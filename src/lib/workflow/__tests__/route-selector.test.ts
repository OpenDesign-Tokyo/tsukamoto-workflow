import { describe, it, expect } from 'vitest'
import { selectRouteTemplate, type RouteCondition } from '../route-selector'

interface TestRoute {
  id: string
  is_default: boolean
  condition: RouteCondition | null
}

const makeRoute = (id: string, condition: RouteCondition | null, is_default = false): TestRoute => ({
  id, is_default, condition,
})

describe('selectRouteTemplate', () => {
  describe('金額条件マッチング', () => {
    const routes: TestRoute[] = [
      makeRoute('low', { amount_field: 'total', min: 0, max: 500000 }),
      makeRoute('mid', { amount_field: 'total', min: 500000, max: 1000000 }),
      makeRoute('high', { amount_field: 'total', min: 1000000 }),
      makeRoute('default', null, true),
    ]

    it('50万円未満は low ルート', () => {
      const r = selectRouteTemplate(routes, { total: 300000 })
      expect(r?.id).toBe('low')
    })

    it('50万円ちょうどは mid ルート (min inclusive)', () => {
      const r = selectRouteTemplate(routes, { total: 500000 })
      expect(r?.id).toBe('mid')
    })

    it('100万円ちょうどは high ルート', () => {
      const r = selectRouteTemplate(routes, { total: 1000000 })
      expect(r?.id).toBe('high')
    })

    it('該当ルートがなければデフォルトを返す', () => {
      const onlyConditional: TestRoute[] = [
        makeRoute('mid', { amount_field: 'total', min: 500000, max: 1000000 }),
        makeRoute('default', null, true),
      ]
      const r = selectRouteTemplate(onlyConditional, { total: 100 })
      expect(r?.id).toBe('default')
    })

    it('ルートが空ならnullを返す', () => {
      expect(selectRouteTemplate([], { total: 100 })).toBeNull()
    })
  })

  describe('compute_from でテーブル明細の合計', () => {
    const routes: TestRoute[] = [
      makeRoute('low', {
        amount_field: 'total',
        compute_from: { table: 'items', sum_column: 'amount' },
        min: 0, max: 500000,
      }),
      makeRoute('high', {
        amount_field: 'total',
        compute_from: { table: 'items', sum_column: 'amount' },
        min: 500000,
      }),
    ]

    it('明細合計が50万未満なら low', () => {
      const r = selectRouteTemplate(routes, {
        items: [{ amount: 100000 }, { amount: 200000 }],
      })
      expect(r?.id).toBe('low')
    })

    it('明細合計が50万以上なら high', () => {
      const r = selectRouteTemplate(routes, {
        items: [{ amount: 300000 }, { amount: 400000 }],
      })
      expect(r?.id).toBe('high')
    })

    it('明細が空でも直接フィールドにフォールバック', () => {
      const r = selectRouteTemplate(routes, { items: [], total: 600000 })
      expect(r?.id).toBe('high')
    })

    it('数値以外の amount は0扱い', () => {
      const r = selectRouteTemplate(routes, {
        items: [{ amount: 'invalid' }, { amount: 100000 }],
      })
      expect(r?.id).toBe('low')
    })
  })

  describe('quantity × unit_price フォールバック', () => {
    const routes: TestRoute[] = [
      makeRoute('high', { amount_field: 'missing_field', min: 500000 }),
      makeRoute('default', null, true),
    ]

    it('quantity * unit_price が閾値を超えれば high', () => {
      const r = selectRouteTemplate(routes, { quantity: 100, unit_price: 6000 })
      expect(r?.id).toBe('high')
    })

    it('quantity * unit_price が閾値未満ならdefault', () => {
      const r = selectRouteTemplate(routes, { quantity: 10, unit_price: 1000 })
      expect(r?.id).toBe('default')
    })
  })

  describe('境界値', () => {
    it('min と max が同値の場合は不一致 (min<=x<max)', () => {
      const routes: TestRoute[] = [
        makeRoute('exact', { amount_field: 'total', min: 100, max: 100 }),
        makeRoute('default', null, true),
      ]
      const r = selectRouteTemplate(routes, { total: 100 })
      expect(r?.id).toBe('default')
    })

    it('min のみ指定で下限のみチェック', () => {
      const routes: TestRoute[] = [
        makeRoute('over', { amount_field: 'total', min: 1000 }),
        makeRoute('default', null, true),
      ]
      expect(selectRouteTemplate(routes, { total: 999 })?.id).toBe('default')
      expect(selectRouteTemplate(routes, { total: 1000 })?.id).toBe('over')
      expect(selectRouteTemplate(routes, { total: 99999999 })?.id).toBe('over')
    })
  })
})
