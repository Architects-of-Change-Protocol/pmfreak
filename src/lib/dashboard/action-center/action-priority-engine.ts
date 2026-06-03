import { assignDashboardActionOwnerLane } from './owner-lane-engine'
import { assignDashboardActionExecutionLane } from './execution-lane-engine'
import { assignDashboardActionSLA } from './sla-engine'
import { buildDashboardActionEscalationRoute } from './escalation-routing-engine'
import type { DashboardAction, DashboardActionPriority } from './types'

const rank: Record<DashboardActionPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 }

export function assignDashboardActionPriority(signal: Record<string, unknown> = {}): DashboardActionPriority {
  const s = String(signal.severity ?? signal.sourceSeverity ?? '').toLowerCase()
  const u = String(signal.urgency ?? signal.sourceUrgency ?? '').toLowerCase()
  const rp = String(signal.refreshPriority ?? '').toLowerCase()
  const rec = String(signal.recommendation ?? '').toLowerCase()
  const hydrationRisk = String(signal.hydrationRisk ?? '').toLowerCase()
  const title = `${signal.title ?? ''} ${signal.rationale ?? ''}`.toLowerCase()
  const isWarningAction = signal.type === 'acknowledge_warning'

  if (s === 'critical' || u === 'critical' || rp === 'critical' || hydrationRisk === 'critical' || signal.hasCriticalAttention === true || ((title.includes('financial') || title.includes('budget') || title.includes('invoice') || title.includes('payment') || title.includes('po')) && (s === 'high' || title.includes('blocked')))) return 'critical'
  if (s === 'high' || u === 'high' || rp === 'high' || rec === 'escalate' || rec === 'reject' || hydrationRisk === 'high') return 'high'
  if (s === 'warning' || s === 'moderate' || u === 'medium' || rec === 'approve_with_conditions' || rp === 'medium' || isWarningAction) return 'medium'
  if (s === 'info' || s === 'low' || String(signal.warningKind ?? '').toLowerCase() === 'informational' || String(signal.mode ?? '').toLowerCase() === 'preventive') return 'low'
  return 'medium'
}

function key(a: DashboardAction) { return `${a.type}::${a.source}::${a.sourceId ?? ''}::${a.title}` }

export function prioritizeDashboardActions(actions: DashboardAction[]): DashboardAction[] {
  const dedup = new Map<string, DashboardAction>()
  for (const action of actions) {
    const priority = assignDashboardActionPriority({ ...action.signal, type: action.type, title: action.title, rationale: action.rationale })
    const enriched = { ...action, priority }
    const withOwner = { ...enriched, ownerLane: assignDashboardActionOwnerLane(enriched) }
    const withExec = { ...withOwner, executionLane: assignDashboardActionExecutionLane(withOwner) }
    const withSla = { ...withExec, sla: assignDashboardActionSLA(withExec) }
    const finalized = { ...withSla, escalationRoute: buildDashboardActionEscalationRoute(withSla) }
    dedup.set(key(finalized), finalized)
  }
  return [...dedup.values()].sort((a,b)=>rank[a.priority]-rank[b.priority] || Number(b.escalationRoute.required)-Number(a.escalationRoute.required) || a.executionLane.localeCompare(b.executionLane) || a.title.localeCompare(b.title))
}
