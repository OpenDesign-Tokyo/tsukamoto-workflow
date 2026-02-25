'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ApplicationWithDetails } from '@/lib/types/database'
import type { ApplicationStatus } from '@/lib/types/workflow'

const PAGE_SIZE = 20

export function useApplications(
  applicantId?: string,
  options?: { statusFilter?: ApplicationStatus | 'all'; search?: string; page?: number }
) {
  const { statusFilter = 'all', search = '', page = 1 } = options || {}
  const [applications, setApplications] = useState<ApplicationWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)

  const fetch = useCallback(async () => {
    if (!applicantId) return
    setIsLoading(true)
    const supabase = createClient()

    let query = supabase
      .from('applications')
      .select(`
        *,
        document_type:document_types(*),
        applicant:employees!applicant_id(*)
      `, { count: 'exact' })
      .eq('applicant_id', applicantId)
      .order('created_at', { ascending: false })

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    if (search.trim()) {
      query = query.or(`title.ilike.%${search.trim()}%,application_number.ilike.%${search.trim()}%`)
    }

    query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    const { data, count } = await query
    setApplications((data as unknown as ApplicationWithDetails[]) || [])
    setTotalCount(count ?? 0)
    setIsLoading(false)
  }, [applicantId, statusFilter, search, page])

  useEffect(() => {
    fetch()
  }, [fetch])

  return {
    applications,
    isLoading,
    refetch: fetch,
    totalCount,
    totalPages: Math.ceil(totalCount / PAGE_SIZE),
    pageSize: PAGE_SIZE,
  }
}
