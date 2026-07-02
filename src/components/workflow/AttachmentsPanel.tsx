'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, FileText, Pencil, Trash2, ExternalLink, Loader2 } from 'lucide-react'
import { getDemoUserHeader } from '@/lib/auth/demo-auth'

interface Attachment {
  id: string
  file_name: string
  file_size: number
  mime_type: string
  web_url: string | null
  provider: string
  created_at: string
  uploader?: { name: string } | null
}

const EDITABLE = /\.(xlsx?|docx?|pptx?)$/i

function humanSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/**
 * 申請の添付ファイル管理。SharePoint に格納し、Office ファイルは
 * 「編集(MS365)」で Office for the web を開いて途中編集できる（証跡を監査ログに記録）。
 */
export function AttachmentsPanel({ applicationId, canEdit }: { applicationId: string; canEdit: boolean }) {
  const [items, setItems] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/applications/${applicationId}/attachments`, { headers: getDemoUserHeader() })
    if (res.ok) {
      const json = await res.json()
      setItems(json.attachments || [])
    }
    setLoading(false)
  }, [applicationId])

  useEffect(() => { load() }, [load])

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/applications/${applicationId}/attachments`, {
        method: 'POST', headers: getDemoUserHeader(), body: fd,
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error || 'アップロードに失敗しました')
      } else {
        await load()
      }
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const onEdit = async (att: Attachment) => {
    const res = await fetch(`/api/applications/${applicationId}/attachments/${att.id}/edit-open`, {
      method: 'POST', headers: getDemoUserHeader(),
    })
    if (res.ok) {
      const { editUrl } = await res.json()
      window.open(editUrl, '_blank')
    } else {
      setError('編集用URLの取得に失敗しました')
    }
  }

  const onDelete = async (att: Attachment) => {
    if (!confirm(`「${att.file_name}」を削除しますか？`)) return
    setBusy(true)
    try {
      await fetch(`/api/applications/${applicationId}/attachments/${att.id}`, {
        method: 'DELETE', headers: getDemoUserHeader(),
      })
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base">添付ファイル</CardTitle>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
            アップロード
          </Button>
        )}
        <input ref={inputRef} type="file" className="hidden" onChange={onUpload} />
      </CardHeader>
      <CardContent className="space-y-2">
        {error && <p className="text-xs text-red-500">{error}</p>}
        {loading ? (
          <p className="text-sm text-gray-400">読み込み中...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-400">添付ファイルはありません</p>
        ) : (
          items.map(att => (
            <div key={att.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <FileText className="w-4 h-4 shrink-0 text-gray-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{att.file_name}</p>
                <p className="text-xs text-gray-400">
                  {humanSize(att.file_size)}{att.uploader?.name ? ` ・ ${att.uploader.name}` : ''}
                </p>
              </div>
              {att.web_url && (
                <Button variant="ghost" size="sm" onClick={() => window.open(att.web_url!, '_blank')} title="表示">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              )}
              {canEdit && att.web_url && EDITABLE.test(att.file_name) && (
                <Button variant="ghost" size="sm" onClick={() => onEdit(att)} title="編集(MS365)">
                  <Pencil className="w-4 h-4" />
                </Button>
              )}
              {canEdit && (
                <Button variant="ghost" size="sm" onClick={() => onDelete(att)} title="削除" disabled={busy}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
