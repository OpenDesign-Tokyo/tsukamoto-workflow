'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getDemoUserHeader } from '@/lib/auth/demo-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils/format'
import type { Employee } from '@/lib/types/database'

interface ProxySettingWithDetails {
  id: string
  principal_id: string
  proxy_id: string
  document_type_id: string | null
  valid_from: string
  valid_until: string
  is_active: boolean
  created_at: string
  principal: { id: string; name: string; email: string }
  proxy: { id: string; name: string; email: string }
}

export default function ProxyManagementPage() {
  const [settings, setSettings] = useState<ProxySettingWithDetails[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    principal_id: '',
    proxy_id: '',
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: '',
  })

  const fetchSettings = useCallback(async () => {
    const res = await fetch('/api/admin/proxy', { headers: getDemoUserHeader() })
    if (res.ok) setSettings(await res.json())
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchSettings()
    const fetchEmployees = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('employees')
        .select('*')
        .eq('is_active', true)
        .order('name')
      if (data) setEmployees(data)
    }
    fetchEmployees()
  }, [fetchSettings])

  const handleCreate = async () => {
    if (!formData.principal_id || !formData.proxy_id || !formData.valid_from || !formData.valid_until) {
      toast.error('全ての項目を入力してください')
      return
    }
    if (formData.principal_id === formData.proxy_id) {
      toast.error('委任者と代理者が同一です')
      return
    }

    const res = await fetch('/api/admin/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getDemoUserHeader() },
      body: JSON.stringify(formData),
    })

    if (res.ok) {
      toast.success('代理設定を追加しました')
      setShowForm(false)
      setFormData({ principal_id: '', proxy_id: '', valid_from: new Date().toISOString().split('T')[0], valid_until: '' })
      fetchSettings()
    } else {
      const data = await res.json()
      toast.error(data.error || '追加に失敗しました')
    }
  }

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    await supabase.from('proxy_settings').update({ is_active: false }).eq('id', id)
    toast.success('代理設定を無効化しました')
    fetchSettings()
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  const now = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">代理承認管理</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-2" />
          代理設定追加
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">新規代理設定</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>委任者（本来の承認者）</Label>
                <Select value={formData.principal_id} onValueChange={v => setFormData(p => ({ ...p, principal_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="選択..." /></SelectTrigger>
                  <SelectContent>
                    {employees.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>代理者</Label>
                <Select value={formData.proxy_id} onValueChange={v => setFormData(p => ({ ...p, proxy_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="選択..." /></SelectTrigger>
                  <SelectContent>
                    {employees.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>開始日</Label>
                <Input
                  type="date"
                  value={formData.valid_from}
                  onChange={e => setFormData(p => ({ ...p, valid_from: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>終了日</Label>
                <Input
                  type="date"
                  value={formData.valid_until}
                  onChange={e => setFormData(p => ({ ...p, valid_until: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>キャンセル</Button>
              <Button onClick={handleCreate}>追加</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {settings.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>代理設定がありません</p>
            </div>
          ) : (
            <div className="divide-y">
              {settings.map((s) => {
                const isExpired = s.valid_until < now
                const isActive = s.is_active && !isExpired
                return (
                  <div key={s.id} className="flex items-center justify-between p-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{s.principal?.name}</span>
                        <span className="text-gray-400 text-xs">→</span>
                        <span className="font-medium text-sm">{s.proxy?.name}</span>
                        {isActive ? (
                          <Badge className="bg-green-100 text-green-700 text-xs">有効</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            {isExpired ? '期限切れ' : '無効'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {formatDate(s.valid_from)} 〜 {formatDate(s.valid_until)}
                      </p>
                    </div>
                    {isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(s.id)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
