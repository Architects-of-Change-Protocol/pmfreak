export type DashboardActionType =
  | 'refresh_dashboard_source'
  | 'resolve_portfolio_risk'
  | 'execute_pmo_intervention'
  | 'review_executive_decision'
  | 'escalate_dashboard_alert'
  | 'recover_dashboard_hydration'
  | 'approve_refresh_plan'
  | 'acknowledge_warning'
  | 'open_follow_up_cadence'
  | 'request_missing_input'
  | 'resolve_dependency'
  | 'review_financial_exposure'

export type DashboardActionPriority = 'low' | 'medium' | 'high' | 'critical'
export type DashboardActionStatus = 'proposed' | 'approved' | 'in_progress' | 'blocked' | 'completed' | 'cancelled'

export type DashboardActionOwnerLane =
  | 'project_manager'
  | 'pmo_director'
  | 'technical_lead'
  | 'finance_lead'
  | 'logistics_lead'
  | 'executive_sponsor'
  | 'client_owner'
  | 'vendor_owner'
  | 'system_runtime'

export type DashboardActionExecutionLane =
  | 'dashboard_refresh'
  | 'portfolio_governance'
  | 'pmo_intervention'
  | 'executive_decision'
  | 'risk_management'
  | 'dependency_management'
  | 'financial_governance'
  | 'client_coordination'
  | 'technical_coordination'
  | 'system_recovery'

export interface DashboardActionEscalationRoute { required: boolean; routeTo?: DashboardActionOwnerLane; reason?: string }
export interface DashboardActionSLA { responseDueHours: number; resolutionDueHours: number; cadence: string }

export interface DashboardAction {
  id: string
  type: DashboardActionType
  title: string
  description: string
  priority: DashboardActionPriority
  status: DashboardActionStatus
  ownerLane: DashboardActionOwnerLane
  executionLane: DashboardActionExecutionLane
  affectedProjects: string[]
  source: string
  sourceId?: string
  sla: DashboardActionSLA
  escalationRoute: DashboardActionEscalationRoute
  evidenceRequired: string[]
  rationale: string
  signal?: Record<string, unknown>
}

export interface DashboardActionCenterInput {
  dashboardViewModel?: unknown
  cacheRefreshResult?: unknown
  hydrationResult?: unknown
  pmoInterventionReport?: unknown
}

export interface DashboardActionCenterReport {
  totalActions: number
  criticalActions: number
  escalationRequiredCount: number
  actionsByExecutionLane: Record<string, number>
  actionsByOwnerLane: Record<string, number>
  recommendedNextAction?: DashboardAction
  actions: DashboardAction[]
  executiveSummary: string
}
