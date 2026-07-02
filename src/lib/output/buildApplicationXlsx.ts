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

/**
 * 会社印画像を取得する（押印: 会社印1つ方式）。優先順:
 *   1. COMPANY_SEAL_URL（再デプロイ不要でENV設定可能）
 *   2. COMPANY_SEAL_PATH / public/company-seal.png|jpg
 * 見つからなければ null（承認欄は空の印枠のまま）。
 */
async function loadCompanySeal(): Promise<{ buffer: Buffer; ext: 'png' | 'jpeg' } | null> {
  const url = process.env.COMPANY_SEAL_URL
  if (url) {
    try {
      const res = await fetch(url)
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer())
        const ext = /\.jpe?g($|\?)/i.test(url) || res.headers.get('content-type')?.includes('jpeg') ? 'jpeg' : 'png'
        return { buffer: buf, ext }
      }
    } catch {
      /* fall through to file */
    }
  }
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
  const seal = await loadCompanySeal()
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

// ════════════════════════════════════════════════════════════════════════
// ビジネス帳票様式（見積書・請求書・注文書・加工指図書）
// 「渡している帳票通り」に近い、宛先/自社ブロック・明細表・合計・承認印の様式で出力。
// ════════════════════════════════════════════════════════════════════════

export interface BizDocConfig {
  title: string
  /** 宛先ブロックのラベルと表示するフィールド */
  partyLabel: string
  partyFields: string[]
  /** 件名/案件名として大きく出すフィールド */
  projectField?: string
  intro: string
  /** 明細テーブルのフィールドid（未指定ならschema内の最初のtable） */
  tableId?: string
  /** 消費税（小計/税/合計）を明示表示（請求書など） */
  tax?: boolean
}

export const BIZ_DOCS: Record<string, BizDocConfig> = {
  T02: { title: '御 見 積 書', partyLabel: '御見積先', partyFields: ['customer_name'], projectField: 'project_name', intro: '下記の通り御見積り申し上げます。', tableId: 'estimate_items' },
  T13: { title: '請 求 書', partyLabel: '請求先', partyFields: ['billing_to'], projectField: 'subject', intro: '下記の通り御請求申し上げます。', tableId: 'billing_items', tax: true },
  T08: { title: '注 文 書', partyLabel: '御注文先', partyFields: ['vendor_name'], projectField: 'project_name', intro: '下記の通り御注文申し上げます。', tableId: 'detail_table' },
  T12: { title: '加 工 指 図 書', partyLabel: '加工先', partyFields: ['customer_name'], projectField: 'project_name', intro: '下記の通り加工を指図します。', tableId: 'processing_items' },
}

export function getBizDocConfig(code?: string | null): BizDocConfig | null {
  if (!code) return null
  return BIZ_DOCS[code] || null
}

export async function buildBusinessDocXlsx(
  app: OutputApplicationData,
  schema: FormSchema,
  config: BizDocConfig,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Tsukamoto Workflow'
  const ws = wb.addWorksheet('帳票', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } },
  })
  ws.columns = [{ width: 22 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 16 }]
  const LAST = 6
  const fieldById = new Map(schema.fields.map(f => [f.id, f]))
  let r = 1

  // タイトル
  ws.mergeCells(r, 1, r, LAST)
  const t = ws.getCell(r, 1)
  t.value = config.title
  t.font = { size: 20, bold: true }
  t.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(r).height = 34
  r += 2

  // 右: 発行日 / 申請番号 / 自社名   左: 宛先ブロック
  const topRow = r
  const submitted = (app.submitted_at || app.created_at || '').slice(0, 10)
  ws.getCell(topRow, 5).value = '発行日'
  ws.getCell(topRow, 5).font = { size: 9, bold: true }
  ws.getCell(topRow, 6).value = submitted
  ws.getCell(topRow, 6).font = { size: 9 }
  ws.getCell(topRow + 1, 5).value = '番号'
  ws.getCell(topRow + 1, 5).font = { size: 9, bold: true }
  ws.getCell(topRow + 1, 6).value = app.application_number
  ws.getCell(topRow + 1, 6).font = { size: 9 }
  ws.mergeCells(topRow + 2, 5, topRow + 2, 6)
  const selfCo = ws.getCell(topRow + 2, 5)
  selfCo.value = '株式会社ツカモトコーポレーション'
  selfCo.font = { size: 10, bold: true }
  selfCo.alignment = { horizontal: 'right' }

  // 宛先（左）
  const partyName = config.partyFields.map(fid => app.form_data[fid]).filter(Boolean).join(' ') || ''
  ws.mergeCells(topRow, 1, topRow, 4)
  const pc = ws.getCell(topRow, 1)
  pc.value = `${partyName}　御中`
  pc.font = { size: 13, bold: true, underline: true }
  ws.getCell(topRow + 1, 1).value = `（${config.partyLabel}）`
  ws.getCell(topRow + 1, 1).font = { size: 8, color: { argb: 'FF888888' } }
  r = topRow + 4

  // 件名 / 案件名
  if (config.projectField && fieldById.get(config.projectField)) {
    const f = fieldById.get(config.projectField)!
    ws.getCell(r, 1).value = `【${f.label}】`
    ws.getCell(r, 1).font = { size: 10, bold: true }
    ws.mergeCells(r, 2, r, LAST)
    ws.getCell(r, 2).value = String(app.form_data[config.projectField] ?? '')
    ws.getCell(r, 2).font = { size: 11, bold: true }
    r += 1
  }

  // リード文
  ws.mergeCells(r, 1, r, LAST)
  ws.getCell(r, 1).value = config.intro
  ws.getCell(r, 1).font = { size: 9 }
  r += 2

  // 明細テーブル
  const tableField = (config.tableId && fieldById.get(config.tableId)) || schema.fields.find(f => f.type === 'table')
  let amountColId: string | null = null
  if (tableField && tableField.columns) {
    const cols = tableField.columns
    // 金額列（formula）を検出
    amountColId = cols.find(c => c.type === 'formula')?.id || cols[cols.length - 1]?.id || null
    const headRow = r
    cols.forEach((c, i) => {
      if (i >= LAST) return
      const cell = ws.getCell(headRow, i + 1)
      cell.value = c.label
      cell.font = { size: 9, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = boxBorder
    })
    r += 1
    const rows = (app.form_data[tableField.id] as Record<string, unknown>[]) || []
    for (const row of rows) {
      cols.forEach((c, i) => {
        if (i >= LAST) return
        const cell = ws.getCell(r, i + 1)
        const v = row[c.id]
        if (c.type === 'currency' || c.type === 'formula' || c.type === 'number') {
          cell.value = typeof v === 'number' ? v : (v !== undefined && v !== '' ? Number(v) : null)
          cell.numFmt = '#,##0'
          cell.alignment = { horizontal: 'right' }
        } else {
          cell.value = v != null ? String(v) : ''
        }
        cell.font = { size: 9 }
        cell.border = boxBorder
      })
      r += 1
    }
    // 空行を数行（体裁）
    for (let k = rows.length; k < Math.max(3, rows.length); k++) {
      cols.forEach((_, i) => { if (i < LAST) ws.getCell(r, i + 1).border = boxBorder })
      r += 1
    }
  }

  // 合計欄
  const money = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)
  const putTotal = (label: string, value: number) => {
    ws.getCell(r, LAST - 1).value = label
    ws.getCell(r, LAST - 1).font = { size: 9, bold: true }
    ws.getCell(r, LAST - 1).alignment = { horizontal: 'right' }
    ws.getCell(r, LAST - 1).border = boxBorder
    const vc = ws.getCell(r, LAST)
    vc.value = value
    vc.numFmt = '¥#,##0'
    vc.font = { size: 10, bold: true }
    vc.alignment = { horizontal: 'right' }
    vc.border = boxBorder
    r += 1
  }
  const totalVal = money(app.form_data['total_amount'])
  if (config.tax) {
    const sub = money(app.form_data['subtotal_amount']) || totalVal
    const taxv = money(app.form_data['tax_amount']) || Math.floor(sub * 0.1)
    putTotal('小計', sub)
    putTotal('消費税(10%)', taxv)
    putTotal('合計(税込)', money(app.form_data['total_amount']) || sub + taxv)
  } else if (totalVal) {
    putTotal('合計金額', totalVal)
  }
  r += 1

  // その他項目（宛先/案件/明細/合計以外のスカラー）
  const usedIds = new Set<string>([...config.partyFields, config.projectField || '', tableField?.id || '',
    'total_amount', 'subtotal_amount', 'tax_amount'])
  const extras = schema.fields.filter(f => !usedIds.has(f.id) && !['table', 'formula'].includes(f.type))
  for (const f of extras) {
    const v = app.form_data[f.id]
    if (v === undefined || v === null || v === '') continue
    ws.getCell(r, 1).value = f.label
    ws.getCell(r, 1).font = { size: 9, bold: true }
    ws.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } }
    ws.getCell(r, 1).border = boxBorder
    ws.mergeCells(r, 2, r, LAST)
    ws.getCell(r, 2).value = fieldDisplay(f, v)
    ws.getCell(r, 2).font = { size: 9 }
    ws.getCell(r, 2).border = boxBorder
    r += 1
  }
  r += 1

  // 承認印欄
  const approved = (app.approval_records || []).filter(a => a.action === 'approved')
  const sealCols = Math.min(LAST, Math.max(1, approved.length || 1))
  const labelRow = r, nameRow = r + 1, sealRow = r + 2
  for (let i = 0; i < sealCols; i++) {
    const c = i + 1
    ws.getCell(labelRow, c).value = approved[i]?.step_name || '承認'
    ws.getCell(labelRow, c).font = { size: 8, bold: true }
    ws.getCell(labelRow, c).alignment = { horizontal: 'center' }
    ws.getCell(labelRow, c).border = boxBorder
    ws.getCell(nameRow, c).value = approved[i]?.approver?.name || ''
    ws.getCell(nameRow, c).font = { size: 9 }
    ws.getCell(nameRow, c).alignment = { horizontal: 'center' }
    ws.getCell(nameRow, c).border = boxBorder
    ws.getCell(sealRow, c).border = boxBorder
  }
  ws.getRow(sealRow).height = 44

  const seal = await loadCompanySeal()
  if (seal && sealCols > 0) {
    const imageId = wb.addImage({ buffer: seal.buffer as unknown as ExcelJS.Buffer, extension: seal.ext })
    ws.addImage(imageId, { tl: { col: sealCols - 1 + 0.15, row: sealRow - 1 + 0.1 } as ExcelJS.Anchor, ext: { width: 58, height: 58 } })
  }

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}
