import type { DashboardLiveConnectorRegistry } from '../live-adapter-connectors/index'
import { createAsanaDashboardConnector } from './asana-connector'
import { createAteneaDashboardConnector } from './atenea-connector-contract'
import { createJiraDashboardConnector } from './jira-connector'
import { createLinearDashboardConnector } from './linear-connector'
import type { AsanaClientContract, AsanaConnectorConfig, AteneaClientContract, AteneaConnectorConfig, DashboardConnectorClientHealth, JiraClientContract, JiraConnectorConfig, LinearClientContract, LinearConnectorConfig, WebhookClientContract, WebhookConnectorConfig } from './types'
import { createWebhookDashboardConnector } from './webhook-connector'

export interface RealDashboardConnectorRegistryInput {
  jira?: { client: JiraClientContract; config: JiraConnectorConfig }
  linear?: { client: LinearClientContract; config: LinearConnectorConfig }
  asana?: { client: AsanaClientContract; config: AsanaConnectorConfig }
  webhook?: { client: WebhookClientContract; config: WebhookConnectorConfig }
  atenea?: { client?: AteneaClientContract; config: AteneaConnectorConfig }
}

export function createRealDashboardConnectorRegistry(input: RealDashboardConnectorRegistryInput): DashboardLiveConnectorRegistry {
  const registry: DashboardLiveConnectorRegistry = {}
  if (input.jira?.client && input.jira?.config) registry.jira = createJiraDashboardConnector(input.jira)
  if (input.linear?.client && input.linear?.config) registry.linear = createLinearDashboardConnector(input.linear)
  if (input.asana?.client && input.asana?.config) registry.asana = createAsanaDashboardConnector(input.asana)
  if (input.webhook?.client && input.webhook?.config) registry.email_queue = createWebhookDashboardConnector(input.webhook)
  if (input.atenea?.config) registry.atenea = createAteneaDashboardConnector(input.atenea)
  return registry
}

function health(provider: string): DashboardConnectorClientHealth {
  return { provider, available: false, canCreateTask: false, canComment: false, canTransition: false, warnings: [], errors: [] }
}

export function getRealConnectorClientHealth(input: RealDashboardConnectorRegistryInput): DashboardConnectorClientHealth[] {
  const report: DashboardConnectorClientHealth[] = []
  if (input.jira) {
    const h = health('jira')
    h.available = Boolean(input.jira.client)
    h.canCreateTask = typeof (input.jira.client as unknown as Record<string, unknown>).createIssue === 'function'
    h.canComment = typeof (input.jira.client as unknown as Record<string, unknown>).addComment === 'function'
    h.canTransition = typeof (input.jira.client as unknown as Record<string, unknown>).transitionIssue === 'function'
    if (!h.canCreateTask) h.errors.push('Missing required createIssue method.')
    if (!h.canComment) h.warnings.push('Optional addComment method is unavailable.')
    if (!h.canTransition) h.warnings.push('Optional transitionIssue method is unavailable.')
    report.push(h)
  }
  if (input.linear) {
    const h = health('linear')
    h.available = Boolean(input.linear.client)
    h.canCreateTask = typeof (input.linear.client as unknown as Record<string, unknown>).createIssue === 'function'
    h.canComment = typeof (input.linear.client as unknown as Record<string, unknown>).createComment === 'function'
    h.canTransition = typeof (input.linear.client as unknown as Record<string, unknown>).updateIssueState === 'function'
    if (!h.canCreateTask) h.errors.push('Missing required createIssue method.')
    report.push(h)
  }
  if (input.asana) {
    const h = health('asana')
    h.available = Boolean(input.asana.client)
    h.canCreateTask = typeof (input.asana.client as unknown as Record<string, unknown>).createTask === 'function'
    h.canComment = typeof (input.asana.client as unknown as Record<string, unknown>).addComment === 'function'
    h.canTransition = typeof (input.asana.client as unknown as Record<string, unknown>).completeTask === 'function'
    if (!h.canCreateTask) h.errors.push('Missing required createTask method.')
    report.push(h)
  }
  if (input.webhook) {
    const h = health('webhook')
    h.available = Boolean(input.webhook.client)
    h.canCreateTask = typeof (input.webhook.client as unknown as Record<string, unknown>).post === 'function'
    if (!h.canCreateTask) h.errors.push('Missing required post method.')
    report.push(h)
  }
  if (input.atenea) {
    const h = health('atenea')
    h.available = Boolean(input.atenea.client)
    h.canCreateTask = Boolean(input.atenea.client?.createImpediment || input.atenea.client?.createFollowUp || input.atenea.client?.createApprovalRequest)
    h.canComment = false
    h.canTransition = false
    if (!h.canCreateTask) h.warnings.push('No Atenea create method configured yet.')
    report.push(h)
  }
  return report
}
