'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { DemoAuthContext, getStoredUserId, setStoredUserId, clearStoredUserId } from './demo-auth'
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
      // Stored ID is stale — clear and leave unauthenticated
      clearStoredUserId()
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
      // No stored user — stay unauthenticated (login page will handle)
      setIsLoading(false)
    }
  }, [fetchUser])

  const handleSetUserId = useCallback((id: string) => {
    setStoredUserId(id)
    setIsLoading(true)
    fetchUser(id)
  }, [fetchUser])

  const handleLogout = useCallback(() => {
    clearStoredUserId()
    setCurrentUser(null)
  }, [])

  return (
    <DemoAuthContext.Provider value={{
      currentUser,
      setCurrentUserId: handleSetUserId,
      logout: handleLogout,
      isLoading,
    }}>
      {children}
    </DemoAuthContext.Provider>
  )
}
