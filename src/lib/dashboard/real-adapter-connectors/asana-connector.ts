import type { DashboardLiveConnector } from '../live-adapter-connectors/index'
import type { DashboardProjectedTaskPayload } from '../task-adapters/index'
import { normalizeConnectorError } from './connector-error-normalizer'
import type { AsanaClientContract, AsanaConnectorConfig } from './types'

export function buildAsanaTaskPayload(input: { payload: DashboardProjectedTaskPayload; config: AsanaConnectorConfig }): Record<string, unknown> {
  return {
    name: input.payload.title,
    notes: input.payload.description,
    ...(input.config.projectGid ? { projects: [input.config.projectGid] } : {}),
    ...(input.config.workspaceGid ? { workspace: input.config.workspaceGid } : {}),
    ...(input.config.defaultAssigneeGid ? { assignee: input.config.defaultAssigneeGid } : {}),
  }
}

export function createAsanaDashboardConnector(input: { client: AsanaClientContract; config: AsanaConnectorConfig }): DashboardLiveConnector {
  return {
    adapter: 'asana',
    async execute({ payload, lifecycle, mode }) {
      if (mode === 'dry_run') return { status: 'simulated', externalTaskId: `simulated:asana:${lifecycle.id}`, message: 'Asana execution simulated.' }
      try {
        const task = await input.client.createTask(buildAsanaTaskPayload({ payload, config: input.config }))
        return { status: 'created', externalTaskId: task.gid, message: 'Asana task created.', metadata: { provider: 'asana', taskGid: task.gid, url: task.permalink_url } }
      } catch (error) {
        const normalized = normalizeConnectorError(error)
        return { status: 'failed', message: normalized.message, retryable: normalized.retryable, metadata: normalized.metadata }
      }
    },
  }
}
