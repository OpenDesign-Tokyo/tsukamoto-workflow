/**
 * 承認完了時の SharePoint 自動アーカイブ オーケストレータ。
 *
 * engine.ts の finalApprove から「fire-and-forget」で呼ばれ、以下を行う:
 *   1. 申請の最新データ + 使用フォームテンプレートを取得
 *   2. サーバーサイドで PDF を生成 (exportPdfServer.ts)
 *   3. SharePoint の `document_type.name` フォルダにアップロード
 *   4. メタデータ（申請番号 / 申請者 / 承認者 / 申請日 / 承認完了日）を設定
 *   5. `applications.sharepoint_url` に webUrl を保存
 *   6. 監査ログ記録
 *
 * 失敗してもエンジン本体には影響させない（アーカイブ失敗 = 申請承認の失敗ではない）。
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { archivePdfToSharePoint, isSharePointConfigured, type ArchiveMetadata } from '@/lib/graph/sharepoint'
import { exportApplicationPdfToBuffer } from '@/lib/utils/exportPdfServer'
import { writeAuditLog } from '@/lib/audit/logger'
import type { FormSchema } from '@/lib/types/database'

const ARCHIVE_ACTOR_ID = '00000000-0000-0000-0000-000000000000'

/**
 * 承認完了直後にバックグラウンドで起動する想定。
 * Promise は呼び元で .catch() してエンジン本体を巻き込まないこと。
 */
export async function archiveApprovedApplication(applicationId: string): Promise<void> {
  if (!isSharePointConfigured()) {
    // 環境未設定 = モックモード扱い。ログだけ残して終了。
    console.log(`[archive] SharePoint 未設定のためスキップ: ${applicationId}`)
    return
  }

  const supabase = createAdminClient()

  // 1. 申請データ取得（承認履歴・申請者・書類種別も join）
  const { data: app, error } = await supabase
    .from('applications')
    .select(`
      id, application_number, title, status, form_data, submitted_at, approved_at, created_at,
      form_template_id,
      applicant:employees!applicant_id(name),
      document_type:document_types(name),
      approval_records(step_name, action, comment, acted_at, approver:employees!approver_id(name))
    `)
    .eq('id', applicationId)
    .maybeSingle()

  if (error || !app) {
    console.error(`[archive] 申請取得失敗: ${applicationId}`, error)
    return
  }

  // 2. フォームスキーマ取得
  const { data: tmpl } = await supabase
    .from('form_templates')
    .select('schema')
    .eq('id', app.form_template_id)
    .maybeSingle()

  if (!tmpl?.schema) {
    console.error(`[archive] フォームテンプレート取得失敗: ${applicationId}`)
    return
  }

  const schema = tmpl.schema as FormSchema
  const docTypeName = (app.document_type as unknown as { name: string } | null)?.name || 'その他'
  const applicantName = (app.applicant as unknown as { name: string } | null)?.name || '不明'

  // 承認履歴から最終承認者と承認者一覧を抽出
  const records = (app.approval_records as unknown as Array<{
    step_name: string
    action: string
    approver?: { name: string } | null
    acted_at?: string | null
  }>) || []

  const approvedSteps = records
    .filter(r => r.action === 'approved')
    .sort((a, b) => (a.acted_at || '').localeCompare(b.acted_at || ''))

  const finalApproverName = approvedSteps[approvedSteps.length - 1]?.approver?.name ?? null
  const approversTrail = approvedSteps
    .map(r => `${r.step_name}: ${r.approver?.name ?? '-'}`)
    .join(' / ')

  // 3. PDF 生成
  let pdfBuffer: ArrayBuffer
  try {
    pdfBuffer = await exportApplicationPdfToBuffer(
      {
        title: app.title,
        application_number: app.application_number,
        applicant: app.applicant as unknown as { name: string } | null,
        document_type: app.document_type as unknown as { name: string } | null,
        submitted_at: app.submitted_at,
        created_at: app.created_at,
        status: app.status,
        form_data: app.form_data as Record<string, unknown>,
        approval_records: records,
      },
      schema,
    )
  } catch (e) {
    console.error(`[archive] PDF生成失敗: ${applicationId}`, e)
    await writeAuditLog({
      actorId: ARCHIVE_ACTOR_ID,
      action: 'application.approve',
      targetType: 'application',
      targetId: applicationId,
      metadata: { phase: 'archive.pdf', error: String(e) },
    })
    return
  }

  // 4. SharePoint アップロード
  const fileName = `${app.application_number}_${app.title}.pdf`.replace(/[\\/:*?"<>|]/g, '_')

  const metadata: ArchiveMetadata = {
    applicationNumber: app.application_number,
    applicantName,
    finalApproverName,
    submittedAt: app.submitted_at,
    approvedAt: app.approved_at || new Date().toISOString(),
    approversTrail,
    documentTypeName: docTypeName,
  }

  try {
    const result = await archivePdfToSharePoint(pdfBuffer, fileName, docTypeName, metadata)

    // 5. webUrl を applications に保存
    await supabase
      .from('applications')
      .update({ sharepoint_url: result.webUrl, updated_at: new Date().toISOString() })
      .eq('id', applicationId)

    await writeAuditLog({
      actorId: ARCHIVE_ACTOR_ID,
      action: 'application.approve',
      targetType: 'application',
      targetId: applicationId,
      metadata: { phase: 'archive.success', webUrl: result.webUrl, folder: docTypeName },
    })

    console.log(`[archive] 成功: ${app.application_number} → ${result.webUrl}`)
  } catch (e) {
    console.error(`[archive] SharePointアップロード失敗: ${applicationId}`, e)
    await writeAuditLog({
      actorId: ARCHIVE_ACTOR_ID,
      action: 'application.approve',
      targetType: 'application',
      targetId: applicationId,
      metadata: { phase: 'archive.upload', folder: docTypeName, error: String(e) },
    })
  }
}
