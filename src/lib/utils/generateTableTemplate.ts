import type { FormField } from '@/lib/types/database'

export async function generateTableTemplate(field: FormField): Promise<ArrayBuffer> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  // Only include editable columns (exclude formula columns)
  const editableColumns = (field.columns || []).filter(c => c.type !== 'formula')
  const header = editableColumns.map(c => c.label)

  const ws = XLSX.utils.aoa_to_sheet([header])
  ws['!cols'] = editableColumns.map(c => ({
    wch: Math.max(14, (c.label || '').length * 2 + 4),
  }))

  XLSX.utils.book_append_sheet(wb, ws, 'データ入力')

  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}
