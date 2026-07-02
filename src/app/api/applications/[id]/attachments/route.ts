import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { uploadAttachmentToSharePoint, isSharePointConfigured } from '@/lib/graph/sharepoint'
import { writeAuditLog } from '@/lib/audit/logger'

/** 添付一覧 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('application_attachments')
    .select('id, file_name, file_size, mime_type, web_url, provider, sp_item_id, sp_drive_id, created_at, uploaded_by, uploader:employees!uploaded_by(name)')
    .eq('application_id', id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ attachments: data || [] })
}

/** 添付アップロード（SharePoint格納） */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const userId = req.headers.get('x-demo-user-id')
  const supabase = createAdminClient()

  if (!isSharePointConfigured()) {
    return NextResponse.json(
      { error: 'SharePoint が未設定のため添付アップロードは利用できません（管理者に連絡してください）' },
      { status: 503 },
    )
  }

  const { data: app } = await supabase
    .from('applications')
    .select('id, application_number')
    .eq('id', id)
    .maybeSingle()
  if (!app) return NextResponse.json({ error: '申請が見つかりません' }, { status: 404 })

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 })
  }
  const bytes = Buffer.from(await file.arrayBuffer())

  let uploaded
  try {
    uploaded = await uploadAttachmentToSharePoint(bytes, file.name, app.application_number)
  } catch (e) {
    return NextResponse.json({ error: `アップロード失敗: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 })
  }
  if (!uploaded) {
    return NextResponse.json({ error: 'SharePoint未設定' }, { status: 503 })
  }

  const { data: row, error: insErr } = await supabase
    .from('application_attachments')
    .insert({
      application_id: id,
      file_name: file.name,
      file_size: bytes.length,
      mime_type: file.type || 'application/octet-stream',
      storage_path: uploaded.webUrl,
      provider: 'sharepoint',
      web_url: uploaded.webUrl,
      sp_item_id: uploaded.itemId,
      sp_drive_id: uploaded.driveId,
      uploaded_by: userId,
    })
    .select('id, file_name, file_size, mime_type, web_url, provider, sp_item_id, created_at')
    .single()

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  if (userId) {
    await writeAuditLog({
      actorId: userId,
      action: 'attachment.upload',
      targetType: 'application',
      targetId: id,
      metadata: { attachmentId: row.id, fileName: file.name },
    })
  }

  return NextResponse.json({ attachment: row })
}
