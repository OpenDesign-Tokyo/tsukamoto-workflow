import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildApplicationXlsx, buildBusinessDocXlsx, getBizDocConfig } from '@/lib/output/buildApplicationXlsx'
import { convertOfficeToPdfViaGraph } from '@/lib/graph/sharepoint'
import type { FormSchema } from '@/lib/types/database'

/**
 * 帳票出力。条件書「出力」列 ○ の帳票を、渡された様式に沿って出力する。
 * GET /api/applications/[id]/output            → xlsx
 * GET /api/applications/[id]/output?format=pdf → PDF（Graph変換。不可なら xlsx にフォールバック）
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const wantPdf = req.nextUrl.searchParams.get('format') === 'pdf'
  const supabase = createAdminClient()

  const { data: app, error } = await supabase
    .from('applications')
    .select(`
      id, application_number, title, status, form_data, submitted_at, created_at, form_template_id,
      applicant:employees!applicant_id(name),
      document_type:document_types(name, code),
      approval_records(step_name, action, acted_at, approver:employees!approver_id(name))
    `)
    .eq('id', id)
    .maybeSingle()

  if (error || !app) {
    return NextResponse.json({ error: '申請が見つかりません' }, { status: 404 })
  }

  const { data: tmpl } = await supabase
    .from('form_templates')
    .select('schema')
    .eq('id', app.form_template_id)
    .maybeSingle()

  if (!tmpl?.schema) {
    return NextResponse.json({ error: 'フォームテンプレートが見つかりません' }, { status: 404 })
  }

  const dtInfo = app.document_type as unknown as { name: string; code?: string } | null
  const bizConfig = getBizDocConfig(dtInfo?.code)
  const appData = {
    title: app.title,
    application_number: app.application_number,
    applicant: app.applicant as unknown as { name: string } | null,
    document_type: dtInfo,
    submitted_at: app.submitted_at,
    created_at: app.created_at,
    status: app.status,
    form_data: app.form_data as Record<string, unknown>,
    approval_records: app.approval_records as unknown as Array<{
      step_name: string
      approver?: { name: string } | null
      action: string
      acted_at?: string | null
    }>,
  }
  const buffer = bizConfig
    ? await buildBusinessDocXlsx(appData, tmpl.schema as FormSchema, bizConfig)
    : await buildApplicationXlsx(appData,
    tmpl.schema as FormSchema,
  )

  const docName = (app.document_type as unknown as { name: string } | null)?.name || '帳票'
  const baseName = `${app.application_number}_${docName}`.replace(/[\\/:*?"<>|]/g, '_')

  // PDF 希望時は Graph 変換。失敗/未設定なら xlsx にフォールバック（拡張子と内容を一致させる）。
  if (wantPdf) {
    const pdf = await convertOfficeToPdfViaGraph(buffer, baseName, 'xlsx')
    if (pdf) {
      return new NextResponse(new Uint8Array(pdf), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(baseName + '.pdf')}`,
        },
      })
    }
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(baseName + '.xlsx')}`,
    },
  })
}
