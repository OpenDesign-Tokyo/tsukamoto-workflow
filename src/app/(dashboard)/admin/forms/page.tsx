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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Pencil, Eye, EyeOff, Upload, Trash2, GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils/format'
import { FormRenderer } from '@/components/forms/FormRenderer'
import { TemplateEditor } from '@/components/admin/TemplateEditor'
import { ExcelTemplateImporter } from '@/components/admin/ExcelTemplateImporter'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { FormSchema } from '@/lib/types/database'

interface FormTemplateRow {
  id: string
  version: number
  is_current: boolean
  created_at: string
  schema: unknown
  document_type: { id: string; name: string; code: string; sort_order?: number }
}

interface DocumentType {
  id: string
  name: string
  code: string
  category: string
}

// ============================================================================
// Sortable row component
// ============================================================================

function SortableTemplateRow({
  t,
  previewId,
  onTogglePreview,
  onEdit,
  onDelete,
}: {
  t: FormTemplateRow
  previewId: string | null
  onTogglePreview: (id: string) => void
  onEdit: (t: FormTemplateRow) => void
  onDelete: (t: FormTemplateRow) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: t.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const fieldCount = (t.schema as Record<string, unknown[]>)?.fields?.length || 0

  return (
    <tr ref={setNodeRef} style={style} className="hover:bg-gray-50">
      <td className="p-3 w-8">
        <button
          type="button"
          className="cursor-grab text-gray-400 hover:text-gray-600"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </td>
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
          <Button variant="ghost" size="sm" onClick={() => onTogglePreview(t.id)}>
            {previewId === t.id ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onEdit(t)}>
            <Pencil className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(t)}
            className="text-gray-400 hover:text-red-600"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </td>
    </tr>
  )
}

// ============================================================================
// Main page
// ============================================================================

export default function FormsPage() {
  const [templates, setTemplates] = useState<FormTemplateRow[]>([])
  const [allDocTypes, setAllDocTypes] = useState<DocumentType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [editTemplate, setEditTemplate] = useState<FormTemplateRow | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importedSchema, setImportedSchema] = useState<FormSchema | null>(null)
  const [selectedDocTypeId, setSelectedDocTypeId] = useState<string>('')

  const fetchData = useCallback(async () => {
    const [templatesRes, docTypesRes] = await Promise.all([
      fetch('/api/admin/templates', { headers: getDemoUserHeader() }),
      fetch('/api/admin/document-types', { headers: getDemoUserHeader() }),
    ])
    if (templatesRes.ok) setTemplates(await templatesRes.json())
    if (docTypesRes.ok) setAllDocTypes(await docTypesRes.json())
    setIsLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = templates.findIndex(t => t.id === active.id)
    const newIndex = templates.findIndex(t => t.id === over.id)
    const reordered = arrayMove(templates, oldIndex, newIndex)
    setTemplates(reordered)

    // Persist new order by updating document_types.sort_order
    const order = reordered.map((t, i) => ({
      document_type_id: t.document_type?.id,
      sort_order: i,
    })).filter(item => item.document_type_id)

    try {
      await fetch('/api/admin/templates/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getDemoUserHeader() },
        body: JSON.stringify({ order }),
      })
    } catch {
      // Revert on error
      await fetchData()
    }
  }

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

  const [deleteTarget, setDeleteTarget] = useState<FormTemplateRow | null>(null)

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/admin/templates/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: getDemoUserHeader(),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || '削除に失敗しました')
        return
      }
      toast.success('テンプレートを削除しました')
      setDeleteTarget(null)
      await fetchData()
    } catch {
      toast.error('エラーが発生しました')
    }
  }

  const previewTemplate = templates.find(t => t.id === previewId)

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
              {allDocTypes.map(dt => (
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
                <th className="w-8 p-3"></th>
                <th className="text-left p-3">書類種別</th>
                <th className="text-left p-3">バージョン</th>
                <th className="text-left p-3">フィールド数</th>
                <th className="text-left p-3">状態</th>
                <th className="text-left p-3">作成日</th>
                <th className="text-right p-3">操作</th>
              </tr>
            </thead>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={templates.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <tbody className="divide-y">
                  {templates.map(t => (
                    <SortableTemplateRow
                      key={t.id}
                      t={t}
                      previewId={previewId}
                      onTogglePreview={(id) => setPreviewId(previewId === id ? null : id)}
                      onEdit={setEditTemplate}
                      onDelete={setDeleteTarget}
                    />
                  ))}
                </tbody>
              </SortableContext>
            </DndContext>
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>テンプレートの削除</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.document_type?.name} v{deleteTarget?.version}」を削除しますか？
              申請で使用されている場合は削除できません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
