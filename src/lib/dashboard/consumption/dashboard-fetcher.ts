import type { DashboardFetchOptions, DashboardConsumptionError } from './types'

export async function fetchPortfolioDashboard(options: DashboardFetchOptions = {}): Promise<Record<string, unknown>> {
  const { baseUrl, signal } = options
  const path = '/api/dashboard/portfolio'
  const url = baseUrl ? `${baseUrl}${path}` : path

  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    })
  } catch (err) {
    const error: DashboardConsumptionError = {
      code: 'dashboard_api_network_error',
      message: err instanceof Error ? err.message : 'Network error fetching dashboard',
      recoverable: true,
    }
    throw error
  }

  if (!response.ok) {
    const error: DashboardConsumptionError = {
      code: 'dashboard_api_http_error',
      message: `Dashboard API responded with ${response.status}`,
      recoverable: response.status >= 500,
    }
    throw error
  }

  try {
    return await response.json()
  } catch {
    const error: DashboardConsumptionError = {
      code: 'dashboard_api_parse_error',
      message: 'Failed to parse dashboard API response',
      recoverable: false,
    }
    throw error
  }
}
