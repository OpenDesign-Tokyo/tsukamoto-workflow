import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('document_types')
    .select('id, name, code, category')
    .eq('is_active', true)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()

  const { name, code, category } = body
  if (!name || !code || !category) {
    return NextResponse.json({ error: '名前、コード、カテゴリは必須です' }, { status: 400 })
  }

  // Check for duplicate code
  const { data: existing } = await supabase
    .from('document_types')
    .select('id')
    .eq('code', code)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: `コード「${code}」は既に使用されています` }, { status: 400 })
  }

  // Get max sort_order
  const { data: maxRow } = await supabase
    .from('document_types')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (maxRow?.sort_order ?? 0) + 1

  const { data, error } = await supabase
    .from('document_types')
    .insert({
      name,
      code,
      category,
      sort_order: nextOrder,
      is_active: true,
    })
    .select('id, name, code, category')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
