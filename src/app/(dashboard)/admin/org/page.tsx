'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getDemoUserHeader } from '@/lib/auth/demo-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { ChevronRight, ChevronDown, Building2, User, Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Department, Employee, EmployeeAssignment, Position } from '@/lib/types/database'

interface DeptNode extends Department {
  children: DeptNode[]
  members: (EmployeeAssignment & { employee: Employee; position: Position })[]
}

export default function OrgPage() {
  const [tree, setTree] = useState<DeptNode[]>([])
  const [allDepts, setAllDepts] = useState<Department[]>([])
  const [selectedDept, setSelectedDept] = useState<DeptNode | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Dialog state
  const [showDeptDialog, setShowDeptDialog] = useState(false)
  const [editingDept, setEditingDept] = useState<Department | null>(null)
  const [deptForm, setDeptForm] = useState({ name: '', code: '', parent_id: '', level: 0, sort_order: 0 })
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null)

  const fetchOrg = useCallback(async () => {
    const supabase = createClient()

    const [deptRes, assignRes] = await Promise.all([
      supabase.from('departments').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('employee_assignments').select(`
        *,
        employee:employees(*),
        position:positions(*)
      `).eq('is_active', true),
    ])

    const departments = deptRes.data || []
    setAllDepts(departments)
    const assignments = (assignRes.data || []) as unknown as (EmployeeAssignment & { employee: Employee; position: Position })[]

    const nodeMap = new Map<string, DeptNode>()
    departments.forEach(d => {
      nodeMap.set(d.id, {
        ...d,
        children: [],
        members: assignments.filter(a => a.department_id === d.id),
      })
    })

    const roots: DeptNode[] = []
    nodeMap.forEach(node => {
      if (node.parent_id && nodeMap.has(node.parent_id)) {
        nodeMap.get(node.parent_id)!.children.push(node)
      } else {
        roots.push(node)
      }
    })

    setTree(roots)
    if (!selectedDept && roots.length > 0) setSelectedDept(roots[0])
    // Update selectedDept if it still exists
    if (selectedDept) {
      const updated = nodeMap.get(selectedDept.id)
      if (updated) setSelectedDept(updated)
    }
    setIsLoading(false)
  }, [selectedDept])

  useEffect(() => {
    fetchOrg()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openAddDept = (parentId?: string) => {
    setEditingDept(null)
    const parent = allDepts.find(d => d.id === parentId)
    setDeptForm({
      name: '',
      code: '',
      parent_id: parentId || '',
      level: parent ? parent.level + 1 : 0,
      sort_order: 0,
    })
    setShowDeptDialog(true)
  }

  const openEditDept = (dept: Department) => {
    setEditingDept(dept)
    setDeptForm({
      name: dept.name,
      code: dept.code || '',
      parent_id: dept.parent_id || '',
      level: dept.level,
      sort_order: dept.sort_order,
    })
    setShowDeptDialog(true)
  }

  const saveDept = async () => {
    try {
      const url = editingDept
        ? `/api/admin/departments/${editingDept.id}`
        : '/api/admin/departments'
      const res = await fetch(url, {
        method: editingDept ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...getDemoUserHeader() },
        body: JSON.stringify(deptForm),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || '保存に失敗しました')
        return
      }
      toast.success(editingDept ? '部署を更新しました' : '部署を追加しました')
      setShowDeptDialog(false)
      fetchOrg()
    } catch {
      toast.error('エラーが発生しました')
    }
  }

  const deleteDept = async () => {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/admin/departments/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: getDemoUserHeader(),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || '削除に失敗しました')
        return
      }
      toast.success('部署を削除しました')
      setDeleteTarget(null)
      if (selectedDept?.id === deleteTarget.id) setSelectedDept(null)
      fetchOrg()
    } catch {
      toast.error('エラーが発生しました')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">組織図管理</h1>
        <Button size="sm" onClick={() => openAddDept()}>
          <Plus className="w-4 h-4 mr-1" />
          部署追加
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">部署ツリー</CardTitle>
          </CardHeader>
          <CardContent>
            {tree.map(node => (
              <DeptTreeNode
                key={node.id}
                node={node}
                selectedId={selectedDept?.id}
                onSelect={setSelectedDept}
                onEdit={openEditDept}
                onAddChild={(id) => openAddDept(id)}
                onDelete={setDeleteTarget}
                level={0}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedDept ? selectedDept.name : '部署を選択'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDept ? (
              selectedDept.members.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">メンバーがいません</p>
              ) : (
                <div className="space-y-3">
                  {selectedDept.members
                    .sort((a, b) => (b.position?.rank || 0) - (a.position?.rank || 0))
                    .map((m) => (
                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{m.employee?.name}</p>
                        <p className="text-xs text-gray-500">{m.employee?.email}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {m.position?.name}
                      </Badge>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">左の部署ツリーから選択してください</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Department Dialog */}
      <Dialog open={showDeptDialog} onOpenChange={setShowDeptDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDept ? '部署編集' : '部署追加'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>部署名</Label>
              <Input value={deptForm.name} onChange={e => setDeptForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>コード</Label>
              <Input value={deptForm.code} onChange={e => setDeptForm(f => ({ ...f, code: e.target.value }))} placeholder="例: UNI-SALES" />
            </div>
            <div>
              <Label>親部署</Label>
              <Select value={deptForm.parent_id} onValueChange={v => {
                const parent = allDepts.find(d => d.id === v)
                setDeptForm(f => ({ ...f, parent_id: v, level: parent ? parent.level + 1 : 0 }))
              }}>
                <SelectTrigger><SelectValue placeholder="なし（最上位）" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">なし（最上位）</SelectItem>
                  {allDepts.filter(d => d.id !== editingDept?.id).map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>表示順</Label>
              <Input type="number" value={deptForm.sort_order} onChange={e => setDeptForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeptDialog(false)}>キャンセル</Button>
            <Button onClick={saveDept}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>部署の削除</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.name}」を削除しますか？子部署やメンバーが存在する場合、削除できない場合があります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={deleteDept} className="bg-red-600 hover:bg-red-700">削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function DeptTreeNode({
  node,
  selectedId,
  onSelect,
  onEdit,
  onAddChild,
  onDelete,
  level,
}: {
  node: DeptNode
  selectedId?: string
  onSelect: (node: DeptNode) => void
  onEdit: (dept: Department) => void
  onAddChild: (parentId: string) => void
  onDelete: (dept: Department) => void
  level: number
}) {
  const [expanded, setExpanded] = useState(level < 2)
  const [hover, setHover] = useState(false)
  const hasChildren = node.children.length > 0
  const isSelected = selectedId === node.id

  return (
    <div>
      <div
        className={`flex items-center gap-1 w-full px-2 py-1.5 text-sm rounded-md transition-colors ${
          isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <button
          onClick={() => {
            onSelect(node)
            if (hasChildren) setExpanded(!expanded)
          }}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          {hasChildren ? (
            expanded ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />
          ) : (
            <span className="w-4" />
          )}
          <Building2 className="w-4 h-4 shrink-0 text-gray-400" />
          <span className="truncate">{node.name}</span>
          <span className="text-xs text-gray-400 ml-auto mr-1">{node.members.length}</span>
        </button>
        {hover && (
          <div className="flex gap-0.5 shrink-0">
            <button onClick={() => onAddChild(node.id)} className="p-1 rounded hover:bg-gray-200" title="子部署追加">
              <Plus className="w-3 h-3" />
            </button>
            <button onClick={() => onEdit(node)} className="p-1 rounded hover:bg-gray-200" title="編集">
              <Pencil className="w-3 h-3" />
            </button>
            <button onClick={() => onDelete(node)} className="p-1 rounded hover:bg-red-100 text-red-500" title="削除">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <DeptTreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              onEdit={onEdit}
              onAddChild={onAddChild}
              onDelete={onDelete}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
