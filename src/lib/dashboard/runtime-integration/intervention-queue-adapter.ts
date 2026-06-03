import type { DashboardSeverity, InterventionQueueItemDTO } from './types'

const MAX_INTERVENTIONS = 15

const URGENCY_SORT_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

function mapUrgencyToSeverity(urgency: string): DashboardSeverity {
  if (urgency === 'critical') return 'critical'
  if (urgency === 'high' || urgency === 'medium') return 'warning'
  return 'info'
}

export function adaptInterventionQueue(interventionReport: Record<string, unknown> | null | undefined): InterventionQueueItemDTO[] {
  if (!interventionReport) return []

  const interventions: Record<string, unknown>[] = (interventionReport?.interventions as Record<string, unknown>[] | undefined) ?? []

  return interventions
    .slice()
    .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const aOrder = URGENCY_SORT_ORDER[(a.urgency as string | undefined) ?? 'low'] ?? 3
      const bOrder = URGENCY_SORT_ORDER[(b.urgency as string | undefined) ?? 'low'] ?? 3
      return aOrder - bOrder
    })
    .slice(0, MAX_INTERVENTIONS)
    .map((intervention: Record<string, unknown>): InterventionQueueItemDTO => ({
      id: (intervention.id as string | undefined) ?? '',
      title: (intervention.title as string | undefined) ?? '',
      urgency: mapUrgencyToSeverity((intervention.urgency as string | undefined) ?? 'low'),
      ownerLane: (intervention.ownerLane as string | undefined) ?? '',
      cadence: (intervention.recommendedCadence as string | undefined) ?? '',
      affectedProjects: (intervention.affectedProjects as string[] | undefined) ?? [],
    }))
}
