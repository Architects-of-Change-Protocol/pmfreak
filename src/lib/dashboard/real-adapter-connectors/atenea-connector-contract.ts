import type { DashboardLiveConnector } from '../live-adapter-connectors/index'
import type { DashboardProjectedTaskPayload } from '../task-adapters/index'
import type { DashboardTaskLifecycleRecord } from '../task-lifecycle/index'
import { normalizeConnectorError } from './connector-error-normalizer'
import type { AteneaClientContract, AteneaConnectorConfig } from './types'

function inferRecordType(payload: DashboardProjectedTaskPayload, config: AteneaConnectorConfig) {
  if (config.defaultRecordType) return config.defaultRecordType
  const lane = String(payload.metadata?.executionLane ?? '').toLowerCase()
  if (lane === 'financial_governance' || lane === 'dependency_management') return 'impediment'
  if (lane === 'client_coordination') return 'follow_up'
  if (lane === 'executive_decision') return 'approval_request'
  return 'follow_up'
}

export function buildAteneaPayload(input: { payload: DashboardProjectedTaskPayload; lifecycle: DashboardTaskLifecycleRecord; config: AteneaConnectorConfig }): Record<string, unknown> {
  const recordType = inferRecordType(input.payload, input.config)
  const projectCode = input.config.defaultProjectCode
    ?? input.payload.metadata?.projectCode
    ?? input.lifecycle.envelope?.payload?.metadata?.projectCode
  return {
    recordType,
    projectCode,
    title: input.payload.title,
    description: input.payload.description,
    priority: input.payload.priority,
    evidence: input.payload.metadata?.evidence,
    ownerLane: input.payload.metadata?.ownerLane,
    executionLane: input.payload.metadata?.executionLane,
    source: {
      lifecycleId: input.lifecycle.id,
      envelopeId: input.lifecycle.envelopeId,
      actionId: input.lifecycle.actionId,
      metadata: input.payload.metadata,
    },
  }
}

export function createAteneaDashboardConnector(input: { client?: AteneaClientContract; config: AteneaConnectorConfig }): DashboardLiveConnector {
  return {
    adapter: 'atenea',
    async execute({ payload, lifecycle, mode }) {
      if (mode === 'dry_run') return { status: 'simulated', externalTaskId: `simulated:atenea:${lifecycle.id}`, message: 'Atenea execution simulated.' }
      if (!input.client) return { status: 'failed', message: 'Atenea client is not configured.', retryable: false }
      const ateneaPayload = buildAteneaPayload({ payload, lifecycle, config: input.config })
      const recordType = ateneaPayload.recordType
      try {
        if (recordType === 'impediment' && input.client.createImpediment) {
          const created = await input.client.createImpediment(ateneaPayload)
          return { status: 'created', externalTaskId: created.id, message: 'Atenea record created.', metadata: { provider: 'atenea', recordType, id: created.id, url: created.url } }
        }
        if (recordType === 'follow_up' && input.client.createFollowUp) {
          const created = await input.client.createFollowUp(ateneaPayload)
          return { status: 'created', externalTaskId: created.id, message: 'Atenea record created.', metadata: { provider: 'atenea', recordType, id: created.id, url: created.url } }
        }
        if (recordType === 'approval_request' && input.client.createApprovalRequest) {
          const created = await input.client.createApprovalRequest(ateneaPayload)
          return { status: 'created', externalTaskId: created.id, message: 'Atenea record created.', metadata: { provider: 'atenea', recordType, id: created.id, url: created.url } }
        }
        return { status: 'failed', message: `Atenea client method missing for record type: ${recordType}.`, retryable: false }
      } catch (error) {
        const normalized = normalizeConnectorError(error)
        return { status: 'failed', message: normalized.message, retryable: normalized.retryable, metadata: normalized.metadata }
      }
    },
  }
}
