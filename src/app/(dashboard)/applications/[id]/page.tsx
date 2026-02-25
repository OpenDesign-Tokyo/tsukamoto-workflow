'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { getDemoUserHeader } from '@/lib/auth/demo-auth'
import { FormRenderer } from '@/components/forms/FormRenderer'
import { ApprovalTimeline } from '@/components/workflow/ApprovalTimeline'
import { ApprovalActions } from '@/components/workflow/ApprovalActions'
import { StatusBadge } from '@/components/workflow/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { ArrowLeft, User, Calendar, Hash, Pencil, XCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils/format'
import { toast } from 'sonner'
import type { ApplicationStatus } from '@/lib/types/workflow'
import type { FormSchema } from '@/lib/types/database'

export default function ApplicationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { currentUser } = useCurrentUser()
  const id = params.id as string

  const [application, setApplication] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)

  const fetchApplication = useCallback(async () => {
    const res = await fetch(`/api/applications/${id}`, {
      headers: getDemoUserHeader(),
    })
    if (res.ok) {
      setApplication(await res.json())
    }
    setIsLoading(false)
  }, [id])

  useEffect(() => {
    fetchApplication()
  }, [fetchApplication])

  const handleApprove = async (comment?: string) => {
    const res = await fetch(`/api/applications/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getDemoUserHeader() },
      body: JSON.stringify({ comment }),
    })
    if (res.ok) {
      toast.success('承認しました')
      fetchApplication()
    } else {
      const data = await res.json()
      toast.error(data.error || '承認に失敗しました')
    }
  }

  const handleReject = async (comment: string) => {
    const res = await fetch(`/api/applications/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getDemoUserHeader() },
      body: JSON.stringify({ comment }),
    })
    if (res.ok) {
      toast.success('差戻ししました')
      fetchApplication()
    } else {
      const data = await res.json()
      toast.error(data.error || '差戻しに失敗しました')
    }
  }

  const handleWithdraw = async () => {
    setIsWithdrawing(true)
    try {
      const res = await fetch(`/api/applications/${id}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getDemoUserHeader() },
      })
      if (res.ok) {
        toast.success('申請を取り下げました')
        fetchApplication()
      } else {
        const data = await res.json()
        toast.error(data.error || '取下げに失敗しました')
      }
    } finally {
      setIsWithdrawing(false)
      setShowWithdrawConfirm(false)
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

  const schema = application.form_template?.schema as unknown as FormSchema
  const isCurrentApprover = application.approval_records?.some(
    (r: any) => r.approver_id === currentUser?.id && r.action === 'pending'
  )
  const isApplicant = application.applicant_id === currentUser?.id
  const canEdit = isApplicant && (application.status === 'draft' || application.status === 'rejected')
  const canWithdraw = isApplicant && (application.status === 'submitted' || application.status === 'in_approval')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{application.title}</h1>
            <StatusBadge status={application.status as ApplicationStatus} />
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/applications/${id}/edit`)}
            >
              <Pencil className="w-4 h-4 mr-1" />
              編集
            </Button>
          )}
          {canWithdraw && (
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => setShowWithdrawConfirm(true)}
            >
              <XCircle className="w-4 h-4 mr-1" />
              取下げ
            </Button>
          )}
        </div>
      </div>

      {/* Meta info */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">申請番号</p>
                <p className="font-mono">{application.application_number}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">申請者</p>
                <p>{application.applicant?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">申請日</p>
                <p>{formatDate(application.submitted_at || application.created_at)}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500">書類種別</p>
              <p>{application.document_type?.name}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form content */}
        <div className="lg:col-span-2">
          {schema ? (
            <FormRenderer
              schema={schema}
              formData={application.form_data || {}}
              readOnly
            />
          ) : (
            <Card>
              <CardContent className="p-4">
                <p className="text-gray-500">フォームテンプレートが見つかりません</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar: Approval timeline + actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">承認状況</CardTitle>
            </CardHeader>
            <CardContent>
              <ApprovalTimeline
                records={application.approval_records || []}
                totalSteps={application.total_steps}
                currentStep={application.current_step}
              />
            </CardContent>
          </Card>

          {/* Approval actions */}
          {isCurrentApprover && (
            <ApprovalActions
              applicationId={application.id}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          )}

          {/* Applicant actions for rejected */}
          {isApplicant && application.status === 'rejected' && (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500 mb-3">差戻されました。修正して再申請できます。</p>
                <Button
                  className="w-full"
                  onClick={() => router.push(`/applications/${id}/edit`)}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  修正して再申請
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Draft actions */}
          {isApplicant && application.status === 'draft' && (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500 mb-3">下書き状態です。編集して申請できます。</p>
                <Button
                  className="w-full"
                  onClick={() => router.push(`/applications/${id}/edit`)}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  編集する
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Withdraw confirmation dialog */}
      <AlertDialog open={showWithdrawConfirm} onOpenChange={setShowWithdrawConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>申請の取下げ</AlertDialogTitle>
            <AlertDialogDescription>
              この申請を取り下げます。承認中の場合、承認プロセスが中断されます。よろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleWithdraw}
              disabled={isWithdrawing}
              className="bg-red-600 hover:bg-red-700"
            >
              取り下げる
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
