'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface UserWithAssignment {
  id: string
  name: string
  email: string
  employee_number: string
  is_admin: boolean
  is_active: boolean
  department_name?: string
  position_name?: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserWithAssignment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchUsers = async () => {
      const supabase = createClient()
      const { data: employees } = await supabase
        .from('employees')
        .select('*')
        .order('employee_number')

      if (employees) {
        const usersWithAssignments = await Promise.all(
          employees.map(async (emp) => {
            const { data: assignment } = await supabase
              .from('employee_assignments')
              .select('department:departments(name), position:positions(name)')
              .eq('employee_id', emp.id)
              .eq('is_primary', true)
              .eq('is_active', true)
              .single()

            return {
              ...emp,
              department_name: (assignment?.department as any)?.name || '-',
              position_name: (assignment?.position as any)?.name || '-',
            }
          })
        )
        setUsers(usersWithAssignments)
      }
      setIsLoading(false)
    }
    fetchUsers()
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ユーザー管理</h1>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>社員番号</TableHead>
                <TableHead>氏名</TableHead>
                <TableHead>メール</TableHead>
                <TableHead>部署</TableHead>
                <TableHead>役職</TableHead>
                <TableHead>権限</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-mono text-sm">{user.employee_number}</TableCell>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-sm text-gray-500">{user.email}</TableCell>
                  <TableCell className="text-sm">{user.department_name}</TableCell>
                  <TableCell className="text-sm">{user.position_name}</TableCell>
                  <TableCell>
                    {user.is_admin && <Badge className="bg-purple-100 text-purple-700">管理者</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
