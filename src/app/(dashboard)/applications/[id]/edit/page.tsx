'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
import type { FormSchema } from '@/lib/types/database'

export default function EditApplicationPage() {
  const params = useParams()
  const router = useRouter()
  const { currentUser } = useCurrentUser()
  const id = params.id as string

  const [application, setApplication] = useState<any>(null)
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch(`/api/applications/${id}`, {
        headers: getDemoUserHeader(),
      })
      if (res.ok) {
        const data = await res.json()
        setApplication(data)
        setFormData(data.form_data || {})
      }
      setIsLoading(false)
    }
    fetchData()
  }, [id])

  const handleSave = async (submit: boolean) => {
    if (!application || !currentUser) return

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getDemoUserHeader(),
        },
        body: JSON.stringify({
          form_data: formData,
          title: application.title,
          submit,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || '保存に失敗しました')
        return
      }

      if (submit) {
        toast.success('申請を送信しました')
      } else {
        toast.success('下書きを保存しました')
      }
      router.push(`/applications/${id}`)
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

  if (!application) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">申請が見つかりません</p>
        <Button variant="outline" onClick={() => router.back()} className="mt-4">戻る</Button>
      </div>
    )
  }

  // Only editable if draft or rejected and user is applicant or proxy applicant
  const canEdit = (application.status === 'draft' || application.status === 'rejected') &&
    (application.applicant_id === currentUser?.id || application.proxy_applicant_id === currentUser?.id)

  if (!canEdit) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">この申請は編集できません</p>
        <Button variant="outline" onClick={() => router.push(`/applications/${id}`)} className="mt-4">詳細に戻る</Button>
      </div>
    )
  }

  const schema = application.form_template?.schema as unknown as FormSchema
  const isResubmit = application.status === 'rejected'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {isResubmit ? '再申請' : '下書き編集'}: {application.document_type?.name}
          </h1>
          <p className="text-sm text-gray-500">申請者: {currentUser?.name}</p>
        </div>
      </div>

      {isResubmit && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          この申請は差戻されました。内容を修正して再申請してください。
          {application.approval_records?.filter((r: any) => r.action === 'rejected').map((r: any) => (
            <div key={r.id} className="mt-2 pl-3 border-l-2 border-amber-300">
              <p className="font-medium">{r.approver?.name}: {r.comment}</p>
            </div>
          ))}
        </div>
      )}

      {schema ? (
        <FormRenderer
          schema={schema}
          formData={formData}
          onChange={setFormData}
        />
      ) : (
        <p className="text-gray-500">フォームテンプレートが見つかりません</p>
      )}

      <div className="flex gap-3 justify-end sticky bottom-6 bg-white/80 backdrop-blur p-4 rounded-lg border shadow-sm">
        <Button
          variant="outline"
          onClick={() => handleSave(false)}
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
          {isResubmit ? '再申請する' : '申請する'}
        </Button>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isResubmit ? '再申請の確認' : '申請の確認'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isResubmit
                ? '修正した内容で再申請します。承認ルートの最初から承認が行われます。よろしいですか？'
                : '申請を送信します。承認者に通知されます。よろしいですか？'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleSave(true)}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {isResubmit ? '再申請する' : '申請する'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
