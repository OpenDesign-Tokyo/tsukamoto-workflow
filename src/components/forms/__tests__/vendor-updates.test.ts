import { describe, it, expect } from 'vitest'
import { vendorFieldUpdates } from '../FormRenderer'
import type { FormField, Vendor } from '@/lib/types/database'

const vendor: Vendor = {
  id: 'v-1',
  code: 'V-0001',
  name: '株式会社サンプル繊維',
  name_kana: 'サンプルセンイ',
  short_name: 'サンプル繊維',
  address: '東京都品川区東品川1-1-1',
  contact_person: '山田太郎',
  contact_email: 'yamada@sample.co.jp',
  contact_phone: '03-1111-1111',
  payment_terms: '月末締め翌月末払い',
  category: '仕入先',
  credit_limit: 5000000,
  is_active: true,
}

describe('vendorFieldUpdates', () => {
  it('autoFillなし: vendor id だけセット', () => {
    const field: FormField = { id: 'vendor_id', type: 'vendor_select', label: '取引先' }
    const updates = vendorFieldUpdates(field, vendor)
    expect(updates).toEqual({ vendor_id: 'v-1' })
  })

  it('autoFill指定時: 関連フィールドも展開される', () => {
    const field: FormField = {
      id: 'vendor_id',
      type: 'vendor_select',
      label: '取引先',
      vendorAutoFill: [
        { fieldId: 'vendor_name', vendorKey: 'name' },
        { fieldId: 'vendor_address', vendorKey: 'address' },
        { fieldId: 'vendor_payment_terms', vendorKey: 'payment_terms' },
      ],
    }
    const updates = vendorFieldUpdates(field, vendor)
    expect(updates).toEqual({
      vendor_id: 'v-1',
      vendor_name: '株式会社サンプル繊維',
      vendor_address: '東京都品川区東品川1-1-1',
      vendor_payment_terms: '月末締め翌月末払い',
    })
  })

  it('クリア (null): autoFillフィールドも空文字に', () => {
    const field: FormField = {
      id: 'vendor_id',
      type: 'vendor_select',
      label: '取引先',
      vendorAutoFill: [
        { fieldId: 'vendor_name', vendorKey: 'name' },
        { fieldId: 'vendor_address', vendorKey: 'address' },
      ],
    }
    const updates = vendorFieldUpdates(field, null)
    expect(updates).toEqual({
      vendor_id: '',
      vendor_name: '',
      vendor_address: '',
    })
  })

  it('vendor属性がnullの場合は空文字でフォールバック', () => {
    const noAddressVendor: Vendor = { ...vendor, address: null }
    const field: FormField = {
      id: 'vendor_id',
      type: 'vendor_select',
      label: '取引先',
      vendorAutoFill: [{ fieldId: 'vendor_address', vendorKey: 'address' }],
    }
    const updates = vendorFieldUpdates(field, noAddressVendor)
    expect(updates.vendor_address).toBe('')
  })
})
