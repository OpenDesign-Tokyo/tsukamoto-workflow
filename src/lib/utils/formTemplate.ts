/**
 * フォーム項目テンプレート（取込用）。
 *
 * 条件書「取込」○ の帳票向け。表を持たないスカラー項目を、Excel テンプレに
 * ダウンロード → 記入 → アップロードで一括投入できるようにする。
 *
 * テンプレ構成: A列=項目名 / B列=入力値 / C列=field.id（照合用・非表示）
 * テーブル項目は各テーブルの取込機能を使うためテンプレには含めない（注記のみ）。
 */
import type { FormSchema, FormField } from '@/lib/types/database'

/** 取込対象のスカラー項目のみ（table/formula/file は除外） */
function importableFields(schema: FormSchema): FormField[] {
  return schema.fields.filter(f => !['table', 'formula', 'file'].includes(f.type))
}

/** 現在の formData を初期値としてテンプレ xlsx を生成する。 */
export async function generateFormTemplate(
  schema: FormSchema,
  formData: Record<string, unknown> = {},
  title = '申請テンプレート',
): Promise<ArrayBuffer> {
  const ExcelJS = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('入力')
  ws.columns = [{ width: 26 }, { width: 44 }, { width: 14 }]

  ws.mergeCells(1, 1, 1, 2)
  const t = ws.getCell(1, 1)
  t.value = title
  t.font = { size: 14, bold: true }
  ws.getCell(1, 3).value = 'field_id'
  ws.getCell(1, 3).font = { size: 8, color: { argb: 'FF999999' } }

  let r = 2
  ws.getCell(r, 1).value = '項目名'
  ws.getCell(r, 2).value = '入力値'
  ;[1, 2, 3].forEach(c => {
    const cell = ws.getCell(r, c)
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B579A' } }
  })
  r += 1

  for (const f of importableFields(schema)) {
    const lc = ws.getCell(r, 1)
    lc.value = f.label + (f.required ? ' *' : '')
    lc.font = { bold: true }
    lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } }

    const vc = ws.getCell(r, 2)
    const cur = formData[f.id]
    if (f.type === 'select' && f.options) {
      // 既存値があればラベル表示、無ければ空。選択肢は注記に。
      const opt = f.options.find(o => o.value === String(cur))
      vc.value = opt?.label ?? (cur != null ? String(cur) : '')
      vc.note = '選択肢: ' + f.options.map(o => o.label).join(' / ')
    } else {
      vc.value = cur != null && cur !== '' ? (cur as string | number) : ''
    }
    vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFED' } }

    ws.getCell(r, 3).value = f.id
    r += 1
  }

  // テーブル項目がある場合の注記
  const tables = schema.fields.filter(f => f.type === 'table')
  if (tables.length) {
    r += 1
    ws.getCell(r, 1).value = '※ 明細（' + tables.map(t => t.label).join('・') + '）は各明細表の「Excel取込」から入力してください。'
    ws.getCell(r, 1).font = { size: 9, italic: true, color: { argb: 'FF888888' } }
  }

  // field_id 列は非表示
  ws.getColumn(3).hidden = true
  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>
}

/** 記入済みテンプレ xlsx を解析し、field.id→値 の部分更新を返す。 */
export async function parseFormTemplate(
  buffer: ArrayBuffer,
  schema: FormSchema,
): Promise<Record<string, unknown>> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return {}
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })

  const byId = new Map(importableFields(schema).map(f => [f.id, f]))
  const updates: Record<string, unknown> = {}

  for (const row of rows) {
    const id = String((row as unknown[])[2] ?? '').trim()
    if (!id || !byId.has(id)) continue
    const field = byId.get(id)!
    const raw = (row as unknown[])[1]
    if (raw === undefined || raw === null || raw === '') continue

    if (field.type === 'number' || field.type === 'currency') {
      const n = Number(String(raw).replace(/[,¥\s]/g, ''))
      updates[id] = Number.isFinite(n) ? n : raw
    } else if (field.type === 'select' && field.options) {
      const s = String(raw).trim()
      const opt = field.options.find(o => o.label === s || o.value === s)
      updates[id] = opt ? opt.value : s
    } else {
      updates[id] = String(raw)
    }
  }
  return updates
}
