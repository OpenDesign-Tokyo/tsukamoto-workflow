'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Check, X, Loader2, User } from 'lucide-react'
import { getDemoUserHeader } from '@/lib/auth/demo-auth'
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

interface NextStepCandidate {
  employeeId: string
  employeeName: string
  positionName: string
  departmentName: string
}

interface NextStepInfo {
  needsSelection: boolean
  stepName?: string
  stepOrder?: number
  approvalType?: string
  candidates: NextStepCandidate[]
}

interface Props {
  applicationId: string
  onApprove: (comment?: string, selectedNextApprovers?: string[]) => Promise<void>
  onReject: (comment: string) => Promise<void>
  disabled?: boolean
}

export function ApprovalActions({ applicationId, onApprove, onReject, disabled }: Props) {
  const [comment, setComment] = useState('')
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)

  // Dynamic selection state
  const [nextStepInfo, setNextStepInfo] = useState<NextStepInfo | null>(null)
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false)
  const [selectedNextApprovers, setSelectedNextApprovers] = useState<string[]>([])

  const isProcessing = isApproving || isRejecting

  const fetchNextStepCandidates = useCallback(async () => {
    setIsLoadingCandidates(true)
    try {
      const res = await fetch(`/api/applications/${applicationId}/next-step-candidates`, {
        headers: getDemoUserHeader(),
      })
      if (res.ok) {
        const data = await res.json() as NextStepInfo
        setNextStepInfo(data)
        if (data.needsSelection && data.candidates.length > 0) {
          // Pre-select all candidates
          setSelectedNextApprovers(data.candidates.map(c => c.employeeId))
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingCandidates(false)
    }
  }, [applicationId])

  const handleApproveClick = async () => {
    // Fetch next step candidates first
    await fetchNextStepCandidates()
    setShowApproveDialog(true)
  }

  const handleApprove = async () => {
    setIsApproving(true)
    setShowApproveDialog(false)
    try {
      const nextApprovers = nextStepInfo?.needsSelection && selectedNextApprovers.length > 0
        ? selectedNextApprovers
        : undefined
      await onApprove(comment || undefined, nextApprovers)
    } finally {
      setIsApproving(false)
    }
  }

  const handleReject = async () => {
    if (!comment.trim()) return
    setIsRejecting(true)
    setShowRejectDialog(false)
    try {
      await onReject(comment)
    } finally {
      setIsRejecting(false)
    }
  }

  const toggleNextApprover = (id: string) => {
    setSelectedNextApprovers(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  if (isProcessing) {
    return (
      <div className="p-6 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="relative">
            <div className="w-10 h-10 rounded-full border-3 border-blue-200 border-t-blue-600 animate-spin" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-blue-900">
              {isApproving ? '承認処理中...' : '差戻し処理中...'}
            </p>
            <p className="text-xs text-blue-600">
              現在処理を実行しています。そのままお待ちください。
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
      <h3 className="font-semibold text-sm text-blue-900">承認アクション</h3>

      <Textarea
        placeholder="コメント（任意。差戻しの場合は理由を記入してください）"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
      />

      <div className="flex gap-3">
        <Button
          onClick={handleApproveClick}
          className="bg-green-600 hover:bg-green-700 flex-1"
          disabled={disabled}
        >
          <Check className="w-4 h-4 mr-2" />
          承認する
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            if (!comment.trim()) {
              alert('差戻しの場合はコメントを入力してください')
              return
            }
            setShowRejectDialog(true)
          }}
          className="flex-1"
          disabled={disabled}
        >
          <X className="w-4 h-4 mr-2" />
          差戻す
        </Button>
      </div>

      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>承認の確認</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>この申請を承認します。よろしいですか？</p>
                {isLoadingCandidates && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    次のステップを確認中...
                  </div>
                )}
                {nextStepInfo?.needsSelection && nextStepInfo.candidates.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                    <p className="text-sm font-medium text-gray-700">
                      次のステップ「{nextStepInfo.stepName}」の承認者を選択してください
                    </p>
                    <div className="space-y-1.5">
                      {nextStepInfo.candidates.map(c => (
                        <label
                          key={c.employeeId}
                          className="flex items-center gap-2 p-2 rounded-md hover:bg-white cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedNextApprovers.includes(c.employeeId)}
                            onChange={() => toggleNextApprover(c.employeeId)}
                            className="rounded border-gray-300"
                          />
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-sm">{c.employeeName}</span>
                          <span className="text-xs text-gray-400">（{c.positionName}・{c.departmentName}）</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprove}
              disabled={isLoadingCandidates || (nextStepInfo?.needsSelection && selectedNextApprovers.length === 0)}
            >
              承認する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>差戻しの確認</AlertDialogTitle>
            <AlertDialogDescription>
              この申請を差し戻します。よろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="bg-red-600 hover:bg-red-700"
            >
              差戻す
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
