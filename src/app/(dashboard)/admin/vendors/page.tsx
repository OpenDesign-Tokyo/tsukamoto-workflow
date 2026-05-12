'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { getDemoUserHeader } from '@/lib/auth/demo-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Trash2, Pencil, Search, FileUp, Building2, Download } from 'lucide-react'
import { toast } from 'sonner'
import type { Vendor } from '@/lib/types/database'

const EMPTY_FORM = {
  code: '',
  name: '',
  name_kana: '',
  short_name: '',
  address: '',
  contact_person: '',
  contact_email: '',
  contact_phone: '',
  payment_terms: '',
  credit_limit: '',
  category: '',
  notes: '',
  is_active: true,
}

type FormState = typeof EMPTY_FORM

const CATEGORY_OPTIONS = ['仕入先', '外注先', 'その他']

export default function VendorsAdminPage() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [showInactive, setShowInactive] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [showImport, setShowImport] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false)

  const fetchVendors = useCallback(async () => {
    const res = await fetch(`/api/admin/vendors?include_inactive=1`, { headers: getDemoUserHeader() })
    if (res.ok) {
      const data = await res.json()
      setVendors(data.vendors ?? [])
    }
    setIsLoading(false)
  }, [])

  useEffect(() => { fetchVendors() }, [fetchVendors])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return vendors.filter(v => {
      if (!showInactive && !v.is_active) return false
      if (categoryFilter !== 'all' && v.category !== categoryFilter) return false
      if (!term) return true
      const hay = [v.code, v.name, v.name_kana, v.short_name, v.contact_person, v.address]
        .filter(Boolean).join(' ').toLowerCase()
      return hay.includes(term)
    })
  }, [vendors, search, categoryFilter, showInactive])

  const resetForm = () => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(false) }

  const openAddForm = () => { resetForm(); setShowForm(true) }

  const openEditForm = (v: Vendor) => {
    setEditingId(v.id)
    setForm({
      code: v.code,
      name: v.name,
      name_kana: v.name_kana ?? '',
      short_name: v.short_name ?? '',
      address: v.address ?? '',
      contact_person: v.contact_person ?? '',
      contact_email: v.contact_email ?? '',
      contact_phone: v.contact_phone ?? '',
      payment_terms: v.payment_terms ?? '',
      credit_limit: v.credit_limit != null ? String(v.credit_limit) : '',
      category: v.category ?? '',
      notes: v.notes ?? '',
      is_active: v.is_active,
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error('取引先コードと社名は必須です')
      return
    }
    let creditLimit: number | null = null
    if (form.credit_limit) {
      const n = Number(form.credit_limit.replace(/,/g, ''))
      if (Number.isNaN(n)) { toast.error('与信枠は数値で入力してください'); return }
      creditLimit = n
    }

    const payload = { ...form, credit_limit: creditLimit }
    const url = editingId ? `/api/admin/vendors/${editingId}` : '/api/admin/vendors'
    const method = editingId ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...getDemoUserHeader() },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      toast.success(editingId ? '取引先を更新しました' : '取引先を追加しました')
      resetForm()
      fetchVendors()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || '保存に失敗しました')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const res = await fetch(`/api/admin/vendors/${deleteTarget.id}`, {
      method: 'DELETE',
      headers: getDemoUserHeader(),
    })
    if (res.ok) {
      toast.success(`「${deleteTarget.name}」を無効化しました`)
      setDeleteTarget(null)
      fetchVendors()
    } else {
      toast.error('無効化に失敗しました')
    }
  }

  const handleImport = async () => {
    if (!importFile) { toast.error('xlsxファイルを選択してください'); return }
    setIsImporting(true)
    try {
      const arrayBuffer = await importFile.arrayBuffer()
      // Convert to base64 in chunks to avoid stack overflow on large files
      const bytes = new Uint8Array(arrayBuffer)
      let binary = ''
      const chunkSize = 0x8000
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)))
      }
      const base64 = btoa(binary)

      const res = await fetch('/api/admin/vendors/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getDemoUserHeader() },
        body: JSON.stringify({ fileBase64: base64 }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`インポート完了: ${data.created}件新規 / ${data.updated}件更新`)
        setShowImport(false)
        setImportFile(null)
        fetchVendors()
      } else {
        const details = Array.isArray(data.details) ? `\n${data.details.slice(0, 5).join('\n')}` : ''
        toast.error(`${data.error || 'インポートに失敗しました'}${details}`)
      }
    } catch (e) {
      toast.error(`ファイルの読み込みに失敗しました: ${(e as Error).message}`)
    } finally {
      setIsImporting(false)
    }
  }

  const handleTemplateDownload = async () => {
    setIsDownloadingTemplate(true)
    try {
      const res = await fetch('/api/admin/vendors/template', { headers: getDemoUserHeader() })
      if (!res.ok) {
        toast.error('テンプレートのダウンロードに失敗しました')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = '取引先マスタ_テンプレート.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setIsDownloadingTemplate(false)
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
        <h1 className="text-2xl font-bold">取引先マスタ</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTemplateDownload} disabled={isDownloadingTemplate}>
            <Download className="w-4 h-4 mr-2" />
            テンプレートDL
          </Button>
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <FileUp className="w-4 h-4 mr-2" />
            インポート
          </Button>
          <Button onClick={openAddForm}>
            <Plus className="w-4 h-4 mr-2" />
            取引先追加
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="社名・コード・カナで検索..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべての区分</SelectItem>
            {CATEGORY_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
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
            <CardTitle className="text-base">{editingId ? '取引先の編集' : '新規取引先'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="取引先コード *">
                <Input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} placeholder="V-0001" />
              </Field>
              <Field label="社名 *">
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="株式会社サンプル繊維" />
              </Field>
              <Field label="フリガナ">
                <Input value={form.name_kana} onChange={e => setForm(p => ({ ...p, name_kana: e.target.value }))} placeholder="サンプルセンイ" />
              </Field>
              <Field label="略称">
                <Input value={form.short_name} onChange={e => setForm(p => ({ ...p, short_name: e.target.value }))} placeholder="サンプル繊維" />
              </Field>
              <Field label="区分">
                <Select value={form.category || 'none'} onValueChange={v => setForm(p => ({ ...p, category: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="選択..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">未分類</SelectItem>
                    {CATEGORY_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="支払サイト">
                <Input value={form.payment_terms} onChange={e => setForm(p => ({ ...p, payment_terms: e.target.value }))} placeholder="月末締め翌月末払い" />
              </Field>
              <Field label="担当者">
                <Input value={form.contact_person} onChange={e => setForm(p => ({ ...p, contact_person: e.target.value }))} />
              </Field>
              <Field label="担当メール">
                <Input value={form.contact_email} onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))} type="email" />
              </Field>
              <Field label="電話番号">
                <Input value={form.contact_phone} onChange={e => setForm(p => ({ ...p, contact_phone: e.target.value }))} />
              </Field>
              <Field label="与信枠（円）">
                <Input value={form.credit_limit} onChange={e => setForm(p => ({ ...p, credit_limit: e.target.value }))} placeholder="5000000" />
              </Field>
              <Field label="住所" className="md:col-span-2">
                <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
              </Field>
              <Field label="メモ" className="md:col-span-2">
                <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
              </Field>
              {editingId && (
                <label className="flex items-center gap-2 cursor-pointer text-sm md:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                  />
                  有効
                </label>
              )}
            </div>
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
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>該当する取引先がありません</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map(v => (
                <div key={v.id} className="flex items-center justify-between p-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{v.name}</span>
                      <span className="text-xs text-gray-400">{v.code}</span>
                      {v.category && <Badge variant="secondary" className="text-xs">{v.category}</Badge>}
                      {!v.is_active && <Badge variant="secondary" className="text-xs bg-gray-200">無効</Badge>}
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {[v.contact_person, v.contact_phone, v.address].filter(Boolean).join(' ・ ')}
                    </p>
                    {v.payment_terms && (
                      <p className="text-xs text-gray-400">支払: {v.payment_terms}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openEditForm(v)} className="text-gray-400 hover:text-blue-600">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    {v.is_active && (
                      <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(v)} className="text-gray-400 hover:text-red-600">
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

      <p className="text-xs text-gray-500 text-right">{filtered.length} / {vendors.length} 件</p>

      {/* xlsx Import sheet */}
      <Sheet open={showImport} onOpenChange={setShowImport}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>取引先マスタ インポート</SheetTitle>
            <SheetDescription>
              テンプレート（.xlsx）に取引先データを記入し、ここからアップロードしてください。
              「取引先コード」が既存の取引先と一致する場合は上書き更新されます。
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-5 mt-6 px-2">
            <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm space-y-2">
              <p className="font-medium text-blue-900">手順</p>
              <ol className="text-xs text-blue-900 space-y-1 list-decimal list-inside">
                <li>右上の「テンプレートDL」から xlsx をダウンロード</li>
                <li>Excel で「取引先マスタ」シートにデータを記入（サンプル行は削除可）</li>
                <li>保存して、下の「ファイル選択」からアップロード</li>
              </ol>
              <p className="text-xs text-blue-700 mt-2">
                ※ 必須列は「取引先コード」と「社名」。形式が不正な場合は行ごとにエラーが表示されます。
              </p>
            </div>

            <div className="space-y-2">
              <Label>xlsx ファイル</Label>
              <Input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              />
              {importFile && (
                <p className="text-xs text-gray-600">
                  選択中: <span className="font-medium">{importFile.name}</span>（{Math.round(importFile.size / 1024)} KB）
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => { setShowImport(false); setImportFile(null) }}
              >
                キャンセル
              </Button>
              <Button onClick={handleImport} disabled={isImporting || !importFile}>
                {isImporting ? 'インポート中...' : 'インポート実行'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>取引先の無効化</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.name}」を無効化しますか？申請データはそのまま残ります。
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

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label>{label}</Label>
      {children}
    </div>
  )
}
