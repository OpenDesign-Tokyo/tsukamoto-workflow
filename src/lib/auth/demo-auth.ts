'use client'

import { createContext, useContext } from 'react'
import type { EmployeeWithAssignment } from '@/lib/types/database'

const STORAGE_KEY = 'current_employee_id'

export interface DemoAuthContextType {
  currentUser: EmployeeWithAssignment | null
  setCurrentUserId: (id: string) => void
  logout: () => void
  isLoading: boolean
}

export const DemoAuthContext = createContext<DemoAuthContextType>({
  currentUser: null,
  setCurrentUserId: () => {},
  logout: () => {},
  isLoading: true,
})

export function useDemoAuth() {
  return useContext(DemoAuthContext)
}

export function getStoredUserId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(STORAGE_KEY)
}

export function setStoredUserId(id: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, id)
}

export function clearStoredUserId() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

export function getDemoUserHeader(): Record<string, string> {
  const id = getStoredUserId()
  if (!id) return {}
  return { 'X-Demo-User-Id': id }
}
