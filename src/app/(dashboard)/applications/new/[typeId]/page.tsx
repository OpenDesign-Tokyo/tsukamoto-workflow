'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { getDemoUserHeader } from '@/lib/auth/demo-auth'
import { FormRenderer } from '@/components/forms/FormRenderer'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Save, Send, ArrowLeft, Loader2 } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { ApprovalFlowVisualizer, type FlowStepData } from '@/components/workflow/ApprovalFlowVisualizer'
import { toast } from 'sonner'
import type { DocumentType, FormTemplate, FormSchema } from '@/lib/types/database'
import { format } from 'date-fns'
import { validateFormData } from '@/lib/utils/validateForm'

interface RoutePreviewStep {
  step_order: number
  name: string
  approval_type: string
  allow_dynamic_selection: boolean
  candidates: {
    employeeId: string
    employeeName: string
    positionName: string
    departmentName: string
  }[]
}

/**
 * 申請の確認モーダル内のルート可視化セクション。
 *
 * 設計:
 *   - ApprovalFlowVisualizer で水平ステップを表示（admin/routes と同じ見た目）
 *   - 単独承認(single)で複数候補があるステップは「承認者の選択」を別セクションに分離
 *   - 単一の候補者しかいないステップは選択不要なので表示しない
 *   - 「承認ルート」「承認者の選択」のラベルはカード外側に出して規則性を整える
 */
function ConfirmRoutePreview({
  routePreview,
  selectedApprovers,
  setSelectedApprovers,
}: {
  routePreview: RoutePreviewStep[]
  selectedApprovers: Record<string, string[]>
  setSelectedApprovers: React.Dispatch<React.SetStateAction<Record<string, string[]>>>
}) {
  // 各ステップを Visualizer 用に変換
  const flowSteps: FlowStepData[] = routePreview.map(step => {
    let approvers: FlowStepData['approvers']
    if (step.candidates.length === 0) {
      approvers = []
    } else if (step.approval_type === 'single' && step.candidates.length > 1) {
      // single + 複数候補: 選択中（未選択時はデフォルトの先頭）を1人だけ表示
      const selectedId = selectedApprovers[String(step.step_order)]?.[0] || step.candidates[0].employeeId
      const picked = step.candidates.find(c => c.employeeId === selectedId) || step.candidates[0]
      approvers = [{ name: picked.employeeName, action: 'pending' }]
    } else {
      approvers = step.candidates.map(c => ({ name: c.employeeName, action: 'pending' }))
    }
    return {
      stepOrder: step.step_order,
      name: step.name,
      approvalType: step.approval_type as FlowStepData['approvalType'],
      allowDynamicSelection: step.allow_dynamic_selection,
      approvers,
    }
  })

  // 「単独承認 + 候補が複数 = 申請者が1人指名する必要あり」のステップだけ抽出
  const selectableSteps = routePreview.filter(
    s => s.approval_type === 'single' && s.candidates.length > 1,
  )

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <Label className="text-xs text-gray-500">承認ルート</Label>
        <div className="rounded-lg border bg-gray-50/40 p-3">
          <ApprovalFlowVisualizer steps={flowSteps} />
        </div>
      </section>

      {selectableSteps.length > 0 && (
        <section className="space-y-2">
          <Label className="text-xs text-gray-500">承認者の選択</Label>
          <div className="rounded-lg border bg-amber-50/30 divide-y">
            {selectableSteps.map(step => (
              <div key={step.step_order} className="px-3 py-2.5 flex items-center justify-between gap-3">
                <div className="text-sm flex items-center gap-2 min-w-0">
                  <span className="text-xs text-gray-400 shrink-0">{step.step_order}.</span>
                  <span className="font-medium truncate">{step.name}</span>
                </div>
                <Select
                  value={selectedApprovers[String(step.step_order)]?.[0] || step.candidates[0].employeeId}
                  onValueChange={v => setSelectedApprovers(prev => ({
                    ...prev,
                    [String(step.step_order)]: [v],
                  }))}
                >
                  <SelectTrigger className="h-8 text-xs w-60 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {step.candidates.map(c => (
                      <SelectItem key={c.employeeId} value={c.employeeId}>
                        {c.employeeName}（{c.positionName}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default function NewApplicationFormPage() {
  const params = useParams()
  const router = useRouter()
  const { currentUser } = useCurrentUser()
  const typeId = params.typeId as string

  const [docType, setDocType] = useState<DocumentType | null>(null)
  const [template, setTemplate] = useState<FormTemplate | null>(null)
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [principals, setPrincipals] = useState<{ id: string; name: string; email: string }[]>([])
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null)

  // Route preview
  const [routePreview, setRoutePreview] = useState<RoutePreviewStep[] | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [selectedApprovers, setSelectedApprovers] = useState<Record<string, string[]>>({})

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()

      const { data: dt } = await supabase
        .from('document_types')
        .select('*')
        .eq('id', typeId)
        .maybeSingle()

      if (dt) {
        setDocType(dt)
        const { data: tmpl } = await supabase
          .from('form_templates')
          .select('*')
          .eq('document_type_id', dt.id)
          .eq('is_current', true)
          .maybeSingle()

        if (tmpl) {
          setTemplate(tmpl)
          const schema = tmpl.schema as unknown as FormSchema
          const defaults: Record<string, unknown> = {}
          schema.fields.forEach((f) => {
            if (f.defaultValue === 'today') {
              defaults[f.id] = format(new Date(), 'yyyy-MM-dd')
            }
            if (f.type === 'table') {
              defaults[f.id] = [{}]
            }
          })
          setFormData(defaults)
        }
      }

      setIsLoading(false)
    }
    fetchData()
  }, [typeId])

  // Fetch principals for proxy application
  useEffect(() => {
    if (!docType || !currentUser) return
    const fetchPrincipals = async () => {
      try {
        const res = await fetch(`/api/proxy/principals?document_type_id=${docType.id}`, {
          headers: getDemoUserHeader(),
        })
        if (res.ok) {
          const data = await res.json()
          setPrincipals(data)
        }
      } catch {
        // ignore
      }
    }
    fetchPrincipals()
  }, [docType, currentUser])

  const applicantName = selectedApplicantId
    ? principals.find(p => p.id === selectedApplicantId)?.name
    : currentUser?.name

  const fetchRoutePreview = useCallback(async () => {
    if (!docType) return
    setIsLoadingPreview(true)
    try {
      const res = await fetch('/api/applications/preview-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getDemoUserHeader() },
        body: JSON.stringify({
          document_type_id: docType.id,
          applicant_id: selectedApplicantId || undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json() as RoutePreviewStep[]
        setRoutePreview(data)
        // Auto-select first candidate for single-type steps with multiple candidates
        const autoSelected: Record<string, string[]> = {}
        for (const step of data) {
          if (step.approval_type === 'single' && step.candidates.length > 0) {
            autoSelected[String(step.step_order)] = [step.candidates[0].employeeId]
          }
        }
        setSelectedApprovers(autoSelected)
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingPreview(false)
    }
  }, [docType, selectedApplicantId])

  const handlePrepareSubmit = async () => {
    if (!template || !docType || !currentUser) return

    const schema = template.schema as unknown as FormSchema
    const errors = validateFormData(schema, formData)
    if (errors.length > 0) {
      const errorMap: Record<string, string> = {}
      errors.forEach(e => { errorMap[e.fieldId] = e.message })
      setValidationErrors(errorMap)
      toast.error(`入力エラーが${errors.length}件あります`)
      return
    }
    setValidationErrors({})

    // Fetch route preview
    await fetchRoutePreview()
    setShowConfirm(true)
  }

  const handleSubmit = async (isDraft: boolean) => {
    if (!template || !docType || !currentUser) return

    if (!isDraft) {
      const schema = template.schema as unknown as FormSchema
      const errors = validateFormData(schema, formData)
      if (errors.length > 0) {
        const errorMap: Record<string, string> = {}
        errors.forEach(e => { errorMap[e.fieldId] = e.message })
        setValidationErrors(errorMap)
        toast.error(`入力エラーが${errors.length}件あります`)
        return
      }
      setValidationErrors({})
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getDemoUserHeader(),
        },
        body: JSON.stringify({
          document_type_id: docType.id,
          form_template_id: template.id,
          form_data: formData,
          title: `${docType.name} - ${applicantName}`,
          submit: !isDraft,
          ...(selectedApplicantId ? { applicant_id: selectedApplicantId } : {}),
          ...(!isDraft && Object.keys(selectedApprovers).length > 0 ? { selected_approvers: selectedApprovers } : {}),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || '申請に失敗しました')
        return
      }

      if (isDraft) {
        toast.success('下書きを保存しました')
      } else {
        toast.success('申請を送信しました')
      }
      router.push(`/applications/${data.id}`)
    } catch {
      toast.error('エラーが発生しました')
    } finally {
      setIsSubmitting(false)
      setShowConfirm(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!docType || !template) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">書類種別が見つかりません</p>
        <Button variant="outline" onClick={() => router.back()} className="mt-4">
          戻る
        </Button>
      </div>
    )
  }

  const schema = template.schema as unknown as FormSchema

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{docType.name}</h1>
          {principals.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">申請者:</span>
              <Select
                value={selectedApplicantId || '_self'}
                onValueChange={(v) => setSelectedApplicantId(v === '_self' ? null : v)}
              >
                <SelectTrigger className="w-48 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_self">{currentUser?.name}（本人）</SelectItem>
                  {principals.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}（代理）</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-sm text-gray-500">申請者: {currentUser?.name}</p>
          )}
        </div>
      </div>

      <FormRenderer
        schema={schema}
        formData={formData}
        onChange={setFormData}
        errors={validationErrors}
      />

      <div className="flex gap-3 justify-end sticky bottom-6 bg-white/80 backdrop-blur p-4 rounded-lg border shadow-sm">
        <Button
          variant="outline"
          onClick={() => handleSubmit(true)}
          disabled={isSubmitting || isLoadingPreview}
        >
          {isSubmitting ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />保存中...</>
          ) : (
            <><Save className="w-4 h-4 mr-2" />下書き保存</>
          )}
        </Button>
        <Button
          onClick={handlePrepareSubmit}
          disabled={isSubmitting || isLoadingPreview}
          className="bg-[#2563eb] hover:bg-[#1d4ed8]"
        >
          {isLoadingPreview ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />承認ルート確認中...</>
          ) : (
            <><Send className="w-4 h-4 mr-2" />申請する</>
          )}
        </Button>
      </div>

      <AlertDialog
        open={showConfirm}
        onOpenChange={(open) => { if (!isSubmitting) setShowConfirm(open) }}
      >
        <AlertDialogContent className="max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{isSubmitting ? '申請を送信しています' : '申請の確認'}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              {isSubmitting ? (
                <div className="flex flex-col items-center justify-center gap-4 py-10">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-semibold text-gray-900">申請を送信中...</p>
                    <p className="text-xs text-gray-500">そのままお待ちください（5〜10秒程度）</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <p>「{docType.name}」を申請します。</p>

                  {isLoadingPreview ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      承認ルートを確認中...
                    </div>
                  ) : routePreview && (
                    <ConfirmRoutePreview
                      routePreview={routePreview}
                      selectedApprovers={selectedApprovers}
                      setSelectedApprovers={setSelectedApprovers}
                    />
                  )}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!isSubmitting && (
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleSubmit(false)}
                disabled={isSubmitting || isLoadingPreview}
              >
                申請する
              </AlertDialogAction>
            </AlertDialogFooter>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
