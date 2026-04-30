import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveApprovers } from '@/lib/workflow/resolver'

/**
 * GET /api/applications/[id]/next-step-candidates
 * Returns candidates for the next step if it has allow_dynamic_selection=true.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const userId = req.headers.get('x-demo-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Get the application
  const { data: application } = await supabase
    .from('applications')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  // Get the next step definition
  const { data: nextStepDef } = await supabase
    .from('approval_route_steps')
    .select('*')
    .eq('route_template_id', application.route_template_id)
    .gt('step_order', application.current_step)
    .order('step_order')
    .limit(1)
    .maybeSingle()

  if (!nextStepDef || !nextStepDef.allow_dynamic_selection) {
    return NextResponse.json({ needsSelection: false, candidates: [] })
  }

  // Get applicant's department
  const { data: assignment } = await supabase
    .from('employee_assignments')
    .select('department_id')
    .eq('employee_id', application.applicant_id)
    .eq('is_primary', true)
    .eq('is_active', true)
    .maybeSingle()

  if (!assignment) {
    return NextResponse.json({ needsSelection: false, candidates: [] })
  }

  const candidates = await resolveApprovers(nextStepDef, application.applicant_id, assignment.department_id)

  return NextResponse.json({
    needsSelection: true,
    stepName: nextStepDef.name,
    stepOrder: nextStepDef.step_order,
    approvalType: nextStepDef.approval_type,
    candidates: candidates.map(c => ({
      employeeId: c.employeeId,
      employeeName: c.employeeName,
      positionName: c.positionName,
      departmentName: c.departmentName,
    })),
  })
}
