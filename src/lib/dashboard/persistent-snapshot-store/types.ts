import type {
  DashboardSourceKind,
  DashboardSourceSnapshot,
  DashboardSourceHydrationRequest,
  DashboardSnapshotStore,
} from '../source-hydration/types'

export type { DashboardSourceKind, DashboardSourceSnapshot, DashboardSourceHydrationRequest, DashboardSnapshotStore }

export type PersistentSnapshotStoreProvider = 'memory' | 'supabase' | 'vault'

export interface DashboardSourceSnapshotRecord {
  id: string
  tenant_id: string
  workspace_id?: string | null
  portfolio_id?: string | null
  source_kind: DashboardSourceKind
  payload: unknown
  generated_at: string
  expires_at?: string | null
  schema_version: string
  runtime_version: string
  created_at?: string
  updated_at?: string
}

export interface PersistentSnapshotStoreConfig {
  provider: PersistentSnapshotStoreProvider
  supabaseClient?: unknown
  vaultClient?: unknown
  tableName?: string
}

export interface PersistentSnapshotStoreHealth {
  provider: PersistentSnapshotStoreProvider
  available: boolean
  readSupported: boolean
  writeSupported: boolean
  reason?: string
}

export const DEFAULT_DASHBOARD_SNAPSHOT_TABLE = 'dashboard_source_snapshots'
