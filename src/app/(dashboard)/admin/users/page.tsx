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
import { Plus, Pencil, Trash2, Shield } from 'lucide-react'
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
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ユーザー管理</h1>
        <Button size="sm" onClick={openAdd}>
          <Plus className="w-4 h-4 mr-1" />
          ユーザー追加
        </Button>
      </div>

      <div className="flex gap-4 items-center">
        <Input placeholder="名前・メール・社員番号で検索..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
        <span className="text-sm text-gray-500">{filtered.length}件</span>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-left p-3">社員番号</th>
                <th className="text-left p-3">氏名</th>
                <th className="text-left p-3">メール</th>
                <th className="text-left p-3">所属</th>
                <th className="text-left p-3">役職</th>
                <th className="text-left p-3">権限</th>
                <th className="text-right p-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(emp => {
                const primary = emp.assignments.find(a => a.is_primary)
                return (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="p-3 text-sm font-mono">{emp.employee_number}</td>
                    <td className="p-3 text-sm font-medium">{emp.name}</td>
                    <td className="p-3 text-sm text-gray-500">{emp.email}</td>
                    <td className="p-3 text-sm">{primary?.department?.name || '-'}</td>
                    <td className="p-3 text-sm">{primary?.position?.name || '-'}</td>
                    <td className="p-3">
                      {emp.is_admin && (
                        <Badge variant="secondary" className="text-xs">
                          <Shield className="w-3 h-3 mr-1" />管理者
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(emp)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setDeleteTarget(emp)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

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
