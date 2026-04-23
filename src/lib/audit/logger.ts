import { createAdminClient } from '@/lib/supabase/admin'

export type AuditAction =
  | 'application.create'
  | 'application.submit'
  | 'application.approve'
  | 'application.reject'
  | 'application.withdraw'
  | 'application.edit'
  | 'template.create'
  | 'template.update'
  | 'template.delete'
  | 'route.create'
  | 'route.update'
  | 'route.delete'
  | 'proxy.create'
  | 'proxy.update'
  | 'proxy.delete'
  | 'graph_sync.execute'

interface AuditLogEntry {
  actorId: string
  action: AuditAction
  targetType: string
  targetId: string
  metadata?: Record<string, unknown>
}

export async function writeAuditLog(entry: AuditLogEntry) {
  try {
    const supabase = createAdminClient()
    await supabase.from('audit_logs').insert({
      actor_id: entry.actorId,
      action: entry.action,
      target_type: entry.targetType,
      target_id: entry.targetId,
      metadata: entry.metadata || {},
      ip_address: null,
      created_at: new Date().toISOString(),
    })
  } catch (e) {
    // Audit log failures should not break the main flow
    console.error('Audit log write failed:', e)
  }
}
