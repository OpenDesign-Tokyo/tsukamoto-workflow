'use client'

import { useApplications } from '@/hooks/useApplications'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { ApplicationCard } from '@/components/workflow/ApplicationCard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { FilePlus } from 'lucide-react'
import Link from 'next/link'

export default function ApplicationsPage() {
  const { currentUser } = useCurrentUser()
  const { applications, isLoading } = useApplications(currentUser?.id)

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

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : applications.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">申請がありません</p>
          <Link href="/applications/new">
            <Button className="mt-4" variant="outline">
              <FilePlus className="w-4 h-4 mr-2" />
              最初の申請を作成
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <ApplicationCard key={app.id} application={app} />
          ))}
        </div>
      )}
    </div>
  )
}
