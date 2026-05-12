import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { parseVendorXlsx } from '../parseVendorXlsx'

/** Build an xlsx ArrayBuffer from a 2D array of cells (first row = header). */
function buildXlsx(rows: unknown[][]): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return out
}

describe('parseVendorXlsx', () => {
  it('最小ケース: code と name のみ (英語ヘッダー)', () => {
    const buf = buildXlsx([
      ['code', 'name'],
      ['V-0001', '株式会社サンプル'],
    ])
    const r = parseVendorXlsx(buf)
    expect(r.errors).toEqual([])
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].code).toBe('V-0001')
    expect(r.rows[0].name).toBe('株式会社サンプル')
  })

  it('日本語ヘッダーで読み取り', () => {
    const buf = buildXlsx([
      ['取引先コード', '社名', 'フリガナ', '住所', '担当者', '担当メール', '電話番号', '支払サイト', '与信枠（円）', '区分', '有効'],
      ['V-0001', '株式会社サンプル', 'サンプル', '東京都港区', '山田太郎', 'yamada@example.com', '03-0000-0000', '月末締め翌月末払い', 5000000, '仕入先', '有効'],
    ])
    const r = parseVendorXlsx(buf)
    expect(r.errors).toEqual([])
    expect(r.rows[0]).toMatchObject({
      code: 'V-0001',
      name: '株式会社サンプル',
      name_kana: 'サンプル',
      contact_email: 'yamada@example.com',
      credit_limit: 5000000,
      category: '仕入先',
      is_active: true,
    })
  })

  it('ヘッダーの末尾 "*" マーク（必須印）を許容', () => {
    const buf = buildXlsx([
      ['取引先コード *', '社名 *'],
      ['V-1', 'テスト'],
    ])
    const r = parseVendorXlsx(buf)
    expect(r.errors).toEqual([])
    expect(r.rows[0].code).toBe('V-1')
  })

  it('与信枠が数値型・文字列型・カンマ区切り全てパースできる', () => {
    const buf = buildXlsx([
      ['code', 'name', 'credit_limit'],
      ['V-1', 'A', 1000000],
      ['V-2', 'B', '2000000'],
      ['V-3', 'C', '3,000,000'],
    ])
    const r = parseVendorXlsx(buf)
    expect(r.errors).toEqual([])
    expect(r.rows.map(x => x.credit_limit)).toEqual([1000000, 2000000, 3000000])
  })

  it('is_active の様々な表記を boolean に変換', () => {
    const buf = buildXlsx([
      ['code', 'name', 'is_active'],
      ['V-1', 'A', '有効'],
      ['V-2', 'B', '無効'],
      ['V-3', 'C', 'true'],
      ['V-4', 'D', 'false'],
      ['V-5', 'E', 1],
      ['V-6', 'F', 0],
    ])
    const r = parseVendorXlsx(buf)
    expect(r.errors).toEqual([])
    expect(r.rows.map(x => x.is_active)).toEqual([true, false, true, false, true, false])
  })

  it('code と name 列が欠けていればエラー', () => {
    const buf = buildXlsx([
      ['住所', '電話番号'],
      ['東京', '03-0000-0000'],
    ])
    const r = parseVendorXlsx(buf)
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.errors[0]).toContain('必要')
  })

  it('行ごとに code/name 必須チェック', () => {
    const buf = buildXlsx([
      ['取引先コード', '社名'],
      ['V-1', '有効行'],
      ['', '空のコード行'],
      ['V-2', ''],
    ])
    const r = parseVendorXlsx(buf)
    expect(r.errors.length).toBe(2)
    expect(r.rows.length).toBe(1)
  })

  it('email形式不正はエラー', () => {
    const buf = buildXlsx([
      ['code', 'name', 'contact_email'],
      ['V-1', 'テスト', 'invalid-email'],
    ])
    const r = parseVendorXlsx(buf)
    expect(r.errors.length).toBe(1)
    expect(r.errors[0]).toContain('不正')
  })

  it('与信枠が数値でない場合はエラー', () => {
    const buf = buildXlsx([
      ['code', 'name', 'credit_limit'],
      ['V-1', 'テスト', 'abc'],
    ])
    const r = parseVendorXlsx(buf)
    expect(r.errors.length).toBe(1)
    expect(r.errors[0]).toContain('数値')
  })

  it('空行をスキップ', () => {
    const buf = buildXlsx([
      ['code', 'name'],
      ['V-1', 'A'],
      [],
      [null, null],
      ['V-2', 'B'],
    ])
    const r = parseVendorXlsx(buf)
    expect(r.errors).toEqual([])
    expect(r.rows.length).toBe(2)
  })

  it('日本語と英語の混在ヘッダー', () => {
    const buf = buildXlsx([
      ['取引先コード', '社名', 'category'],
      ['V-1', 'テスト', '仕入先'],
    ])
    const r = parseVendorXlsx(buf)
    expect(r.errors).toEqual([])
    expect(r.rows[0].category).toBe('仕入先')
  })

  it('未知のヘッダー列は無視（エラーにしない）', () => {
    const buf = buildXlsx([
      ['取引先コード', '社名', '不明な列'],
      ['V-1', 'テスト', 'foo'],
    ])
    const r = parseVendorXlsx(buf)
    expect(r.errors).toEqual([])
    expect(r.rows[0].code).toBe('V-1')
  })

  it('壊れたバッファでエラーを返す', () => {
    const buf = new ArrayBuffer(8)
    new Uint8Array(buf).set([1, 2, 3, 4, 5, 6, 7, 8])
    const r = parseVendorXlsx(buf)
    expect(r.rows).toEqual([])
    expect(r.errors.length).toBeGreaterThan(0)
  })
})
