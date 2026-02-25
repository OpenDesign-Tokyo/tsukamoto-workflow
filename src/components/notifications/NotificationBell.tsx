'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { NotificationPanel } from './NotificationPanel'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { Notification } from '@/lib/types/database'

export function NotificationBell() {
  const { currentUser } = useCurrentUser()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchNotifications = useCallback(async () => {
    if (!currentUser) return
    const supabase = createClient()
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', currentUser.id)
      .order('sent_at', { ascending: false })
      .limit(20)

    if (data) {
      setNotifications(data)
      setUnreadCount(data.filter(n => !n.is_read).length)
    }
  }, [currentUser])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 10000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  return (
    <Popover>
      <PopoverTrigger className="relative p-2 rounded-md hover:bg-gray-100 transition-colors">
        <Bell className="w-5 h-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <NotificationPanel
          notifications={notifications}
          onRefresh={fetchNotifications}
        />
      </PopoverContent>
    </Popover>
  )
}
