import type { FormField } from '@/lib/types/database'

/* ──────────────────────────── colour palette ─────────────────────────── */
const COLORS = {
  headerBg: 'FF2B579A',     // 濃紺（テーブルヘッダー）
  headerFont: 'FFFFFFFF',   // 白
  labelBg: 'FFD6E4F0',      // 薄い青（ラベルセル）
  inputBg: 'FFFFFFED',      // クリーム（入力セル）
  dataBorder: 'FFB0B0B0',   // グレー罫線
  totalBg: 'FFFFF2CC',      // 黄色（合計行）
  formulaBg: 'FFE8F0FE',    // 薄い青（金額列）
  footerLabelBg: 'FFD6E4F0',
  footerInputBg: 'FFFFFFED',
} as const

const THIN_BORDER: import('exceljs').Border = { style: 'thin', color: { argb: COLORS.dataBorder } }
const ALL_BORDERS: Partial<import('exceljs').Borders> = {
  top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER,
}

/**
 * Generate a visually polished Excel template for a table field.
 *
 * Sheet 1 "注文書" : styled order-form (dates, numbered rows, formulas, totals)
 * Sheet 2 "データ入力" : simple header-only sheet for drag-and-drop import
 */
export async function generateTableTemplate(field: FormField): Promise<ArrayBuffer> {
  const ExcelJS = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'ツカモトワークフロー'

  const allColumns = field.columns || []
  const editableColumns = allColumns.filter(c => c.type !== 'formula')
  const config = field.templateConfig
  const DATA_ROWS = config?.dataRows || 15
  // total columns = 1 (No.) + allColumns.length
  const totalCols = 1 + allColumns.length

  /* ═══════════════════════ Sheet 1 : 注文書 ═══════════════════════════ */
  const ws = wb.addWorksheet('注文書', {
    properties: { defaultColWidth: 14 },
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
  })

  // Column widths: No., then each data column
  ws.columns = [
    { width: 6 },  // A: No.
    ...allColumns.map(c => ({
      width: c.type === 'number' ? 10
        : c.type === 'currency' || c.type === 'formula' ? 14
        : 22,
    })),
  ]

  let row = 1

  /* ── Header fields (職出し日 / 納期) ────────────────────────────── */
  if (config?.headerFields?.length) {
    const hRow = ws.getRow(row)
    let col = 1
    for (const hf of config.headerFields) {
      // Label cell
      const labelCell = hRow.getCell(col)
      labelCell.value = hf.label
      labelCell.font = { bold: true, size: 11 }
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.labelBg } }
      labelCell.border = ALL_BORDERS
      labelCell.alignment = { horizontal: 'center', vertical: 'middle' }

      // Value cell (sample date – date only, no time)
      const valCell = hRow.getCell(col + 1)
      const today = new Date()
      valCell.value = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      valCell.numFmt = 'yyyy/mm/dd'
      valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.inputBg } }
      valCell.border = ALL_BORDERS
      valCell.alignment = { horizontal: 'center', vertical: 'middle' }

      col += 3 // label + value + spacer
    }
    hRow.height = 26
    row += 2 // blank separator row
  }

  /* ── Table header ───────────────────────────────────────────────── */
  const headerRowNum = row
  const hdrRow = ws.getRow(row)
  const headers = ['No.', ...allColumns.map(c => c.label)]
  headers.forEach((label, idx) => {
    const cell = hdrRow.getCell(idx + 1)
    cell.value = label
    cell.font = { bold: true, color: { argb: COLORS.headerFont }, size: 10 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = ALL_BORDERS
  })
  hdrRow.height = 24
  row++

  /* ── Data rows ──────────────────────────────────────────────────── */
  const dataStartRow = row
  for (let i = 0; i < DATA_ROWS; i++) {
    const dRow = ws.getRow(row)
    dRow.height = 22

    // No. column
    const noCell = dRow.getCell(1)
    noCell.value = i + 1
    noCell.alignment = { horizontal: 'center', vertical: 'middle' }
    noCell.border = ALL_BORDERS
    noCell.font = { size: 10, color: { argb: 'FF666666' } }

    // Data columns
    for (let j = 0; j < allColumns.length; j++) {
      const col = allColumns[j]
      const cell = dRow.getCell(j + 2) // +2 because col 1 is No.
      cell.border = ALL_BORDERS
      cell.font = { size: 10 }

      if (col.type === 'formula' && col.formula) {
        // Excel formula: convert field IDs → cell refs
        const excelFormula = buildFormula(col.formula, allColumns, row)
        cell.value = { formula: excelFormula, result: 0 } as import('exceljs').CellFormulaValue
        cell.numFmt = '#,##0'
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.formulaBg } }
        cell.alignment = { horizontal: 'right', vertical: 'middle' }
      } else if (col.type === 'number') {
        cell.numFmt = '#,##0'
        cell.alignment = { horizontal: 'right', vertical: 'middle' }
      } else if (col.type === 'currency') {
        cell.numFmt = '#,##0'
        cell.alignment = { horizontal: 'right', vertical: 'middle' }
      } else {
        cell.alignment = { vertical: 'middle' }
      }
    }
    row++
  }
  const dataEndRow = row - 1

  /* ── Total row ──────────────────────────────────────────────────── */
  const totalRowNum = row
  const tRow = ws.getRow(row)
  tRow.height = 26

  // No. cell (empty)
  const tNoCell = tRow.getCell(1)
  tNoCell.border = ALL_BORDERS
  tNoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalBg } }

  for (let j = 0; j < allColumns.length; j++) {
    const col = allColumns[j]
    const cell = tRow.getCell(j + 2)
    cell.border = ALL_BORDERS
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalBg } }
    cell.font = { bold: true, size: 11 }
    cell.alignment = { vertical: 'middle' }

    if (j === 0) {
      // 「合計」 label in first data column
      cell.value = '合計'
      cell.alignment = { horizontal: 'right', vertical: 'middle' }
    } else if (col.type === 'number' || col.type === 'currency' || col.type === 'formula') {
      const colLetter = colLetter_from(j + 2) // +2 for 1-indexed + No. offset
      cell.value = { formula: `SUM(${colLetter}${dataStartRow}:${colLetter}${dataEndRow})`, result: 0 } as import('exceljs').CellFormulaValue
      cell.numFmt = '#,##0'
      cell.alignment = { horizontal: 'right', vertical: 'middle' }
    }
  }

  // Tax note in last column
  if (config?.taxNote) {
    const lastCell = tRow.getCell(totalCols)
    // If last column already has a SUM, put note in the column after
    if (allColumns[allColumns.length - 1].type !== 'number'
      && allColumns[allColumns.length - 1].type !== 'currency'
      && allColumns[allColumns.length - 1].type !== 'formula') {
      lastCell.value = config.taxNote
      lastCell.font = { size: 9, color: { argb: 'FF888888' } }
      lastCell.alignment = { horizontal: 'left', vertical: 'middle' }
    } else {
      // Put in next column
      const noteCell = tRow.getCell(totalCols + 1)
      noteCell.value = config.taxNote
      noteCell.font = { size: 9, color: { argb: 'FF888888' } }
      noteCell.alignment = { horizontal: 'left', vertical: 'middle' }
    }
  }
  row += 2 // blank separator

  /* ── Footer fields (成果物 / 納入先 / 支払方法) ────────────────── */
  if (config?.footerFields?.length) {
    for (const ff of config.footerFields) {
      const fRow = ws.getRow(row)
      fRow.height = 24

      // Label
      const labelCell = fRow.getCell(1)
      labelCell.value = ff.label
      labelCell.font = { bold: true, size: 10 }
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.footerLabelBg } }
      labelCell.border = ALL_BORDERS
      labelCell.alignment = { horizontal: 'center', vertical: 'middle' }

      // Merged input area (columns 2 → last)
      ws.mergeCells(row, 2, row, totalCols)
      const inputCell = fRow.getCell(2)
      inputCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.footerInputBg } }
      inputCell.border = ALL_BORDERS
      inputCell.alignment = { vertical: 'middle' }

      row++
    }
  }

  /* ═══════════════════ Sheet 2 : データ入力 ═══════════════════════ */
  const ws2 = wb.addWorksheet('データ入力')
  const importRow = ws2.getRow(1)
  editableColumns.forEach((col, idx) => {
    const cell = importRow.getCell(idx + 1)
    cell.value = col.label
    cell.font = { bold: true, size: 10 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } }
    cell.font = { bold: true, color: { argb: COLORS.headerFont }, size: 10 }
    cell.border = ALL_BORDERS
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })
  ws2.columns = editableColumns.map(c => ({
    width: c.type === 'number' || c.type === 'currency' ? 12 : 18,
  }))

  /* ═══════════════════ Write to buffer ═══════════════════════════ */
  const buffer = await wb.xlsx.writeBuffer()
  return buffer as ArrayBuffer
}

/* ──────────────────────── helpers ─────────────────────────────────── */

/** Convert 1-indexed column number to Excel letter (1→A, 2→B, 27→AA) */
function colLetter_from(colNum: number): string {
  let result = ''
  let n = colNum
  while (n > 0) {
    n--
    result = String.fromCharCode(65 + (n % 26)) + result
    n = Math.floor(n / 26)
  }
  return result
}

/** Convert a field formula like "qty * price" to "C5*D5" */
function buildFormula(formula: string, allColumns: { id: string }[], excelRow: number): string {
  return formula.replace(/[a-z_]+/g, (match) => {
    const idx = allColumns.findIndex(c => c.id === match)
    if (idx >= 0) return `${colLetter_from(idx + 2)}${excelRow}` // +2 for 1-indexed + No.
    return match
  })
}
