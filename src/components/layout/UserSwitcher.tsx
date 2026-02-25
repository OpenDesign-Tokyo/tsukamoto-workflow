'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ChevronDown } from 'lucide-react'
import type { Employee } from '@/lib/types/database'

interface DemoUser extends Employee {
  role_label?: string
}

const ROLE_LABELS: Record<string, string> = {
  'tanaka@tsukamoto-demo.com': '営業1課 一般（申請者）',
  'sato@tsukamoto-demo.com': '営業1課 課長（第1承認者）',
  'suzuki@tsukamoto-demo.com': '営業1課 係長',
  'takahashi@tsukamoto-demo.com': '営業部 部長（第2承認者）',
  'yamamoto@tsukamoto-demo.com': '事業部長（最終承認者）',
  'admin@tsukamoto-demo.com': '管理者ロール',
}

export function UserSwitcher() {
  const { currentUser, setCurrentUserId } = useCurrentUser()
  const [users, setUsers] = useState<DemoUser[]>([])

  useEffect(() => {
    const fetchUsers = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('employees')
        .select('*')
        .eq('is_active', true)
        .order('employee_number')

      if (data) {
        setUsers(data.map(u => ({
          ...u,
          role_label: ROLE_LABELS[u.email] || '',
        })))
      }
    }
    fetchUsers()
  }, [])

  if (!currentUser) return null

  const initials = currentUser.name.slice(0, 2)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors outline-none">
        <Avatar className="w-8 h-8">
          <AvatarFallback className="bg-[#1e3a5f] text-white text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="text-left">
          <p className="text-sm font-medium">{currentUser.name}</p>
          <p className="text-xs text-gray-500">
            {currentUser.assignment?.department?.name} {currentUser.assignment?.position?.name}
          </p>
        </div>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs text-gray-500">
          デモ用ユーザー切替
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {users.map((user) => (
          <DropdownMenuItem
            key={user.id}
            onClick={() => setCurrentUserId(user.id)}
            className="flex flex-col items-start gap-0.5 cursor-pointer"
          >
            <span className="font-medium">{user.name}</span>
            <span className="text-xs text-gray-500">{user.role_label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
