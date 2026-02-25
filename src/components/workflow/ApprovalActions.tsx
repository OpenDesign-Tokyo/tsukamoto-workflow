'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Check, X, Loader2 } from 'lucide-react'
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

interface Props {
  applicationId: string
  onApprove: (comment?: string) => Promise<void>
  onReject: (comment: string) => Promise<void>
  disabled?: boolean
}

export function ApprovalActions({ applicationId, onApprove, onReject, disabled }: Props) {
  const [comment, setComment] = useState('')
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)

  const isProcessing = isApproving || isRejecting

  const handleApprove = async () => {
    setIsApproving(true)
    setShowApproveDialog(false)
    try {
      await onApprove(comment || undefined)
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
          onClick={() => setShowApproveDialog(true)}
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
            <AlertDialogDescription>
              この申請を承認します。よろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove}>
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
