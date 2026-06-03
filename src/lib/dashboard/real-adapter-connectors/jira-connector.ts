import type { DashboardLiveConnector } from '../live-adapter-connectors/index'
import type { DashboardProjectedTaskPayload } from '../task-adapters/index'
import { normalizeConnectorError } from './connector-error-normalizer'
import type { JiraClientContract, JiraConnectorConfig } from './types'

function mapPriority(priority: string): string {
  const normalized = priority?.toLowerCase?.() ?? 'medium'
  if (normalized === 'highest') return 'Highest'
  if (normalized === 'high') return 'High'
  if (normalized === 'low') return 'Low'
  return 'Medium'
}

export function buildJiraIssuePayload(input: { payload: DashboardProjectedTaskPayload; config: JiraConnectorConfig }): Record<string, unknown> {
  const labels = [...(input.config.defaultLabels ?? []), ...(input.payload.labels ?? [])]
  let description = input.payload.description
  if (input.payload.metadata && Object.keys(input.payload.metadata).length > 0) {
    description = `${description}\n\nMetadata:\n${JSON.stringify(input.payload.metadata, null, 2)}`
  }
  return {
    fields: {
      project: { key: input.config.projectKey },
      issuetype: { name: input.config.issueType ?? 'Task' },
      summary: input.payload.title,
      description,
      labels,
      priority: { name: mapPriority(input.payload.priority) },
    },
  }
}

export function createJiraDashboardConnector(input: { client: JiraClientContract; config: JiraConnectorConfig }): DashboardLiveConnector {
  return {
    adapter: 'jira',
    async execute({ payload, lifecycle, mode }) {
      if (mode === 'dry_run') {
        return { status: 'simulated', externalTaskId: `simulated:jira:${lifecycle.id}`, message: 'Jira execution simulated.' }
      }
      try {
        const issue = await input.client.createIssue(buildJiraIssuePayload({ payload, config: input.config }))
        return {
          status: 'created',
          externalTaskId: issue.key || issue.id,
          message: 'Jira issue created.',
          metadata: { provider: 'jira', issueId: issue.id, issueKey: issue.key, url: issue.url },
        }
      } catch (error) {
        const normalized = normalizeConnectorError(error)
        return { status: 'failed', message: normalized.message, retryable: normalized.retryable, metadata: normalized.metadata }
      }
    },
  }
}
