export interface Department {
  id: string
  name: string
  code: string | null
  parent_id: string | null
  level: number
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Position {
  id: string
  name: string
  code: string | null
  rank: number
  is_active: boolean
  created_at: string
}

export interface Employee {
  id: string
  auth_user_id: string | null
  employee_number: string | null
  name: string
  name_kana: string | null
  email: string
  phone_extension: string | null
  avatar_url: string | null
  is_admin: boolean
  is_active: boolean
  joined_at: string | null
  left_at: string | null
  created_at: string
  updated_at: string
}

export interface EmployeeAssignment {
  id: string
  employee_id: string
  department_id: string
  position_id: string
  is_primary: boolean
  is_active: boolean
  started_at: string
  ended_at: string | null
  created_at: string
}

export interface DocumentType {
  id: string
  code: string
  name: string
  category: string
  description: string | null
  icon: string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface FormTemplate {
  id: string
  document_type_id: string
  version: number
  is_current: boolean
  schema: FormSchema
  layout: unknown
  excel_mapping: unknown
  created_at: string
  created_by: string | null
}

export interface FormSchema {
  version: number
  fields: FormField[]
  layout: {
    type: string
    sections: FormSection[]
  }
}

/** 承認ルートに紐付く閲覧者（オブザーバー）。承認権限なし、通知のみ。 */
export interface ApprovalRouteObserver {
  id: string
  route_template_id: string
  employee_id: string
  notify_on: 'submit' | 'each_step' | 'approved' | 'rejected' | 'all'
  created_at: string
  employee?: Employee
}

export interface Vendor {
  id: string
  code: string
  name: string
  name_kana?: string | null
  short_name?: string | null
  address?: string | null
  contact_person?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  payment_terms?: string | null
  credit_limit?: number | null
  category?: string | null
  notes?: string | null
  is_active: boolean
}

/** Vendor attribute keys that a `vendor_select` field can auto-fill into other form fields. */
export type VendorAttrKey =
  | 'code' | 'name' | 'name_kana' | 'short_name'
  | 'address' | 'contact_person' | 'contact_email' | 'contact_phone'
  | 'payment_terms' | 'category'

export interface FormField {
  id: string
  type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'currency' | 'table' | 'formula' | 'file' | 'vendor_select'
  /** For `vendor_select`: when a vendor is picked, populate these other form fields from the vendor record. */
  vendorAutoFill?: { fieldId: string; vendorKey: VendorAttrKey }[]
  /** For `vendor_select`: restrict to specific categories (仕入先 / 外注先 等). */
  vendorCategories?: string[]
  label: string
  required?: boolean
  placeholder?: string
  defaultValue?: string
  rows?: number
  options?: { value: string; label: string }[]
  columns?: TableColumn[]
  minRows?: number
  maxRows?: number
  allowExcelPaste?: boolean
  formula?: string
  width?: string
  templateConfig?: {
    title?: string
    headerFields?: { label: string }[]
    footerFields?: { label: string }[]
    dataRows?: number
    taxNote?: string
    // ── Phase 1.1: business-form aesthetics (X-point Cloud parity) ────
    /** Large centered document title, e.g. "注文書". When set, rendered as a banner row above the table. */
    documentTitle?: string
    /** Company name shown top-right, e.g. "ツカモトコーポレーション". */
    companyName?: string
    /** Reserve a cell for a company logo image (placeholder text only — image embedding handled separately). */
    companyLogoPlaceholder?: boolean
    /** Applicant metadata block: rendered as label/value pairs at the top, e.g. [{ label: "申請番号" }, { label: "申請者" }, { label: "申請部署" }]. */
    metaBlock?: { label: string }[]
    /** Vendor / counterparty info block. When true, renders a 4-row 取引先 box (社名 / 担当者 / 住所 / 電話). */
    vendorBlock?: boolean
    /** Number of approval seal (印鑑) boxes to render — typically 3 for 課長 / 部長 / 事業部長. */
    approvalSeals?: number
  }
}

export interface TableColumn {
  id: string
  type: string
  label: string
  width?: string
  formula?: string
}

export interface FormSection {
  title: string
  fields: string[]
}

export interface RouteCondition {
  amount_field: string
  compute_from?: { table: string; sum_column: string }
  min?: number
  max?: number
}

export interface ApprovalRouteTemplate {
  id: string
  document_type_id: string
  name: string
  description: string | null
  is_default: boolean
  is_active: boolean
  condition: RouteCondition | null
  created_at: string
  updated_at: string
}

export interface ApprovalRouteStep {
  id: string
  route_template_id: string
  step_order: number
  name: string
  assignee_type: 'position_in_department' | 'position_in_parent_department' | 'specific_employee' | 'department_head' | 'applicant_manager'
  assignee_position_id: string | null
  assignee_employee_id: string | null
  approval_type: 'single' | 'all' | 'any'
  allow_dynamic_selection: boolean
  can_skip: boolean
  is_stamp_required: boolean
  created_at: string
}

export interface Application {
  id: string
  application_number: string
  document_type_id: string
  form_template_id: string
  route_template_id: string
  applicant_id: string
  proxy_applicant_id: string | null
  form_data: Record<string, unknown>
  title: string
  status: 'draft' | 'submitted' | 'in_approval' | 'approved' | 'rejected' | 'withdrawn' | 'archived'
  current_step: number
  total_steps: number
  submitted_at: string | null
  approved_at: string | null
  archived_at: string | null
  selected_approvers: Record<string, string[]> | null
  sharepoint_url: string | null
  created_at: string
  updated_at: string
}

export interface ApprovalRecord {
  id: string
  application_id: string
  step_order: number
  step_name: string
  approver_id: string
  is_proxy: boolean
  proxy_for_id: string | null
  action: 'pending' | 'approved' | 'rejected' | 'skipped'
  comment: string | null
  acted_at: string | null
  selected_next_approvers: string[] | null
  teams_notification_sent: boolean
  teams_notification_sent_at: string | null
  created_at: string
}

export interface Notification {
  id: string
  recipient_id: string
  application_id: string | null
  type: 'approval_request' | 'approved' | 'rejected' | 'reminder' | 'withdrawn'
  channel: 'teams' | 'in_app' | 'email'
  title: string
  body: string | null
  action_url: string | null
  is_read: boolean
  sent_at: string
  read_at: string | null
}

export interface ApplicationAttachment {
  id: string
  application_id: string
  file_name: string
  file_size: number
  mime_type: string
  storage_path: string
  uploaded_by: string
  created_at: string
}

export interface ProxySetting {
  id: string
  principal_id: string
  proxy_id: string
  document_type_id: string | null
  valid_from: string
  valid_until: string
  is_active: boolean
  created_at: string
}

// Extended types with joins
export interface EmployeeWithAssignment extends Employee {
  assignment?: EmployeeAssignment & {
    department: Department
    position: Position
  }
}

export interface ApplicationWithDetails extends Application {
  document_type: DocumentType
  applicant: Employee
  proxy_applicant?: Employee | null
  approval_records: (ApprovalRecord & { approver: Employee })[]
}
