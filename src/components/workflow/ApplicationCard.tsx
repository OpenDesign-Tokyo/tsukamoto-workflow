'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from './StatusBadge'
import { formatDate } from '@/lib/utils/format'
import { Progress } from '@/components/ui/progress'
import type { ApplicationWithDetails } from '@/lib/types/database'
import type { ApplicationStatus } from '@/lib/types/workflow'

interface Props {
  application: ApplicationWithDetails
}

export function ApplicationCard({ application }: Props) {
  const progressPercent = application.total_steps > 0
    ? (application.current_step / application.total_steps) * 100
    : 0

  return (
    <Link href={`/applications/${application.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-xs text-gray-500 font-mono">{application.application_number}</p>
              <p className="font-medium mt-1 truncate">{application.title}</p>
              <p className="text-sm text-gray-500 mt-1">
                {application.document_type?.name} | {application.applicant?.name}
                {application.proxy_applicant_id && (
                  <span className="ml-1 text-xs text-orange-500 font-medium">(代理申請)</span>
                )}
              </p>
            </div>
            <StatusBadge status={application.status as ApplicationStatus} />
          </div>

          {(application.status === 'in_approval' || application.status === 'submitted') && application.total_steps > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>承認進捗</span>
                <span>{application.current_step}/{application.total_steps}</span>
              </div>
              <Progress value={progressPercent} className="h-1.5" />
            </div>
          )}

          <p className="text-xs text-gray-400 mt-2">
            {formatDate(application.submitted_at || application.created_at)}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}
