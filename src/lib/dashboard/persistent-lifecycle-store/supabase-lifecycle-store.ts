import type { DashboardPersistentLifecycleStoreConfig, DashboardPersistentLifecycleStoreHealth, DashboardTaskLifecycleStore } from './types'
import { buildLifecycleScopeFilter, mapLifecycleToPersistentRecord, mapPersistentRecordToLifecycle, type PersistentLifecycleRecord } from './lifecycle-record-mapper'
import { mapEventToPersistentRecord, mapPersistentRecordToEvent, type PersistentLifecycleEventRecord } from './lifecycle-event-mapper'
import type { DashboardTaskLifecycleRecord } from './types'
import type { DashboardTaskLifecycleEvent } from './types'

/** Minimal structural interface for the Supabase query builder chain. */
interface SupabaseQueryBuilder {
  eq(column: string, value: string | null): SupabaseQueryBuilder
  is(column: string, value: null): SupabaseQueryBuilder
  order(column: string, options?: { ascending?: boolean }): SupabaseQueryBuilder
  limit(count: number): SupabaseQueryBuilder
  maybeSingle(): Promise<{ data: unknown; error: unknown }>
  then: Promise<{ data: unknown; error: unknown }>['then']
}

/** Minimal structural interface for the Supabase client. */
export interface SupabaseClient {
  from(table: string): {
    select(columns: string): SupabaseQueryBuilder
    upsert(record: unknown, options?: Record<string, unknown>): Promise<{ error: unknown }>
    insert(record: unknown, options?: Record<string, unknown>): Promise<{ error: unknown }>
  }
  rpc?: (...args: unknown[]) => unknown
}

const EVENTS_TABLE = 'dashboard_task_lifecycle_events'

function applyScope(query: SupabaseQueryBuilder, tenantId: string, workspaceId?: string): SupabaseQueryBuilder {
  const scope = buildLifecycleScopeFilter(tenantId, workspaceId)
  query = query.eq('tenant_id', scope.tenant_id)
  query = scope.workspace_id === null ? query.is('workspace_id', null) : query.eq('workspace_id', scope.workspace_id)
  return query
}

export function createSupabasePersistentLifecycleStore(input: {
  client: SupabaseClient
  config: DashboardPersistentLifecycleStoreConfig
}): DashboardTaskLifecycleStore & { getLifecycleById(id: string): Promise<DashboardTaskLifecycleRecord | null>; getEventsForLifecycle(lifecycleId: string): Promise<DashboardTaskLifecycleEvent[]> } {
  const { client, config } = input
  const lifecycleTable = config.tableName ?? 'dashboard_task_lifecycle_records'

  return {
    async saveLifecycle(record) {
      const payload = mapLifecycleToPersistentRecord({ tenantId: config.tenantId, workspaceId: config.workspaceId, lifecycle: record })
      await client.from(lifecycleTable).upsert(payload, { onConflict: 'tenant_id,workspace_id,lifecycle_id' })
    },
    async saveEvent(event) {
      const payload = mapEventToPersistentRecord({ tenantId: config.tenantId, workspaceId: config.workspaceId, event })
      await client.from(EVENTS_TABLE).insert(payload, { onConflict: 'event_id', ignoreDuplicates: true })
    },
    async getLifecycle(id) {
      const row = await this.getLifecycleById(id)
      return row
    },
    async getLifecycleByEnvelopeId(envelopeId) {
      let query = client.from(lifecycleTable).select('*')
      query = applyScope(query, config.tenantId, config.workspaceId).eq('envelope_id', envelopeId)
      const { data } = await query.maybeSingle()
      return data ? mapPersistentRecordToLifecycle(data as PersistentLifecycleRecord) : null
    },
    async listLifecycles() {
      let query = client.from(lifecycleTable).select('*')
      query = applyScope(query, config.tenantId, config.workspaceId).order('updated_at', { ascending: true }).order('lifecycle_id', { ascending: true })
      const { data } = await query
      return ((data ?? []) as PersistentLifecycleRecord[]).map((x) => mapPersistentRecordToLifecycle(x))
    },
    async listEvents(lifecycleId) {
      let query = client.from(EVENTS_TABLE).select('*')
      query = applyScope(query, config.tenantId, config.workspaceId)
      if (lifecycleId) query = query.eq('lifecycle_id', lifecycleId)
      query = query.order('occurred_at', { ascending: true }).order('event_id', { ascending: true })
      const { data } = await query
      return ((data ?? []) as PersistentLifecycleEventRecord[]).map((x) => mapPersistentRecordToEvent(x))
    },
    async getLifecycleById(id: string) {
      let query = client.from(lifecycleTable).select('*')
      query = applyScope(query, config.tenantId, config.workspaceId).eq('lifecycle_id', id)
      const { data } = await query.maybeSingle()
      return data ? mapPersistentRecordToLifecycle(data as PersistentLifecycleRecord) : null
    },
    async getEventsForLifecycle(lifecycleId: string) {
      return this.listEvents(lifecycleId)
    },
  }
}

export function getSupabaseLifecycleStoreHealth(client: SupabaseClient | null | undefined): DashboardPersistentLifecycleStoreHealth {
  const warnings: string[] = []
  const errors: string[] = []
  if (!client) errors.push('Supabase client is missing.')
  if (client && typeof client.from !== 'function') errors.push('Supabase client missing from().')
  if (client && typeof client.rpc !== 'function') warnings.push('Supabase client missing rpc(); health checks limited.')
  return { provider: 'supabase', healthy: errors.length === 0, warnings, errors }
}
