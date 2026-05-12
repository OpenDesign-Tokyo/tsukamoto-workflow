-- ─────────────────────────────────────────────────────────────────────────────
-- DRAFT: Strict RLS policies for production hardening
-- ─────────────────────────────────────────────────────────────────────────────
-- Status: NOT yet applied. This file exists as a starting point for Phase 0.5
-- (see docs/IMPLEMENTATION_ROADMAP.md). Apply only after:
--   1. `X-Demo-User-Id` header auth is replaced by Entra ID JWT
--      (auth.uid() will then resolve to the real authenticated employee).
--   2. The application is updated to query through the `authenticated` role,
--      not the service-role key, for end-user requests.
--   3. Staging environment verifies that every existing screen still loads
--      under these policies.
--
-- Design principles:
--   • Employees can only read data scoped to them (own applications, assigned
--     approvals, notifications addressed to them).
--   • Admins (employees.is_admin = true) can read everything.
--   • All writes go through API routes that use the service-role key (which
--     bypasses RLS); regular clients can only INSERT through their own paths.
--   • Reference data (departments, positions, document_types, form_templates,
--     approval_route_templates / _steps) is readable by all authenticated users
--     and writable only by admins.
-- ─────────────────────────────────────────────────────────────────────────────

-- Re-grant baseline access (service role still bypasses RLS).
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- ─── Helper functions ────────────────────────────────────────────────────────
-- The current authenticated employee's primary key in the public.employees table.
-- Assumes employees.auth_user_id is populated from Supabase Auth on first login.
CREATE OR REPLACE FUNCTION public.current_employee_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM public.employees WHERE auth_user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_current_employee_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE((SELECT is_admin FROM public.employees WHERE auth_user_id = auth.uid() LIMIT 1), false)
$$;

-- ─── Enable RLS on all tables ────────────────────────────────────────────────
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_route_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_route_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proxy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ─── Drop any existing allow-all policies ────────────────────────────────────
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- ─── Reference data: readable by all authenticated, writable by admin only ──
CREATE POLICY ref_read_employees ON public.employees
  FOR SELECT TO authenticated USING (true);
CREATE POLICY ref_write_employees ON public.employees
  FOR ALL TO authenticated USING (is_current_employee_admin()) WITH CHECK (is_current_employee_admin());

CREATE POLICY ref_read_assignments ON public.employee_assignments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY ref_write_assignments ON public.employee_assignments
  FOR ALL TO authenticated USING (is_current_employee_admin()) WITH CHECK (is_current_employee_admin());

CREATE POLICY ref_read_departments ON public.departments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY ref_write_departments ON public.departments
  FOR ALL TO authenticated USING (is_current_employee_admin()) WITH CHECK (is_current_employee_admin());

CREATE POLICY ref_read_positions ON public.positions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY ref_write_positions ON public.positions
  FOR ALL TO authenticated USING (is_current_employee_admin()) WITH CHECK (is_current_employee_admin());

CREATE POLICY ref_read_document_types ON public.document_types
  FOR SELECT TO authenticated USING (true);
CREATE POLICY ref_write_document_types ON public.document_types
  FOR ALL TO authenticated USING (is_current_employee_admin()) WITH CHECK (is_current_employee_admin());

CREATE POLICY ref_read_form_templates ON public.form_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY ref_write_form_templates ON public.form_templates
  FOR ALL TO authenticated USING (is_current_employee_admin()) WITH CHECK (is_current_employee_admin());

CREATE POLICY ref_read_route_templates ON public.approval_route_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY ref_write_route_templates ON public.approval_route_templates
  FOR ALL TO authenticated USING (is_current_employee_admin()) WITH CHECK (is_current_employee_admin());

CREATE POLICY ref_read_route_steps ON public.approval_route_steps
  FOR SELECT TO authenticated USING (true);
CREATE POLICY ref_write_route_steps ON public.approval_route_steps
  FOR ALL TO authenticated USING (is_current_employee_admin()) WITH CHECK (is_current_employee_admin());

-- ─── Applications: applicant, proxy applicant, current approver, admin ──────
CREATE POLICY apps_select ON public.applications FOR SELECT TO authenticated
  USING (
    is_current_employee_admin()
    OR applicant_id = current_employee_id()
    OR proxy_applicant_id = current_employee_id()
    OR EXISTS (
      SELECT 1 FROM public.approval_records r
      WHERE r.application_id = applications.id AND r.approver_id = current_employee_id()
    )
  );

CREATE POLICY apps_insert ON public.applications FOR INSERT TO authenticated
  WITH CHECK (applicant_id = current_employee_id() OR proxy_applicant_id = current_employee_id());

CREATE POLICY apps_update ON public.applications FOR UPDATE TO authenticated
  USING (
    is_current_employee_admin()
    OR applicant_id = current_employee_id()
    OR proxy_applicant_id = current_employee_id()
  );

-- ─── Approval records: approver, applicant, admin ───────────────────────────
CREATE POLICY recs_select ON public.approval_records FOR SELECT TO authenticated
  USING (
    is_current_employee_admin()
    OR approver_id = current_employee_id()
    OR EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = approval_records.application_id
        AND (a.applicant_id = current_employee_id() OR a.proxy_applicant_id = current_employee_id())
    )
  );

CREATE POLICY recs_update ON public.approval_records FOR UPDATE TO authenticated
  USING (approver_id = current_employee_id() OR is_current_employee_admin());

-- ─── Notifications: recipient only ──────────────────────────────────────────
CREATE POLICY notif_select ON public.notifications FOR SELECT TO authenticated
  USING (recipient_id = current_employee_id() OR is_current_employee_admin());

CREATE POLICY notif_update ON public.notifications FOR UPDATE TO authenticated
  USING (recipient_id = current_employee_id());

-- ─── Comments: people who can see the parent application ────────────────────
CREATE POLICY comm_select ON public.application_comments FOR SELECT TO authenticated
  USING (
    is_current_employee_admin()
    OR EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_comments.application_id
        AND (
          a.applicant_id = current_employee_id()
          OR a.proxy_applicant_id = current_employee_id()
          OR EXISTS (SELECT 1 FROM public.approval_records r WHERE r.application_id = a.id AND r.approver_id = current_employee_id())
        )
    )
  );

CREATE POLICY comm_insert ON public.application_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = current_employee_id());

-- ─── Attachments: same as comments ──────────────────────────────────────────
CREATE POLICY att_select ON public.application_attachments FOR SELECT TO authenticated
  USING (
    is_current_employee_admin()
    OR EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_attachments.application_id
        AND (
          a.applicant_id = current_employee_id()
          OR a.proxy_applicant_id = current_employee_id()
          OR EXISTS (SELECT 1 FROM public.approval_records r WHERE r.application_id = a.id AND r.approver_id = current_employee_id())
        )
    )
  );

CREATE POLICY att_insert ON public.application_attachments FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = current_employee_id());

-- ─── Proxy settings: principal, proxy, admin ────────────────────────────────
CREATE POLICY proxy_select ON public.proxy_settings FOR SELECT TO authenticated
  USING (
    is_current_employee_admin()
    OR principal_id = current_employee_id()
    OR proxy_id = current_employee_id()
  );

CREATE POLICY proxy_write ON public.proxy_settings FOR ALL TO authenticated
  USING (is_current_employee_admin()) WITH CHECK (is_current_employee_admin());

-- ─── Audit logs: admin read only ────────────────────────────────────────────
CREATE POLICY audit_read ON public.audit_logs FOR SELECT TO authenticated
  USING (is_current_employee_admin());
-- (Inserts always come via service-role key from the server.)

-- ─── Revoke broad grants from anon (Phase 0.4 will remove anon entirely) ────
-- Keep this commented until SSO migration completes so existing demo login
-- (which currently uses anon key) keeps working.
-- REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
-- REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
