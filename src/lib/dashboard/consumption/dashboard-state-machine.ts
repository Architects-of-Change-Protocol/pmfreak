import type {
  DashboardConsumptionInput,
  DashboardConsumptionStatus,
  DashboardViewModel,
} from './types'

export function deriveDashboardConsumptionStatus(
  input: DashboardConsumptionInput,
): DashboardConsumptionStatus {
  if (input.loading) return 'loading'
  if (input.fetchError) return 'error'
  if (!input.apiResponse) return 'idle'

  switch ((input.apiResponse as { status?: string } | null | undefined)?.status) {
    case 'ok':
      return 'ready'
    case 'partial':
      return 'partial'
    case 'empty':
      return 'empty'
    case 'error':
      return 'error'
    default:
      return 'error'
  }
}

export function isDashboardActionRequired(viewModel: DashboardViewModel): boolean {
  if (
    viewModel.status === 'partial' ||
    viewModel.status === 'empty' ||
    viewModel.status === 'error'
  ) {
    return true
  }
  if (viewModel.hasCriticalAttention) return true
  if (viewModel.criticalRisksCount > 0) return true
  if (viewModel.alertsCount > 0 && viewModel.status !== 'ready') return true
  return false
}
