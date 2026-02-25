'use client'

import { Badge } from '@/components/ui/badge'
import { STATUS_LABELS, STATUS_COLORS, type ApplicationStatus } from '@/lib/types/workflow'

interface Props {
  status: ApplicationStatus
}

export function StatusBadge({ status }: Props) {
  return (
    <Badge className={STATUS_COLORS[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}
