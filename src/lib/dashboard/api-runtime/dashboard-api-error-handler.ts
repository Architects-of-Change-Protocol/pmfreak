import type { DashboardApiError, DashboardApiResponse } from './types'

export function buildDashboardApiErrorResponse(errors: DashboardApiError[]): DashboardApiResponse {
  return {
    status: 'error',
    data: null,
    warnings: errors.map((e) => e.message),
  }
}
