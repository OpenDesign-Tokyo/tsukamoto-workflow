'use client'

import { useState } from 'react'
import { getDemoUserHeader } from '@/lib/auth/demo-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Loader2, Cloud, CloudOff } from 'lucide-react'
import { toast } from 'sonner'

interface SyncChange {
  type: 'create' | 'update' | 'deactivate'
  entity: 'employee' | 'department' | 'position'
  name: string
  email?: string
  details: Record<string, unknown>
}

interface SyncResult {
  changes: SyncChange[]
  summary: {
    employees: { created: number; updated: number; deactivated: number }
    departments: { created: number }
    positions: { created: number }
  }
}

interface ConnectionStatus {
  configured: boolean
  connected: boolean
  userCount?: number
  message?: string
  error?: string
}

const CHANGE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  create: { label: '新規', color: 'bg-green-100 text-green-800' },
  update: { label: '更新', color: 'bg-blue-100 text-blue-800' },
  deactivate: { label: '無効化', color: 'bg-red-100 text-red-800' },
}

const ENTITY_LABELS: Record<string, string> = {
  employee: 'ユーザー',
  department: '部署',
  position: '役職',
}

export default function GraphSyncPage() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [preview, setPreview] = useState<SyncResult | null>(null)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [showSyncConfirm, setShowSyncConfirm] = useState(false)

  const checkStatus = async () => {
    setIsCheckingStatus(true)
    try {
      const res = await fetch('/api/admin/graph-sync/status', {
        headers: getDemoUserHeader(),
      })
      const data = await res.json()
      setStatus(data)
    } catch {
      toast.error('接続確認に失敗しました')
    } finally {
      setIsCheckingStatus(false)
    }
  }

  const runPreview = async () => {
    setIsPreviewing(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/graph-sync', {
        headers: getDemoUserHeader(),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'プレビューに失敗しました')
        return
      }
      const data: SyncResult = await res.json()
      setPreview(data)
    } catch {
      toast.error('プレビューに失敗しました')
    } finally {
      setIsPreviewing(false)
    }
  }

  const executeSync = async () => {
    setIsSyncing(true)
    try {
      const res = await fetch('/api/admin/graph-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getDemoUserHeader() },
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || '同期に失敗しました')
        return
      }
      const data: SyncResult = await res.json()
      setResult(data)
      setPreview(null)
      toast.success('同期が完了しました')
    } catch {
      toast.error('同期に失敗しました')
    } finally {
      setIsSyncing(false)
      setShowSyncConfirm(false)
    }
  }

  const displayData = result || preview
  const totalChanges = displayData?.changes.length || 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">MS365 組織同期</h1>
        <p className="text-sm text-gray-500 mt-1">
          Microsoft Entra ID からユーザー・部署・役職情報を取得し、組織データを同期します
        </p>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">接続状態</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {status === null ? (
                <span className="text-sm text-gray-500">接続状態を確認してください</span>
              ) : status.configured && status.connected ? (
                <>
                  <Cloud className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-green-700 font-medium">接続済み</span>
                </>
              ) : status.configured ? (
                <>
                  <CloudOff className="w-5 h-5 text-red-500" />
                  <div>
                    <span className="text-sm text-red-600 font-medium">接続エラー</span>
                    {status.error && <p className="text-xs text-red-500 mt-0.5">{status.error}</p>}
                  </div>
                </>
              ) : (
                <>
                  <CloudOff className="w-5 h-5 text-gray-400" />
                  <div>
                    <span className="text-sm text-gray-600 font-medium">未設定</span>
                    <p className="text-xs text-gray-500 mt-0.5">{status.message}</p>
                  </div>
                </>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={checkStatus} disabled={isCheckingStatus}>
              {isCheckingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="ml-1.5">確認</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          onClick={runPreview}
          disabled={isPreviewing || isSyncing || (status !== null && !status.connected)}
          variant="outline"
        >
          {isPreviewing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          プレビュー
        </Button>
        <Button
          onClick={() => setShowSyncConfirm(true)}
          disabled={!preview || isSyncing || totalChanges === 0}
          className="bg-[#2563eb] hover:bg-[#1d4ed8]"
        >
          {isSyncing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Cloud className="w-4 h-4 mr-2" />}
          同期実行
        </Button>
      </div>

      {/* Summary */}
      {displayData && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {result ? '同期結果' : 'プレビュー（変更予定）'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {totalChanges === 0 ? (
              <div className="text-center py-6">
                <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-gray-500">変更はありません。組織データは最新です。</p>
              </div>
            ) : (
              <>
                {/* Summary counts */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-700">{displayData.summary.employees.created}</p>
                    <p className="text-xs text-green-600">ユーザー追加</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-700">{displayData.summary.employees.updated}</p>
                    <p className="text-xs text-blue-600">ユーザー更新</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-700">{displayData.summary.employees.deactivated}</p>
                    <p className="text-xs text-red-600">ユーザー無効化</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-purple-700">{displayData.summary.departments.created}</p>
                    <p className="text-xs text-purple-600">部署追加</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-orange-700">{displayData.summary.positions.created}</p>
                    <p className="text-xs text-orange-600">役職追加</p>
                  </div>
                </div>

                {/* Change list */}
                <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
                  {displayData.changes.map((change, i) => {
                    const typeInfo = CHANGE_TYPE_LABELS[change.type]
                    return (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <Badge variant="secondary" className={`text-xs ${typeInfo.color}`}>
                          {typeInfo.label}
                        </Badge>
                        <span className="text-xs text-gray-400 w-16">{ENTITY_LABELS[change.entity]}</span>
                        <span className="font-medium">{change.name}</span>
                        {change.email && <span className="text-gray-400 text-xs">{change.email}</span>}
                        {change.details && Object.keys(change.details).length > 0 && (
                          <span className="text-xs text-gray-400 ml-auto">
                            {Object.entries(change.details).map(([k, v]) =>
                              typeof v === 'object' ? `${k}: ${JSON.stringify(v)}` : `${k}: ${v}`
                            ).join(', ')}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sync confirmation dialog */}
      <AlertDialog open={showSyncConfirm} onOpenChange={setShowSyncConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>同期の実行</AlertDialogTitle>
            <AlertDialogDescription>
              {totalChanges}件の変更を適用します。この操作はユーザー・部署・役職データを更新します。よろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={executeSync} disabled={isSyncing}>
              {isSyncing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              同期実行
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
