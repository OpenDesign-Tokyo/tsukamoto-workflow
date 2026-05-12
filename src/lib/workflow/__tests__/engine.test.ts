import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createFakeSupabase, type FakeSupabaseClient, type Row } from './_fake-supabase'

// ──────────────── Module mocks ────────────────
let fakeSupabase: FakeSupabaseClient

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => fakeSupabase,
}))

const notifySpy = vi.fn()
vi.mock('../notifications', () => ({
  sendWorkflowNotification: (...args: unknown[]) => notifySpy(...args),
}))

const resolverSpy = vi.fn()
const resolversSpy = vi.fn()
vi.mock('../resolver', () => ({
  resolveApprover: (...args: unknown[]) => resolverSpy(...args),
  resolveApprovers: (...args: unknown[]) => resolversSpy(...args),
}))

// Import AFTER mocks
import { submitApplication, approveApplication, rejectApplication } from '../engine'

// ──────────────── Test helpers ────────────────
function seedBaseApp(overrides: Partial<Row> = {}): Row {
  return {
    id: 'app-1',
    application_number: 'APP-001',
    title: 'テスト申請',
    applicant_id: 'emp-applicant',
    route_template_id: 'route-1',
    current_step: 1,
    total_steps: 2,
    status: 'in_approval',
    applicant: { name: '申請者太郎', is_admin: false },
    document_type: { name: 'T08' },
    ...overrides,
  }
}

const approver1 = {
  employeeId: 'emp-mgr', employeeName: '課長', positionName: '課長',
  departmentName: '営業部', isProxy: false,
}
const approver2 = {
  employeeId: 'emp-dir', employeeName: '部長', positionName: '部長',
  departmentName: '営業部', isProxy: false,
}

beforeEach(() => {
  notifySpy.mockClear()
  resolverSpy.mockReset()
  resolversSpy.mockReset()
})

// ─────────────────────── submitApplication ───────────────────────
describe('submitApplication', () => {
  it('管理者の自己申請: 1ステップで自己承認レコード作成', async () => {
    fakeSupabase = createFakeSupabase({
      applications: [seedBaseApp({
        applicant: { name: '管理者', is_admin: true },
      })],
      approval_records: [],
      approval_route_steps: [],
      employee_assignments: [],
    })

    const result = await submitApplication('app-1')

    expect(result.success).toBe(true)
    expect(result.applicationNumber).toBe('APP-001')

    const app = fakeSupabase._store.applications[0]
    expect(app.status).toBe('in_approval')
    expect(app.current_step).toBe(1)
    expect(app.total_steps).toBe(1)

    expect(fakeSupabase._store.approval_records).toHaveLength(1)
    expect(fakeSupabase._store.approval_records[0].approver_id).toBe('emp-applicant')
    expect(notifySpy).toHaveBeenCalledTimes(1)
  })

  it('通常申請: 1ステップ目の承認者を解決して通知', async () => {
    fakeSupabase = createFakeSupabase({
      applications: [seedBaseApp({ status: 'draft' })],
      approval_records: [],
      approval_route_steps: [
        { id: 's1', route_template_id: 'route-1', step_order: 1, name: '課長承認', approval_type: 'single', assignee_type: 'position_in_department' },
        { id: 's2', route_template_id: 'route-1', step_order: 2, name: '部長承認', approval_type: 'single', assignee_type: 'position_in_department' },
      ],
      employee_assignments: [
        { employee_id: 'emp-applicant', department_id: 'dept-1', is_primary: true, is_active: true },
      ],
    })
    resolverSpy.mockResolvedValueOnce(approver1)

    const result = await submitApplication('app-1')

    expect(result.success).toBe(true)
    expect(result.firstApprover?.employeeId).toBe('emp-mgr')
    expect(fakeSupabase._store.approval_records).toHaveLength(1)
    expect(fakeSupabase._store.approval_records[0].step_order).toBe(1)
    expect(fakeSupabase._store.approval_records[0].action).toBe('pending')
  })

  it('承認者が解決できないステップは自動スキップ', async () => {
    fakeSupabase = createFakeSupabase({
      applications: [seedBaseApp({ status: 'draft' })],
      approval_records: [],
      approval_route_steps: [
        { id: 's1', route_template_id: 'route-1', step_order: 1, name: '課長承認', approval_type: 'single', assignee_type: 'position_in_department' },
        { id: 's2', route_template_id: 'route-1', step_order: 2, name: '部長承認', approval_type: 'single', assignee_type: 'position_in_department' },
      ],
      employee_assignments: [
        { employee_id: 'emp-applicant', department_id: 'dept-1', is_primary: true, is_active: true },
      ],
    })
    // step1 returns null (unresolvable), step2 resolves
    resolverSpy.mockResolvedValueOnce(null).mockResolvedValueOnce(approver2)

    const result = await submitApplication('app-1')

    expect(result.success).toBe(true)
    const records = fakeSupabase._store.approval_records
    expect(records.some(r => r.step_order === 1 && r.action === 'skipped')).toBe(true)
    expect(records.some(r => r.step_order === 2 && r.action === 'pending')).toBe(true)
  })
})

// ─────────────────────── approveApplication ───────────────────────
describe('approveApplication', () => {
  it('single 承認・最終ステップ: 申請を approved に更新', async () => {
    fakeSupabase = createFakeSupabase({
      applications: [seedBaseApp({ current_step: 2, total_steps: 2 })],
      approval_records: [
        { application_id: 'app-1', step_order: 2, approver_id: 'emp-dir', action: 'pending' },
      ],
      approval_route_steps: [
        { route_template_id: 'route-1', step_order: 2, approval_type: 'single' },
      ],
      employee_assignments: [
        { employee_id: 'emp-applicant', department_id: 'dept-1', is_primary: true, is_active: true },
      ],
    })

    const result = await approveApplication('app-1', 'emp-dir', 'OK')

    expect(result.success).toBe(true)
    expect(result.isCompleted).toBe(true)
    const app = fakeSupabase._store.applications[0]
    expect(app.status).toBe('approved')
    expect(app.approved_at).toBeTruthy()

    const rec = fakeSupabase._store.approval_records[0]
    expect(rec.action).toBe('approved')
    expect(rec.comment).toBe('OK')

    // notification to applicant
    expect(notifySpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'approved' }))
  })

  it('single 承認・中間ステップ: 次のステップへ進行', async () => {
    fakeSupabase = createFakeSupabase({
      applications: [seedBaseApp({ current_step: 1, total_steps: 2 })],
      approval_records: [
        { application_id: 'app-1', step_order: 1, approver_id: 'emp-mgr', action: 'pending' },
      ],
      approval_route_steps: [
        { route_template_id: 'route-1', step_order: 1, approval_type: 'single' },
        { route_template_id: 'route-1', step_order: 2, approval_type: 'single', name: '部長承認' },
      ],
      employee_assignments: [
        { employee_id: 'emp-applicant', department_id: 'dept-1', is_primary: true, is_active: true },
      ],
    })
    resolverSpy.mockResolvedValueOnce(approver2)

    const result = await approveApplication('app-1', 'emp-mgr')

    expect(result.success).toBe(true)
    expect(result.isCompleted).toBe(false)
    expect(result.nextStep?.approver.employeeId).toBe('emp-dir')

    const app = fakeSupabase._store.applications[0]
    expect(app.current_step).toBe(2)
    expect(app.status).toBe('in_approval')

    // approval_request notification to next approver
    expect(notifySpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'approval_request' }))
  })

  it('AND 合議: 全員承認まで待機', async () => {
    fakeSupabase = createFakeSupabase({
      applications: [seedBaseApp({ current_step: 1, total_steps: 1 })],
      approval_records: [
        { application_id: 'app-1', step_order: 1, approver_id: 'emp-mgr', action: 'pending' },
        { application_id: 'app-1', step_order: 1, approver_id: 'emp-dir', action: 'pending' },
      ],
      approval_route_steps: [
        { route_template_id: 'route-1', step_order: 1, approval_type: 'all' },
      ],
      employee_assignments: [],
    })

    const result = await approveApplication('app-1', 'emp-mgr')

    expect(result.success).toBe(true)
    expect(result.waitingForOthers).toBe(true)
    expect(result.isCompleted).toBe(false)

    // application status should NOT be approved yet
    const app = fakeSupabase._store.applications[0]
    expect(app.status).not.toBe('approved')
  })

  it('OR 承認: 他のpendingレコードを skipped に更新', async () => {
    fakeSupabase = createFakeSupabase({
      applications: [seedBaseApp({ current_step: 1, total_steps: 1 })],
      approval_records: [
        { application_id: 'app-1', step_order: 1, approver_id: 'emp-mgr', action: 'pending' },
        { application_id: 'app-1', step_order: 1, approver_id: 'emp-dir', action: 'pending' },
      ],
      approval_route_steps: [
        { route_template_id: 'route-1', step_order: 1, approval_type: 'any' },
      ],
      employee_assignments: [
        { employee_id: 'emp-applicant', department_id: 'dept-1', is_primary: true, is_active: true },
      ],
    })

    const result = await approveApplication('app-1', 'emp-mgr')

    expect(result.success).toBe(true)
    expect(result.isCompleted).toBe(true)

    const records = fakeSupabase._store.approval_records
    const approver = records.find(r => r.approver_id === 'emp-mgr')
    const skipped = records.find(r => r.approver_id === 'emp-dir')
    expect(approver?.action).toBe('approved')
    expect(skipped?.action).toBe('skipped')
    expect(skipped?.comment).toBe('他の承認者が承認済み')
  })
})

// ─────────────────────── rejectApplication ───────────────────────
describe('rejectApplication', () => {
  it('差戻し: 他のpending を skipped に更新、申請者へ通知', async () => {
    fakeSupabase = createFakeSupabase({
      applications: [seedBaseApp({ current_step: 1, total_steps: 2 })],
      approval_records: [
        { application_id: 'app-1', step_order: 1, approver_id: 'emp-mgr', action: 'pending' },
        { application_id: 'app-1', step_order: 1, approver_id: 'emp-other', action: 'pending' },
      ],
    })

    const result = await rejectApplication('app-1', 'emp-mgr', '金額再確認をお願いします')

    expect(result.success).toBe(true)

    const records = fakeSupabase._store.approval_records
    const rejector = records.find(r => r.approver_id === 'emp-mgr')
    const skipped = records.find(r => r.approver_id === 'emp-other')
    expect(rejector?.action).toBe('rejected')
    expect(rejector?.comment).toBe('金額再確認をお願いします')
    expect(skipped?.action).toBe('skipped')

    const app = fakeSupabase._store.applications[0]
    expect(app.status).toBe('rejected')

    expect(notifySpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'rejected',
      recipientId: 'emp-applicant',
    }))
  })

  it('差戻し: 申請が存在しない場合はエラー', async () => {
    fakeSupabase = createFakeSupabase({ applications: [] })

    const result = await rejectApplication('missing-app', 'emp-mgr', 'NG')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Application not found')
  })
})
