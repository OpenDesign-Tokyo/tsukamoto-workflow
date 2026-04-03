'use client'

import { useRouter } from 'next/navigation'
import { useDemoAuth } from '@/lib/auth/demo-auth'
import { UserSwitcher } from './UserSwitcher'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { LogOut } from 'lucide-react'

export function Header() {
  const { currentUser, logout } = useDemoAuth()
  const router = useRouter()

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-3">
        <NotificationBell />
        {currentUser?.is_admin && <UserSwitcher />}
        <button
          onClick={handleLogout}
          title="ログアウト"
          className="p-2 rounded-md hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
