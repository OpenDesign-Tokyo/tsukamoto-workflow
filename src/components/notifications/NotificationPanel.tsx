'use client'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils/format'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { CheckCheck } from 'lucide-react'
import type { Notification } from '@/lib/types/database'

const TYPE_LABELS: Record<string, string> = {
  approval_request: '承認依頼',
  approved: '承認完了',
  rejected: '差戻し',
  reminder: 'リマインド',
  withdrawn: '取下げ',
}

const TYPE_COLORS: Record<string, string> = {
  approval_request: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  reminder: 'bg-blue-100 text-blue-700',
  withdrawn: 'bg-gray-100 text-gray-600',
}

interface Props {
  notifications: Notification[]
  onRefresh: () => void
}

export function NotificationPanel({ notifications, onRefresh }: Props) {
  const markAllRead = async () => {
    const supabase = createClient()
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id)
    if (unreadIds.length === 0) return

    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in('id', unreadIds)

    onRefresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold text-sm">通知</h3>
        <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs">
          <CheckCheck className="w-3 h-3 mr-1" />
          全て既読
        </Button>
      </div>
      <ScrollArea className="max-h-96">
        {notifications.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">通知はありません</p>
        ) : (
          notifications.map((n) => (
            <Link
              key={n.id}
              href={n.action_url || '#'}
              className={`block px-4 py-3 border-b hover:bg-gray-50 transition-colors ${
                !n.is_read ? 'bg-blue-50/50' : ''
              }`}
            >
              <div className="flex items-start gap-2">
                <Badge className={`text-xs shrink-0 ${TYPE_COLORS[n.type] || ''}`}>
                  {TYPE_LABELS[n.type] || n.type}
                </Badge>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{n.title}</p>
                  {n.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>}
                  <p className="text-xs text-gray-400 mt-1">{formatDateTime(n.sent_at)}</p>
                </div>
              </div>
            </Link>
          ))
        )}
      </ScrollArea>
    </div>
  )
}
