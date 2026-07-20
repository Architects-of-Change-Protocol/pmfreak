# PR9 Companion — Component Map

Status: Implemented
Parent: `08-design-system.md` §3, ADR-PMF-072

Purpose: locate the seven Enterprise Components `08-design-system.md` §3 catalogs, now implemented, plus the module-scoped Domain Presentation components built on top of them, so a future PR can find and reuse them rather than reinventing.

## The Seven Enterprise Components (Platform layer)

All under `src/platform/components/`, exported from `src/platform/components/index.ts`:

| Component | File | Props (summary) | Spec |
| --- | --- | --- | --- |
| `HealthIndicator` | `HealthIndicator.tsx` | `{ percentage: number; band: HealthBand; label?: string }` | `08-design-system.md` §3, Execution Health zone |
| `RiskBadge` | `RiskBadge.tsx` | `{ severity: Severity; label?: string }` | `08-command-center-experience.md` §1, `08-accessibility-guidelines.md` §4 |
| `ConfidenceScore` | `ConfidenceScore.tsx` | `{ confidence: number; basis: string; lowConfidenceThreshold?: number }` | `08-ai-interaction-patterns.md` §2.1 |
| `DecisionCard` | `DecisionCard.tsx` | `{ decision: DecisionCardViewModel; approvalActions?: ReactNode }` | `08-ai-interaction-patterns.md` §1 |
| `EvidenceViewer` | `EvidenceViewer.tsx` | `{ sourceDocuments, historicalData?, metrics?, agentReasoning?, confidence }` | `08-ai-interaction-patterns.md` §5 |
| `AgentStatus` | `AgentStatus.tsx` | `{ name: string; status: "active"\|"disabled"; capabilities: string[]; lastRun?: {...} }` | `08-ai-interaction-patterns.md` §4 |
| `ApprovalFlow` | `ApprovalFlow.tsx` | `{ itemLabel: string; onApprove; onReject; disabled?; disabledReason? }` | `08-ai-interaction-patterns.md` §6 |

Plus one supporting, domain-free Platform component added by this PR: `ZoneFrame` (`ZoneFrame.tsx`) — the shared Loading/Populated/Empty/Error wrapper every Command Center zone and module list screen uses (`08-command-center-experience.md` §5). It is Platform, not a governed Enterprise Component, since it carries no domain shape of its own — purely structural.

## Module-Scoped Presentation Components (not part of the governed 7)

Per `08-design-system.md` §5 rule 3 ("new enterprise components require a named gap"), these are ordinary Domain Presentation components local to their module, not additions to the governed catalog:

| Component | Module | File |
| --- | --- | --- |
| `RecommendationCard` | `recommendations` | `src/modules/recommendations/presentation/RecommendationCard.tsx` |
| `ProjectHealthCard` | `project` | `src/modules/project/presentation/ProjectHealthCard.tsx` |
| `RiskSummary` | `project` | `src/modules/project/presentation/RiskSummary.tsx` |
| `TimelineVariance` | `project` | `src/modules/project/presentation/TimelineVariance.tsx` |
| `AIInsightCard` | `project` | `src/modules/project/presentation/AIInsightCard.tsx` |
| `AgentRunTimeline` | `agents` | `src/modules/agents/presentation/AgentRunTimeline.tsx` |

`CapabilityBadge` (named in the sprint brief's Fase 8 component list) was not built as a separate component — `AgentStatus` already renders capability pills inline; a separate component would duplicate it without adding a distinct concern.

## Platform Shell Components

`src/platform/shell/`: `ApplicationShell.tsx`, `SidebarNavigation.tsx`, `WorkspaceSwitcher.tsx`, `EnterpriseSwitcher.tsx`, `UserMenu.tsx`, `NotificationCenter.tsx` — see `docs/product-architecture/09-product-implementation.md` §2 for which are intentionally minimal stubs.

## Tokens

`src/app/globals.css`'s new `--pmf-*` custom properties (severity/health-band/AI-accent colors, light and dark) — see ADR-PMF-072's governance rule ("tokens before values"): no component in this PR hardcodes a color outside this set.
