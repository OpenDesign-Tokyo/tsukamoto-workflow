import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('employees')
    .select(`
      *,
      assignments:employee_assignments(
        *,
        department:departments(*),
        position:positions(*)
      )
    `)
    .eq('is_active', true)
    .order('employee_number')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('employees')
    .insert({
      name: body.name,
      name_kana: body.name_kana,
      email: body.email,
      employee_number: body.employee_number,
      is_admin: body.is_admin ?? false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If assignment info provided, create assignment
  if (body.department_id && body.position_id) {
    await supabase
      .from('employee_assignments')
      .insert({
        employee_id: data.id,
        department_id: body.department_id,
        position_id: body.position_id,
        is_primary: true,
      })
  }

  return NextResponse.json(data)
}
