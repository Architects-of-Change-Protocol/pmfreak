import type { DashboardSeverity, RiskTableRowDTO } from './types'

const MAX_RISK_ROWS = 10

function mapRiskLevelToSeverity(riskLevel: string): DashboardSeverity {
  if (riskLevel === 'critical') return 'critical'
  if (riskLevel === 'high' || riskLevel === 'moderate') return 'warning'
  return 'info'
}

export function adaptRiskTable(executiveDashboardReport: Record<string, unknown>): RiskTableRowDTO[] {
  const topRisks: Record<string, unknown>[] = (executiveDashboardReport?.topRisks as Record<string, unknown>[] | undefined) ?? []

  return topRisks.slice(0, MAX_RISK_ROWS).map((risk: Record<string, unknown>): RiskTableRowDTO => ({
    id: risk.id as string ?? '',
    title: risk.title as string ?? '',
    severity: mapRiskLevelToSeverity(risk.riskLevel as string ?? ''),
    source: risk.source as string ?? '',
    affectedProjects: risk.affectedProjects as string[] ?? [],
    rationale: risk.rationale as string ?? '',
  }))
}
