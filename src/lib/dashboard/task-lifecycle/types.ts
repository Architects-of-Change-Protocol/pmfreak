import type { DashboardManualPushEnvelope, DashboardManualPushReport } from '../manual-task-push'
import type {
  DashboardApprovalDecision,
  DashboardApprovalRequest,
  DashboardApprovalWorkflowReport,
} from '../approval-workflow'

export type DashboardTaskLifecycleStatus =
  | 'created'
  | 'approval_pending'
  | 'approval_not_required'
  | 'approved'
  | 'rejected'
  | 'changes_requested'
  | 'expired'
  | 'ready_for_execution'
  | 'execution_blocked'
  | 'execution_simulated'
  | 'execution_failed'
  | 'execution_completed'
  | 'cancelled'

export type DashboardTaskLifecycleEventType =
  | 'envelope_created'
  | 'approval_requested'
  | 'approval_not_required'
  | 'approval_approved'
  | 'approval_rejected'
  | 'approval_changes_requested'
  | 'approval_expired'
  | 'execution_ready'
  | 'execution_blocked'
  | 'execution_simulated'
  | 'execution_failed'
  | 'execution_completed'
  | 'retry_scheduled'
  | 'cancelled'
  | 'reconciled'

export interface DashboardTaskLifecycleRecord {
  id: string
  envelopeId: string
  actionId: string
  adapter: string
  status: DashboardTaskLifecycleStatus
  envelope: DashboardManualPushEnvelope
  approvalRequest?: DashboardApprovalRequest
  approvalDecisions: DashboardApprovalDecision[]
  externalTaskId?: string
  retryOfLifecycleId?: string
  retryCount: number
  createdAt: string
  updatedAt: string
}

export interface DashboardTaskLifecycleEvent {
  id: string
  lifecycleId: string
  eventType: DashboardTaskLifecycleEventType
  occurredAt: string
  actor?: string
  message: string
  metadata: Record<string, unknown>
}

export interface DashboardTaskLifecycleTransition {
  lifecycleId: string
  fromStatus: DashboardTaskLifecycleStatus
  toStatus: DashboardTaskLifecycleStatus
  eventType: DashboardTaskLifecycleEventType
  reason: string
  actor?: string
}

export interface DashboardTaskLifecycleStore {
  saveLifecycle(record: DashboardTaskLifecycleRecord): Promise<void>
  getLifecycle(id: string): Promise<DashboardTaskLifecycleRecord | null>
  getLifecycleByEnvelopeId(envelopeId: string): Promise<DashboardTaskLifecycleRecord | null>
  listLifecycles(): Promise<DashboardTaskLifecycleRecord[]>
  saveEvent(event: DashboardTaskLifecycleEvent): Promise<void>
  listEvents(lifecycleId?: string): Promise<DashboardTaskLifecycleEvent[]>
}

export interface DashboardTaskLifecycleRuntimeInput {
  manualPushReport: DashboardManualPushReport
  approvalWorkflowReport?: DashboardApprovalWorkflowReport
  store: DashboardTaskLifecycleStore
  actor?: string
  now?: string
}

export interface DashboardTaskLifecycleReport {
  generatedAt: string
  totalLifecycles: number
  readyForExecution: number
  blocked: number
  approved: number
  rejected: number
  simulated: number
  failed: number
  completed: number
  eventsCreated: number
  lifecycles: DashboardTaskLifecycleRecord[]
  events: DashboardTaskLifecycleEvent[]
  executiveSummary: string
}
