'use client'

import { UserSwitcher } from './UserSwitcher'
import { NotificationBell } from '@/components/notifications/NotificationBell'

export function Header() {
  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-3">
        <NotificationBell />
        <UserSwitcher />
      </div>
    </header>
  )
}
