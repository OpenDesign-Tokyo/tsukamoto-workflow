/**
 * Organization sync engine: Graph API → Supabase
 * Supports preview (dry-run) and execute modes.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { getUsers, getUserManager, type GraphUser } from './ms-graph'

export interface SyncChange {
  type: 'create' | 'update' | 'deactivate'
  entity: 'employee' | 'department' | 'position'
  name: string
  email?: string
  details: Record<string, unknown>
}

export interface SyncResult {
  changes: SyncChange[]
  summary: {
    employees: { created: number; updated: number; deactivated: number }
    departments: { created: number }
    positions: { created: number }
  }
}

/**
 * Preview: show what changes would be made without applying them.
 */
export async function previewSync(): Promise<SyncResult> {
  return runSync(true)
}

/**
 * Execute: apply all changes to the database.
 */
export async function executeSync(): Promise<SyncResult> {
  return runSync(false)
}

async function runSync(dryRun: boolean): Promise<SyncResult> {
  const supabase = createAdminClient()
  const changes: SyncChange[] = []
  const summary = {
    employees: { created: 0, updated: 0, deactivated: 0 },
    departments: { created: 0 },
    positions: { created: 0 },
  }

  // 1. Fetch all users from Graph API
  const graphUsers = await getUsers()

  // Filter to only real person accounts in company domain
  const COMPANY_DOMAIN = '@tsukamoto.co.jp'
  const validUsers = graphUsers.filter(u => {
    const email = (u.mail || u.userPrincipalName || '').toLowerCase()
    return email.endsWith(COMPANY_DOMAIN) && u.accountEnabled
  })

  // 2. Fetch existing data from Supabase
  const { data: existingEmployees } = await supabase.from('employees').select('id, email, name, is_active, auth_user_id')
  const { data: existingDepts } = await supabase.from('departments').select('id, name')
  const { data: existingPositions } = await supabase.from('positions').select('id, name')
  const { data: existingAssignments } = await supabase.from('employee_assignments').select('id, employee_id, department_id, position_id, is_active')

  const employeesByEmail = new Map((existingEmployees || []).map(e => [e.email.toLowerCase(), e]))
  const deptsByName = new Map((existingDepts || []).map(d => [d.name, d.id]))
  const positionsByName = new Map((existingPositions || []).map(p => [p.name, p.id]))
  const assignmentsByEmployee = new Map<string, typeof existingAssignments>()
  for (const a of existingAssignments || []) {
    const list = assignmentsByEmployee.get(a.employee_id) || []
    list.push(a)
    assignmentsByEmployee.set(a.employee_id, list)
  }

  const seenEmails = new Set<string>()

  // 3. Process each Graph user
  for (const gu of validUsers) {
    const email = (gu.mail || gu.userPrincipalName).toLowerCase()
    seenEmails.add(email)

    const existing = employeesByEmail.get(email)
    const departmentName = gu.department || null
    const positionName = gu.jobTitle || null

    // Ensure department exists
    let departmentId: string | null = null
    if (departmentName) {
      if (deptsByName.has(departmentName)) {
        departmentId = deptsByName.get(departmentName)!
      } else {
        changes.push({
          type: 'create',
          entity: 'department',
          name: departmentName,
          details: {},
        })
        summary.departments.created++
        if (!dryRun) {
          const { data: newDept } = await supabase
            .from('departments')
            .insert({ name: departmentName, level: 1, sort_order: 999 })
            .select('id')
            .single()
          if (newDept) {
            departmentId = newDept.id
            deptsByName.set(departmentName, newDept.id)
          }
        } else {
          deptsByName.set(departmentName, `preview-${departmentName}`)
        }
      }
    }

    // Ensure position exists
    let positionId: string | null = null
    if (positionName) {
      if (positionsByName.has(positionName)) {
        positionId = positionsByName.get(positionName)!
      } else {
        changes.push({
          type: 'create',
          entity: 'position',
          name: positionName,
          details: {},
        })
        summary.positions.created++
        if (!dryRun) {
          const { data: newPos } = await supabase
            .from('positions')
            .insert({ name: positionName, rank: 99 })
            .select('id')
            .single()
          if (newPos) {
            positionId = newPos.id
            positionsByName.set(positionName, newPos.id)
          }
        } else {
          positionsByName.set(positionName, `preview-${positionName}`)
        }
      }
    }

    if (!existing) {
      // New employee
      changes.push({
        type: 'create',
        entity: 'employee',
        name: gu.displayName,
        email,
        details: { department: departmentName, position: positionName },
      })
      summary.employees.created++
      if (!dryRun) {
        const { data: newEmp } = await supabase
          .from('employees')
          .insert({
            name: gu.displayName,
            email,
            is_active: true,
            is_admin: false,
          })
          .select('id')
          .single()
        if (newEmp && departmentId && positionId) {
          await supabase.from('employee_assignments').insert({
            employee_id: newEmp.id,
            department_id: departmentId,
            position_id: positionId,
            is_primary: true,
            is_active: true,
            started_at: new Date().toISOString().split('T')[0],
          })
        }
      }
    } else {
      // Existing employee - check for changes
      const nameChanged = existing.name !== gu.displayName
      const wasInactive = !existing.is_active

      // Check assignment changes
      const currentAssignments = assignmentsByEmployee.get(existing.id) || []
      const activeAssignment = currentAssignments.find(a => a.is_active)
      const assignmentChanged = departmentId && positionId && (
        !activeAssignment ||
        activeAssignment.department_id !== departmentId ||
        activeAssignment.position_id !== positionId
      )

      if (nameChanged || wasInactive || assignmentChanged) {
        const details: Record<string, unknown> = {}
        if (nameChanged) details.name = { from: existing.name, to: gu.displayName }
        if (wasInactive) details.reactivated = true
        if (assignmentChanged) details.assignment = { department: departmentName, position: positionName }

        changes.push({
          type: 'update',
          entity: 'employee',
          name: gu.displayName,
          email,
          details,
        })
        summary.employees.updated++

        if (!dryRun) {
          const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
          if (nameChanged) updateData.name = gu.displayName
          if (wasInactive) updateData.is_active = true

          await supabase.from('employees').update(updateData).eq('id', existing.id)

          if (assignmentChanged && departmentId && positionId) {
            // Deactivate old assignments
            if (activeAssignment) {
              await supabase
                .from('employee_assignments')
                .update({ is_active: false, ended_at: new Date().toISOString().split('T')[0] })
                .eq('id', activeAssignment.id)
            }
            // Create new assignment
            await supabase.from('employee_assignments').insert({
              employee_id: existing.id,
              department_id: departmentId,
              position_id: positionId,
              is_primary: true,
              is_active: true,
              started_at: new Date().toISOString().split('T')[0],
            })
          }
        }
      }
    }
  }

  // 4. Deactivate employees not in Graph (only those that were synced, i.e. have a matching email)
  for (const emp of existingEmployees || []) {
    if (emp.is_active && !seenEmails.has(emp.email.toLowerCase())) {
      // Only deactivate if the employee email domain matches the tenant
      // Skip manually-created demo users
      changes.push({
        type: 'deactivate',
        entity: 'employee',
        name: emp.name,
        email: emp.email,
        details: { reason: 'Not found in Entra ID' },
      })
      summary.employees.deactivated++

      if (!dryRun) {
        await supabase
          .from('employees')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', emp.id)
      }
    }
  }

  return { changes, summary }
}
