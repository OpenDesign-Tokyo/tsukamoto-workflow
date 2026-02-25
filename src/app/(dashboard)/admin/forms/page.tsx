'use client'

import { useEffect, useState, useCallback } from 'react'
import { getDemoUserHeader } from '@/lib/auth/demo-auth'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Pencil, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils/format'
import { FormRenderer } from '@/components/forms/FormRenderer'
import type { FormSchema } from '@/lib/types/database'

interface FormTemplateRow {
  id: string
  version: number
  is_current: boolean
  created_at: string
  schema: unknown
  document_type: { id: string; name: string; code: string }
}

export default function FormsPage() {
  const [templates, setTemplates] = useState<FormTemplateRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [schemaText, setSchemaText] = useState('')
  const [schemaError, setSchemaError] = useState('')

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/admin/templates', { headers: getDemoUserHeader() })
    if (res.ok) setTemplates(await res.json())
    setIsLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const openEdit = (t: FormTemplateRow) => {
    setEditId(t.id)
    setSchemaText(JSON.stringify(t.schema, null, 2))
    setSchemaError('')
  }

  const saveSchema = async () => {
    try {
      const parsed = JSON.parse(schemaText)
      const res = await fetch(`/api/admin/templates/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getDemoUserHeader() },
        body: JSON.stringify({ schema: parsed }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || '保存に失敗しました')
        return
      }
      toast.success('テンプレートを更新しました')
      setEditId(null)
      fetchData()
    } catch {
      setSchemaError('無効なJSON形式です')
    }
  }

  const previewTemplate = templates.find(t => t.id === previewId)

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">フォームテンプレート管理</h1>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-left p-3">書類種別</th>
                <th className="text-left p-3">バージョン</th>
                <th className="text-left p-3">フィールド数</th>
                <th className="text-left p-3">状態</th>
                <th className="text-left p-3">作成日</th>
                <th className="text-right p-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {templates.map(t => {
                const fieldCount = (t.schema as any)?.fields?.length || 0
                return (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="p-3 text-sm font-medium">{t.document_type?.name}</td>
                    <td className="p-3 text-sm">v{t.version}</td>
                    <td className="p-3 text-sm">{fieldCount}件</td>
                    <td className="p-3">
                      {t.is_current ? (
                        <Badge className="bg-green-100 text-green-700">現行</Badge>
                      ) : (
                        <Badge variant="secondary">旧版</Badge>
                      )}
                    </td>
                    <td className="p-3 text-sm text-gray-500">{formatDate(t.created_at)}</td>
                    <td className="p-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => setPreviewId(previewId === t.id ? null : t.id)}>
                          {previewId === t.id ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Preview */}
      {previewTemplate && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">
              プレビュー: {previewTemplate.document_type?.name}
            </h3>
            <FormRenderer
              schema={previewTemplate.schema as unknown as FormSchema}
              formData={{}}
              readOnly
            />
          </CardContent>
        </Card>
      )}

      {/* Edit Schema Dialog */}
      <Dialog open={!!editId} onOpenChange={() => setEditId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>テンプレートスキーマ編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>JSON Schema</Label>
            <Textarea
              value={schemaText}
              onChange={e => { setSchemaText(e.target.value); setSchemaError('') }}
              rows={20}
              className="font-mono text-xs"
            />
            {schemaError && <p className="text-sm text-red-500">{schemaError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditId(null)}>キャンセル</Button>
            <Button onClick={saveSchema}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
