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
}

export function ApprovalActions({ applicationId, onApprove, onReject }: Props) {
  const [comment, setComment] = useState('')
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)

  const handleApprove = async () => {
    setIsApproving(true)
    try {
      await onApprove(comment || undefined)
    } finally {
      setIsApproving(false)
      setShowApproveDialog(false)
    }
  }

  const handleReject = async () => {
    if (!comment.trim()) return
    setIsRejecting(true)
    try {
      await onReject(comment)
    } finally {
      setIsRejecting(false)
      setShowRejectDialog(false)
    }
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
          disabled={isApproving || isRejecting}
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
          disabled={isApproving || isRejecting}
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
            <AlertDialogAction onClick={handleApprove} disabled={isApproving}>
              {isApproving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
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
              disabled={isRejecting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isRejecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              差戻す
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
