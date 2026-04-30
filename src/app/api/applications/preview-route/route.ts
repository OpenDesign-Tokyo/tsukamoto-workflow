import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveApprovers } from '@/lib/workflow/resolver'
import type { ApprovalRouteStep } from '@/lib/types/database'

/**
 * POST /api/applications/preview-route
 * Body: { document_type_id, applicant_id }
 * Returns: Array of steps with their candidates
 */
export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-demo-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 401 })
  }

  const body = await req.json()
  const { document_type_id, applicant_id } = body

  if (!document_type_id) {
    return NextResponse.json({ error: 'document_type_id required' }, { status: 400 })
  }

  const effectiveApplicantId = applicant_id || userId
  const supabase = createAdminClient()

  // Find the default route for this document type
  const { data: route } = await supabase
    .from('approval_route_templates')
    .select('*, steps:approval_route_steps(*)')
    .eq('document_type_id', document_type_id)
    .eq('is_active', true)
    .eq('is_default', true)
    .maybeSingle()

  if (!route) {
    return NextResponse.json({ error: 'No approval route found' }, { status: 404 })
  }

  // Get applicant's primary department
  const { data: assignment } = await supabase
    .from('employee_assignments')
    .select('department_id')
    .eq('employee_id', effectiveApplicantId)
    .eq('is_primary', true)
    .eq('is_active', true)
    .maybeSingle()

  if (!assignment) {
    return NextResponse.json({ error: 'Applicant has no department' }, { status: 400 })
  }

  // Sort steps by step_order
  const steps = (route.steps as ApprovalRouteStep[])
    .sort((a, b) => a.step_order - b.step_order)

  // Resolve candidates for each step
  const result = await Promise.all(
    steps.map(async (step) => {
      const candidates = await resolveApprovers(step, effectiveApplicantId, assignment.department_id)
      return {
        step_order: step.step_order,
        name: step.name,
        approval_type: step.approval_type || 'single',
        allow_dynamic_selection: step.allow_dynamic_selection || false,
        candidates: candidates.map(c => ({
          employeeId: c.employeeId,
          employeeName: c.employeeName,
          positionName: c.positionName,
          departmentName: c.departmentName,
        })),
      }
    })
  )

  return NextResponse.json(result)
}
