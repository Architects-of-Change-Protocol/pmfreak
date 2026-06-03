import type {
  DashboardTaskLifecycleEvent,
  DashboardTaskLifecycleRecord,
  DashboardTaskLifecycleStatus,
  DashboardTaskLifecycleStore,
} from '../task-lifecycle'
import type { DashboardProjectedTaskPayload, DashboardTaskAdapterKind } from '../task-adapters'

export type DashboardLiveConnectorExecutionMode = 'dry_run' | 'execute'
export type DashboardLiveConnectorStatus = 'available' | 'unavailable' | 'invalid'
export type DashboardLiveExecutionStatus = 'executed' | 'simulated' | 'skipped' | 'failed' | 'retry_scheduled'

export interface DashboardLiveConnector {
  adapter: DashboardTaskAdapterKind
  execute(input: {
    payload: DashboardProjectedTaskPayload
    lifecycle: DashboardTaskLifecycleRecord
    mode: DashboardLiveConnectorExecutionMode
    now: string
  }): Promise<{
    externalTaskId?: string
    status: 'created' | 'simulated' | 'failed'
    message: string
    retryable?: boolean
    metadata?: Record<string, unknown>
  }>
}

export type DashboardLiveConnectorRegistry = Partial<Record<DashboardTaskAdapterKind, DashboardLiveConnector>>

export interface DashboardLiveExecutionRequest {
  store: DashboardTaskLifecycleStore
  connectors: DashboardLiveConnectorRegistry
  mode: DashboardLiveConnectorExecutionMode
  requestedLifecycleIds?: string[]
  requestedAdapters?: DashboardTaskAdapterKind[]
  actor?: string
  now?: string
  maxExecutions?: number
}

export interface DashboardLiveExecutionResult {
  lifecycleId: string
  envelopeId: string
  adapter: DashboardTaskAdapterKind | string
  status: DashboardLiveExecutionStatus
  externalTaskId?: string
  message: string
  retryable: boolean
  error?: string
}

export interface DashboardLiveExecutionReport {
  generatedAt: string
  mode: DashboardLiveConnectorExecutionMode
  attempted: number
  executed: number
  simulated: number
  skipped: number
  failed: number
  retryScheduled: number
  results: DashboardLiveExecutionResult[]
  events: DashboardTaskLifecycleEvent[]
  warnings: string[]
  executiveSummary: string
}

export interface DashboardConnectorValidationResult {
  adapter: DashboardTaskAdapterKind | string
  status: DashboardLiveConnectorStatus
  valid: boolean
  warnings: string[]
  errors: string[]
}

export type DashboardExecutionStatusMapping = Partial<Record<DashboardLiveExecutionStatus, DashboardTaskLifecycleStatus>>
