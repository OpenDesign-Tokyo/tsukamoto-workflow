import { createAdminClient } from '@/lib/supabase/admin'
import type { ResolvedApprover } from '@/lib/types/workflow'
import type { ApprovalRouteStep } from '@/lib/types/database'

/**
 * 申請者の情報と承認ステップ定義から、具体的な承認者を解決する。
 *
 * 解決ロジック:
 * 1. position_in_department: 申請者の部署→親部署方向に指定役職を検索
 * 2. position_in_parent_department: 親部署から上方向に指定役職を検索
 * 3. specific_employee: 指定された特定の従業員
 * 4. department_head: 申請者の部署長（最上位役職者）
 * 5. applicant_manager: 申請者の直属上長（同部署で1つ上の役職）
 */
export async function resolveApprover(
  step: ApprovalRouteStep,
  applicantId: string,
  applicantDepartmentId: string
): Promise<ResolvedApprover | null> {
  const supabase = createAdminClient()

  switch (step.assignee_type) {
    case 'position_in_department': {
      // Build the department ancestor chain (current → parent → grandparent → ...)
      const deptChain: string[] = [applicantDepartmentId]
      let nextParentId: string | null = applicantDepartmentId
      for (let i = 0; i < 10 && nextParentId; i++) {
        const { data: d } = await supabase
          .from('departments')
          .select('parent_id')
          .eq('id', nextParentId)
          .maybeSingle()
        if (d?.parent_id) {
          deptChain.push(d.parent_id as string)
          nextParentId = d.parent_id as string
        } else {
          break
        }
      }

      // Search each department in the chain for the target position
      for (const deptId of deptChain) {
        const { data } = await supabase
          .from('employee_assignments')
          .select(`
            employee:employees(id, name),
            position:positions(name),
            department:departments(id, name)
          `)
          .eq('department_id', deptId)
          .eq('position_id', step.assignee_position_id!)
          .eq('is_active', true)
          .neq('employee_id', applicantId)
          .maybeSingle()

        if (data?.employee) {
          const emp = data.employee as unknown as { id: string; name: string }
          const pos = data.position as unknown as { name: string }
          const deptInfo = data.department as unknown as { id: string; name: string }
          return {
            employeeId: emp.id,
            employeeName: emp.name,
            positionName: pos.name,
            departmentName: deptInfo.name,
            isProxy: false,
          }
        }
      }
      return null
    }

    case 'position_in_parent_department': {
      // Get parent department
      const { data: dept } = await supabase
        .from('departments')
        .select('parent_id')
        .eq('id', applicantDepartmentId)
        .maybeSingle()

      if (!dept?.parent_id) {
        // If no parent, search in same department
        return resolveApprover(
          { ...step, assignee_type: 'position_in_department' },
          applicantId,
          applicantDepartmentId
        )
      }

      // Find the approver with the target position going up the tree
      let searchDeptId: string | null = dept.parent_id
      while (searchDeptId) {
        const { data } = await supabase
          .from('employee_assignments')
          .select(`
            employee:employees(id, name),
            position:positions(name),
            department:departments(id, name, parent_id)
          `)
          .eq('department_id', searchDeptId)
          .eq('position_id', step.assignee_position_id!)
          .eq('is_active', true)
          .neq('employee_id', applicantId)
          .maybeSingle()

        if (data?.employee) {
          const emp = data.employee as unknown as { id: string; name: string }
          const pos = data.position as unknown as { name: string }
          const deptInfo = data.department as unknown as { id: string; name: string; parent_id: string | null }
          return {
            employeeId: emp.id,
            employeeName: emp.name,
            positionName: pos.name,
            departmentName: deptInfo.name,
            isProxy: false,
          }
        }

        // Go up another level
        const { data: parentDept } = await supabase
          .from('departments')
          .select('parent_id')
          .eq('id', searchDeptId)
          .maybeSingle()

        searchDeptId = parentDept?.parent_id || null
      }

      return null
    }

    case 'specific_employee': {
      const { data } = await supabase
        .from('employees')
        .select('id, name')
        .eq('id', step.assignee_employee_id!)
        .maybeSingle()

      if (!data) return null

      const { data: assignment } = await supabase
        .from('employee_assignments')
        .select(`
          position:positions(name),
          department:departments(name)
        `)
        .eq('employee_id', data.id)
        .eq('is_primary', true)
        .eq('is_active', true)
        .maybeSingle()

      const pos = assignment?.position as unknown as { name: string } | null
      const dept = assignment?.department as unknown as { name: string } | null
      return {
        employeeId: data.id,
        employeeName: data.name,
        positionName: pos?.name || '',
        departmentName: dept?.name || '',
        isProxy: false,
      }
    }

    case 'department_head': {
      const { data } = await supabase
        .from('employee_assignments')
        .select(`
          employee:employees(id, name),
          position:positions(name, rank),
          department:departments(name)
        `)
        .eq('department_id', applicantDepartmentId)
        .eq('is_active', true)
        .neq('employee_id', applicantId)
        .order('position_id')  // will need to sort by rank
        .limit(1)

      if (!data?.[0]?.employee) return null
      const emp = data[0].employee as unknown as { id: string; name: string }
      const pos = data[0].position as unknown as { name: string }
      const dept = data[0].department as unknown as { name: string }
      return {
        employeeId: emp.id,
        employeeName: emp.name,
        positionName: pos.name,
        departmentName: dept.name,
        isProxy: false,
      }
    }

    case 'applicant_manager': {
      // Same department, one rank above
      const { data: applicantAssignment } = await supabase
        .from('employee_assignments')
        .select('position:positions(rank)')
        .eq('employee_id', applicantId)
        .eq('department_id', applicantDepartmentId)
        .eq('is_active', true)
        .maybeSingle()

      const applicantRank = (applicantAssignment?.position as unknown as { rank: number })?.rank || 0

      const { data: managers } = await supabase
        .from('employee_assignments')
        .select(`
          employee:employees(id, name),
          position:positions(name, rank),
          department:departments(name)
        `)
        .eq('department_id', applicantDepartmentId)
        .eq('is_active', true)
        .neq('employee_id', applicantId)

      if (!managers?.length) return null

      // Find closest higher rank
      const sorted = managers
        .filter(m => {
          const rank = (m.position as unknown as { rank: number })?.rank || 0
          return rank > applicantRank
        })
        .sort((a, b) => {
          const ra = (a.position as unknown as { rank: number })?.rank || 0
          const rb = (b.position as unknown as { rank: number })?.rank || 0
          return ra - rb
        })

      if (!sorted[0]) return null
      const emp = sorted[0].employee as unknown as { id: string; name: string }
      const pos = sorted[0].position as unknown as { name: string }
      const dept = sorted[0].department as unknown as { name: string }
      return {
        employeeId: emp.id,
        employeeName: emp.name,
        positionName: pos.name,
        departmentName: dept.name,
        isProxy: false,
      }
    }
  }
}
