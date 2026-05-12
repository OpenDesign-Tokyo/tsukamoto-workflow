'use client'

import { useEffect, useState, useCallback } from 'react'
import { getDemoUserHeader } from '@/lib/auth/demo-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Trash2, Pencil, Briefcase, Cloud } from 'lucide-react'
import { toast } from 'sonner'

interface PositionRow {
  id: string
  name: string
  code: string | null
  rank: number
  is_active: boolean
  usage_count: number
  created_at: string
  updated_at: string
}

const EMPTY_FORM = { name: '', code: '', rank: 0, is_active: true }

export default function PositionsAdminPage() {
  const [positions, setPositions] = useState<PositionRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<PositionRow | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  const fetchPositions = useCallback(async () => {
    const res = await fetch(`/api/admin/positions?include_inactive=${showInactive ? '1' : '0'}`, {
      headers: getDemoUserHeader(),
    })
    if (res.ok) {
      const data = await res.json()
      setPositions(data.positions ?? [])
    }
    setIsLoading(false)
  }, [showInactive])

  useEffect(() => { fetchPositions() }, [fetchPositions])

  const resetForm = () => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(false) }
  const openAddForm = () => { resetForm(); setShowForm(true) }
  const openEditForm = (p: PositionRow) => {
    setEditingId(p.id)
    setForm({ name: p.name, code: p.code ?? '', rank: p.rank, is_active: p.is_active })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('役職名は必須です'); return }

    const url = editingId ? `/api/admin/positions/${editingId}` : '/api/admin/positions'
    const method = editingId ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...getDemoUserHeader() },
      body: JSON.stringify(form),
    })

    if (res.ok) {
      toast.success(editingId ? '役職を更新しました' : '役職を追加しました')
      resetForm()
      fetchPositions()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || '保存に失敗しました')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const res = await fetch(`/api/admin/positions/${deleteTarget.id}`, {
      method: 'DELETE',
      headers: getDemoUserHeader(),
    })
    if (res.ok) {
      toast.success(`「${deleteTarget.name}」を無効化しました`)
      setDeleteTarget(null)
      fetchPositions()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || '無効化に失敗しました')
      setDeleteTarget(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">役職マスタ</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            承認ルートで使う役職を管理します。MS365 同期で取り込まれる役職もここに表示されます。
          </p>
        </div>
        <Button onClick={openAddForm}>
          <Plus className="w-4 h-4 mr-2" />
          役職追加
        </Button>
      </div>

      <Card className="bg-blue-50/40 border-blue-200/60">
        <CardContent className="p-4 text-sm text-blue-900 space-y-1">
          <p className="font-medium">📘 役職の登録方法は2つあります</p>
          <ul className="text-xs space-y-0.5 pl-4 list-disc">
            <li>
              <span className="font-medium">手動登録（このページ）</span>:
              「担当パタンナー」など Entra ID（Azure AD）の jobTitle に入っていない役職を追加できます。
            </li>
            <li>
              <span className="font-medium">MS365同期から自動取込</span>:
              <code className="text-[11px] bg-blue-100 px-1 rounded mx-0.5">/admin/sync</code>
              実行時、Entra ID の jobTitle が既存役職と合致しなければ新規作成されます。
            </li>
          </ul>
          <p className="text-xs text-blue-700 pt-1">
            ※ rank（ランク）が <strong>小さいほど上位</strong>。承認者解決ロジック（部署内の上位役職を辿る等）で利用されます。
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <label className="text-sm flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
          />
          無効も表示
        </label>
      </div>

      {/* Edit/Add form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{editingId ? '役職の編集' : '新規役職'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>役職名 *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="担当パタンナー"
                />
              </div>
              <div className="space-y-1.5">
                <Label>コード（任意）</Label>
                <Input
                  value={form.code}
                  onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                  placeholder="POS-PATTERNER"
                />
              </div>
              <div className="space-y-1.5">
                <Label>ランク（小さいほど上位）</Label>
                <Input
                  type="number"
                  value={form.rank}
                  onChange={e => setForm(p => ({ ...p, rank: Number(e.target.value) || 0 }))}
                  placeholder="0"
                />
              </div>
            </div>
            {editingId && (
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                />
                有効
              </label>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetForm}>キャンセル</Button>
              <Button onClick={handleSave}>{editingId ? '更新' : '追加'}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {positions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Briefcase className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>役職が登録されていません</p>
            </div>
          ) : (
            <div className="divide-y">
              {positions.map(p => (
                <div key={p.id} className="flex items-center justify-between p-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{p.name}</span>
                      {p.code && <span className="text-xs text-gray-400">{p.code}</span>}
                      <Badge variant="secondary" className="text-xs">rank {p.rank}</Badge>
                      <span className="text-xs text-gray-500">{p.usage_count} 名に割当</span>
                      {!p.is_active && <Badge variant="secondary" className="text-xs bg-gray-200">無効</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openEditForm(p)} className="text-gray-400 hover:text-blue-600">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    {p.is_active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(p)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-gray-500 text-right flex items-center justify-end gap-2">
        <Cloud className="w-3.5 h-3.5" /> MS365同期での更新は <code className="bg-gray-100 px-1 rounded">/admin/sync</code> から実行できます
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>役職の無効化</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.name}」を無効化します。過去の社員割当は残ります。
              現在 {deleteTarget?.usage_count ?? 0} 名に割り当てられていますが、誰にも割当てがない場合のみ無効化できます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              無効化
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
