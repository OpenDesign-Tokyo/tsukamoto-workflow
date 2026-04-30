import type { FormField } from '@/lib/types/database'

/**
 * Generate an Excel template for a table field.
 *
 * Creates two sheets:
 *   1. "注文書" – formatted order-form layout with row numbers, formulas,
 *      a total row, and optional header / footer fields.
 *   2. "データ入力" – simple header-only sheet for drag-and-drop import.
 */
export async function generateTableTemplate(field: FormField): Promise<ArrayBuffer> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  const allColumns = field.columns || []
  const editableColumns = allColumns.filter(c => c.type !== 'formula')
  const config = field.templateConfig

  // ─── Sheet 1: 注文書 (formatted template) ───────────────────────

  const aoa: (string | number | null)[][] = []
  const dataRows = config?.dataRows || 15

  // --- Header fields (e.g. 職出し日, 納期) ---
  let headerRowCount = 0
  if (config?.headerFields?.length) {
    const row: (string | number | null)[] = []
    for (let i = 0; i < config.headerFields.length; i++) {
      row.push(config.headerFields[i].label, null)
      if (i < config.headerFields.length - 1) {
        row.push(null) // spacer between pairs
      }
    }
    aoa.push(row)
    headerRowCount++
    aoa.push([]) // blank separator
    headerRowCount++
  }

  // --- Table header row ---
  const tableHeaderRow = headerRowCount // 0-indexed row for the header
  aoa.push(['No.', ...allColumns.map(c => c.label)])

  // --- Data rows (pre-filled row numbers + formula placeholders) ---
  const dataStartExcelRow = tableHeaderRow + 2 // 1-indexed Excel row
  for (let i = 0; i < dataRows; i++) {
    const row: (string | number | null)[] = [i + 1]
    for (const col of allColumns) {
      if (col.type === 'formula') {
        row.push(0) // placeholder – replaced with formula below
      } else if (col.type === 'number' || col.type === 'currency') {
        row.push(null)
      } else {
        row.push(null)
      }
    }
    aoa.push(row)
  }

  // --- Total row ---
  const totalAoaIdx = aoa.length
  const totalRow: (string | number | null)[] = [null, '合計']
  for (let j = 1; j < allColumns.length; j++) {
    totalRow.push(null) // placeholder – SUM formulas set below
  }
  aoa.push(totalRow)

  // Blank separator
  aoa.push([])

  // --- Footer fields (成果物, 納入先, 支払方法) ---
  if (config?.footerFields?.length) {
    for (const ff of config.footerFields) {
      aoa.push([ff.label])
    }
  }

  // Build the worksheet from the array-of-arrays
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // Build a column-ID → Excel column letter map (offset +1 for "No." column)
  const colLetterMap: Record<string, string> = {}
  for (let j = 0; j < allColumns.length; j++) {
    colLetterMap[allColumns[j].id] = XLSX.utils.encode_col(j + 1)
  }

  // --- Inject Excel formulas into formula-type columns ---
  for (let i = 0; i < dataRows; i++) {
    for (let j = 0; j < allColumns.length; j++) {
      const col = allColumns[j]
      if (col.type === 'formula' && col.formula) {
        const excelRow = dataStartExcelRow + i
        const cellAddr = XLSX.utils.encode_cell({ r: tableHeaderRow + 1 + i, c: j + 1 })
        const excelFormula = convertFormula(col.formula, colLetterMap, excelRow)
        ws[cellAddr] = { t: 'n', f: excelFormula, v: 0 }
      }
    }
  }

  // --- Inject SUM formulas into total row ---
  const lastDataExcelRow = dataStartExcelRow + dataRows - 1
  for (let j = 0; j < allColumns.length; j++) {
    const col = allColumns[j]
    if (col.type === 'number' || col.type === 'currency' || col.type === 'formula') {
      const colLetter = colLetterMap[col.id]
      const cellAddr = XLSX.utils.encode_cell({ r: totalAoaIdx, c: j + 1 })
      ws[cellAddr] = {
        t: 'n',
        f: `SUM(${colLetter}${dataStartExcelRow}:${colLetter}${lastDataExcelRow})`,
        v: 0,
      }
    }
  }

  // --- Tax note (e.g. "(税別)") ---
  if (config?.taxNote) {
    // Place in the last column of the total row
    const lastColIdx = allColumns.length
    const cellAddr = XLSX.utils.encode_cell({ r: totalAoaIdx, c: lastColIdx })
    ws[cellAddr] = { t: 's', v: config.taxNote }
  }

  // --- Column widths ---
  ws['!cols'] = [
    { wch: 5 }, // No.
    ...allColumns.map(c => {
      if (c.type === 'number') return { wch: 8 }
      if (c.type === 'currency' || c.type === 'formula') return { wch: 12 }
      return { wch: 20 }
    }),
  ]

  XLSX.utils.book_append_sheet(wb, ws, '注文書')

  // ─── Sheet 2: データ入力 (import-compatible) ────────────────────

  const importHeaders = editableColumns.map(c => c.label)
  const ws2 = XLSX.utils.aoa_to_sheet([importHeaders])
  ws2['!cols'] = editableColumns.map(c => ({
    wch: Math.max(14, (c.label || '').length * 2 + 4),
  }))
  XLSX.utils.book_append_sheet(wb, ws2, 'データ入力')

  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

/**
 * Convert a field-level formula (e.g. "qty * price") into an Excel
 * cell formula (e.g. "C5*D5") using the column letter map.
 */
function convertFormula(
  formula: string,
  colLetterMap: Record<string, string>,
  excelRow: number
): string {
  return formula.replace(/[a-z_]+/g, (match) => {
    const letter = colLetterMap[match]
    if (letter) return `${letter}${excelRow}`
    return match // unknown token – keep as-is
  })
}
