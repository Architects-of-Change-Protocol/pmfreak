export type DashboardSeverity = 'info' | 'warning' | 'critical'

export type DashboardCardStatus = 'healthy' | 'attention' | 'critical'

export interface PortfolioHealthPanelDTO {
  score: number
  status: DashboardCardStatus
  label: string
  trend: string
}

export interface ExecutiveSummaryCardDTO {
  title: string
  summary: string
  status: DashboardCardStatus
  recommendation: string
}

export interface RiskTableRowDTO {
  id: string
  title: string
  severity: DashboardSeverity
  source: string
  affectedProjects: string[]
  rationale: string
}

export interface DecisionWidgetItemDTO {
  id: string
  title: string
  recommendation: string
  confidenceScore: number
  severity: DashboardSeverity
}

export interface InterventionQueueItemDTO {
  id: string
  title: string
  urgency: DashboardSeverity
  ownerLane: string
  cadence: string
  affectedProjects: string[]
}

export interface AlertPanelItemDTO {
  id: string
  title: string
  type: string
  severity: DashboardSeverity
  description: string
}

export interface PortfolioExecutiveDashboardDTO {
  portfolioHealthPanel: PortfolioHealthPanelDTO
  executiveSummaryCard: ExecutiveSummaryCardDTO
  topRisksTable: RiskTableRowDTO[]
  decisionsWidget: DecisionWidgetItemDTO[]
  interventionsQueue: InterventionQueueItemDTO[]
  alertPanel: AlertPanelItemDTO[]
}

export interface DashboardRuntimeInput {
  executiveDashboardReport: Record<string, unknown>
  interventionReport?: Record<string, unknown>
  decisionSimulationReports?: Record<string, unknown>[]
  conflictReport?: Record<string, unknown>
}
