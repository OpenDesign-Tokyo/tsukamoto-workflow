import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('employees')
    .update({
      name: body.name,
      name_kana: body.name_kana,
      email: body.email,
      employee_number: body.employee_number,
      is_admin: body.is_admin,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update primary assignment if provided
  if (body.department_id && body.position_id) {
    // Deactivate existing primary
    await supabase
      .from('employee_assignments')
      .update({ is_active: false })
      .eq('employee_id', id)
      .eq('is_primary', true)

    // Create new primary assignment
    await supabase
      .from('employee_assignments')
      .insert({
        employee_id: id,
        department_id: body.department_id,
        position_id: body.position_id,
        is_primary: true,
      })
  }

  return NextResponse.json(data)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()

  // Soft-delete: deactivate
  const { error } = await supabase
    .from('employees')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
