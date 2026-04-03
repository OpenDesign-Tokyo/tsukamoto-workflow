'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { DemoAuthContext, getStoredUserId, setStoredUserId } from './demo-auth'
import { createClient } from '@/lib/supabase/client'
import type { EmployeeWithAssignment } from '@/lib/types/database'

export function DemoAuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<EmployeeWithAssignment | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadDefaultUser = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('employees')
      .select('id')
      .eq('email', 'ta-sato@tsukamoto.co.jp')
      .maybeSingle()

    if (data) {
      setStoredUserId(data.id)
      return data.id
    }
    // Fallback: pick first active employee
    const { data: first } = await supabase
      .from('employees')
      .select('id')
      .eq('is_active', true)
      .order('employee_number')
      .limit(1)
      .maybeSingle()

    if (first) {
      setStoredUserId(first.id)
      return first.id
    }
    return null
  }, [])

  const fetchUser = useCallback(async (employeeId: string) => {
    const supabase = createClient()
    const { data: employee } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .maybeSingle()

    if (!employee) {
      // Stored ID is stale (e.g. old demo user) — reset to default
      localStorage.removeItem('current_employee_id')
      const defaultId = await loadDefaultUser()
      if (defaultId) {
        const { data: fallback } = await supabase
          .from('employees')
          .select('*')
          .eq('id', defaultId)
          .maybeSingle()
        if (fallback) {
          const { data: assignment } = await supabase
            .from('employee_assignments')
            .select(`*, department:departments(*), position:positions(*)`)
            .eq('employee_id', defaultId)
            .eq('is_primary', true)
            .eq('is_active', true)
            .maybeSingle()
          setCurrentUser({ ...fallback, assignment: assignment || undefined })
          setIsLoading(false)
          return
        }
      }
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
  }, [loadDefaultUser])

  useEffect(() => {
    const stored = getStoredUserId()
    if (stored) {
      fetchUser(stored)
    } else {
      loadDefaultUser().then((id) => {
        if (id) {
          fetchUser(id)
        } else {
          setIsLoading(false)
        }
      })
    }
  }, [fetchUser, loadDefaultUser])

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
