'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowRight } from 'lucide-react'

interface RouteWithSteps {
  id: string
  name: string
  document_type: { name: string; code: string }
  steps: { step_order: number; name: string; assignee_type: string; position?: { name: string } }[]
}

export default function RoutesPage() {
  const [routes, setRoutes] = useState<RouteWithSteps[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchRoutes = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('approval_route_templates')
        .select(`
          *,
          document_type:document_types(name, code),
          steps:approval_route_steps(
            step_order, name, assignee_type,
            position:positions(name)
          )
        `)
        .eq('is_active', true)
        .order('created_at')

      if (data) {
        const sorted = data.map(r => ({
          ...r,
          steps: ((r.steps || []) as any[]).sort((a: any, b: any) => a.step_order - b.step_order),
        }))
        setRoutes(sorted as unknown as RouteWithSteps[])
      }
      setIsLoading(false)
    }
    fetchRoutes()
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">承認ルート管理</h1>

      <div className="space-y-4">
        {routes.map((route) => (
          <Card key={route.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{route.name}</CardTitle>
                <Badge variant="secondary">{route.document_type?.name}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 flex-wrap">
                {route.steps.map((step, idx) => (
                  <div key={step.step_order} className="flex items-center gap-2">
                    <div className="px-3 py-1.5 bg-gray-50 rounded-md border text-sm">
                      <span className="text-xs text-gray-400 mr-1">Step {step.step_order}</span>
                      <span className="font-medium">{step.name}</span>
                      {step.position && (
                        <span className="text-xs text-gray-500 ml-1">({(step.position as any).name})</span>
                      )}
                    </div>
                    {idx < route.steps.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-gray-300" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
