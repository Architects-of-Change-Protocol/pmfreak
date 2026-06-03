export type DashboardApiRuntimeStatus = 'ok' | 'partial' | 'empty' | 'error'

export interface DashboardApiRequest {
  tenantId: string
  workspaceId?: string
  portfolioId?: string
  userId?: string
  includeSignals?: boolean
  includeMetadata?: boolean
}

export interface DashboardApiMetadata {
  generatedAt: string
  tenantId: string
  workspaceId?: string
  portfolioId?: string
  sourceSignals: {
    executiveDashboardReport: boolean
    interventionReport: boolean
    decisionSimulationReports: boolean
    conflictReport: boolean
  }
  runtimeVersion: string
}

export interface DashboardApiResponse {
  status: DashboardApiRuntimeStatus
  data: unknown
  metadata?: DashboardApiMetadata
  warnings: string[]
}

export interface DashboardApiError {
  code: string
  message: string
  recoverable: boolean
}

export interface DashboardSourceData {
  executiveDashboardReport?: unknown
  interventionReport?: unknown
  decisionSimulationReports?: unknown
  conflictReport?: unknown
}
