import type { DashboardTaskLifecycleEvent } from './types'

export interface PersistentLifecycleEventRecord {
  tenant_id: string
  workspace_id: string | null
  event_id: string
  lifecycle_id: string
  event_type: string
  occurred_at: string
  actor: string | null
  message: string
  metadata_json: Record<string, unknown>
}

export function mapEventToPersistentRecord(input: {
  tenantId: string
  workspaceId?: string
  event: DashboardTaskLifecycleEvent
}): PersistentLifecycleEventRecord {
  const { tenantId, workspaceId, event } = input
  return {
    tenant_id: tenantId,
    workspace_id: workspaceId ?? null,
    event_id: event.id,
    lifecycle_id: event.lifecycleId,
    event_type: event.eventType,
    occurred_at: event.occurredAt,
    actor: event.actor ?? null,
    message: event.message,
    metadata_json: event.metadata,
  }
}

export function mapPersistentRecordToEvent(record: PersistentLifecycleEventRecord): DashboardTaskLifecycleEvent {
  return {
    id: record.event_id,
    lifecycleId: record.lifecycle_id,
    eventType: record.event_type as DashboardTaskLifecycleEvent['eventType'],
    occurredAt: record.occurred_at,
    actor: record.actor ?? undefined,
    message: record.message,
    metadata: record.metadata_json ?? {},
  }
}
