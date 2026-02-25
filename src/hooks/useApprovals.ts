'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ApprovalRecord, Application, Employee, DocumentType } from '@/lib/types/database'

export interface PendingApproval extends ApprovalRecord {
  application: Application & {
    document_type: DocumentType
    applicant: Employee
  }
}

export function useApprovals(approverId?: string, filter: 'all' | 'pending' | 'completed' = 'all') {
  const [approvals, setApprovals] = useState<PendingApproval[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!approverId) return
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
      `)
      .eq('approver_id', approverId)
      .order('created_at', { ascending: false })

    if (filter === 'pending') {
      query = query.eq('action', 'pending')
    } else if (filter === 'completed') {
      query = query.neq('action', 'pending')
    }

    const { data } = await query
    setApprovals((data as unknown as PendingApproval[]) || [])
    setIsLoading(false)
  }, [approverId, filter])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { approvals, isLoading, refetch: fetch }
}
