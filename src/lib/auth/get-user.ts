import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export interface AuthenticatedUser {
  id: string
  name: string
  email: string
  isAdmin: boolean
  authSource: 'sso' | 'demo'
}

/**
 * Resolve the current authenticated employee for an API request.
 *
 * Resolution order (Phase 0.4 in IMPLEMENTATION_ROADMAP.md):
 *   1. Supabase Auth session (Entra ID SSO) — production path
 *   2. `X-Demo-User-Id` header — demo / development fallback, controlled by
 *      `NEXT_PUBLIC_AZURE_SSO_ENABLED`. When SSO is enabled in production,
 *      set `DEMO_AUTH_ALLOWED=false` to lock this off entirely.
 *
 * Returns null if no user can be resolved. Callers should treat null as 401.
 */
export async function getServerUser(req: NextRequest): Promise<AuthenticatedUser | null> {
  const ssoUser = await tryResolveFromSupabaseAuth()
  if (ssoUser) return ssoUser

  if (process.env.DEMO_AUTH_ALLOWED !== 'false') {
    const demoUser = await tryResolveFromDemoHeader(req)
    if (demoUser) return demoUser
  }

  return null
}

async function tryResolveFromSupabaseAuth(): Promise<AuthenticatedUser | null> {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() { /* readonly in API route */ },
        },
      },
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const admin = createAdminClient()
    const { data: employee } = await admin
      .from('employees')
      .select('id, name, email, is_admin')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (!employee) return null
    return {
      id: employee.id as string,
      name: employee.name as string,
      email: employee.email as string,
      isAdmin: !!employee.is_admin,
      authSource: 'sso',
    }
  } catch (e) {
    console.warn('[getServerUser] SSO resolution failed:', e)
    return null
  }
}

async function tryResolveFromDemoHeader(req: NextRequest): Promise<AuthenticatedUser | null> {
  const userId = req.headers.get('x-demo-user-id')
  if (!userId) return null

  const supabase = createAdminClient()
  const { data: employee } = await supabase
    .from('employees')
    .select('id, name, email, is_admin')
    .eq('id', userId)
    .maybeSingle()

  if (!employee) return null
  return {
    id: employee.id as string,
    name: employee.name as string,
    email: employee.email as string,
    isAdmin: !!employee.is_admin,
    authSource: 'demo',
  }
}

/**
 * Helper for admin-only endpoints. Returns the user id when the request is
 * authenticated AND the user is an admin; null otherwise.
 *
 * Drop-in replacement for `requireAdmin` in lib/auth/require-admin.ts —
 * the two should be unified once all admin API routes have been migrated.
 */
export async function requireAdminUser(req: NextRequest): Promise<AuthenticatedUser | null> {
  const user = await getServerUser(req)
  if (!user) return null
  if (!user.isAdmin) return null
  return user
}
