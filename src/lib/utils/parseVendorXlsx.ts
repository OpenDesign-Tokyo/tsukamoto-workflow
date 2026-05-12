/**
 * 取引先マスタの xlsx ファイルをパースする。
 *
 * - 1 シート目をデータとして読み取り、「入力ガイド」シートは無視
 * - 1 行目をヘッダーとして扱う（`取引先コード *` 等の `*` マークは自動的に除去）
 * - 日本語ヘッダーも英語コードキー（code, name 等）もどちらも受理
 * - 旧 parseVendorCsv と同じ VendorRow を返すので呼び出し側の変更は最小
 *
 * 入力: ArrayBuffer (アップロードされた .xlsx の中身)
 * 出力: { rows, errors }  — エラー行はスキップして次へ進む
 */

import * as XLSX from 'xlsx'

export interface VendorRow {
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

const COLUMN_ALIASES: Record<string, keyof VendorRow> = {
  // English (canonical)
  code: 'code', name: 'name', name_kana: 'name_kana', short_name: 'short_name',
  address: 'address', contact_person: 'contact_person', contact_email: 'contact_email',
  contact_phone: 'contact_phone', payment_terms: 'payment_terms',
  credit_limit: 'credit_limit', category: 'category', notes: 'notes',
  is_active: 'is_active',

  // Japanese aliases (matching generateVendorTemplate column labels)
  '取引先コード': 'code',
  '社名': 'name',
  'フリガナ': 'name_kana',
  '略称': 'short_name',
  '住所': 'address',
  '担当者': 'contact_person',
  '担当メール': 'contact_email',
  'メール': 'contact_email',
  '電話番号': 'contact_phone',
  '電話': 'contact_phone',
  '支払サイト': 'payment_terms',
  '支払条件': 'payment_terms',
  '与信枠': 'credit_limit',
  '与信枠（円）': 'credit_limit',
  '区分': 'category',
  'カテゴリ': 'category',
  '有効': 'is_active',
  '有効/無効': 'is_active',
  'メモ': 'notes',
  '備考': 'notes',
}

function normalizeHeader(raw: unknown): keyof VendorRow | null {
  if (raw == null) return null
  // Strip trailing required-marker ` *` and whitespace
  const cleaned = String(raw).trim().replace(/\s*\*+\s*$/, '').replace(/\s+/g, '')
  return COLUMN_ALIASES[cleaned] || null
}

function parseIsActive(raw: unknown): boolean | undefined {
  if (raw == null || raw === '') return undefined
  const v = String(raw).trim().toLowerCase()
  if (['true', '1', 'yes', '有効'].includes(v)) return true
  if (['false', '0', 'no', '無効'].includes(v)) return false
  return undefined // unknown value treated as default (active)
}

function parseCreditLimit(raw: unknown): { value: number | null; error?: string } {
  if (raw == null || raw === '') return { value: null }
  if (typeof raw === 'number') return { value: raw }
  const cleaned = String(raw).replace(/,/g, '').trim()
  if (cleaned === '') return { value: null }
  const n = Number(cleaned)
  if (Number.isNaN(n)) return { value: null, error: `与信枠 "${raw}" は数値ではありません` }
  return { value: n }
}

export function parseVendorXlsx(buffer: ArrayBuffer): { rows: VendorRow[]; errors: string[] } {
  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(buffer, { type: 'array' })
  } catch (e) {
    return { rows: [], errors: [`xlsx の読み込みに失敗しました: ${(e as Error).message}`] }
  }

  const sheetName = wb.SheetNames[0]
  if (!sheetName) return { rows: [], errors: ['シートが見つかりません'] }
  const sheet = wb.Sheets[sheetName]

  // header: 1 → return rows as arrays so we can normalize header text ourselves
  const aoa: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, raw: false })
  if (aoa.length === 0) return { rows: [], errors: ['ファイルが空です'] }

  const headerRow = aoa[0]
  const columnMap: (keyof VendorRow | null)[] = headerRow.map(normalizeHeader)

  if (!columnMap.includes('code') || !columnMap.includes('name')) {
    return { rows: [], errors: ['「取引先コード」(code) と「社名」(name) の列が必要です'] }
  }

  const rows: VendorRow[] = []
  const errors: string[] = []

  for (let i = 1; i < aoa.length; i++) {
    const cells = aoa[i]
    if (!cells || cells.every(c => c == null || String(c).trim() === '')) continue

    const r: Partial<VendorRow> = {}
    let rowError: string | null = null

    for (let j = 0; j < columnMap.length; j++) {
      const key = columnMap[j]
      if (!key) continue
      const raw = cells[j]

      if (key === 'is_active') {
        r.is_active = parseIsActive(raw)
      } else if (key === 'credit_limit') {
        const { value, error } = parseCreditLimit(raw)
        if (error) { rowError = `行 ${i + 1}: ${error}`; break }
        r.credit_limit = value
      } else if (key === 'contact_email') {
        const v = raw == null ? '' : String(raw).trim()
        if (v && !/^\S+@\S+\.\S+$/.test(v)) {
          rowError = `行 ${i + 1}: メール "${v}" の形式が不正です`
          break
        }
        r.contact_email = v || null
      } else {
        const v = raw == null ? '' : String(raw).trim()
        ;(r as Record<string, unknown>)[key] = v === '' ? null : v
      }
    }

    if (rowError) { errors.push(rowError); continue }

    if (!r.code || !r.name) {
      errors.push(`行 ${i + 1}: 取引先コードと社名は必須です`)
      continue
    }

    rows.push(r as VendorRow)
  }

  return { rows, errors }
}
