import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'yyyy/MM/dd', { locale: ja })
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'yyyy/MM/dd HH:mm', { locale: ja })
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '-'
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(num: number | null | undefined): string {
  if (num == null) return '-'
  return new Intl.NumberFormat('ja-JP').format(num)
}
