'use client'

import { useEffect, useState, useCallback } from 'react'
import { getDemoUserHeader } from '@/lib/auth/demo-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Pencil, Trash2, Shield, Search, Mail, Hash, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Department, Position } from '@/lib/types/database'

interface EmployeeWithAssignment {
  id: string
  name: string
  name_kana: string
  email: string
  employee_number: string
  is_admin: boolean
  is_active: boolean
  assignments: {
    id: string
    department: Department | null
    position: Position | null
    is_primary: boolean
  }[]
}

// Gradient palette for avatars based on name hash
const AVATAR_COLORS = [
  'from-blue-500 to-blue-600',
  'from-indigo-500 to-indigo-600',
  'from-violet-500 to-violet-600',
  'from-emerald-500 to-emerald-600',
  'from-teal-500 to-teal-600',
  'from-cyan-500 to-cyan-600',
  'from-amber-500 to-amber-600',
  'from-rose-500 to-rose-600',
]

function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(name: string) {
  const parts = name.split(/[\s　]+/)
  if (parts.length >= 2) return parts[0][0] + parts[1][0]
  return name.slice(0, 2)
}

export default function UsersPage() {
  const [employees, setEmployees] = useState<EmployeeWithAssignment[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', name_kana: '', email: '', employee_number: '',
    is_admin: false, department_id: '', position_id: '',
  })
  const [deleteTarget, setDeleteTarget] = useState<EmployeeWithAssignment | null>(null)

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/admin/employees', { headers: getDemoUserHeader() })
    if (res.ok) setEmployees(await res.json())

    const supabase = createClient()
    const [deptRes, posRes] = await Promise.all([
      supabase.from('departments').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('positions').select('*').order('rank', { ascending: false }),
    ])
    setDepartments(deptRes.data || [])
    setPositions(posRes.data || [])
    setIsLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const openAdd = () => {
    setEditingId(null)
    setForm({ name: '', name_kana: '', email: '', employee_number: '', is_admin: false, department_id: '', position_id: '' })
    setShowDialog(true)
  }

  const openEdit = (emp: EmployeeWithAssignment) => {
    setEditingId(emp.id)
    const primary = emp.assignments.find(a => a.is_primary)
    setForm({
      name: emp.name, name_kana: emp.name_kana, email: emp.email,
      employee_number: emp.employee_number, is_admin: emp.is_admin,
      department_id: primary?.department?.id || '',
      position_id: primary?.position?.id || '',
    })
    setShowDialog(true)
  }

  const saveEmployee = async () => {
    const url = editingId ? `/api/admin/employees/${editingId}` : '/api/admin/employees'
    const res = await fetch(url, {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', ...getDemoUserHeader() },
      body: JSON.stringify(form),
    })
    if (!res.ok) {
      const data = await res.json()
      toast.error(data.error || '保存に失敗しました')
      return
    }
    toast.success(editingId ? 'ユーザーを更新しました' : 'ユーザーを追加しました')
    setShowDialog(false)
    fetchData()
  }

  const deleteEmployee = async () => {
    if (!deleteTarget) return
    const res = await fetch(`/api/admin/employees/${deleteTarget.id}`, {
      method: 'DELETE',
      headers: getDemoUserHeader(),
    })
    if (!res.ok) {
      toast.error('削除に失敗しました')
      return
    }
    toast.success('ユーザーを無効化しました')
    setDeleteTarget(null)
    fetchData()
  }

  const filtered = employees.filter(e =>
    !search || e.name.includes(search) || e.email.includes(search) || e.employee_number.includes(search)
  )

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-40" />)}</div></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ユーザー管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">{employees.length}名のユーザー</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4 mr-1.5" />
          ユーザー追加
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="名前・メール・社員番号で検索..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
        {search && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
            {filtered.length}件
          </span>
        )}
      </div>

      {/* User Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(emp => {
          const primary = emp.assignments.find(a => a.is_primary)
          const color = getAvatarColor(emp.name)
          const initials = getInitials(emp.name)

          return (
            <Card key={emp.id} className="group hover:shadow-md transition-shadow">
              <CardContent className="p-0">
                {/* Card Header with gradient */}
                <div className={`h-2 rounded-t-lg bg-gradient-to-r ${color}`} />

                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${color} flex items-center justify-center shrink-0 shadow-sm`}>
                      <span className="text-white font-bold text-sm">{initials}</span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm truncate">{emp.name}</h3>
                        {emp.is_admin && (
                          <Badge className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0 shrink-0">
                            <Shield className="w-2.5 h-2.5 mr-0.5" />管理者
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{emp.name_kana}</p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(emp)}>
                        <Pencil className="w-3.5 h-3.5 text-gray-400" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDeleteTarget(emp)}>
                        <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                      </Button>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Mail className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                      <span className="truncate">{emp.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Hash className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                      <span className="font-mono">{emp.employee_number}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Building2 className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                      <span>{primary?.department?.name || '未所属'}</span>
                      {primary?.position && (
                        <>
                          <span className="text-gray-300">|</span>
                          <span>{primary.position.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'ユーザー編集' : 'ユーザー追加'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>氏名</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>カナ</Label><Input value={form.name_kana} onChange={e => setForm(f => ({ ...f, name_kana: e.target.value }))} /></div>
            </div>
            <div><Label>メール</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div><Label>社員番号</Label><Input value={form.employee_number} onChange={e => setForm(f => ({ ...f, employee_number: e.target.value }))} /></div>
            <div>
              <Label>所属部署</Label>
              <Select value={form.department_id} onValueChange={v => setForm(f => ({ ...f, department_id: v }))}>
                <SelectTrigger><SelectValue placeholder="選択してください" /></SelectTrigger>
                <SelectContent>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{'　'.repeat(d.level)}{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>役職</Label>
              <Select value={form.position_id} onValueChange={v => setForm(f => ({ ...f, position_id: v }))}>
                <SelectTrigger><SelectValue placeholder="選択してください" /></SelectTrigger>
                <SelectContent>
                  {positions.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="is_admin" checked={form.is_admin} onCheckedChange={v => setForm(f => ({ ...f, is_admin: !!v }))} />
              <Label htmlFor="is_admin">管理者権限</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>キャンセル</Button>
            <Button onClick={saveEmployee}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ユーザーの無効化</AlertDialogTitle>
            <AlertDialogDescription>「{deleteTarget?.name}」を無効化しますか？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={deleteEmployee} className="bg-red-600 hover:bg-red-700">無効化</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
