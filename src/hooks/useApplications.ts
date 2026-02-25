'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ApplicationWithDetails } from '@/lib/types/database'

export function useApplications(applicantId?: string) {
  const [applications, setApplications] = useState<ApplicationWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!applicantId) return
    const supabase = createClient()
    let query = supabase
      .from('applications')
      .select(`
        *,
        document_type:document_types(*),
        applicant:employees!applicant_id(*)
      `)
      .eq('applicant_id', applicantId)
      .order('created_at', { ascending: false })

    const { data } = await query
    setApplications((data as unknown as ApplicationWithDetails[]) || [])
    setIsLoading(false)
  }, [applicantId])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { applications, isLoading, refetch: fetch }
}
