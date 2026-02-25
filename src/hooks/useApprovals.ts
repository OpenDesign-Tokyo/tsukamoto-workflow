'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ApprovalRecord, Application, Employee, DocumentType } from '@/lib/types/database'

const PAGE_SIZE = 20

export interface PendingApproval extends ApprovalRecord {
  application: Application & {
    document_type: DocumentType
    applicant: Employee
  }
}

export function useApprovals(
  approverId?: string,
  filter: 'all' | 'pending' | 'completed' = 'all',
  search = '',
  page = 1
) {
  const [approvals, setApprovals] = useState<PendingApproval[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)

  const fetch = useCallback(async () => {
    if (!approverId) return
    setIsLoading(true)
    const supabase = createClient()
    let query = supabase
      .from('approval_records')
      .select(`
        *,
        application:applications(
          *,
          document_type:document_types(*),
          applicant:employees!applicant_id(*)
        )
      `, { count: 'exact' })
      .eq('approver_id', approverId)
      .order('created_at', { ascending: false })

    if (filter === 'pending') {
      query = query.eq('action', 'pending')
    } else if (filter === 'completed') {
      query = query.neq('action', 'pending')
    }

    query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    const { data, count } = await query

    let results = (data as unknown as PendingApproval[]) || []

    // Client-side search for nested application fields
    if (search.trim()) {
      const s = search.trim().toLowerCase()
      results = results.filter(a =>
        a.application?.title?.toLowerCase().includes(s) ||
        a.application?.application_number?.toLowerCase().includes(s) ||
        a.application?.applicant?.name?.toLowerCase().includes(s)
      )
    }

    setApprovals(results)
    setTotalCount(count ?? 0)
    setIsLoading(false)
  }, [approverId, filter, search, page])

  useEffect(() => {
    fetch()
  }, [fetch])

  return {
    approvals,
    isLoading,
    refetch: fetch,
    totalCount,
    totalPages: Math.ceil(totalCount / PAGE_SIZE),
  }
}
