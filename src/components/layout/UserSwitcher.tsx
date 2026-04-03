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
interface DemoUser {
  id: string
  name: string
  email: string
  is_admin: boolean
  role_label: string
}

export function UserSwitcher() {
  const { currentUser, setCurrentUserId } = useCurrentUser()
  const [users, setUsers] = useState<DemoUser[]>([])

  useEffect(() => {
    const fetchUsers = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('employees')
        .select(`
          id, name, email, is_admin,
          employee_assignments!inner(
            is_primary,
            department:departments(name),
            position:positions(name)
          )
        `)
        .eq('is_active', true)
        .eq('employee_assignments.is_primary', true)
        .order('employee_number')

      if (data) {
        setUsers(data.map((u: Record<string, unknown>) => {
          const assignment = Array.isArray(u.employee_assignments)
            ? u.employee_assignments[0]
            : u.employee_assignments
          const dept = (assignment as Record<string, unknown>)?.department as Record<string, string> | null
          const pos = (assignment as Record<string, unknown>)?.position as Record<string, string> | null
          return {
            id: u.id as string,
            name: u.name as string,
            email: u.email as string,
            is_admin: u.is_admin as boolean,
            role_label: `${dept?.name || ''} ${pos?.name || ''}${u.is_admin ? '（管理者）' : ''}`.trim(),
          }
        }))
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
      <DropdownMenuContent align="end" className="w-72 max-h-[70vh] overflow-y-auto">
        <DropdownMenuLabel className="text-xs text-gray-500">
          ユーザー切替（{users.length}名）
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
