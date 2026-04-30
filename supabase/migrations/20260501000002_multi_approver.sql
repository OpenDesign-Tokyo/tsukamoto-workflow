-- Multi-approver support: allow_dynamic_selection on steps,
-- selected_approvers on applications, selected_next_approvers on approval_records.

-- Dynamic selection flag: when true, the previous step's approver can choose
-- who should handle this step (used with approval_type='all').
ALTER TABLE approval_route_steps
  ADD COLUMN IF NOT EXISTS allow_dynamic_selection BOOLEAN NOT NULL DEFAULT false;

-- Store the applicant's choice of approvers at submission time.
-- Format: { "<step_order>": ["employee_id_1", ...] }
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS selected_approvers JSONB;

-- Store the approver's choice of next-step approvers (dynamic selection).
-- Format: ["employee_id_1", ...]
ALTER TABLE approval_records
  ADD COLUMN IF NOT EXISTS selected_next_approvers JSONB;
