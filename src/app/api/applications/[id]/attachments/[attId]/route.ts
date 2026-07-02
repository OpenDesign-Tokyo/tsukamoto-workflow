import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteSharePointItem } from '@/lib/graph/sharepoint'
import { writeAuditLog } from '@/lib/audit/logger'

/** 添付削除（SharePointアイテム＋レコード） */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attId: string }> },
) {
  const { id, attId } = await params
  const userId = req.headers.get('x-demo-user-id')
  const supabase = createAdminClient()

  const { data: att } = await supabase
    .from('application_attachments')
    .select('id, file_name, sp_item_id, sp_drive_id, provider')
    .eq('id', attId)
    .eq('application_id', id)
    .maybeSingle()
  if (!att) return NextResponse.json({ error: '添付が見つかりません' }, { status: 404 })

  if (att.provider === 'sharepoint' && att.sp_drive_id && att.sp_item_id) {
    try {
      await deleteSharePointItem(att.sp_drive_id, att.sp_item_id)
    } catch (e) {
      // SharePoint側の削除失敗はログのみ（DBレコードは削除して不整合を残さない）
      console.warn('[attachments] SharePoint削除失敗:', e)
    }
  }

  const { error } = await supabase.from('application_attachments').delete().eq('id', attId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (userId) {
    await writeAuditLog({
      actorId: userId,
      action: 'attachment.delete',
      targetType: 'application',
      targetId: id,
      metadata: { attachmentId: attId, fileName: att.file_name },
    })
  }
  return NextResponse.json({ ok: true })
}
