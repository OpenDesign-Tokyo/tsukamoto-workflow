/**
 * サーバーサイド PDF 生成（SharePoint 自動アーカイブ用）。
 *
 * 既存の `exportPdf.ts` はブラウザ専用（`doc.save()` でダウンロード）。
 * このファイルは同じ見た目の PDF を Node.js 上で組み立てて Buffer で返す。
 *
 * - 日本語フォント (NotoSansJP) は `public/fonts/` から fs で読み込む
 * - 出力は ArrayBuffer (SharePoint アップロード用)
 */

import fs from 'fs'
import path from 'path'
import type { FormSchema } from '@/lib/types/database'

interface ApplicationData {
  title: string
  application_number: string
  applicant?: { name: string } | null
  document_type?: { name: string } | null
  submitted_at?: string | null
  created_at: string
  status: string
  form_data: Record<string, unknown>
  approval_records?: Array<{
    step_name: string
    approver?: { name: string } | null
    action: string
    comment?: string | null
    acted_at?: string | null
  }>
}

const STATUS_LABELS: Record<string, string> = {
  draft: '下書き',
  submitted: '提出済み',
  in_approval: '承認中',
  pending: '承認待ち',
  approved: '承認済み',
  rejected: '差戻し',
  withdrawn: '取下げ',
  archived: 'アーカイブ済み',
}

const ACTION_LABELS: Record<string, string> = {
  approved: '承認',
  rejected: '差戻し',
  pending: '未処理',
  skipped: 'スキップ',
}

let cachedFontBase64: string | null = null

function loadFontBase64(): string | null {
  if (cachedFontBase64 !== null) return cachedFontBase64 || null
  try {
    const fontPath = path.join(process.cwd(), 'public/fonts/NotoSansJP-Regular.ttf')
    const buf = fs.readFileSync(fontPath)
    cachedFontBase64 = buf.toString('base64')
    return cachedFontBase64
  } catch (e) {
    console.warn('[exportPdfServer] 日本語フォントの読み込みに失敗:', e)
    cachedFontBase64 = ''
    return null
  }
}

export async function exportApplicationPdfToBuffer(
  application: ApplicationData,
  schema: FormSchema,
): Promise<ArrayBuffer> {
  // Dynamic import: jsPDF is a heavy ESM module — keep cold-start fast.
  const { jsPDF } = await import('jspdf')
  const autoTableModule = await import('jspdf-autotable')
  const autoTable = autoTableModule.default

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // ── Font setup ────────────────────────────────────────────────────────────
  let fontName = 'Helvetica'
  const base64 = loadFontBase64()
  if (base64) {
    doc.addFileToVFS('NotoSansJP-Regular.ttf', base64)
    doc.addFont('NotoSansJP-Regular.ttf', 'NotoSansJP', 'normal', undefined, 'Identity-H')
    doc.setFont('NotoSansJP')
    fontName = 'NotoSansJP'
  } else {
    doc.setFont('Helvetica')
  }

  let y = 20

  // ── Title ────────────────────────────────────────────────────────────────
  doc.setFontSize(16)
  doc.text(application.title || '申請書', 14, y)
  y += 10

  // ── Meta info ────────────────────────────────────────────────────────────
  doc.setFontSize(9)
  const statusLabel = STATUS_LABELS[application.status] || application.status
  const meta = [
    `申請番号: ${application.application_number}`,
    `書類種別: ${application.document_type?.name || '-'}`,
    `申請者: ${application.applicant?.name || '-'}`,
    `申請日: ${application.submitted_at || application.created_at}`,
    `ステータス: ${statusLabel}`,
  ]
  for (const line of meta) {
    doc.text(line, 14, y)
    y += 5
  }
  y += 3

  doc.setDrawColor(200, 200, 200)
  doc.line(14, y, 196, y)
  y += 7

  // ── Form data ────────────────────────────────────────────────────────────
  doc.setFontSize(11)
  doc.text('申請内容', 14, y)
  y += 7

  doc.setFontSize(9)

  for (const field of schema.fields) {
    const value = application.form_data[field.id]

    if (field.type === 'table') {
      doc.text(`${field.label}:`, 14, y)
      y += 5

      const rows = (value as Record<string, unknown>[]) || []
      const cols = field.columns || []

      if (cols.length > 0 && rows.length > 0) {
        const tableHead = cols.map(c => c.label)
        const tableBody = rows.map(row =>
          cols.map(c => {
            const v = row[c.id]
            if (c.type === 'currency' || c.type === 'formula') {
              return typeof v === 'number' ? v.toLocaleString() : String(v || '')
            }
            return String(v || '')
          }),
        )

        autoTable(doc, {
          startY: y,
          head: [tableHead],
          body: tableBody,
          margin: { left: 14 },
          styles: { fontSize: 8, font: fontName },
          headStyles: { fillColor: [30, 58, 95], font: fontName, fontStyle: 'normal' },
        })
        // @ts-expect-error lastAutoTable injected by jspdf-autotable
        y = doc.lastAutoTable.finalY + 5
      }
    } else {
      let displayVal = ''
      if (value === undefined || value === null || value === '') {
        displayVal = '-'
      } else if (field.type === 'currency') {
        displayVal = typeof value === 'number' ? `¥${value.toLocaleString()}` : String(value)
      } else if (field.type === 'select' && field.options) {
        const opt = field.options.find(o => o.value === String(value))
        displayVal = opt?.label || String(value)
      } else {
        displayVal = String(value)
      }

      if (displayVal.length > 80) displayVal = displayVal.substring(0, 80) + '...'

      doc.text(`${field.label}: ${displayVal}`, 14, y)
      y += 5

      if (y > 270) {
        doc.addPage()
        y = 20
      }
    }
  }

  // ── Approval history ─────────────────────────────────────────────────────
  if (application.approval_records && application.approval_records.length > 0) {
    if (y > 240) { doc.addPage(); y = 20 }
    y += 3
    doc.setDrawColor(200, 200, 200)
    doc.line(14, y, 196, y)
    y += 7
    doc.setFontSize(11)
    doc.text('承認履歴', 14, y)
    y += 7

    const approvalHead = ['ステップ', '承認者', 'アクション', 'コメント', '日時']
    const approvalBody = application.approval_records.map(r => [
      r.step_name,
      r.approver?.name || '-',
      ACTION_LABELS[r.action] || r.action,
      r.comment || '-',
      r.acted_at || '-',
    ])

    autoTable(doc, {
      startY: y,
      head: [approvalHead],
      body: approvalBody,
      margin: { left: 14 },
      styles: { fontSize: 8, font: fontName },
      headStyles: { fillColor: [30, 58, 95], font: fontName, fontStyle: 'normal' },
    })
  }

  const arrayBuffer = doc.output('arraybuffer')
  return arrayBuffer as ArrayBuffer
}
