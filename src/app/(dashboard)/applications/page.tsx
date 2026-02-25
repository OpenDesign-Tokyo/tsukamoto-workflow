'use client'

import { useState } from 'react'
import { useApplications } from '@/hooks/useApplications'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { ApplicationCard } from '@/components/workflow/ApplicationCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FilePlus, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { STATUS_LABELS, type ApplicationStatus } from '@/lib/types/workflow'
import Link from 'next/link'

const STATUS_OPTIONS: { value: ApplicationStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全てのステータス' },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value: value as ApplicationStatus, label })),
]

export default function ApplicationsPage() {
  const { currentUser } = useCurrentUser()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all')
  const [page, setPage] = useState(1)

  const { applications, isLoading, totalCount, totalPages } = useApplications(
    currentUser?.id,
    { statusFilter, search: debouncedSearch, page }
  )

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
    clearTimeout((globalThis as any).__appSearchTimer)
    ;(globalThis as any).__appSearchTimer = setTimeout(() => setDebouncedSearch(value), 300)
  }

  const handleStatusChange = (value: string) => {
    setStatusFilter(value as ApplicationStatus | 'all')
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">申請一覧</h1>
        <Link href="/applications/new">
          <Button>
            <FilePlus className="w-4 h-4 mr-2" />
            新規申請
          </Button>
        </Link>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="申請番号・タイトルで検索..."
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : applications.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">
            {debouncedSearch || statusFilter !== 'all' ? '条件に一致する申請がありません' : '申請がありません'}
          </p>
          {!debouncedSearch && statusFilter === 'all' && (
            <Link href="/applications/new">
              <Button className="mt-4" variant="outline">
                <FilePlus className="w-4 h-4 mr-2" />
                最初の申請を作成
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>{totalCount}件中 {(page - 1) * 20 + 1}-{Math.min(page * 20, totalCount)}件</span>
          </div>
          <div className="space-y-3">
            {applications.map((app) => (
              <ApplicationCard key={app.id} application={app} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
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
    </div>
  )
}
