'use client'

import { useState, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
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
import { ArrowLeft, Save, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { FieldList } from './FieldList'
import { SectionManager } from './SectionManager'
import { ExcelTemplateImporter } from './ExcelTemplateImporter'
import { formSchemaValidator } from './schema-validation'
import { FormRenderer } from '@/components/forms/FormRenderer'
import type { FormSchema, FormField, FormSection } from '@/lib/types/database'

interface Props {
  initialSchema: FormSchema
  templateId: string
  templateName: string
  onSave: (schema: FormSchema) => Promise<void>
  onCancel: () => void
}

export function TemplateEditor({ initialSchema, templateId, templateName, onSave, onCancel }: Props) {
  const [fields, setFields] = useState<FormField[]>(initialSchema.fields)
  const [sections, setSections] = useState<FormSection[]>(initialSchema.layout?.sections || [])
  const [version] = useState(initialSchema.version || 1)
  const [activeTab, setActiveTab] = useState<string>('visual')
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(true)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Build current schema from state
  const currentSchema = useMemo<FormSchema>(() => ({
    version,
    fields,
    layout: { type: 'sections', sections },
  }), [version, fields, sections])

  const handleFieldsChange = useCallback((newFields: FormField[]) => {
    setFields(newFields)
    setHasChanges(true)
  }, [])

  const handleSectionsChange = useCallback((newSections: FormSection[]) => {
    setSections(newSections)
    setHasChanges(true)
  }, [])

  // Tab switching: sync JSON text
  const handleTabChange = useCallback((tab: string) => {
    if (tab === 'json') {
      setJsonText(JSON.stringify(currentSchema, null, 2))
      setJsonError('')
    }
    if (activeTab === 'json' && tab !== 'json' && jsonText) {
      try {
        const parsed = JSON.parse(jsonText) as FormSchema
        setFields(parsed.fields || [])
        setSections(parsed.layout?.sections || [])
        setHasChanges(true)
      } catch {
        // If JSON is invalid, don't switch
        setJsonError('無効なJSON形式です。修正してからタブを切り替えてください。')
        return
      }
    }
    setActiveTab(tab)
  }, [activeTab, currentSchema, jsonText])

  // Excel import
  const handleExcelImport = useCallback((schema: FormSchema) => {
    setFields(schema.fields)
    setSections(schema.layout?.sections || [])
    setHasChanges(true)
    setActiveTab('visual')
    toast.success('Excelからインポートしました')
  }, [])

  // Save
  const handleSave = useCallback(async () => {
    // If on JSON tab, sync first
    let schemaToSave = currentSchema
    if (activeTab === 'json') {
      try {
        schemaToSave = JSON.parse(jsonText) as FormSchema
      } catch {
        setJsonError('無効なJSON形式です')
        return
      }
    }

    // Validate
    const result = formSchemaValidator.safeParse(schemaToSave)
    if (!result.success) {
      const issues = result.error.issues.map(i => i.message).join(', ')
      toast.error(`バリデーションエラー: ${issues}`)
      return
    }

    setIsSaving(true)
    try {
      await onSave(schemaToSave)
      setHasChanges(false)
      toast.success('テンプレートを保存しました')
    } catch (e) {
      toast.error(`保存に失敗しました: ${e instanceof Error ? e.message : '不明なエラー'}`)
    } finally {
      setIsSaving(false)
    }
  }, [activeTab, currentSchema, jsonText, onSave])

  // Cancel with unsaved changes warning
  const handleCancel = useCallback(() => {
    if (hasChanges) {
      setShowCancelDialog(true)
    } else {
      onCancel()
    }
  }, [hasChanges, onCancel])

  // Suppress unused var warning
  void templateId

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            <ArrowLeft className="w-4 h-4 mr-1" />戻る
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <h2 className="text-lg font-semibold">{templateName}</h2>
            <p className="text-xs text-gray-500">テンプレート編集</p>
          </div>
          {hasChanges && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">未保存</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
            プレビュー
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            <Save className="w-4 h-4 mr-1" />
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className={`flex gap-4 ${showPreview ? '' : ''}`}>
        {/* Editor panel */}
        <div className={showPreview ? 'w-3/5' : 'w-full'}>
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="mb-3">
              <TabsTrigger value="visual">ビジュアル</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
              <TabsTrigger value="excel">Excelインポート</TabsTrigger>
            </TabsList>

            <TabsContent value="visual" className="space-y-4">
              {/* Section Manager */}
              <SectionManager
                sections={sections}
                allFields={fields}
                onChange={handleSectionsChange}
              />

              <Separator />

              {/* Field List */}
              <div>
                <h4 className="text-xs font-medium text-gray-500 mb-2">
                  フィールド一覧（{fields.length}件）
                </h4>
                <FieldList fields={fields} onFieldsChange={handleFieldsChange} />
              </div>
            </TabsContent>

            <TabsContent value="json" className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">JSON Schemaを直接編集できます</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    try {
                      const formatted = JSON.stringify(JSON.parse(jsonText), null, 2)
                      setJsonText(formatted)
                      setJsonError('')
                    } catch {
                      setJsonError('JSONの整形に失敗しました')
                    }
                  }}
                >
                  整形
                </Button>
              </div>
              <Textarea
                value={jsonText}
                onChange={e => {
                  setJsonText(e.target.value)
                  setJsonError('')
                  setHasChanges(true)
                }}
                rows={30}
                className="font-mono text-xs"
              />
              {jsonError && <p className="text-sm text-red-500">{jsonError}</p>}
            </TabsContent>

            <TabsContent value="excel">
              <ExcelTemplateImporter onImport={handleExcelImport} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Preview panel */}
        {showPreview && (
          <div className="w-2/5 border rounded-lg">
            <div className="bg-gray-50 px-4 py-2 border-b rounded-t-lg">
              <h3 className="text-sm font-medium text-gray-600">プレビュー</h3>
            </div>
            <ScrollArea className="h-[calc(100vh-240px)] p-4">
              {fields.length > 0 ? (
                <FormRenderer
                  schema={currentSchema}
                  formData={{}}
                  readOnly
                />
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">
                  フィールドを追加するとプレビューが表示されます
                </p>
              )}
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Unsaved changes dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>未保存の変更があります</AlertDialogTitle>
            <AlertDialogDescription>
              変更内容は破棄されます。よろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>編集を続ける</AlertDialogCancel>
            <AlertDialogAction onClick={onCancel}>破棄して戻る</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
