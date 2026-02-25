export type ApplicationStatus = 'draft' | 'submitted' | 'in_approval' | 'approved' | 'rejected' | 'withdrawn' | 'archived'

export type ApprovalAction = 'pending' | 'approved' | 'rejected' | 'skipped'

export interface ResolvedApprover {
  employeeId: string
  employeeName: string
  positionName: string
  departmentName: string
  isProxy: boolean
  proxyForId?: string
}

export interface WorkflowSubmitResult {
  success: boolean
  applicationId: string
  applicationNumber: string
  firstApprover?: ResolvedApprover
  error?: string
}

export interface WorkflowApproveResult {
  success: boolean
  nextStep?: {
    stepOrder: number
    stepName: string
    approver: ResolvedApprover
  }
  isCompleted: boolean
  error?: string
}

export interface WorkflowRejectResult {
  success: boolean
  error?: string
}

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft: '下書き',
  submitted: '申請済み',
  in_approval: '承認中',
  approved: '決裁済み',
  rejected: '差戻し',
  withdrawn: '取下げ',
  archived: 'アーカイブ',
}

export const STATUS_COLORS: Record<ApplicationStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  in_approval: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  withdrawn: 'bg-gray-100 text-gray-500',
  archived: 'bg-purple-100 text-purple-700',
}
