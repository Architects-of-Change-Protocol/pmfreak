import type { DashboardViewModel } from './types'

/**
 * Honest dashboard labeling (M-01, extended by the Zero State UX refactor).
 *
 * The dashboard view model is hydrated from real portfolio source data
 * ('ready'/'partial') or carries no data at all ('empty'/'idle'/'loading'/
 * 'error' — data is null, never a fabricated DTO). The UI must never present
 * numbers under "Live" / "Workspace-Derived" / "Real Time" labels unless they
 * derive from real workspace data, and must render a dedicated empty state —
 * not placeholder metrics — when no data exists yet.
 *
 * All user-visible labeling for that distinction is derived here, in one
 * pure, tested function.
 */

export type DashboardPresentation = {
  /** True only when the metrics are actually derived from workspace source data. */
  isWorkspaceDerived: boolean
  /** Value for the "Operational State" metric chip. Never "Live" without real data. */
  operationalStateLabel: string
  /** Heading for the portfolio snapshot section. Never claims workspace derivation without real data. */
  snapshotHeading: string
  /** Explanatory notice for degraded (partial/loading/error) presentations; null when data is real or simply absent. */
  fallbackNotice: string | null
}

export function deriveDashboardPresentation(viewModel: Pick<DashboardViewModel, 'status'>): DashboardPresentation {
  switch (viewModel.status) {
    case 'ready':
      return {
        isWorkspaceDerived: true,
        operationalStateLabel: 'Live',
        snapshotHeading: 'Workspace-Derived Portfolio Snapshot',
        fallbackNotice: null,
      }
    case 'partial':
      return {
        isWorkspaceDerived: true,
        operationalStateLabel: 'Partial data',
        snapshotHeading: 'Workspace-Derived Portfolio Snapshot (partial)',
        fallbackNotice: 'Some portfolio sources are unavailable; the metrics below reflect only the connected sources.',
      }
    case 'loading':
      return {
        isWorkspaceDerived: false,
        operationalStateLabel: 'Loading',
        snapshotHeading: 'Portfolio Snapshot',
        fallbackNotice: 'Loading portfolio data…',
      }
    case 'error':
      return {
        isWorkspaceDerived: false,
        operationalStateLabel: 'Unavailable',
        snapshotHeading: 'Portfolio Snapshot — data unavailable',
        fallbackNotice: 'Unable to load portfolio data. Retry, or contact support if the problem persists.',
      }
    case 'empty':
    case 'idle':
    default:
      // No data yet is a valid state, not a failure: the page renders a clean
      // empty state, so there are no placeholder numbers to disclaim.
      return {
        isWorkspaceDerived: false,
        operationalStateLabel: 'Awaiting data',
        snapshotHeading: 'Portfolio Snapshot',
        fallbackNotice: null,
      }
  }
}
