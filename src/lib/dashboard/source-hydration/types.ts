export const DASHBOARD_SOURCE_KINDS = [
  'executive_dashboard_report',
  'intervention_report',
  'decision_simulation_reports',
  'conflict_report',
] as const

export type DashboardSourceKind = (typeof DASHBOARD_SOURCE_KINDS)[number]

export type DashboardSnapshotStatus = 'fresh' | 'stale' | 'incomplete' | 'missing' | 'invalid'

export type DashboardHydrationRiskLevel = 'low' | 'moderate' | 'high' | 'critical'

export interface DashboardSourceSnapshot {
  id: string
  tenantId: string
  workspaceId?: string
  portfolioId?: string
  sourceKind: DashboardSourceKind
  payload: unknown
  generatedAt: string
  expiresAt?: string
  schemaVersion: string
  runtimeVersion: string
}

export interface DashboardSourceHydrationRequest {
  tenantId: string
  workspaceId?: string
  portfolioId?: string
  maxAgeMinutes?: number
}

export interface DashboardSourceFreshness {
  sourceKind: DashboardSourceKind
  status: DashboardSnapshotStatus
  ageMinutes?: number
  freshnessScore: number
  reason: string
}

export interface DashboardSourceCompleteness {
  requiredSourcesPresent: boolean
  presentSources: DashboardSourceKind[]
  missingSources: DashboardSourceKind[]
  invalidSources: DashboardSourceKind[]
  completenessScore: number
}

export interface DashboardHydrationResult {
  sourceData: {
    executiveDashboardReport?: unknown
    interventionReport?: unknown
    decisionSimulationReports?: unknown
    conflictReport?: unknown
  }
  snapshots: DashboardSourceSnapshot[]
  freshness: DashboardSourceFreshness[]
  completeness: DashboardSourceCompleteness
  riskLevel: DashboardHydrationRiskLevel
  warnings: string[]
}

export interface DashboardSnapshotStore {
  saveSnapshot(snapshot: DashboardSourceSnapshot): Promise<void>
  getLatestSnapshot(request: {
    tenantId: string
    workspaceId?: string
    portfolioId?: string
    sourceKind: DashboardSourceKind
  }): Promise<DashboardSourceSnapshot | null>
  listLatestSnapshots(request: DashboardSourceHydrationRequest): Promise<DashboardSourceSnapshot[]>
}
