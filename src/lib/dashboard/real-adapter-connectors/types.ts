import type { DashboardLiveConnector } from '../live-adapter-connectors/index'
import type { DashboardProjectedTaskPayload, DashboardTaskAdapterKind } from '../task-adapters/index'

export type { DashboardLiveConnector, DashboardProjectedTaskPayload, DashboardTaskAdapterKind }

export interface DashboardRealConnectorExecutionResult {
  externalTaskId?: string
  externalUrl?: string
  status: 'created' | 'updated' | 'commented' | 'simulated' | 'failed'
  message: string
  retryable?: boolean
  metadata?: Record<string, unknown>
}

export interface DashboardConnectorClientHealth {
  provider: string
  available: boolean
  canCreateTask: boolean
  canComment: boolean
  canTransition: boolean
  warnings: string[]
  errors: string[]
}

export interface JiraClientContract {
  createIssue(input: Record<string, unknown>): Promise<{ id: string; key?: string; url?: string }>
  addComment?(issueIdOrKey: string, body: string): Promise<unknown>
  transitionIssue?(issueIdOrKey: string, transition: string): Promise<unknown>
}

export interface LinearClientContract {
  createIssue(input: Record<string, unknown>): Promise<{ id: string; identifier?: string; url?: string }>
  createComment?(issueId: string, body: string): Promise<unknown>
  updateIssueState?(issueId: string, state: string): Promise<unknown>
}

export interface AsanaClientContract {
  createTask(input: Record<string, unknown>): Promise<{ gid: string; permalink_url?: string }>
  addComment?(taskGid: string, text: string): Promise<unknown>
  completeTask?(taskGid: string): Promise<unknown>
}

export interface WebhookClientContract {
  post(input: { url: string; payload: Record<string, unknown>; headers?: Record<string, string> }): Promise<{ id?: string; status?: number; url?: string; body?: unknown }>
}

export interface AteneaClientContract {
  createImpediment?(input: Record<string, unknown>): Promise<{ id: string; url?: string }>
  createFollowUp?(input: Record<string, unknown>): Promise<{ id: string; url?: string }>
  createApprovalRequest?(input: Record<string, unknown>): Promise<{ id: string; url?: string }>
}

export interface JiraConnectorConfig {
  projectKey: string
  issueType?: string
  defaultLabels?: string[]
}

export interface LinearConnectorConfig {
  teamId: string
  defaultLabelIds?: string[]
  defaultStateId?: string
}

export interface AsanaConnectorConfig {
  projectGid?: string
  workspaceGid?: string
  defaultAssigneeGid?: string
}

export interface WebhookConnectorConfig {
  url: string
  headers?: Record<string, string>
}

export interface AteneaConnectorConfig {
  defaultProjectCode?: string
  defaultRecordType?: 'impediment' | 'follow_up' | 'approval_request'
}
