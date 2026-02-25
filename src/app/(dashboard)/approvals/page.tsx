'use client'

import { useState, useCallback } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useApprovals, type PendingApproval } from '@/hooks/useApprovals'
import { ApplicationCard } from '@/components/workflow/ApplicationCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Search, ChevronLeft, ChevronRight, CheckSquare, Loader2 } from 'lucide-react'
import { getDemoUserHeader } from '@/lib/auth/demo-auth'
import { toast } from 'sonner'
import type { ApplicationWithDetails } from '@/lib/types/database'

export default function ApprovalsPage() {
  const { currentUser } = useCurrentUser()
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBatchProcessing, setIsBatchProcessing] = useState(false)

  const { approvals, isLoading, totalPages, refetch } = useApprovals(
    currentUser?.id,
    filter,
    debouncedSearch,
    page
  )

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
    clearTimeout((globalThis as any).__approvalSearchTimer)
    ;(globalThis as any).__approvalSearchTimer = setTimeout(() => setDebouncedSearch(value), 300)
  }

  const handleFilterChange = (v: string) => {
    setFilter(v as typeof filter)
    setPage(1)
    setSelectedIds(new Set())
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    const pendingApprovals = approvals.filter(a => a.action === 'pending')
    if (selectedIds.size === pendingApprovals.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pendingApprovals.map(a => a.application_id)))
    }
  }

  const handleBatchApprove = useCallback(async () => {
    if (selectedIds.size === 0) return
    setIsBatchProcessing(true)
    try {
      const results = await Promise.allSettled(
        Array.from(selectedIds).map(appId =>
          fetch(`/api/applications/${appId}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getDemoUserHeader() },
            body: JSON.stringify({ comment: '一括承認' }),
          })
        )
      )
      const succeeded = results.filter(r => r.status === 'fulfilled' && (r.value as Response).ok).length
      const failed = results.length - succeeded
      if (succeeded > 0) toast.success(`${succeeded}件を承認しました`)
      if (failed > 0) toast.error(`${failed}件の承認に失敗しました`)
      setSelectedIds(new Set())
      refetch()
    } finally {
      setIsBatchProcessing(false)
    }
  }, [selectedIds, refetch])

  const pendingApprovals = approvals.filter(a => a.action === 'pending')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">承認待ち</h1>
        {filter === 'pending' && selectedIds.size > 0 && (
          <Button
            onClick={handleBatchApprove}
            disabled={isBatchProcessing}
            className="bg-green-600 hover:bg-green-700"
          >
            {isBatchProcessing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckSquare className="w-4 h-4 mr-2" />
            )}
            {selectedIds.size}件を一括承認
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="タイトル・申請番号・申請者で検索..."
          className="pl-10"
        />
      </div>

      <Tabs value={filter} onValueChange={handleFilterChange}>
        <TabsList>
          <TabsTrigger value="pending">未対応</TabsTrigger>
          <TabsTrigger value="completed">対応済み</TabsTrigger>
          <TabsTrigger value="all">全て</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-4 space-y-3">
          {/* Select all (pending tab only) */}
          {filter === 'pending' && pendingApprovals.length > 0 && (
            <div className="flex items-center gap-2 px-2">
              <Checkbox
                checked={selectedIds.size > 0 && selectedIds.size === pendingApprovals.length}
                onCheckedChange={toggleAll}
              />
              <span className="text-xs text-gray-500">全て選択</span>
            </div>
          )}

          {isLoading ? (
            [...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)
          ) : approvals.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {filter === 'pending' ? '承認待ちの案件はありません' : '該当する案件はありません'}
              </p>
            </div>
          ) : (
            <>
              {approvals.map((approval) => (
                <div key={approval.id} className="flex items-start gap-2">
                  {filter === 'pending' && approval.action === 'pending' && (
                    <Checkbox
                      checked={selectedIds.has(approval.application_id)}
                      onCheckedChange={() => toggleSelect(approval.application_id)}
                      className="mt-4"
                    />
                  )}
                  <div className="flex-1">
                    <ApplicationCard
                      application={approval.application as unknown as ApplicationWithDetails}
                    />
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-600">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
