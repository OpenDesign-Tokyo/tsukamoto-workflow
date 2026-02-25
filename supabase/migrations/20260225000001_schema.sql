-- ============================================
-- 組織管理
-- ============================================

CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  parent_id UUID REFERENCES departments(id),
  level INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  rank INT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE,
  employee_number TEXT UNIQUE,
  name TEXT NOT NULL,
  name_kana TEXT,
  email TEXT NOT NULL UNIQUE,
  phone_extension TEXT,
  avatar_url TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  joined_at DATE,
  left_at DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE employee_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id),
  position_id UUID NOT NULL REFERENCES positions(id),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  started_at DATE NOT NULL DEFAULT CURRENT_DATE,
  ended_at DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, department_id, position_id)
);

CREATE TABLE proxy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id UUID NOT NULL REFERENCES employees(id),
  proxy_id UUID NOT NULL REFERENCES employees(id),
  document_type_id UUID,
  valid_from DATE NOT NULL,
  valid_until DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (valid_from <= valid_until),
  CHECK (principal_id != proxy_id)
);

-- ============================================
-- 書類・フォーム
-- ============================================

CREATE TABLE document_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'file-text',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type_id UUID NOT NULL REFERENCES document_types(id),
  version INT NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT true,
  schema JSONB NOT NULL,
  layout JSONB,
  excel_mapping JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES employees(id),
  UNIQUE(document_type_id, version)
);

-- ============================================
-- 承認ルート
-- ============================================

CREATE TABLE approval_route_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type_id UUID NOT NULL REFERENCES document_types(id),
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  condition JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE approval_route_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_template_id UUID NOT NULL REFERENCES approval_route_templates(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  name TEXT NOT NULL,
  assignee_type TEXT NOT NULL CHECK (assignee_type IN (
    'position_in_department',
    'position_in_parent_department',
    'specific_employee',
    'department_head',
    'applicant_manager'
  )),
  assignee_position_id UUID REFERENCES positions(id),
  assignee_employee_id UUID REFERENCES employees(id),
  approval_type TEXT NOT NULL DEFAULT 'single' CHECK (approval_type IN ('single', 'all', 'any')),
  can_skip BOOLEAN NOT NULL DEFAULT false,
  is_stamp_required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(route_template_id, step_order)
);

-- ============================================
-- 申請・承認
-- ============================================

CREATE SEQUENCE IF NOT EXISTS application_number_seq START WITH 1;

CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_number TEXT NOT NULL UNIQUE DEFAULT 'APP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('application_number_seq')::text, 5, '0'),
  document_type_id UUID NOT NULL REFERENCES document_types(id),
  form_template_id UUID NOT NULL REFERENCES form_templates(id),
  route_template_id UUID NOT NULL REFERENCES approval_route_templates(id),
  applicant_id UUID NOT NULL REFERENCES employees(id),
  proxy_applicant_id UUID REFERENCES employees(id),
  form_data JSONB NOT NULL DEFAULT '{}',
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'submitted', 'in_approval', 'approved', 'rejected', 'withdrawn', 'archived'
  )),
  current_step INT NOT NULL DEFAULT 0,
  total_steps INT NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  sharepoint_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE approval_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  step_name TEXT NOT NULL,
  approver_id UUID NOT NULL REFERENCES employees(id),
  is_proxy BOOLEAN NOT NULL DEFAULT false,
  proxy_for_id UUID REFERENCES employees(id),
  action TEXT NOT NULL DEFAULT 'pending' CHECK (action IN ('pending', 'approved', 'rejected', 'skipped')),
  comment TEXT,
  acted_at TIMESTAMPTZ,
  teams_notification_sent BOOLEAN DEFAULT false,
  teams_notification_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(application_id, step_order, approver_id)
);

CREATE TABLE application_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES employees(id),
  application_id UUID REFERENCES applications(id),
  type TEXT NOT NULL CHECK (type IN (
    'approval_request', 'approved', 'rejected', 'reminder', 'withdrawn'
  )),
  channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('teams', 'in_app', 'email')),
  title TEXT NOT NULL,
  body TEXT,
  action_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES employees(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- インデックス
-- ============================================
CREATE INDEX idx_emp_assignments_employee ON employee_assignments(employee_id) WHERE is_active = true;
CREATE INDEX idx_emp_assignments_dept ON employee_assignments(department_id) WHERE is_active = true;
CREATE INDEX idx_applications_applicant ON applications(applicant_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_approval_records_app ON approval_records(application_id);
CREATE INDEX idx_approval_records_approver ON approval_records(approver_id) WHERE action = 'pending';
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id) WHERE is_read = false;

-- ============================================
-- RLS
-- ============================================
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_route_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_route_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE proxy_settings ENABLE ROW LEVEL SECURITY;

-- デモ用: 全テーブル全操作許可（本番ではRLS厳格化する）
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (true) WITH CHECK (true)', 'allow_all_' || t, t);
  END LOOP;
END
$$;
