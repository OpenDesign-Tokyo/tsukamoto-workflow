'use client'

import { useDemoAuth } from '@/lib/auth/demo-auth'

export function useCurrentUser() {
  return useDemoAuth()
}
