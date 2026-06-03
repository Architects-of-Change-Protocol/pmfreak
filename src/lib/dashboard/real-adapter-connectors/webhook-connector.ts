import type { DashboardLiveConnector } from '../live-adapter-connectors/index'
import type { DashboardProjectedTaskPayload } from '../task-adapters/index'
import type { DashboardTaskLifecycleRecord } from '../task-lifecycle/index'
import { normalizeConnectorError } from './connector-error-normalizer'
import type { WebhookClientContract, WebhookConnectorConfig } from './types'

export function buildWebhookPayload(input: { payload: DashboardProjectedTaskPayload; lifecycle: DashboardTaskLifecycleRecord }): Record<string, unknown> {
  return {
    title: input.payload.title,
    description: input.payload.description,
    priority: input.payload.priority,
    adapter: input.payload.adapter,
    labels: input.payload.labels ?? [],
    metadata: input.payload.metadata,
    lifecycleId: input.lifecycle.id,
    envelopeId: input.lifecycle.envelopeId,
    actionId: input.lifecycle.actionId,
  }
}

export function createWebhookDashboardConnector(input: { client: WebhookClientContract; config: WebhookConnectorConfig }): DashboardLiveConnector {
  return {
    adapter: 'email_queue',
    async execute({ payload, lifecycle, mode }) {
      if (mode === 'dry_run') return { status: 'simulated', externalTaskId: `simulated:webhook:${lifecycle.id}`, message: 'Webhook execution simulated.' }
      try {
        const bodyPayload = buildWebhookPayload({ payload, lifecycle })
        const response = await input.client.post({ url: input.config.url, payload: bodyPayload, headers: input.config.headers })
        return {
          status: 'created',
          externalTaskId: response.id ?? `webhook:${response.status ?? 'unknown'}:${lifecycle.id}`,
          message: 'Webhook task payload posted.',
          metadata: { provider: 'webhook', status: response.status, url: response.url ?? input.config.url, body: response.body },
        }
      } catch (error) {
        const normalized = normalizeConnectorError(error)
        return { status: 'failed', message: normalized.message, retryable: normalized.retryable, metadata: normalized.metadata }
      }
    },
  }
}
