'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Ruler, Plane, FileText, Lightbulb, AlertTriangle, AlertCircle,
  Edit, ShoppingCart, Maximize, Calendar, Truck, Receipt, FileSpreadsheet,
  Train, Package, Stamp, Wallet, ClipboardCheck,
} from 'lucide-react'
import type { DocumentType } from '@/lib/types/database'

const ICON_MAP: Record<string, React.ElementType> = {
  ruler: Ruler,
  plane: Plane,
  'file-text': FileText,
  lightbulb: Lightbulb,
  'alert-triangle': AlertTriangle,
  'alert-circle': AlertCircle,
  edit: Edit,
  'shopping-cart': ShoppingCart,
  maximize: Maximize,
  calendar: Calendar,
  truck: Truck,
  receipt: Receipt,
  'file-spreadsheet': FileSpreadsheet,
  train: Train,
  package: Package,
  stamp: Stamp,
  wallet: Wallet,
  'clipboard-check': ClipboardCheck,
}

export default function NewApplicationPage() {
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchTypes = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('document_types')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')

      setDocumentTypes(data || [])
      setIsLoading(false)
    }
    fetchTypes()
  }, [])

  // Group by category
  const categories = documentTypes.reduce<Record<string, DocumentType[]>>((acc, dt) => {
    if (!acc[dt.category]) acc[dt.category] = []
    acc[dt.category].push(dt)
    return acc
  }, {})

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">新規申請 - 書類種別選択</h1>

      {Object.entries(categories).map(([category, types]) => (
        <div key={category}>
          <h2 className="text-lg font-semibold mb-3 text-gray-700">{category}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {types.map((dt) => {
              const Icon = ICON_MAP[dt.icon] || FileText
              return (
                <Link key={dt.id} href={`/applications/new/${dt.id}`}>
                  <Card className="hover:shadow-md hover:border-blue-300 transition-all cursor-pointer h-full">
                    <CardContent className="p-4 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{dt.name}</p>
                        <p className="text-xs text-gray-500 mt-1">{dt.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
