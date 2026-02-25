'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronRight, ChevronDown, Building2, User } from 'lucide-react'
import type { Department, Employee, EmployeeAssignment, Position } from '@/lib/types/database'

interface DeptNode extends Department {
  children: DeptNode[]
  members: (EmployeeAssignment & { employee: Employee; position: Position })[]
}

export default function OrgPage() {
  const [tree, setTree] = useState<DeptNode[]>([])
  const [selectedDept, setSelectedDept] = useState<DeptNode | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchOrg = async () => {
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
      const assignments = (assignRes.data || []) as unknown as (EmployeeAssignment & { employee: Employee; position: Position })[]

      // Build tree
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
      if (roots.length > 0) setSelectedDept(roots[0])
      setIsLoading(false)
    }
    fetchOrg()
  }, [])

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
      <h1 className="text-2xl font-bold">組織図管理</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Tree */}
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
                level={0}
              />
            ))}
          </CardContent>
        </Card>

        {/* Members */}
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
    </div>
  )
}

function DeptTreeNode({
  node,
  selectedId,
  onSelect,
  level,
}: {
  node: DeptNode
  selectedId?: string
  onSelect: (node: DeptNode) => void
  level: number
}) {
  const [expanded, setExpanded] = useState(level < 2)
  const hasChildren = node.children.length > 0
  const isSelected = selectedId === node.id

  return (
    <div>
      <button
        onClick={() => {
          onSelect(node)
          if (hasChildren) setExpanded(!expanded)
        }}
        className={`flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md transition-colors ${
          isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {hasChildren ? (
          expanded ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />
        ) : (
          <span className="w-4" />
        )}
        <Building2 className="w-4 h-4 shrink-0 text-gray-400" />
        <span className="truncate">{node.name}</span>
        <span className="text-xs text-gray-400 ml-auto">{node.members.length}</span>
      </button>
      {expanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <DeptTreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
