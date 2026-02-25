'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getDemoUserHeader } from '@/lib/auth/demo-auth'
import { Card, CardContent } from '@/components/ui/card'
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
import { Plus, Pencil, Trash2, User, Users, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Department, Employee, EmployeeAssignment, Position } from '@/lib/types/database'

interface DeptNode extends Department {
  children: DeptNode[]
  members: (EmployeeAssignment & { employee: Employee; position: Position })[]
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function OrgPage() {
  const [tree, setTree] = useState<DeptNode[]>([])
  const [allDepts, setAllDepts] = useState<Department[]>([])
  const [selectedDept, setSelectedDept] = useState<DeptNode | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [zoom, setZoom] = useState(1)

  // Dialog state
  const [showDeptDialog, setShowDeptDialog] = useState(false)
  const [editingDept, setEditingDept] = useState<Department | null>(null)
  const [deptForm, setDeptForm] = useState({ name: '', code: '', parent_id: '', level: 0 })
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

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

  // Auto-fit zoom after initial load
  useEffect(() => {
    if (!isLoading && tree.length > 0) {
      requestAnimationFrame(() => {
        const container = containerRef.current
        const content = contentRef.current
        if (container && content) {
          const cw = container.clientWidth
          const sw = content.scrollWidth
          if (sw > cw) {
            const fitZoom = Math.max(0.4, Math.floor((cw / sw) * 10) / 10)
            setZoom(fitZoom)
          }
        }
      })
    }
  }, [isLoading, tree])

  const openAddDept = (parentId?: string) => {
    setEditingDept(null)
    const parent = allDepts.find(d => d.id === parentId)
    setDeptForm({
      name: '',
      code: '',
      parent_id: parentId || '',
      level: parent ? parent.level + 1 : 0,
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

  const fitToView = () => {
    const container = containerRef.current
    const content = contentRef.current
    if (container && content) {
      // Reset to 1 first to get true content width
      setZoom(1)
      requestAnimationFrame(() => {
        const cw = container.clientWidth
        const sw = content.scrollWidth
        const fitZoom = sw > cw ? Math.max(0.4, Math.floor((cw / sw) * 10) / 10) : 1
        setZoom(fitZoom)
        container.scrollLeft = 0
        container.scrollTop = 0
      })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[600px]" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">組織図管理</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white border rounded-lg px-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setZoom(z => Math.max(0.4, z - 0.1))}>
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
            <span className="text-xs text-gray-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setZoom(z => Math.min(1.5, z + 0.1))}>
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={fitToView}>
              <Maximize2 className="w-3.5 h-3.5" />
            </Button>
          </div>
          <Button size="sm" onClick={() => openAddDept()}>
            <Plus className="w-4 h-4 mr-1" />
            部署追加
          </Button>
        </div>
      </div>

      {/* Org Chart Canvas */}
      <Card className="overflow-hidden">
        <div
          ref={containerRef}
          className="overflow-auto bg-gradient-to-br from-slate-50 to-blue-50/30"
          style={{ minHeight: '500px', maxHeight: 'calc(100vh - 280px)' }}
        >
          <div
            ref={contentRef}
            className="p-8 min-w-fit"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
          >
            {tree.map(root => (
              <OrgChartNode
                key={root.id}
                node={root}
                selectedId={selectedDept?.id}
                onSelect={setSelectedDept}
                onEdit={openEditDept}
                onAddChild={(id) => openAddDept(id)}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        </div>
      </Card>

      {/* Selected Department Detail Panel */}
      {selectedDept && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">{selectedDept.name}</h3>
                {selectedDept.code && (
                  <Badge variant="secondary" className="text-xs font-mono">{selectedDept.code}</Badge>
                )}
                <Badge variant="outline" className="text-xs">{selectedDept.members.length}名</Badge>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEditDept(selectedDept)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openAddDept(selectedDept.id)}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            {selectedDept.members.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">メンバーがいません</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {selectedDept.members
                  .sort((a, b) => (b.position?.rank || 0) - (a.position?.rank || 0))
                  .map((m) => (
                    <div key={m.id} className="flex items-center gap-2.5 p-2.5 rounded-lg border bg-white">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{m.employee?.name}</p>
                        <p className="text-[10px] text-gray-400 truncate">{m.position?.name}</p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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

// ============================================================================
// Helper: recursive total member count (includes all descendants)
// ============================================================================

function getTotalMemberCount(node: DeptNode): number {
  let count = node.members.length
  for (const child of node.children) {
    count += getTotalMemberCount(child)
  }
  return count
}

// ============================================================================
// ORG CHART NODE - Graphical card-based tree node
// ============================================================================

function OrgChartNode({
  node,
  selectedId,
  onSelect,
  onEdit,
  onAddChild,
  onDelete,
}: {
  node: DeptNode
  selectedId?: string
  onSelect: (node: DeptNode) => void
  onEdit: (dept: Department) => void
  onAddChild: (parentId: string) => void
  onDelete: (dept: Department) => void
}) {
  const [hover, setHover] = useState(false)
  const isSelected = selectedId === node.id
  const hasChildren = node.children.length > 0
  const totalCount = getTotalMemberCount(node)

  // Add button label: level 0 = 部署追加, level 1+ = 課追加
  const addChildLabel = node.level < 1 ? '部署追加' : '課追加'

  // Color scheme based on hierarchy level
  const levelColors = [
    { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-600', hoverBg: 'hover:bg-blue-700' },
    { bg: 'bg-blue-500', text: 'text-white', border: 'border-blue-500', hoverBg: 'hover:bg-blue-600' },
    { bg: 'bg-white', text: 'text-gray-800', border: 'border-blue-300', hoverBg: 'hover:bg-blue-50' },
    { bg: 'bg-white', text: 'text-gray-700', border: 'border-gray-300', hoverBg: 'hover:bg-gray-50' },
  ]
  const colors = levelColors[Math.min(node.level, levelColors.length - 1)]

  return (
    <div className="flex flex-col items-center">
      {/* Node Card */}
      <div
        className="relative group"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <button
          onClick={() => onSelect(node)}
          className={`
            relative px-5 py-3 rounded-lg border-2 transition-all duration-150 cursor-pointer
            min-w-[140px] max-w-[220px] text-center shadow-sm
            ${colors.bg} ${colors.text} ${colors.border} ${colors.hoverBg}
            ${isSelected ? 'ring-2 ring-blue-400 ring-offset-2 shadow-md' : ''}
          `}
        >
          <p className="font-bold text-sm leading-tight truncate">{node.name}</p>
          <div className={`flex items-center justify-center gap-1 mt-1 text-xs ${node.level < 2 ? 'text-blue-100' : 'text-gray-400'}`}>
            <Users className="w-3 h-3" />
            <span>{totalCount}名</span>
          </div>
        </button>

        {/* Hover action buttons */}
        {hover && (
          <div className="absolute -top-2 -right-2 flex gap-0.5 z-10">
            <button
              onClick={(e) => { e.stopPropagation(); onAddChild(node.id) }}
              className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center shadow-md hover:bg-green-600 transition-colors"
              title={addChildLabel}
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(node) }}
              className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-md hover:bg-blue-600 transition-colors"
              title="編集"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(node) }}
              className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
              title="削除"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Connector lines + Children */}
      {hasChildren && (
        <>
          {/* Vertical line down from parent */}
          <div className="w-px h-6 bg-blue-300" />

          {/* Children row: each child draws its portion of the horizontal connector */}
          <div className="flex items-start">
            {node.children.map((child, i) => (
              <div key={child.id} className="flex flex-col items-center relative px-3">
                {/* Horizontal line - left half (all except first child) */}
                {node.children.length > 1 && i > 0 && (
                  <div className="absolute top-0 h-px bg-blue-300 left-0" style={{ right: '50%' }} />
                )}
                {/* Horizontal line - right half (all except last child) */}
                {node.children.length > 1 && i < node.children.length - 1 && (
                  <div className="absolute top-0 h-px bg-blue-300 right-0" style={{ left: '50%' }} />
                )}
                {/* Vertical line from horizontal bar to child */}
                <div className="w-px h-6 bg-blue-300" />
                <OrgChartNode
                  node={child}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  onEdit={onEdit}
                  onAddChild={onAddChild}
                  onDelete={onDelete}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
