'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { DemoAuthContext, getStoredUserId, setStoredUserId } from './demo-auth'
import { createClient } from '@/lib/supabase/client'
import type { EmployeeWithAssignment } from '@/lib/types/database'

export function DemoAuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<EmployeeWithAssignment | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchUser = useCallback(async (employeeId: string) => {
    const supabase = createClient()
    const { data: employee } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .maybeSingle()

    if (!employee) {
      setCurrentUser(null)
      setIsLoading(false)
      return
    }

    const { data: assignments } = await supabase
      .from('employee_assignments')
      .select(`
        *,
        department:departments(*),
        position:positions(*)
      `)
      .eq('employee_id', employeeId)
      .eq('is_primary', true)
      .eq('is_active', true)
      .maybeSingle()

    setCurrentUser({
      ...employee,
      assignment: assignments || undefined,
    })
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const stored = getStoredUserId()
    if (stored) {
      fetchUser(stored)
    } else {
      // Default: load first employee
      const supabase = createClient()
      supabase
        .from('employees')
        .select('id')
        .eq('email', 'ta-sato@tsukamoto.co.jp')
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setStoredUserId(data.id)
            fetchUser(data.id)
          } else {
            setIsLoading(false)
          }
        })
    }
  }, [fetchUser])

  const handleSetUserId = useCallback((id: string) => {
    setStoredUserId(id)
    setIsLoading(true)
    fetchUser(id)
  }, [fetchUser])

  return (
    <DemoAuthContext.Provider value={{ currentUser, setCurrentUserId: handleSetUserId, isLoading }}>
      {children}
    </DemoAuthContext.Provider>
  )
}
