import { describe, it, expect } from 'vitest'
import { parseVendorCsv } from '../parseVendorCsv'

describe('parseVendorCsv', () => {
  it('最小ケース: code と name のみ', () => {
    const csv = 'code,name\nV-0001,株式会社サンプル'
    const r = parseVendorCsv(csv)
    expect(r.errors).toEqual([])
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].code).toBe('V-0001')
    expect(r.rows[0].name).toBe('株式会社サンプル')
  })

  it('全列指定', () => {
    const csv = [
      'code,name,name_kana,short_name,address,contact_person,contact_email,contact_phone,payment_terms,credit_limit,category,is_active',
      'V-0001,株式会社サンプル,サンプル,サンプル,東京都港区,山田太郎,yamada@example.com,03-0000-0000,月末締め翌月末払い,5000000,仕入先,true',
    ].join('\n')
    const r = parseVendorCsv(csv)
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

  it('与信枠のカンマ区切り表記をパースできる', () => {
    const csv = 'code,name,credit_limit\nV-0001,テスト,"1,000,000"'
    const r = parseVendorCsv(csv)
    expect(r.errors).toEqual([])
    expect(r.rows[0].credit_limit).toBe(1000000)
  })

  it('is_active の様々な表記を boolean に変換', () => {
    const csv = [
      'code,name,is_active',
      'V-1,A,true',
      'V-2,B,false',
      'V-3,C,有効',
      'V-4,D,無効',
      'V-5,E,1',
      'V-6,F,0',
    ].join('\n')
    const r = parseVendorCsv(csv)
    expect(r.errors).toEqual([])
    expect(r.rows.map(x => x.is_active)).toEqual([true, false, true, false, true, false])
  })

  it('code と name 列が欠けていればエラー', () => {
    const r = parseVendorCsv('name,address\nテスト,東京')
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.errors[0]).toContain('必須')
  })

  it('未知の列はエラー', () => {
    const r = parseVendorCsv('code,name,foo\nV-1,A,X')
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.errors[0]).toContain('未知の列')
  })

  it('行ごとに code/name 必須チェック', () => {
    const csv = 'code,name\nV-1,有効行\n,空のコード行\nV-2,'
    const r = parseVendorCsv(csv)
    expect(r.errors.length).toBe(2)
    expect(r.rows.length).toBe(1)
  })

  it('email形式不正はエラー', () => {
    const csv = 'code,name,contact_email\nV-1,テスト,invalid-email'
    const r = parseVendorCsv(csv)
    expect(r.errors.length).toBe(1)
    expect(r.errors[0]).toContain('不正な形式')
  })

  it('引用符内のカンマと改行を扱える', () => {
    const csv = 'code,name,address\n"V-1","株式会社A,B","東京都\n港区"'
    const r = parseVendorCsv(csv)
    expect(r.errors).toEqual([])
    expect(r.rows[0].name).toBe('株式会社A,B')
    expect(r.rows[0].address).toBe('東京都\n港区')
  })

  it('エスケープされた引用符 ("") を扱える', () => {
    const csv = 'code,name\n"V-1","株式会社""ABC"""'
    const r = parseVendorCsv(csv)
    expect(r.errors).toEqual([])
    expect(r.rows[0].name).toBe('株式会社"ABC"')
  })

  it('BOM 付きCSVを扱える', () => {
    const csv = '﻿code,name\nV-1,テスト'
    const r = parseVendorCsv(csv)
    expect(r.errors).toEqual([])
    expect(r.rows[0].code).toBe('V-1')
  })

  it('空行をスキップ', () => {
    const csv = 'code,name\nV-1,A\n\n\nV-2,B'
    const r = parseVendorCsv(csv)
    expect(r.errors).toEqual([])
    expect(r.rows.length).toBe(2)
  })
})
