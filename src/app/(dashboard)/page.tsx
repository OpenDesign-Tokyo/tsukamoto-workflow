'use client'

import { useEffect, useState, useCallback } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ApplicationCard } from '@/components/workflow/ApplicationCard'
import { FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { ApplicationWithDetails } from '@/lib/types/database'

interface Stats {
  pending: number
  inProgress: number
  completed: number
}

export default function DashboardPage() {
  const { currentUser, isLoading: userLoading } = useCurrentUser()
  const [recentApps, setRecentApps] = useState<ApplicationWithDetails[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<ApplicationWithDetails[]>([])
  const [stats, setStats] = useState<Stats>({ pending: 0, inProgress: 0, completed: 0 })
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!currentUser) return
    const supabase = createClient()

    // Fetch stats
    const [pendingRes, inProgressRes, completedRes] = await Promise.all([
      supabase.from('approval_records').select('*', { count: 'exact', head: true })
        .eq('approver_id', currentUser.id).eq('action', 'pending'),
      supabase.from('applications').select('*', { count: 'exact', head: true })
        .eq('applicant_id', currentUser.id).in('status', ['submitted', 'in_approval']),
      supabase.from('applications').select('*', { count: 'exact', head: true })
        .eq('applicant_id', currentUser.id).eq('status', 'approved'),
    ])

    setStats({
      pending: pendingRes.count || 0,
      inProgress: inProgressRes.count || 0,
      completed: completedRes.count || 0,
    })

    // Fetch recent applications
    const { data: apps } = await supabase
      .from('applications')
      .select(`*, document_type:document_types(*), applicant:employees!applicant_id(*)`)
      .eq('applicant_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(5)

    setRecentApps((apps as unknown as ApplicationWithDetails[]) || [])

    // Fetch pending approvals (applications where I'm the current approver)
    const { data: approvalRecords } = await supabase
      .from('approval_records')
      .select(`
        application_id,
        application:applications(
          *,
          document_type:document_types(*),
          applicant:employees!applicant_id(*)
        )
      `)
      .eq('approver_id', currentUser.id)
      .eq('action', 'pending')
      .limit(5)

    if (approvalRecords) {
      const apps = approvalRecords
        .map(r => r.application as unknown as ApplicationWithDetails)
        .filter(Boolean)
      setPendingApprovals(apps)
    }

    setIsLoading(false)
  }, [currentUser])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (userLoading || isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ダッシュボード</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-sm text-gray-500">承認待ち</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.inProgress}</p>
              <p className="text-sm text-gray-500">申請中</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.completed}</p>
              <p className="text-sm text-gray-500">完了</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Applications */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">最近の申請</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentApps.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">申請はありません</p>
            ) : (
              recentApps.map((app) => (
                <ApplicationCard key={app.id} application={app} />
              ))
            )}
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              承認を待っている案件
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingApprovals.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">承認待ちの案件はありません</p>
            ) : (
              pendingApprovals.map((app) => (
                <ApplicationCard key={app.id} application={app} />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
