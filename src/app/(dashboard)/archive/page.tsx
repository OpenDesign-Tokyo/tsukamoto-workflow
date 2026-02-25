'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ApplicationCard } from '@/components/workflow/ApplicationCard'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Search } from 'lucide-react'
import type { ApplicationWithDetails } from '@/lib/types/database'

export default function ArchivePage() {
  const [applications, setApplications] = useState<ApplicationWithDetails[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('applications')
        .select(`*, document_type:document_types(*), applicant:employees!applicant_id(*)`)
        .in('status', ['approved', 'archived'])
        .order('approved_at', { ascending: false })
        .limit(50)

      setApplications((data as unknown as ApplicationWithDetails[]) || [])
      setIsLoading(false)
    }
    fetch()
  }, [])

  const filtered = searchQuery
    ? applications.filter(
        (a) =>
          a.title.includes(searchQuery) ||
          a.application_number.includes(searchQuery) ||
          a.applicant?.name?.includes(searchQuery)
      )
    : applications

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">アーカイブ</h1>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="申請番号、タイトル、申請者で検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-gray-500 py-12">アーカイブされた申請はありません</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((app) => (
            <ApplicationCard key={app.id} application={app} />
          ))}
        </div>
      )}
    </div>
  )
}
