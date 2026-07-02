import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit/logger'

/**
 * 途中編集: 添付を Office for the web で開く直前に呼ばれ、証跡を残す。
 * 実際のファイル内容の版管理は SharePoint のバージョン履歴に委ねる。
 * 返却する editUrl を開くと Office for the web で編集できる。
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attId: string }> },
) {
  const { id, attId } = await params
  const userId = req.headers.get('x-demo-user-id')
  const supabase = createAdminClient()

  const { data: att } = await supabase
    .from('application_attachments')
    .select('id, file_name, web_url, provider')
    .eq('id', attId)
    .eq('application_id', id)
    .maybeSingle()
  if (!att || !att.web_url) {
    return NextResponse.json({ error: '編集可能な添付が見つかりません' }, { status: 404 })
  }

  if (userId) {
    await writeAuditLog({
      actorId: userId,
      action: 'attachment.edit_open',
      targetType: 'application',
      targetId: id,
      metadata: { attachmentId: attId, fileName: att.file_name },
    })
  }

  // Office for the web の編集モードで開く URL
  const editUrl = `${att.web_url}${att.web_url.includes('?') ? '&' : '?'}action=edit`
  return NextResponse.json({ editUrl })
}
