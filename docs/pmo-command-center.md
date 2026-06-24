# PMO Command Center

## Overview

The PMO Command Center is a read-aggregation executive view for PMO leadership. It collects and aggregates PM Operating Dossiers across the entire workspace into a single unified view — no recalculation of capacity or performance occurs.

## Architecture

### Module: `src/lib/pmo-command-center/pmo-command-center.ts`

The main service function `getPMOCommandCenter({ workspaceId, actorId? })` returns `PMOCommandCenterResult<PMOCommandCenterView>`.

It operates as follows:
1. Calls `listProjectManagers(workspaceId)` to enumerate all PMs in the workspace.
2. Calls `getPMOperatingDossier` for each PM in parallel via `Promise.allSettled`.
3. Aggregates the resulting dossiers into the PMO Command Center view sections.
4. Queries `platform_events` for the workspace-level event timeline (last 30 events).

### API Route: `GET /api/pmo-command-center`

Standard authenticated workspace route. Returns `{ ok: true, data: PMOCommandCenterView }`.

### Page: `/pmo-command-center`

Client-side page with full executive view including:
- PMO Status banner with top risk and recommendation
- Executive Summary cards (8 metrics)
- Attention Queues with 6 tabs (critical, capacity, performance, evidence, underutilized, top performers)
- Capacity, Performance, and Evidence Confidence overviews
- Recommendation Queue table (top 50)
- PM Dossier Table
- Event Timeline

## Key Types

- `PMOCommandCenterView` — the main output type (named differently from existing `PMOCommandCenter` snapshot type to avoid collision)
- `PMOOperationalStatus` — `"healthy" | "watch" | "capacity_pressure" | "performance_pressure" | "evidence_gap" | "critical"`
- `PMOExecutiveSummary` — aggregate counts and top-level status
- `PMOCapacityOverview` — read from capacity sections of dossiers
- `PMOPerformanceOverview` — read from performance sections of dossiers
- `PMOEvidenceConfidenceOverview` — read from evidence_confidence sections
- `PMOAttentionQueues` — classified PM lists by attention category
- `PMORecommendation` — enriched recommendations from all PM dossiers

## Operational Status Precedence

`critical > performance_pressure > capacity_pressure > evidence_gap > watch > healthy`

## Constraints

- No capacity or performance recalculation
- No mutation of any records
- Handles absent sections gracefully (dossiers with `present: false`)
- Workspace-isolated queries throughout
- Missing dossiers (failed parallel loads) are silently excluded
