import type { DashboardViewModel } from './types'

/**
 * Pilot Gate Sprint 01 — Task 5 (M-01, honest dashboard labeling).
 *
 * The dashboard view model can be hydrated from real portfolio source data
 * ('ready'/'partial') or from the fallback DTO ('empty', and 'error'/
 * 'loading'/'idle'). The UI must never present fallback numbers under
 * "Live" / "Workspace-Derived" / "Real Time" labels — that induces users
 * and design partners to believe the metrics derive from their real
 * workspace data when they do not.
 *
 * All user-visible labeling for that distinction is derived here, in one
 * pure, tested function.
 */

export type DashboardPresentation = {
  /** True only when the metrics are actually derived from workspace source data. */
  isWorkspaceDerived: boolean
  /** Value for the "Operational State" metric chip. Never "Live" on fallback data. */
  operationalStateLabel: string
  /** Heading for the portfolio snapshot section. Never claims workspace derivation on fallback data. */
  snapshotHeading: string
  /** Explanatory notice rendered when showing placeholder/fallback numbers; null when data is real. */
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
        fallbackNotice: 'Portfolio data could not be loaded. The numbers below are placeholders, not workspace data.',
      }
    case 'empty':
    case 'idle':
    default:
      return {
        isWorkspaceDerived: false,
        operationalStateLabel: 'Awaiting data',
        snapshotHeading: 'Portfolio Snapshot — not yet connected to workspace data',
        fallbackNotice: 'Portfolio source data is not connected yet. The numbers below are placeholders, not derived from your workspace.',
      }
  }
}
