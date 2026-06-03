import type { DashboardConsumptionInput, DashboardFetchOptions, DashboardViewModel } from './types'
import { deriveDashboardConsumptionStatus } from './dashboard-state-machine'
import { adaptDashboardViewModel } from './dashboard-view-model-adapter'
import { fetchPortfolioDashboard } from './dashboard-fetcher'

export function runDashboardConsumptionRuntime(input: DashboardConsumptionInput): DashboardViewModel {
  const derivedStatus = deriveDashboardConsumptionStatus(input)
  const viewModel = adaptDashboardViewModel(input)
  return { ...viewModel, status: derivedStatus }
}

export async function loadPortfolioDashboardViewModel(
  options: DashboardFetchOptions = {},
): Promise<DashboardViewModel> {
  try {
    const apiResponse = await fetchPortfolioDashboard(options)
    return runDashboardConsumptionRuntime({ apiResponse })
  } catch (fetchError: unknown) {
    const normalizedError =
      fetchError && typeof (fetchError as Record<string, unknown>).code === 'string'
        ? (fetchError as Record<string, unknown>)
        : {
            code: 'dashboard_api_network_error',
            message: fetchError instanceof Error ? fetchError.message : 'Unknown fetch error',
            recoverable: true,
          }
    return runDashboardConsumptionRuntime({ fetchError: normalizedError as { code: string; message: string; recoverable: boolean } })
  }
}
