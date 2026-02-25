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
import { Textarea } from '@/components/ui/textarea'
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
import { ArrowLeft, User, Calendar, Hash, Pencil, XCircle, Send, Download } from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/utils/format'
import { toast } from 'sonner'
import type { ApplicationStatus } from '@/lib/types/workflow'
import type { FormSchema } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import { exportApplicationPdf } from '@/lib/utils/exportPdf'

interface Comment {
  id: string
  application_id: string
  author_id: string
  body: string
  is_internal: boolean
  created_at: string
  author?: { name: string }
}

export default function ApplicationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { currentUser } = useCurrentUser()
  const id = params.id as string

  const [application, setApplication] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [isSendingComment, setIsSendingComment] = useState(false)

  const fetchApplication = useCallback(async () => {
    const res = await fetch(`/api/applications/${id}`, {
      headers: getDemoUserHeader(),
      cache: 'no-store',
    })
    if (res.ok) {
      setApplication(await res.json())
    }
    setIsLoading(false)
  }, [id])

  const fetchComments = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('application_comments')
      .select('*, author:employees!author_id(name)')
      .eq('application_id', id)
      .order('created_at', { ascending: true })
    if (data) setComments(data as Comment[])
  }, [id])

  useEffect(() => {
    fetchApplication()
    fetchComments()
  }, [fetchApplication, fetchComments])

  const handleApprove = async (comment?: string) => {
    setIsProcessing(true)
    try {
      const res = await fetch(`/api/applications/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getDemoUserHeader() },
        body: JSON.stringify({ comment }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.application) setApplication(data.application)
        else await fetchApplication()
        toast.success('承認しました')
      } else {
        const data = await res.json()
        toast.error(data.error || '承認に失敗しました')
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async (comment: string) => {
    setIsProcessing(true)
    try {
      const res = await fetch(`/api/applications/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getDemoUserHeader() },
        body: JSON.stringify({ comment }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.application) setApplication(data.application)
        else await fetchApplication()
        toast.success('差戻ししました')
      } else {
        const data = await res.json()
        toast.error(data.error || '差戻しに失敗しました')
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const handleWithdraw = async () => {
    setIsProcessing(true)
    try {
      const res = await fetch(`/api/applications/${id}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getDemoUserHeader() },
      })
      if (res.ok) {
        const data = await res.json()
        if (data.application) setApplication(data.application)
        else await fetchApplication()
        toast.success('申請を取り下げました')
      } else {
        const data = await res.json()
        toast.error(data.error || '取下げに失敗しました')
      }
    } finally {
      setIsProcessing(false)
      setShowWithdrawConfirm(false)
    }
  }

  const handleSendComment = async () => {
    if (!newComment.trim() || !currentUser) return
    setIsSendingComment(true)
    try {
      const supabase = createClient()
      await supabase.from('application_comments').insert({
        application_id: id,
        author_id: currentUser.id,
        body: newComment.trim(),
        is_internal: false,
      })
      setNewComment('')
      await fetchComments()
    } finally {
      setIsSendingComment(false)
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
    <div className="max-w-6xl mx-auto space-y-6">
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
          {schema && application.status === 'approved' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportApplicationPdf(application, schema)}
            >
              <Download className="w-4 h-4 mr-1" />
              PDF
            </Button>
          )}
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
              disabled={isProcessing}
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

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Approval Timeline */}
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
              disabled={isProcessing}
            />
          )}

          {/* Applicant actions for rejected */}
          {isApplicant && application.status === 'rejected' && (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500 mb-3">差戻されました。修正して再申請できます。</p>
                <Button className="w-full" onClick={() => router.push(`/applications/${id}/edit`)}>
                  <Pencil className="w-4 h-4 mr-2" />修正して再申請
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Draft actions */}
          {isApplicant && application.status === 'draft' && (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500 mb-3">下書き状態です。編集して申請できます。</p>
                <Button className="w-full" onClick={() => router.push(`/applications/${id}/edit`)}>
                  <Pencil className="w-4 h-4 mr-2" />編集する
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Comments */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">コメント</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {comments.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">コメントはまだありません</p>
              )}
              {comments.map((c) => (
                <div key={c.id} className="bg-gray-50 rounded-md p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700">{c.author?.name || '不明'}</span>
                    <span className="text-[10px] text-gray-400">{formatDateTime(c.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{c.body}</p>
                </div>
              ))}
              {currentUser && application.status !== 'draft' && (
                <div className="flex gap-2">
                  <Textarea
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="コメントを入力..."
                    rows={2}
                    className="text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={handleSendComment}
                    disabled={!newComment.trim() || isSendingComment}
                    className="shrink-0 self-end"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
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
              disabled={isProcessing}
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
