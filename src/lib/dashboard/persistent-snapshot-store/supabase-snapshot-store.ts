import type { DashboardSnapshotStore, DashboardSourceHydrationRequest, DashboardSourceSnapshot } from '../source-hydration/types'
import type { DashboardSourceSnapshotRecord } from './types'
import { mapRecordToSnapshot, mapSnapshotToRecord } from './snapshot-record-mapper'
import { DEFAULT_DASHBOARD_SNAPSHOT_TABLE } from './types'

/** Minimal structural interface for the Supabase snapshot store client. */
interface SnapshotSupabaseClient {
  from(table: string): {
    upsert(record: unknown, options?: Record<string, unknown>): Promise<{ error: unknown }>
    select(columns: string): {
      eq(column: string, value: string): SnapshotQueryBuilder
      is(column: string, value: null): SnapshotQueryBuilder
    }
  }
}

interface SnapshotQueryBuilder {
  eq(column: string, value: string | null): SnapshotQueryBuilder
  is(column: string, value: null): SnapshotQueryBuilder
  order(column: string, options?: { ascending?: boolean }): SnapshotQueryBuilder
  limit(count: number): SnapshotQueryBuilder
  then: Promise<{ data: unknown; error: unknown }>['then']
}

export function createSupabaseDashboardSnapshotStore(input: {
  supabaseClient: SnapshotSupabaseClient
  tableName?: string
}): DashboardSnapshotStore {
  const { supabaseClient, tableName = DEFAULT_DASHBOARD_SNAPSHOT_TABLE } = input

  if (!supabaseClient) {
    throw new Error('Supabase client is required for dashboard snapshot store.')
  }

  return {
    async saveSnapshot(snapshot: DashboardSourceSnapshot): Promise<void> {
      const record = mapSnapshotToRecord(snapshot)
      const { error } = await supabaseClient.from(tableName).upsert(record, { onConflict: 'id' })
      if (error) {
        throw new Error('Failed to save dashboard source snapshot.')
      }
    },

    async getLatestSnapshot(request: {
      tenantId: string
      workspaceId?: string
      portfolioId?: string
      sourceKind: string
    }): Promise<DashboardSourceSnapshot | null> {
      let query = supabaseClient
        .from(tableName)
        .select('*')
        .eq('tenant_id', request.tenantId)
        .eq('source_kind', request.sourceKind)

      if (request.workspaceId !== undefined) {
        query = query.eq('workspace_id', request.workspaceId)
      } else {
        query = query.is('workspace_id', null)
      }

      if (request.portfolioId !== undefined) {
        query = query.eq('portfolio_id', request.portfolioId)
      } else {
        query = query.is('portfolio_id', null)
      }

      query = query.order('generated_at', { ascending: false }).limit(1)

      const { data, error } = await query

      if (error) {
        throw new Error('Failed to read dashboard source snapshot.')
      }

      const rows = data as DashboardSourceSnapshotRecord[] | null
      if (!rows || rows.length === 0) return null
      return mapRecordToSnapshot(rows[0])
    },

    async listLatestSnapshots(request: DashboardSourceHydrationRequest): Promise<DashboardSourceSnapshot[]> {
      let query = supabaseClient
        .from(tableName)
        .select('*')
        .eq('tenant_id', request.tenantId)

      if (request.workspaceId !== undefined) {
        query = query.eq('workspace_id', request.workspaceId)
      } else {
        query = query.is('workspace_id', null)
      }

      if (request.portfolioId !== undefined) {
        query = query.eq('portfolio_id', request.portfolioId)
      } else {
        query = query.is('portfolio_id', null)
      }

      query = query.order('generated_at', { ascending: false })

      const { data, error } = await query

      if (error) {
        throw new Error('Failed to list dashboard source snapshots.')
      }

      const allRows = data as DashboardSourceSnapshotRecord[] | null
      if (!allRows || allRows.length === 0) return []

      const latestByKind = new Map<string, DashboardSourceSnapshotRecord>()
      for (const record of allRows) {
        if (!latestByKind.has(record.source_kind)) {
          latestByKind.set(record.source_kind, record)
        }
      }

      const snapshots = Array.from(latestByKind.values()).map(mapRecordToSnapshot)
      return snapshots.sort((a, b) => a.sourceKind.localeCompare(b.sourceKind))
    },
  }
}
