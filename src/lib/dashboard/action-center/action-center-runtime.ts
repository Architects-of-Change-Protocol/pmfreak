import { generateDashboardActions } from './action-generator'
import { prioritizeDashboardActions } from './action-priority-engine'
import type { DashboardActionCenterInput, DashboardActionCenterReport } from './types'

export function runDashboardActionCenter(input: DashboardActionCenterInput): DashboardActionCenterReport {
  const actions = prioritizeDashboardActions(generateDashboardActions(input))
  if (!actions.length) return {
    totalActions: 0, criticalActions: 0, escalationRequiredCount: 0, actionsByExecutionLane: {}, actionsByOwnerLane: {}, actions: [], executiveSummary: 'No operational actions yet. Operational recommendations will appear automatically as projects begin generating real execution data.',
  }
  const actionsByExecutionLane: Record<string, number> = {}
  const actionsByOwnerLane: Record<string, number> = {}
  let criticalActions = 0
  let escalationRequiredCount = 0
  for (const a of actions) {
    if (a.priority === 'critical') criticalActions++
    if (a.escalationRoute.required) escalationRequiredCount++
    actionsByExecutionLane[a.executionLane] = (actionsByExecutionLane[a.executionLane] ?? 0) + 1
    actionsByOwnerLane[a.ownerLane] = (actionsByOwnerLane[a.ownerLane] ?? 0) + 1
  }
  const recommendedNextAction = actions[0]
  return { totalActions: actions.length, criticalActions, escalationRequiredCount, actionsByExecutionLane, actionsByOwnerLane, recommendedNextAction, actions, executiveSummary: `PMFreak generated ${actions.length} dashboard action(s), including ${criticalActions} critical and ${escalationRequiredCount} requiring escalation. Recommended next action: ${recommendedNextAction.title}.` }
}
