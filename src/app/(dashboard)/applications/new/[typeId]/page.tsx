'use client'

import { useEffect, useState } from 'react'
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
import { Save, Send, ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { DocumentType, FormTemplate, FormSchema } from '@/lib/types/database'
import { format } from 'date-fns'

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

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()

      const { data: dt } = await supabase
        .from('document_types')
        .select('*')
        .eq('id', typeId)
        .single()

      if (dt) {
        setDocType(dt)
        const { data: tmpl } = await supabase
          .from('form_templates')
          .select('*')
          .eq('document_type_id', dt.id)
          .eq('is_current', true)
          .single()

        if (tmpl) {
          setTemplate(tmpl)
          // Set default values
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

  const handleSubmit = async (isDraft: boolean) => {
    if (!template || !docType || !currentUser) return

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
          title: `${docType.name} - ${currentUser.name}`,
          submit: !isDraft,
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
          <p className="text-sm text-gray-500">申請者: {currentUser?.name}</p>
        </div>
      </div>

      <FormRenderer
        schema={schema}
        formData={formData}
        onChange={setFormData}
      />

      <div className="flex gap-3 justify-end sticky bottom-6 bg-white/80 backdrop-blur p-4 rounded-lg border shadow-sm">
        <Button
          variant="outline"
          onClick={() => handleSubmit(true)}
          disabled={isSubmitting}
        >
          <Save className="w-4 h-4 mr-2" />
          下書き保存
        </Button>
        <Button
          onClick={() => setShowConfirm(true)}
          disabled={isSubmitting}
          className="bg-[#2563eb] hover:bg-[#1d4ed8]"
        >
          <Send className="w-4 h-4 mr-2" />
          申請する
        </Button>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>申請の確認</AlertDialogTitle>
            <AlertDialogDescription>
              「{docType.name}」を申請します。承認ルートに従って承認者に通知されます。よろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              申請する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
