/**
 * 帳票出力（Excel）ビルダー。
 *
 * 条件書「出力」列 ○ の帳票を、渡された Excel レイアウトに近い形で xlsx 出力する。
 * スキーマ駆動でセクション／テーブル／合計／承認欄（印鑑枠）を描画し、
 * 会社印画像が設定されていれば承認欄に合成する（押印機能）。
 *
 * - exceljs で組み立て、Buffer を返す（サーバー/APIルートから使用）
 * - PDF が必要な場合は Graph 経由の変換を別途行う想定（xlsx→pdf）
 */

import ExcelJS from 'exceljs'
import fs from 'fs'
import path from 'path'
import type { FormSchema, FormField } from '@/lib/types/database'

export interface OutputApplicationData {
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
    acted_at?: string | null
  }>
}

const NAVY = 'FF1E3A5F'
const LIGHT = 'FFF1F5F9'
const BORDER = 'FFB0B8C0'

const thin = { style: 'thin' as const, color: { argb: BORDER } }
const boxBorder = { top: thin, left: thin, bottom: thin, right: thin }

/** 会社印画像を探す（public/company-seal.png 優先、無ければ null）。 */
function loadCompanySeal(): { buffer: Buffer; ext: 'png' | 'jpeg' } | null {
  const candidates = [
    process.env.COMPANY_SEAL_PATH,
    path.join(process.cwd(), 'public', 'company-seal.png'),
    path.join(process.cwd(), 'public', 'company-seal.jpg'),
  ].filter(Boolean) as string[]
  for (const p of candidates) {
    try {
      const buf = fs.readFileSync(p)
      return { buffer: buf, ext: p.endsWith('.jpg') || p.endsWith('.jpeg') ? 'jpeg' : 'png' }
    } catch {
      /* next */
    }
  }
  return null
}

function currencyStr(v: unknown): string {
  return typeof v === 'number' ? v.toLocaleString('ja-JP') : String(v ?? '')
}

function fieldDisplay(field: FormField, value: unknown): string {
  if (value === undefined || value === null || value === '') return ''
  if (field.type === 'currency') return typeof value === 'number' ? `¥${value.toLocaleString('ja-JP')}` : String(value)
  if (field.type === 'select' && field.options) {
    return field.options.find(o => o.value === String(value))?.label || String(value)
  }
  return String(value)
}

export async function buildApplicationXlsx(
  app: OutputApplicationData,
  schema: FormSchema,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Tsukamoto Workflow'
  const ws = wb.addWorksheet('帳票', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } },
  })
  // 6 列レイアウト（ラベル1 : 値2〜6）
  ws.columns = [
    { width: 18 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 },
  ]
  const LASTCOL = 6
  let r = 1

  // ── タイトル（書類名 中央大見出し） ─────────────────────────────
  const docTitle = app.document_type?.name || app.title || '申請書'
  ws.mergeCells(r, 1, r, LASTCOL)
  const titleCell = ws.getCell(r, 1)
  titleCell.value = docTitle
  titleCell.font = { size: 18, bold: true }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(r).height = 30
  r += 1

  // 会社名（右上）
  ws.mergeCells(r, 4, r, LASTCOL)
  const co = ws.getCell(r, 4)
  co.value = '株式会社ツカモトコーポレーション'
  co.alignment = { horizontal: 'right' }
  co.font = { size: 9 }
  r += 2

  // ── メタ情報（申請番号 / 申請者 / 申請日） ─────────────────────
  const submitted = app.submitted_at || app.created_at
  const metaPairs: [string, string][] = [
    ['申請番号', app.application_number],
    ['申請者', app.applicant?.name || ''],
    ['申請日', submitted ? String(submitted).slice(0, 10) : ''],
  ]
  for (const [label, val] of metaPairs) {
    const lc = ws.getCell(r, 5)
    lc.value = label
    lc.font = { size: 9, bold: true }
    lc.alignment = { horizontal: 'right' }
    const vc = ws.getCell(r, 6)
    vc.value = val
    vc.font = { size: 9 }
    vc.alignment = { horizontal: 'right' }
    r += 1
  }
  r += 1

  const fieldById = new Map(schema.fields.map(f => [f.id, f]))
  const sections = schema.layout?.sections?.length
    ? schema.layout.sections
    : [{ title: '申請内容', fields: schema.fields.map(f => f.id) }]

  // ── セクションごとに描画 ────────────────────────────────────────
  for (const section of sections) {
    // セクション見出し
    ws.mergeCells(r, 1, r, LASTCOL)
    const sc = ws.getCell(r, 1)
    sc.value = section.title
    sc.font = { size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    sc.alignment = { vertical: 'middle', indent: 1 }
    ws.getRow(r).height = 20
    r += 1

    for (const fid of section.fields) {
      const field = fieldById.get(fid)
      if (!field) continue

      if (field.type === 'table') {
        // テーブル見出し
        ws.mergeCells(r, 1, r, LASTCOL)
        const tl = ws.getCell(r, 1)
        tl.value = field.label
        tl.font = { size: 10, bold: true }
        r += 1

        const cols = field.columns || []
        const rows = (app.form_data[field.id] as Record<string, unknown>[]) || []
        if (cols.length > 0) {
          // ヘッダ行（列は LASTCOL 内で均等割当）
          const headerRow = r
          cols.forEach((c, i) => {
            if (i >= LASTCOL) return
            const cell = ws.getCell(headerRow, i + 1)
            cell.value = c.label
            cell.font = { size: 9, bold: true, color: { argb: 'FFFFFFFF' } }
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
            cell.border = boxBorder
          })
          r += 1
          // データ行
          for (const row of rows) {
            cols.forEach((c, i) => {
              if (i >= LASTCOL) return
              const cell = ws.getCell(r, i + 1)
              const v = row[c.id]
              if (c.type === 'currency' || c.type === 'formula') {
                cell.value = typeof v === 'number' ? v : (v ? Number(v) : null)
                cell.numFmt = '#,##0'
                cell.alignment = { horizontal: 'right' }
              } else if (c.type === 'number') {
                cell.value = typeof v === 'number' ? v : (v !== undefined && v !== '' ? Number(v) : null)
                cell.alignment = { horizontal: 'right' }
              } else {
                cell.value = v != null ? String(v) : ''
              }
              cell.font = { size: 9 }
              cell.border = boxBorder
            })
            r += 1
          }
        }
      } else {
        // 通常フィールド（ラベル : 値）
        const lc = ws.getCell(r, 1)
        lc.value = field.label
        lc.font = { size: 9, bold: true }
        lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } }
        lc.alignment = { vertical: 'top', indent: 1, wrapText: true }
        lc.border = boxBorder
        ws.mergeCells(r, 2, r, LASTCOL)
        const vc = ws.getCell(r, 2)
        const value = app.form_data[field.id]
        if (field.type === 'currency' && typeof value === 'number') {
          vc.value = value
          vc.numFmt = '¥#,##0'
          vc.alignment = { horizontal: 'left', vertical: 'top' }
        } else {
          vc.value = fieldDisplay(field, value)
          vc.alignment = { vertical: 'top', wrapText: true }
        }
        vc.font = { size: 9 }
        vc.border = boxBorder
        // テキストエリアは行高を確保
        if (field.type === 'textarea') ws.getRow(r).height = Math.max(18, (field.rows || 3) * 12)
        r += 1
      }
    }
    r += 1
  }

  // ── 承認欄（印鑑枠） ────────────────────────────────────────────
  r += 1
  ws.mergeCells(r, 1, r, LASTCOL)
  const appHead = ws.getCell(r, 1)
  appHead.value = '承認欄'
  appHead.font = { size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
  appHead.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
  appHead.alignment = { vertical: 'middle', indent: 1 }
  ws.getRow(r).height = 20
  r += 1

  const approved = (app.approval_records || []).filter(a => a.action === 'approved')
  const sealCols = Math.min(LASTCOL, Math.max(1, approved.length || 1))
  const labelRow = r
  const nameRow = r + 1
  const sealRow = r + 2
  for (let i = 0; i < sealCols; i++) {
    const c = i + 1
    const lbl = ws.getCell(labelRow, c)
    lbl.value = approved[i]?.step_name || ''
    lbl.font = { size: 8, bold: true }
    lbl.alignment = { horizontal: 'center' }
    lbl.border = boxBorder
    const nm = ws.getCell(nameRow, c)
    nm.value = approved[i]?.approver?.name || ''
    nm.font = { size: 9 }
    nm.alignment = { horizontal: 'center' }
    nm.border = boxBorder
    const seal = ws.getCell(sealRow, c)
    seal.value = ''
    seal.border = boxBorder
  }
  ws.getRow(sealRow).height = 42

  // 会社印を最初の承認枠に合成（押印: 会社印1つ方式）
  const seal = loadCompanySeal()
  if (seal && sealCols > 0) {
    const imageId = wb.addImage({ buffer: seal.buffer as unknown as ExcelJS.Buffer, extension: seal.ext })
    ws.addImage(imageId, {
      tl: { col: sealCols - 1 + 0.15, row: sealRow - 1 + 0.1 } as ExcelJS.Anchor,
      ext: { width: 60, height: 60 },
    })
  }

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}
