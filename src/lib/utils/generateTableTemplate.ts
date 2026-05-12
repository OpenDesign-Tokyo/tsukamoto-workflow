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

  /* ── Top banner: company name + document title + approval seals ───── */
  // Renders the corporate-form aesthetic that ツカモトコーポレーション's existing
  // paper 注文書 / 支払依頼書 use: large title centered, company name on the
  // top-right, and N seal (印鑑) boxes for 課長 / 部長 / 事業部長.
  const seals = config?.approvalSeals ?? 0
  const hasBanner = !!(config?.documentTitle || config?.companyName || config?.companyLogoPlaceholder || seals > 0)

  if (hasBanner) {
    const bannerRow = ws.getRow(row)
    bannerRow.height = 44

    // Left side: optional logo placeholder cell
    if (config?.companyLogoPlaceholder) {
      const logoCell = bannerRow.getCell(1)
      logoCell.value = '[ LOGO ]'
      logoCell.alignment = { horizontal: 'center', vertical: 'middle' }
      logoCell.font = { size: 9, color: { argb: 'FF888888' }, italic: true }
      logoCell.border = ALL_BORDERS
    }

    // Center: document title (e.g., "注文書")
    if (config?.documentTitle) {
      // Reserve a few columns for the title; merge them. Leave space for seals on the right.
      const titleStartCol = config.companyLogoPlaceholder ? 2 : 1
      const titleEndCol = Math.max(titleStartCol + 1, totalCols - seals * 2)
      if (titleEndCol > titleStartCol) {
        ws.mergeCells(row, titleStartCol, row, titleEndCol)
      }
      const titleCell = bannerRow.getCell(titleStartCol)
      titleCell.value = config.documentTitle
      titleCell.font = { bold: true, size: 22, color: { argb: 'FF1F2937' } }
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    }

    // Right side: approval seal boxes (印鑑欄)
    // Each seal is a single cell with a small label above.
    if (seals > 0) {
      const sealStartCol = totalCols - seals * 2 + 1
      for (let s = 0; s < seals; s++) {
        const col = sealStartCol + s * 2
        // Two adjacent cells: label header on top, seal box below — but for now
        // we render the seal box only and use the next row for the label.
        const sealCell = bannerRow.getCell(col)
        sealCell.value = '印'
        sealCell.font = { size: 16, color: { argb: 'FFAAAAAA' } }
        sealCell.alignment = { horizontal: 'center', vertical: 'middle' }
        sealCell.border = {
          top: { style: 'medium', color: { argb: 'FF666666' } },
          bottom: { style: 'medium', color: { argb: 'FF666666' } },
          left: { style: 'medium', color: { argb: 'FF666666' } },
          right: { style: 'medium', color: { argb: 'FF666666' } },
        }
      }
    }
    row++

    // Sub-banner: company name (top-right) + seal labels (役職名) underneath
    if (config?.companyName || seals > 0) {
      const subRow = ws.getRow(row)
      subRow.height = 18

      if (config?.companyName) {
        // Place on the left side, opposite of seals
        const nameCol = 1
        const nameEndCol = Math.max(2, totalCols - seals * 2)
        if (nameEndCol > nameCol) ws.mergeCells(row, nameCol, row, nameEndCol)
        const c = subRow.getCell(nameCol)
        c.value = config.companyName
        c.font = { size: 10, color: { argb: 'FF555555' } }
        c.alignment = { horizontal: 'left', vertical: 'middle' }
      }

      if (seals > 0) {
        // Seal labels — default to common Japanese approval titles
        const defaultLabels = ['担当', '課長', '部長', '事業部長', '社長']
        const sealStartCol = totalCols - seals * 2 + 1
        for (let s = 0; s < seals; s++) {
          const col = sealStartCol + s * 2
          const c = subRow.getCell(col)
          c.value = defaultLabels[s] ?? `承認${s + 1}`
          c.font = { size: 8, color: { argb: 'FF555555' } }
          c.alignment = { horizontal: 'center', vertical: 'middle' }
        }
      }
      row++
    }

    row++ // blank separator after banner
  }

  /* ── Meta block (申請番号 / 申請者 / 申請部署 / 申請日 ...) ─────── */
  if (config?.metaBlock?.length) {
    const metaRow = ws.getRow(row)
    metaRow.height = 22
    let col = 1
    for (const mf of config.metaBlock) {
      const labelCell = metaRow.getCell(col)
      labelCell.value = mf.label
      labelCell.font = { bold: true, size: 10 }
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.labelBg } }
      labelCell.border = ALL_BORDERS
      labelCell.alignment = { horizontal: 'center', vertical: 'middle' }

      const valCell = metaRow.getCell(col + 1)
      valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.inputBg } }
      valCell.border = ALL_BORDERS
      valCell.alignment = { vertical: 'middle' }

      col += 2
    }
    row++
    row++ // separator
  }

  /* ── Vendor block (取引先 / 担当者 / 住所 / 電話) ──────────────── */
  if (config?.vendorBlock) {
    const vendorFields = ['取引先名', '担当者', '住所', '電話番号']
    for (const label of vendorFields) {
      const vRow = ws.getRow(row)
      vRow.height = 22

      const labelCell = vRow.getCell(1)
      labelCell.value = label
      labelCell.font = { bold: true, size: 10 }
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.labelBg } }
      labelCell.border = ALL_BORDERS
      labelCell.alignment = { horizontal: 'center', vertical: 'middle' }

      // Merge value across remaining columns
      if (totalCols > 1) ws.mergeCells(row, 2, row, totalCols)
      const valCell = vRow.getCell(2)
      valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.inputBg } }
      valCell.border = ALL_BORDERS
      valCell.alignment = { vertical: 'middle' }

      row++
    }
    row++ // separator
  }

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
