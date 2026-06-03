import { getSupabaseLifecycleStoreHealth, type SupabaseClient } from './supabase-lifecycle-store'
import { hydratePersistentLifecycleState } from './lifecycle-hydration-engine'
import { replayLifecycleEventStream } from './lifecycle-replay-engine'
import { reconcilePersistentLifecycleState } from './lifecycle-reconciliation-engine'
import type { DashboardPersistentLifecycleRuntimeReport, DashboardTaskLifecycleStore } from './types'

export async function runPersistentLifecycleStoreRuntime(input: { store: DashboardTaskLifecycleStore; now?: string; supabaseClient?: SupabaseClient }): Promise<DashboardPersistentLifecycleRuntimeReport> {
  const hydrated = await hydratePersistentLifecycleState(input.store)
  const replay = replayLifecycleEventStream({ lifecycles: hydrated.records, events: hydrated.events })
  const reconciliation = reconcilePersistentLifecycleState({ hydrated: hydrated.records, replayed: replay.reconstructed })
  const health = getSupabaseLifecycleStoreHealth(input.supabaseClient)
  const warnings = [...hydrated.warnings, ...replay.warnings, ...reconciliation.warnings, ...health.warnings]
  const healthy = health.healthy && health.errors.length === 0
  const executiveSummary = !healthy
    ? 'Persistent lifecycle store health issues detected.'
    : warnings.length > 0
      ? 'PMFreak recovered lifecycle state with reconciliation warnings.'
      : 'PMFreak recovered persistent lifecycle state successfully.'

  return {
    generatedAt: input.now ?? new Date().toISOString(),
    hydratedRecords: hydrated.records.length,
    hydratedEvents: hydrated.events.length,
    replayedRecords: replay.reconstructed.length,
    reconciledRecords: reconciliation.reconciled.length,
    warnings,
    healthy,
    executiveSummary,
  }
}
