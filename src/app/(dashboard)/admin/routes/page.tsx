'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getDemoUserHeader } from '@/lib/auth/demo-auth'
import { createClient } from '@/lib/supabase/client'
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
import { Plus, Pencil, Trash2, X, FileText, CheckCircle2, ChevronRight, Route } from 'lucide-react'
import { toast } from 'sonner'
import type { DocumentType, Position } from '@/lib/types/database'

interface RouteStep {
  step_order: number
  name: string
  assignee_type: string
  position?: { id: string; name: string }
  assignee_position_id?: string
}

interface RouteWithSteps {
  id: string
  name: string
  is_default: boolean
  document_type: { id: string; name: string; code: string }
  steps: RouteStep[]
}

// Step color by index
const STEP_COLORS = [
  { bg: 'bg-blue-500', ring: 'ring-blue-100', text: 'text-blue-600', light: 'bg-blue-50' },
  { bg: 'bg-indigo-500', ring: 'ring-indigo-100', text: 'text-indigo-600', light: 'bg-indigo-50' },
  { bg: 'bg-violet-500', ring: 'ring-violet-100', text: 'text-violet-600', light: 'bg-violet-50' },
  { bg: 'bg-purple-500', ring: 'ring-purple-100', text: 'text-purple-600', light: 'bg-purple-50' },
  { bg: 'bg-emerald-500', ring: 'ring-emerald-100', text: 'text-emerald-600', light: 'bg-emerald-50' },
]

export default function RoutesPage() {
  return (
    <Suspense fallback={<div className="space-y-4"><Skeleton className="h-8 w-48" />{[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}</div>}>
      <RoutesPageInner />
    </Suspense>
  )
}

function RoutesPageInner() {
  const searchParams = useSearchParams()
  const [routes, setRoutes] = useState<RouteWithSteps[]>([])
  const [docTypes, setDocTypes] = useState<DocumentType[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', document_type_id: '', is_default: false })
  const [steps, setSteps] = useState<{ name: string; assignee_type: string; assignee_position_id: string }[]>([])
  const [deleteTarget, setDeleteTarget] = useState<RouteWithSteps | null>(null)
  const [autoOpenHandled, setAutoOpenHandled] = useState(false)

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/admin/routes', { headers: getDemoUserHeader() })
    if (res.ok) setRoutes(await res.json())

    const supabase = createClient()
    const [dtRes, posRes] = await Promise.all([
      supabase.from('document_types').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('positions').select('*').order('rank', { ascending: false }),
    ])
    setDocTypes(dtRes.data || [])
    setPositions(posRes.data || [])
    setIsLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-open dialog when navigating from forms page with ?new=<docTypeId>
  useEffect(() => {
    if (autoOpenHandled || isLoading) return
    const newDocTypeId = searchParams.get('new')
    if (newDocTypeId) {
      setAutoOpenHandled(true)
      setEditingId(null)
      setForm({
        name: '標準承認ルート（3段階）',
        document_type_id: newDocTypeId,
        is_default: true,
      })
      setSteps([
        { name: '課長承認', assignee_type: 'position_in_department', assignee_position_id: '' },
        { name: '部長承認', assignee_type: 'position_in_parent_department', assignee_position_id: '' },
        { name: '事業部長承認', assignee_type: 'position_in_parent_department', assignee_position_id: '' },
      ])
      setShowDialog(true)
    }
  }, [searchParams, isLoading, autoOpenHandled])

  const openAdd = () => {
    setEditingId(null)
    setForm({ name: '標準承認ルート（3段階）', document_type_id: '', is_default: true })
    setSteps([
      { name: '課長承認', assignee_type: 'position_in_department', assignee_position_id: '' },
      { name: '部長承認', assignee_type: 'position_in_parent_department', assignee_position_id: '' },
      { name: '事業部長承認', assignee_type: 'position_in_parent_department', assignee_position_id: '' },
    ])
    setShowDialog(true)
  }

  const openEdit = (route: RouteWithSteps) => {
    setEditingId(route.id)
    setForm({ name: route.name, document_type_id: route.document_type?.id || '', is_default: route.is_default })
    setSteps(route.steps.map(s => ({
      name: s.name,
      assignee_type: s.assignee_type,
      assignee_position_id: s.position?.id || s.assignee_position_id || '',
    })))
    setShowDialog(true)
  }

  const addStep = () => {
    setSteps(s => [...s, { name: '', assignee_type: 'position_in_department', assignee_position_id: '' }])
  }

  const removeStep = (idx: number) => {
    setSteps(s => s.filter((_, i) => i !== idx))
  }

  const updateStep = (idx: number, field: string, value: string) => {
    setSteps(s => s.map((step, i) => i === idx ? { ...step, [field]: value } : step))
  }

  const saveRoute = async () => {
    const body = {
      ...form,
      steps: steps.map((s, i) => ({ ...s, step_order: i + 1 })),
    }
    const url = editingId ? `/api/admin/routes/${editingId}` : '/api/admin/routes'
    const res = await fetch(url, {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', ...getDemoUserHeader() },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json()
      toast.error(data.error || '保存に失敗しました')
      return
    }
    toast.success(editingId ? 'ルートを更新しました' : 'ルートを追加しました')
    setShowDialog(false)
    fetchData()
  }

  const deleteRoute = async () => {
    if (!deleteTarget) return
    const res = await fetch(`/api/admin/routes/${deleteTarget.id}`, {
      method: 'DELETE',
      headers: getDemoUserHeader(),
    })
    if (!res.ok) {
      const data = await res.json()
      toast.error(data.error || '削除に失敗しました')
      return
    }
    toast.success('ルートを削除しました')
    setDeleteTarget(null)
    fetchData()
  }

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" />{[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">承認ルート管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">{routes.length}件のルート</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4 mr-1.5" />
          ルート追加
        </Button>
      </div>

      {routes.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Route className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">承認ルートがありません</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {routes.map((route) => (
            <Card key={route.id} className="group hover:shadow-md transition-shadow overflow-hidden">
              <CardContent className="p-0">
                {/* Card header */}
                <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-gray-50 to-white border-b">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{route.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                          {route.document_type?.name}
                        </Badge>
                        {route.is_default && (
                          <Badge className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0">
                            デフォルト
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(route)}>
                      <Pencil className="w-3.5 h-3.5 text-gray-400" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDeleteTarget(route)}>
                      <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                    </Button>
                  </div>
                </div>

                {/* Steps flow */}
                <div className="px-5 py-4">
                  <div className="flex items-center gap-1 overflow-x-auto">
                    {route.steps.map((step, idx) => {
                      const color = STEP_COLORS[idx % STEP_COLORS.length]
                      return (
                        <div key={step.step_order} className="flex items-center gap-1 shrink-0">
                          <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl ${color.light} border border-transparent`}>
                            {/* Step number circle */}
                            <div className={`w-7 h-7 rounded-full ${color.bg} flex items-center justify-center shrink-0 shadow-sm`}>
                              <span className="text-white text-xs font-bold">{step.step_order}</span>
                            </div>
                            {/* Step info */}
                            <div>
                              <p className={`text-xs font-semibold ${color.text}`}>{step.name}</p>
                              {step.position && (
                                <p className="text-[10px] text-gray-400">{step.position.name}</p>
                              )}
                            </div>
                            {/* Check icon */}
                            <CheckCircle2 className={`w-4 h-4 ${color.text} opacity-30 ml-1`} />
                          </div>
                          {idx < route.steps.length - 1 && (
                            <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mx-0.5" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'ルート編集' : 'ルート追加'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>ルート名</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            {!editingId && (
              <div>
                <Label>書類種別</Label>
                <Select value={form.document_type_id} onValueChange={v => setForm(f => ({ ...f, document_type_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="選択してください" /></SelectTrigger>
                  <SelectContent>
                    {docTypes.map(dt => <SelectItem key={dt.id} value={dt.id}>{dt.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>承認ステップ</Label>
                <Button variant="outline" size="sm" onClick={addStep}>
                  <Plus className="w-3 h-3 mr-1" />追加
                </Button>
              </div>
              <div className="space-y-2">
                {steps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2.5 border rounded-lg bg-gray-50/50">
                    <div className={`w-6 h-6 rounded-full ${STEP_COLORS[idx % STEP_COLORS.length].bg} flex items-center justify-center shrink-0`}>
                      <span className="text-white text-[10px] font-bold">{idx + 1}</span>
                    </div>
                    <Input
                      value={step.name}
                      onChange={e => updateStep(idx, 'name', e.target.value)}
                      placeholder="ステップ名"
                      className="flex-1 h-8 text-sm"
                    />
                    <Select value={step.assignee_type} onValueChange={v => updateStep(idx, 'assignee_type', v)}>
                      <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="position_in_department">所属部署の役職</SelectItem>
                        <SelectItem value="position_in_parent_department">上位部署の役職</SelectItem>
                        <SelectItem value="specific_employee">指定社員</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={step.assignee_position_id} onValueChange={v => updateStep(idx, 'assignee_position_id', v)}>
                      <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="役職" /></SelectTrigger>
                      <SelectContent>
                        {positions.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" onClick={() => removeStep(idx)} className="h-8 w-8 p-0 text-red-400 hover:text-red-600">
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>キャンセル</Button>
            <Button onClick={saveRoute}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ルートの削除</AlertDialogTitle>
            <AlertDialogDescription>「{deleteTarget?.name}」を削除しますか？進行中の申請で使用されている場合は削除できません。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={deleteRoute} className="bg-red-600 hover:bg-red-700">削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
