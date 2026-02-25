'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate } from '@/lib/utils/format'

interface FormTemplateRow {
  id: string
  version: number
  is_current: boolean
  created_at: string
  document_type: { name: string; code: string }
  field_count: number
}

export default function FormsPage() {
  const [templates, setTemplates] = useState<FormTemplateRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchTemplates = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('form_templates')
        .select(`*, document_type:document_types(name, code)`)
        .order('created_at', { ascending: false })

      if (data) {
        setTemplates(
          data.map(t => ({
            ...t,
            field_count: (t.schema as any)?.fields?.length || 0,
          })) as unknown as FormTemplateRow[]
        )
      }
      setIsLoading(false)
    }
    fetchTemplates()
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">フォームテンプレート管理</h1>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>書類種別</TableHead>
                <TableHead>バージョン</TableHead>
                <TableHead>フィールド数</TableHead>
                <TableHead>状態</TableHead>
                <TableHead>作成日</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.document_type?.name}</TableCell>
                  <TableCell>v{t.version}</TableCell>
                  <TableCell>{t.field_count}件</TableCell>
                  <TableCell>
                    {t.is_current ? (
                      <Badge className="bg-green-100 text-green-700">現行</Badge>
                    ) : (
                      <Badge variant="secondary">旧版</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">{formatDate(t.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
