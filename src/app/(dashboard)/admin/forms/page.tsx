'use client'

import { useEffect, useState, useCallback } from 'react'
import { getDemoUserHeader } from '@/lib/auth/demo-auth'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pencil, Eye, EyeOff, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils/format'
import { FormRenderer } from '@/components/forms/FormRenderer'
import { TemplateEditor } from '@/components/admin/TemplateEditor'
import { ExcelTemplateImporter } from '@/components/admin/ExcelTemplateImporter'
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
  const [editTemplate, setEditTemplate] = useState<FormTemplateRow | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importedSchema, setImportedSchema] = useState<FormSchema | null>(null)
  const [selectedDocTypeId, setSelectedDocTypeId] = useState<string>('')

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/admin/templates', { headers: getDemoUserHeader() })
    if (res.ok) setTemplates(await res.json())
    setIsLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const saveSchema = async (templateId: string, schema: FormSchema) => {
    const res = await fetch(`/api/admin/templates/${templateId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getDemoUserHeader() },
      body: JSON.stringify({ schema }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || '保存に失敗しました')
    }
    await fetchData()
  }

  const createFromExcel = async (schema: FormSchema) => {
    if (!selectedDocTypeId) {
      toast.error('書類種別を選択してください')
      return
    }
    const res = await fetch('/api/admin/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getDemoUserHeader() },
      body: JSON.stringify({ document_type_id: selectedDocTypeId, schema }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || '作成に失敗しました')
    }
    toast.success('新しいテンプレートを作成しました')
    setImportedSchema(null)
    setSelectedDocTypeId('')
    await fetchData()
  }

  const handleExcelImport = (schema: FormSchema) => {
    setImportedSchema(schema)
    setShowImportDialog(false)
  }

  const previewTemplate = templates.find(t => t.id === previewId)

  // Unique document types for the select dropdown
  const documentTypes = templates.reduce<{ id: string; name: string }[]>((acc, t) => {
    if (t.document_type && !acc.find(d => d.id === t.document_type.id)) {
      acc.push({ id: t.document_type.id, name: t.document_type.name })
    }
    return acc
  }, [])

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>
  }

  // Full-page editor mode (editing existing template)
  if (editTemplate) {
    return (
      <TemplateEditor
        initialSchema={editTemplate.schema as unknown as FormSchema}
        templateId={editTemplate.id}
        templateName={editTemplate.document_type?.name || 'テンプレート'}
        onSave={schema => saveSchema(editTemplate.id, schema)}
        onCancel={() => setEditTemplate(null)}
      />
    )
  }

  // Full-page editor mode (new template from Excel import)
  if (importedSchema) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <Upload className="w-5 h-5 text-blue-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-800">Excelインポートから新規テンプレートを作成</p>
            <p className="text-xs text-blue-600">保存先の書類種別を選択してください</p>
          </div>
          <Select value={selectedDocTypeId} onValueChange={setSelectedDocTypeId}>
            <SelectTrigger className="w-60 h-9">
              <SelectValue placeholder="書類種別を選択" />
            </SelectTrigger>
            <SelectContent>
              {documentTypes.map(dt => (
                <SelectItem key={dt.id} value={dt.id}>{dt.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <TemplateEditor
          initialSchema={importedSchema}
          templateId=""
          templateName="新規テンプレート（Excelインポート）"
          onSave={schema => createFromExcel(schema)}
          onCancel={() => { setImportedSchema(null); setSelectedDocTypeId('') }}
        />
      </div>
    )
  }

  // Template list view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">フォームテンプレート管理</h1>
        <Button variant="outline" onClick={() => setShowImportDialog(true)}>
          <Upload className="w-4 h-4 mr-1.5" />Excelからインポート
        </Button>
      </div>

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
                const fieldCount = (t.schema as Record<string, unknown[]>)?.fields?.length || 0
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
                        <Button variant="ghost" size="sm" onClick={() => setEditTemplate(t)}>
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

      {/* Excel Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Excelからテンプレートをインポート</DialogTitle>
          </DialogHeader>
          <ExcelTemplateImporter onImport={handleExcelImport} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
