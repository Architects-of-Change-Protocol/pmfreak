import type { DashboardLiveConnector } from '../live-adapter-connectors/index'
import type { DashboardProjectedTaskPayload } from '../task-adapters/index'
import { normalizeConnectorError } from './connector-error-normalizer'
import type { LinearClientContract, LinearConnectorConfig } from './types'

function mapPriority(priority: string): number {
  const normalized = priority?.toLowerCase?.() ?? 'medium'
  if (normalized === 'highest') return 1
  if (normalized === 'high') return 2
  if (normalized === 'low') return 4
  return 3
}

export function buildLinearIssuePayload(input: { payload: DashboardProjectedTaskPayload; config: LinearConnectorConfig }): Record<string, unknown> {
  return {
    teamId: input.config.teamId,
    title: input.payload.title,
    description: input.payload.description,
    priority: mapPriority(input.payload.priority),
    labelIds: input.config.defaultLabelIds,
    ...(input.config.defaultStateId ? { stateId: input.config.defaultStateId } : {}),
  }
}

export function createLinearDashboardConnector(input: { client: LinearClientContract; config: LinearConnectorConfig }): DashboardLiveConnector {
  return {
    adapter: 'linear',
    async execute({ payload, lifecycle, mode }) {
      if (mode === 'dry_run') return { status: 'simulated', externalTaskId: `simulated:linear:${lifecycle.id}`, message: 'Linear execution simulated.' }
      try {
        const issue = await input.client.createIssue(buildLinearIssuePayload({ payload, config: input.config }))
        return { status: 'created', externalTaskId: issue.identifier || issue.id, message: 'Linear issue created.', metadata: { provider: 'linear', issueId: issue.id, identifier: issue.identifier, url: issue.url } }
      } catch (error) {
        const normalized = normalizeConnectorError(error)
        return { status: 'failed', message: normalized.message, retryable: normalized.retryable, metadata: normalized.metadata }
      }
    },
  }
}
