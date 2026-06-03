import type { DashboardTaskLifecycleEvent, DashboardTaskLifecycleRecord, DashboardTaskLifecycleStore } from './types'

export interface DashboardVaultLifecycleStoreContract {
  saveLifecycle(record: DashboardTaskLifecycleRecord): Promise<void>
  saveEvent(event: DashboardTaskLifecycleEvent): Promise<void>
  listLifecycles(): Promise<DashboardTaskLifecycleRecord[]>
  listEvents(lifecycleId?: string): Promise<DashboardTaskLifecycleEvent[]>
  getLifecycleById(id: string): Promise<DashboardTaskLifecycleRecord | null>
  getEventsForLifecycle(lifecycleId: string): Promise<DashboardTaskLifecycleEvent[]>
}

export function createVaultPersistentLifecycleStore(provider?: DashboardVaultLifecycleStoreContract): DashboardTaskLifecycleStore & { getLifecycleById(id: string): Promise<DashboardTaskLifecycleRecord | null>; getEventsForLifecycle(lifecycleId: string): Promise<DashboardTaskLifecycleEvent[]> } {
  const fail = async () => { throw new Error('Vault/BYOS lifecycle store provider not configured.') }
  return {
    saveLifecycle: provider?.saveLifecycle ?? fail,
    saveEvent: provider?.saveEvent ?? fail,
    listLifecycles: provider?.listLifecycles ?? fail,
    listEvents: provider?.listEvents ?? fail,
    async getLifecycle(id) { return provider ? provider.getLifecycleById(id) : fail() },
    async getLifecycleByEnvelopeId() { return null },
    async getLifecycleById(id) { return provider ? provider.getLifecycleById(id) : fail() },
    async getEventsForLifecycle(lifecycleId) { return provider ? provider.getEventsForLifecycle(lifecycleId) : fail() },
  }
}
