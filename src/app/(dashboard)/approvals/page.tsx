'use client'

import { useState } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useApprovals } from '@/hooks/useApprovals'
import { ApplicationCard } from '@/components/workflow/ApplicationCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import type { ApplicationWithDetails } from '@/lib/types/database'

export default function ApprovalsPage() {
  const { currentUser } = useCurrentUser()
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending')
  const { approvals, isLoading } = useApprovals(currentUser?.id, filter)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">承認待ち</h1>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          <TabsTrigger value="pending">未対応</TabsTrigger>
          <TabsTrigger value="completed">対応済み</TabsTrigger>
          <TabsTrigger value="all">全て</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-4 space-y-3">
          {isLoading ? (
            [...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)
          ) : approvals.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {filter === 'pending' ? '承認待ちの案件はありません' : '該当する案件はありません'}
              </p>
            </div>
          ) : (
            approvals.map((approval) => (
              <ApplicationCard
                key={approval.id}
                application={approval.application as unknown as ApplicationWithDetails}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
