import { createInMemoryDashboardSnapshotStore } from '../source-hydration/snapshot-store'
import type { DashboardSnapshotStore } from '../source-hydration/types'
import { createSupabaseDashboardSnapshotStore } from './supabase-snapshot-store'
import type { PersistentSnapshotStoreConfig, PersistentSnapshotStoreHealth } from './types'
import { createVaultDashboardSnapshotStore } from './vault-snapshot-store-contract'

export function createPersistentDashboardSnapshotStore(config: PersistentSnapshotStoreConfig): DashboardSnapshotStore {
  switch (config.provider) {
    case 'memory':
      return createInMemoryDashboardSnapshotStore()

    case 'supabase':
      return createSupabaseDashboardSnapshotStore({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabaseClient: config.supabaseClient as any,
        tableName: config.tableName,
      })

    case 'vault':
      return createVaultDashboardSnapshotStore({ vaultClient: config.vaultClient })

    default:
      throw new Error('Unsupported dashboard snapshot store provider.')
  }
}

export function getPersistentSnapshotStoreHealth(config: PersistentSnapshotStoreConfig): PersistentSnapshotStoreHealth {
  if (config.provider === 'memory') {
    return { provider: 'memory', available: true, readSupported: true, writeSupported: true }
  }

  if (config.provider === 'supabase') {
    if (!config.supabaseClient) {
      return {
        provider: 'supabase',
        available: false,
        readSupported: false,
        writeSupported: false,
        reason: 'Supabase client is not configured.',
      }
    }
    return { provider: 'supabase', available: true, readSupported: true, writeSupported: true }
  }

  if (config.provider === 'vault') {
    if (!config.vaultClient) {
      return {
        provider: 'vault',
        available: false,
        readSupported: false,
        writeSupported: false,
        reason: 'Vault client is not configured.',
      }
    }
    const vaultClient = config.vaultClient as Record<string, unknown>
    const hasContract =
      typeof vaultClient.saveSnapshot === 'function' &&
      typeof vaultClient.getLatestSnapshot === 'function' &&
      typeof vaultClient.listLatestSnapshots === 'function'
    if (!hasContract) {
      return {
        provider: 'vault',
        available: false,
        readSupported: false,
        writeSupported: false,
        reason: 'Vault client does not implement dashboard snapshot store contract.',
      }
    }
    return { provider: 'vault', available: true, readSupported: true, writeSupported: true }
  }

  return {
    provider: config.provider,
    available: false,
    readSupported: false,
    writeSupported: false,
    reason: 'Unsupported dashboard snapshot store provider.',
  }
}
