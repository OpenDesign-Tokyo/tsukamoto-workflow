/**
 * Minimal RFC4180-ish CSV parser for the vendor master.
 *
 * Why custom instead of a library: we already parse Excel with SheetJS but
 * this endpoint only receives CSV text from the admin UI's textarea / file
 * upload. Pulling in a CSV library for ~30 lines of logic isn't worth it.
 *
 * Required header columns: `code`, `name`
 * Optional columns: name_kana, short_name, address, contact_person,
 *   contact_email, contact_phone, payment_terms, credit_limit, category,
 *   notes, is_active
 *
 * Returns:
 *   - rows: validated VendorCsvRow array
 *   - errors: row-level error messages (line number + reason)
 */

export interface VendorCsvRow {
  code: string
  name: string
  name_kana?: string | null
  short_name?: string | null
  address?: string | null
  contact_person?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  payment_terms?: string | null
  credit_limit?: number | null
  category?: string | null
  notes?: string | null
  is_active?: boolean
}

const ALLOWED_COLUMNS = new Set([
  'code', 'name', 'name_kana', 'short_name', 'address',
  'contact_person', 'contact_email', 'contact_phone',
  'payment_terms', 'credit_limit', 'category', 'notes', 'is_active',
])

export function parseVendorCsv(csv: string): { rows: VendorCsvRow[]; errors: string[] } {
  const lines = splitCsvLines(csv)
  if (lines.length === 0) return { rows: [], errors: ['CSVが空です'] }

  const header = lines[0].map(h => h.trim())
  const unknown = header.filter(h => !ALLOWED_COLUMNS.has(h))
  if (unknown.length) {
    return { rows: [], errors: [`未知の列があります: ${unknown.join(', ')}`] }
  }
  if (!header.includes('code') || !header.includes('name')) {
    return { rows: [], errors: ['code と name 列は必須です'] }
  }

  const rows: VendorCsvRow[] = []
  const errors: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i]
    if (cells.length === 1 && cells[0].trim() === '') continue // skip blank lines

    const obj: Record<string, string> = {}
    for (let j = 0; j < header.length; j++) {
      obj[header[j]] = (cells[j] ?? '').trim()
    }

    if (!obj.code || !obj.name) {
      errors.push(`行 ${i + 1}: code と name は必須です`)
      continue
    }

    if (obj.contact_email && !/^\S+@\S+\.\S+$/.test(obj.contact_email)) {
      errors.push(`行 ${i + 1}: contact_email "${obj.contact_email}" は不正な形式です`)
      continue
    }

    let creditLimit: number | null = null
    if (obj.credit_limit) {
      const n = Number(obj.credit_limit.replace(/,/g, ''))
      if (Number.isNaN(n)) {
        errors.push(`行 ${i + 1}: credit_limit "${obj.credit_limit}" は数値ではありません`)
        continue
      }
      creditLimit = n
    }

    let isActive: boolean | undefined
    if (obj.is_active !== '' && obj.is_active != null) {
      const v = obj.is_active.toLowerCase()
      if (v === 'true' || v === '1' || v === 'yes' || v === '有効') isActive = true
      else if (v === 'false' || v === '0' || v === 'no' || v === '無効') isActive = false
      else {
        errors.push(`行 ${i + 1}: is_active "${obj.is_active}" は true/false で指定してください`)
        continue
      }
    }

    rows.push({
      code: obj.code,
      name: obj.name,
      name_kana: obj.name_kana || null,
      short_name: obj.short_name || null,
      address: obj.address || null,
      contact_person: obj.contact_person || null,
      contact_email: obj.contact_email || null,
      contact_phone: obj.contact_phone || null,
      payment_terms: obj.payment_terms || null,
      credit_limit: creditLimit,
      category: obj.category || null,
      notes: obj.notes || null,
      is_active: isActive,
    })
  }

  return { rows, errors }
}

/**
 * Split CSV text into rows of cells. Handles:
 *   - quoted fields with commas / newlines inside
 *   - escaped quotes ("")
 *   - CRLF and LF line endings
 *   - BOM at start of file
 */
function splitCsvLines(input: string): string[][] {
  if (input.charCodeAt(0) === 0xFEFF) input = input.slice(1) // strip BOM

  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') { cell += '"'; i++ } // escaped quote
        else { inQuotes = false }
      } else {
        cell += ch
      }
      continue
    }

    if (ch === '"') { inQuotes = true; continue }
    if (ch === ',') { row.push(cell); cell = ''; continue }
    if (ch === '\r') continue
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue }
    cell += ch
  }

  // flush remaining
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row) }
  return rows
}
