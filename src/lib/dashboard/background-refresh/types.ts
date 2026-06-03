import type {
  DashboardSourceKind,
  DashboardSourceHydrationRequest,
  DashboardSnapshotStore,
} from '../source-hydration/index'

import type {
  DashboardRefreshAction,
  DashboardRefreshPlan,
  DashboardRefreshPriority,
} from '../cache-refresh/index'

export type DashboardRefreshWorkerTrigger =
  | 'manual'
  | 'scheduled'
  | 'cache_policy'
  | 'source_missing'
  | 'source_stale'
  | 'system_recovery'

export type DashboardRefreshWorkerStatus = 'completed' | 'partial' | 'skipped' | 'failed'

export type DashboardSourceRefreshStatus = 'refreshed' | 'skipped' | 'failed'

export type DashboardRefreshExecutionMode = 'dry_run' | 'execute'

export interface DashboardSourceRefreshProvider {
  sourceKind: DashboardSourceKind
  refresh(input: {
    request: DashboardSourceHydrationRequest
    reason: string
    now: string
  }): Promise<{
    payload: unknown
    schemaVersion: string
    runtimeVersion: string
    expiresAt?: string
  }>
}

export interface DashboardBackgroundRefreshRequest {
  hydrationRequest: DashboardSourceHydrationRequest
  store: DashboardSnapshotStore
  trigger: DashboardRefreshWorkerTrigger
  mode?: DashboardRefreshExecutionMode
  providers?: Partial<Record<DashboardSourceKind, DashboardSourceRefreshProvider>>
  requestedSourceKinds?: DashboardSourceKind[]
  maxActions?: number
}

export interface DashboardSourceRefreshExecution {
  sourceKind: DashboardSourceKind
  actionId?: string
  reason: string
  priority: DashboardRefreshPriority
  status: DashboardSourceRefreshStatus
  snapshotId?: string
  error?: string
}

export interface DashboardBackgroundRefreshReport {
  status: DashboardRefreshWorkerStatus
  trigger: DashboardRefreshWorkerTrigger
  mode: DashboardRefreshExecutionMode
  generatedAt: string
  attemptedSources: number
  refreshedSources: number
  skippedSources: number
  failedSources: number
  executions: DashboardSourceRefreshExecution[]
  warnings: string[]
}

export interface DashboardBackgroundRefreshPlannerResult {
  refreshPlan: DashboardRefreshPlan
  selectedActions: DashboardRefreshAction[]
  skippedReason?: string
}

export type {
  DashboardSourceKind,
  DashboardSourceHydrationRequest,
  DashboardSnapshotStore,
  DashboardRefreshAction,
  DashboardRefreshPlan,
  DashboardRefreshPriority,
}
