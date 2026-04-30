import type { FormSchema } from '@/lib/types/database'

interface ApplicationData {
  title: string
  application_number: string
  applicant?: { name: string }
  document_type?: { name: string }
  submitted_at?: string | null
  created_at: string
  status: string
  form_data: Record<string, unknown>
  approval_records?: Array<{
    step_name: string
    approver?: { name: string }
    action: string
    comment?: string | null
    acted_at?: string | null
  }>
}

const STATUS_LABELS: Record<string, string> = {
  draft: '下書き',
  submitted: '提出済み',
  in_approval: '承認中',
  approved: '承認済み',
  rejected: '差戻し',
  withdrawn: '取下げ',
}

const ACTION_LABELS: Record<string, string> = {
  approved: '承認',
  rejected: '差戻し',
  pending: '未処理',
  skipped: 'スキップ',
}

export async function exportApplicationExcel(
  application: ApplicationData,
  schema: FormSchema
) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  // Sheet 1: 申請内容
  const rows: unknown[][] = [
    ['申請番号', application.application_number],
    ['書類種別', application.document_type?.name || '-'],
    ['申請者', application.applicant?.name || '-'],
    ['申請日', application.submitted_at || application.created_at],
    ['ステータス', STATUS_LABELS[application.status] || application.status],
    [],
  ]

  for (const field of schema.fields) {
    if (field.type === 'table') continue
    const value = application.form_data[field.id]
    let displayVal = ''
    if (value === undefined || value === null || value === '') {
      displayVal = '-'
    } else if (field.type === 'currency' || field.type === 'formula') {
      displayVal = typeof value === 'number' ? value.toLocaleString() : String(value)
    } else if (field.type === 'select' && field.options) {
      const opt = field.options.find(o => o.value === String(value))
      displayVal = opt?.label || String(value)
    } else {
      displayVal = String(value)
    }
    rows.push([field.label, displayVal])
  }

  const ws1 = XLSX.utils.aoa_to_sheet(rows)
  ws1['!cols'] = [{ wch: 16 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(wb, ws1, '申請内容')

  // Sheet per table field
  for (const field of schema.fields) {
    if (field.type !== 'table' || !field.columns) continue
    const tableRows = (application.form_data[field.id] as Record<string, unknown>[]) || []
    const header = field.columns.map(c => c.label)
    const data = tableRows.map(row =>
      field.columns!.map(c => {
        const v = row[c.id]
        if (v === undefined || v === null) return ''
        return v
      })
    )
    const ws = XLSX.utils.aoa_to_sheet([header, ...data])
    ws['!cols'] = field.columns.map(c => ({ wch: Math.max(12, (c.label || '').length * 2 + 4) }))
    XLSX.utils.book_append_sheet(wb, ws, field.label.substring(0, 31))
  }

  // Sheet: 承認履歴
  if (application.approval_records?.length) {
    const header = ['ステップ', '承認者', 'アクション', 'コメント', '日時']
    const data = application.approval_records.map(r => [
      r.step_name,
      r.approver?.name || '-',
      ACTION_LABELS[r.action] || r.action,
      r.comment || '-',
      r.acted_at || '-',
    ])
    const ws = XLSX.utils.aoa_to_sheet([header, ...data])
    ws['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 30 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, ws, '承認履歴')
  }

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${application.application_number || 'application'}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
