import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('applications')
    .select(`
      *,
      document_type:document_types(*),
      form_template:form_templates(*),
      applicant:employees!applicant_id(*),
      approval_records(
        *,
        approver:employees!approver_id(*)
      )
    `)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sort approval records by step_order
  if (data?.approval_records) {
    data.approval_records.sort((a: { step_order: number }, b: { step_order: number }) => a.step_order - b.step_order)
  }

  return NextResponse.json(data)
}
