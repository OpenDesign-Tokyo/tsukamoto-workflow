-- ─────────────────────────────────────────────────────────────────────────────
-- DRAFT: Postgres RPC functions for atomic workflow operations
-- ─────────────────────────────────────────────────────────────────────────────
-- Status: NOT yet applied. Apply during Phase 0.1 (see IMPLEMENTATION_ROADMAP.md).
--
-- Why this exists:
--   engine.ts currently issues a sequence of independent SUPABASE queries
--   (insert approval_records → update applications → ...). If any one fails or
--   the request is interrupted, the application is left in a half-committed
--   state. Postgres function bodies run in a single implicit transaction, so
--   moving the multi-table writes into RPCs gives us true atomicity.
--
-- Design:
--   The TypeScript resolver still pre-computes who the approvers are
--   (resolveApprovers / advanceToNextStep). The resolver output is passed to
--   these RPCs as a JSONB array, and the RPCs perform the actual writes.
--
--   Switchover plan (when applying):
--     1. Apply this migration in staging.
--     2. Add a feature flag (env var WORKFLOW_USE_RPC=1) to engine.ts so it
--        calls supabase.rpc('activate_application_step', ...) instead of the
--        chained insert/update calls. Keep the legacy path as fallback for
--        one release.
--     3. Verify the existing 22 engine.test.ts tests still pass (extend
--        the fake to mock .rpc()).
--     4. Run a side-by-side comparison in staging with both code paths.
--     5. Remove the legacy path once stable.
-- ─────────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- 1. activate_application_step
-- ============================================================================
-- Used by both submit and advance-to-next-step.
-- Creates approval_records for the supplied approvers AND updates the parent
-- application's status / current_step / total_steps / submitted_at in one tx.
--
-- p_approvers JSON shape:
--   [{ "approver_id": "<uuid>", "is_proxy": false, "proxy_for_id": null }, ...]
--
-- Returns:
--   { "records_inserted": <int> }
-- ============================================================================
CREATE OR REPLACE FUNCTION public.activate_application_step(
  p_application_id  uuid,
  p_step_order      int,
  p_step_name       text,
  p_approvers       jsonb,
  p_set_status      text    DEFAULT NULL,    -- e.g. 'in_approval'
  p_set_current_step int    DEFAULT NULL,
  p_set_total_steps int     DEFAULT NULL,
  p_set_submitted_at boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted int;
BEGIN
  -- Insert one approval_record per approver in the array.
  INSERT INTO approval_records (
    application_id, step_order, step_name, approver_id, is_proxy, proxy_for_id, action
  )
  SELECT
    p_application_id,
    p_step_order,
    p_step_name,
    (a->>'approver_id')::uuid,
    COALESCE((a->>'is_proxy')::boolean, false),
    NULLIF(a->>'proxy_for_id', '')::uuid,
    'pending'
  FROM jsonb_array_elements(p_approvers) AS a
  WHERE a ? 'approver_id';

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Optionally update parent application atomically with the same transaction.
  UPDATE applications SET
    status        = COALESCE(p_set_status, status),
    current_step  = COALESCE(p_set_current_step, current_step),
    total_steps   = COALESCE(p_set_total_steps, total_steps),
    submitted_at  = CASE WHEN p_set_submitted_at AND submitted_at IS NULL THEN now() ELSE submitted_at END,
    updated_at    = now()
  WHERE id = p_application_id;

  RETURN jsonb_build_object('records_inserted', v_inserted);
END
$$;

-- ============================================================================
-- 2. record_step_skipped
-- ============================================================================
-- Records a "no approver could be resolved" skip for the given step.
-- Used both during initial submit (first resolvable step search) and during
-- approve-and-advance.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_step_skipped(
  p_application_id uuid,
  p_step_order     int,
  p_step_name      text,
  p_actor_id       uuid,
  p_reason         text DEFAULT '該当承認者不在のためスキップ'
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO approval_records (
    application_id, step_order, step_name, approver_id, is_proxy, action, comment, acted_at
  ) VALUES (
    p_application_id, p_step_order, p_step_name, p_actor_id, false, 'skipped', p_reason, now()
  );
$$;

-- ============================================================================
-- 3. approve_application_step
-- ============================================================================
-- Marks the supplied approver's pending record as approved, and based on
-- approval_type either:
--   - 'single': returns (status: 'advance')
--   - 'all':    if other pendings remain → (status: 'waiting'); else → 'advance'
--   - 'any':    skips remaining pendings on the same step, returns 'advance'
--
-- The caller (engine.ts) interprets 'advance' and then either calls
-- activate_application_step for the next step or finalize_application.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.approve_application_step(
  p_application_id        uuid,
  p_approver_id           uuid,
  p_step_order            int,
  p_approval_type         text,   -- 'single' | 'all' | 'any'
  p_comment               text DEFAULT NULL,
  p_selected_next         jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending_count int;
BEGIN
  -- 1. Mark this approver's pending record as approved.
  UPDATE approval_records SET
    action = 'approved',
    comment = COALESCE(p_comment, comment),
    selected_next_approvers = COALESCE(p_selected_next, selected_next_approvers),
    acted_at = now()
  WHERE application_id = p_application_id
    AND step_order     = p_step_order
    AND approver_id    = p_approver_id
    AND action         = 'pending';

  -- 2. Branch by approval_type.
  IF p_approval_type = 'all' THEN
    SELECT count(*) INTO v_pending_count
    FROM approval_records
    WHERE application_id = p_application_id
      AND step_order = p_step_order
      AND action = 'pending';

    IF v_pending_count > 0 THEN
      RETURN jsonb_build_object('status', 'waiting', 'pending_remaining', v_pending_count);
    END IF;
  ELSIF p_approval_type = 'any' THEN
    -- Auto-skip remaining pendings on the same step.
    UPDATE approval_records SET
      action = 'skipped',
      comment = '他の承認者が承認済み',
      acted_at = now()
    WHERE application_id = p_application_id
      AND step_order = p_step_order
      AND action = 'pending';
  END IF;

  RETURN jsonb_build_object('status', 'advance');
END
$$;

-- ============================================================================
-- 4. reject_application
-- ============================================================================
-- Marks the supplied approver's pending record as rejected, skips remaining
-- pendings on the same step (since the application is now dead), and sets the
-- application status to 'rejected'. All three in one transaction.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reject_application(
  p_application_id uuid,
  p_approver_id    uuid,
  p_step_order     int,
  p_comment        text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_comment IS NULL OR length(trim(p_comment)) = 0 THEN
    RAISE EXCEPTION 'rejection comment is required';
  END IF;

  -- 1. Mark this approver's record as rejected.
  UPDATE approval_records SET
    action = 'rejected',
    comment = p_comment,
    acted_at = now()
  WHERE application_id = p_application_id
    AND step_order = p_step_order
    AND approver_id = p_approver_id
    AND action = 'pending';

  -- 2. Auto-skip remaining pendings on the same step.
  UPDATE approval_records SET
    action = 'skipped',
    comment = '他の承認者が差戻し',
    acted_at = now()
  WHERE application_id = p_application_id
    AND step_order = p_step_order
    AND action = 'pending';

  -- 3. Set application status to rejected.
  UPDATE applications SET
    status = 'rejected',
    updated_at = now()
  WHERE id = p_application_id;
END
$$;

-- ============================================================================
-- 5. finalize_application
-- ============================================================================
-- Sets the application to 'approved' with approved_at = now(). One liner today
-- but kept as an RPC so the caller doesn't need to chain multiple updates if
-- we add archiving / SharePoint sync inside the same transaction later.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.finalize_application(
  p_application_id uuid
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE applications SET
    status      = 'approved',
    approved_at = now(),
    updated_at  = now()
  WHERE id = p_application_id;
$$;

-- ============================================================================
-- 6. withdraw_application
-- ============================================================================
-- Atomically marks an application as withdrawn and skips all pending records.
-- Only callable if requester is the applicant or the proxy applicant; that
-- authorization check stays in the API route (since auth context lives there).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.withdraw_application(
  p_application_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE approval_records SET
    action = 'skipped',
    comment = '取下げにより自動スキップ',
    acted_at = now()
  WHERE application_id = p_application_id
    AND action = 'pending';

  UPDATE applications SET
    status = 'withdrawn',
    updated_at = now()
  WHERE id = p_application_id;
END
$$;

-- ─── Grants (service role bypasses, but explicit grants help for direct test) ─
GRANT EXECUTE ON FUNCTION public.activate_application_step(uuid, int, text, jsonb, text, int, int, boolean) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.record_step_skipped(uuid, int, text, uuid, text) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_application_step(uuid, uuid, int, text, text, jsonb) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_application(uuid, uuid, int, text) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_application(uuid) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_application(uuid) TO service_role, authenticated;
