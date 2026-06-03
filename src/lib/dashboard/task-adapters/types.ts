import type {
  DashboardAction,
  DashboardActionPriority,
  DashboardActionOwnerLane,
  DashboardActionExecutionLane,
} from '../action-center'

export type { DashboardAction, DashboardActionPriority, DashboardActionOwnerLane, DashboardActionExecutionLane }

export type DashboardTaskAdapterKind =
  | 'jira'
  | 'linear'
  | 'asana'
  | 'clickup'
  | 'email_queue'
  | 'atenea'
  | 'internal_runtime'

export interface DashboardTaskAdapterCapability {
  supportsPriority: boolean
  supportsAssignee: boolean
  supportsDueDate: boolean
  supportsLabels: boolean
  supportsDescription: boolean
  supportsEscalationMetadata: boolean
  supportsEvidenceRequirements: boolean
  supportsExecutionLane: boolean
}

export interface DashboardProjectedTaskPayload {
  adapter: DashboardTaskAdapterKind
  title: string
  description: string
  priority: string
  assignee?: string
  labels?: string[]
  dueHours?: number
  metadata: Record<string, unknown>
}

export interface DashboardTaskProjection {
  adapter: DashboardTaskAdapterKind
  actionId: string
  valid: boolean
  payload?: DashboardProjectedTaskPayload
  warnings: string[]
  errors: string[]
}

export interface DashboardTaskProjectionRequest {
  actions: DashboardAction[]
  adapters: DashboardTaskAdapterKind[]
}

export interface DashboardTaskProjectionReport {
  totalActions: number
  totalAdapters: number
  successfulProjections: number
  failedProjections: number
  projections: DashboardTaskProjection[]
  warnings: string[]
  executiveSummary: string
}
