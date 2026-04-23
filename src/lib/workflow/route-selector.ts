export interface RouteCondition {
  amount_field: string
  compute_from?: { table: string; sum_column: string }
  min?: number
  max?: number
}

interface RouteCandidate {
  id: string
  is_default: boolean
  condition: RouteCondition | null
}

/**
 * form_dataからconditionで指定された金額を計算する。
 * 1. compute_from指定時: テーブルのカラム合計
 * 2. amount_fieldが直接form_dataにある場合
 * 3. フォールバック: quantity * unit_price
 */
function computeAmount(formData: Record<string, unknown>, condition: RouteCondition): number {
  if (condition.compute_from) {
    const rows = formData[condition.compute_from.table] as Record<string, unknown>[] | undefined
    if (rows && rows.length > 0) {
      const sum = rows.reduce((acc, row) => {
        const val = row[condition.compute_from!.sum_column]
        return acc + (typeof val === 'number' ? val : 0)
      }, 0)
      if (sum > 0) return sum
    }
  }

  const direct = formData[condition.amount_field]
  if (typeof direct === 'number') return direct

  const qty = formData['quantity']
  const price = formData['unit_price']
  if (typeof qty === 'number' && typeof price === 'number') return qty * price

  return 0
}

/**
 * 金額がconditionの範囲内かチェック。
 * min: inclusive下限、max: exclusive上限
 */
function evaluateCondition(condition: RouteCondition, amount: number): boolean {
  if (condition.min != null && amount < condition.min) return false
  if (condition.max != null && amount >= condition.max) return false
  return true
}

/**
 * form_dataの内容に基づいて適切なルートテンプレートを選択する。
 * conditionマッチ優先、フォールバックはis_default=trueのルート。
 */
export function selectRouteTemplate(
  routes: RouteCandidate[],
  formData: Record<string, unknown>
): RouteCandidate | null {
  const defaultRoute = routes.find(r => r.is_default)
  const conditionalRoutes = routes.filter(r => r.condition && !r.is_default)

  for (const route of conditionalRoutes) {
    const amount = computeAmount(formData, route.condition!)
    if (evaluateCondition(route.condition!, amount)) {
      return route
    }
  }

  return defaultRoute || routes[0] || null
}
