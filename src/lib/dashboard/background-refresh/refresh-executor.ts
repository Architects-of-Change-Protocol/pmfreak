import type { DashboardRefreshAction } from '../cache-refresh/index'
import type { DashboardSourceSnapshot } from '../source-hydration/index'
import type {
  DashboardBackgroundRefreshRequest,
  DashboardSourceRefreshExecution,
} from './types'

export async function executeDashboardRefreshActions(input: {
  request: DashboardBackgroundRefreshRequest
  actions: DashboardRefreshAction[]
  now?: string
}): Promise<DashboardSourceRefreshExecution[]> {
  const { request, actions } = input
  const now = input.now ?? new Date().toISOString()
  const mode = request.mode ?? 'execute'
  const providers = request.providers ?? {}
  const { hydrationRequest, store } = request
  const executions: DashboardSourceRefreshExecution[] = []

  for (const action of actions) {
    const provider = providers[action.sourceKind]

    if (!provider) {
      executions.push({
        sourceKind: action.sourceKind,
        actionId: action.id,
        reason: action.reason,
        priority: action.priority,
        status: 'skipped',
        error: 'No refresh provider registered for source kind.',
      })
      continue
    }

    if (mode === 'dry_run') {
      executions.push({
        sourceKind: action.sourceKind,
        actionId: action.id,
        reason: action.reason,
        priority: action.priority,
        status: 'skipped',
        error: 'Dry run mode; snapshot was not persisted.',
      })
      continue
    }

    let providerResult: {
      payload: unknown
      schemaVersion: string
      runtimeVersion: string
      expiresAt?: string
    }
    try {
      providerResult = await provider.refresh({
        request: hydrationRequest,
        reason: action.reason,
        now,
      })
    } catch (err) {
      executions.push({
        sourceKind: action.sourceKind,
        actionId: action.id,
        reason: action.reason,
        priority: action.priority,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Provider refresh failed with unknown error.',
      })
      continue
    }

    const snapshotId = [
      'dashboard-snapshot',
      hydrationRequest.tenantId,
      hydrationRequest.workspaceId ?? '_',
      hydrationRequest.portfolioId ?? '_',
      action.sourceKind,
      String(Date.parse(now)),
    ].join(':')

    const snapshot: DashboardSourceSnapshot = {
      id: snapshotId,
      tenantId: hydrationRequest.tenantId,
      workspaceId: hydrationRequest.workspaceId,
      portfolioId: hydrationRequest.portfolioId,
      sourceKind: action.sourceKind,
      payload: providerResult.payload,
      generatedAt: now,
      expiresAt: providerResult.expiresAt,
      schemaVersion: providerResult.schemaVersion,
      runtimeVersion: providerResult.runtimeVersion,
    }

    await store.saveSnapshot(snapshot)

    executions.push({
      sourceKind: action.sourceKind,
      actionId: action.id,
      reason: action.reason,
      priority: action.priority,
      status: 'refreshed',
      snapshotId,
    })
  }

  return executions
}
