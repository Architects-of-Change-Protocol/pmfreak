import type {
  DashboardSnapshotStore,
  DashboardSourceHydrationRequest,
  DashboardSourceKind,
  DashboardSourceSnapshot,
} from '../source-hydration/types'

export interface DashboardVaultSnapshotStoreContract {
  saveSnapshot(snapshot: DashboardSourceSnapshot): Promise<void>
  getLatestSnapshot(request: {
    tenantId: string
    workspaceId?: string
    portfolioId?: string
    sourceKind: DashboardSourceKind
  }): Promise<DashboardSourceSnapshot | null>
  listLatestSnapshots(request: DashboardSourceHydrationRequest): Promise<DashboardSourceSnapshot[]>
}

function isValidVaultContract(client: unknown): client is DashboardVaultSnapshotStoreContract {
  if (typeof client !== 'object' || client === null) return false
  const c = client as Record<string, unknown>
  return (
    typeof c.saveSnapshot === 'function' &&
    typeof c.getLatestSnapshot === 'function' &&
    typeof c.listLatestSnapshots === 'function'
  )
}

export function createVaultDashboardSnapshotStore(input: { vaultClient?: unknown }): DashboardSnapshotStore {
  const { vaultClient } = input

  if (!vaultClient) {
    throw new Error('Vault client is required for dashboard snapshot store.')
  }

  if (!isValidVaultContract(vaultClient)) {
    throw new Error('Vault client does not implement dashboard snapshot store contract.')
  }

  return {
    saveSnapshot: (snapshot) => vaultClient.saveSnapshot(snapshot),
    getLatestSnapshot: (request) => vaultClient.getLatestSnapshot(request),
    listLatestSnapshots: (request) => vaultClient.listLatestSnapshots(request),
  }
}
