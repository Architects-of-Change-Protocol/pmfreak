# PR9 Companion — Data Flow

Status: Implemented
Parent: `07-frontend-state-and-data-architecture.md`, ADR-PMF-060, ADR-PMF-077

Purpose: trace the real path from a UI component to a database table for each of PR9's five modules, so "which layer owns this fetch" and "what does this adapt" are never guesswork for a future contributor.

## General Shape (07-frontend-state-and-data-architecture.md §8)

```
Feature (Client Component)
  -> Application Contracts hook (useX, src/modules/<module>/contracts/*.contract.ts)
    -> fetch() against a Route Handler (src/app/api/**/route.ts)
      -> requireAuthenticatedUser + requireProjectAccess/requireWorkspaceMember (src/lib/security/server-authorization.ts)
      -> existing or new service function (src/lib/**)
        -> Supabase table
```

Every arrow above is real in this PR — no layer is stubbed with fixture data.

## Per-Module Trace

### Project Health

```
ProjectHealthPanel / AttentionPanel / ExecutionHealthCard (client)
  -> useProjectHealth() [src/modules/project/contracts/project-health.contract.ts]
    -> GET /api/projects/[id]/health
      -> requireProjectAccess(projectId, "read")
      -> getProjectHealth() [src/lib/projects/project-health.ts]
        -> composeProjectHealth() [pure function]
           <- buildRaidOverview() [src/lib/raid] <- raid_items
           <- computeScheduleHealth() [src/lib/schedule/health.ts] <- execution_tasks, project_milestones, execution_task_dependencies
           <- computeProjectForecast() [src/lib/critical-path/forecast.ts] <- execution_tasks
```

### Recommendations

```
RecommendationList (client, in modules/recommendations, reused by modules/project)
  -> useRecommendations() [src/modules/recommendations/contracts/recommendations.contract.ts]
    -> GET /api/recommended-actions?projectId=...&status=... (pre-existing, unchanged)
      -> recommended_actions table

  -> decideRecommendation() [same contract file]
    -> POST /api/recommended-actions/decision (pre-existing, unchanged)
      -> decideRecommendedAction() [src/lib/recommended-actions/decision-workflow.ts]
        -> recommended_actions table (status transition)
```

### Decisions

```
DecisionList / DecisionDetail (client, in modules/decisions, reused by modules/project)
  -> useProjectDecisions() / useDecision() [src/modules/decisions/contracts/decisions.contract.ts]
    -> GET /api/projects/[id]/decisions | GET /api/decisions/[id]  (new, this PR)
      -> requireProjectAccess
      -> listProjectDecisions() / getDecision() + buildDecisionLineage() [src/lib/decision-governance/service.ts]
        -> project_decisions, project_decision_evidence_links tables

  -> createDecision() [same contract file]
    -> POST /api/projects/[id]/decisions (new, this PR)
      -> createDecision() then submitDecision() [src/lib/decision-governance/service.ts]
        -> project_decisions table (insert, then draft -> pending_review transition)
        -> createPlatformEvent() [src/lib/platform-events] -> platform_events table

  -> approveDecision() / rejectDecision() [same contract file]
    -> POST /api/decisions/[id]/approve | /reject (new, this PR)
      -> requireProjectAccess(decision.project_id, "write")
      -> approveDecision() / rejectDecision() [src/lib/decision-governance/service.ts]
        -> project_decisions table (state transition) + platform_events
```

### Evidence

```
EvidenceList (client, in modules/evidence)
  -> useProjectEvidence() [src/modules/evidence/contracts/evidence.contract.ts]
    -> GET /api/project-evidence?projectId=... (pre-existing, unchanged)
       GET /api/project-evidence-content?projectId=... (pre-existing, unchanged)
      -> project_evidence, project_evidence_content tables
```

### Agents

```
AgentRegistry / AgentRun (client, in modules/agents)
  -> useAgentRegistry() [src/modules/agents/contracts/agents.contract.ts]
    -> GET /api/agents?workspaceId=... (new, this PR)
      -> listAgentExecutionRequests() [src/lib/agents/agent-execution-registry.ts]
        -> agent_execution_requests table (grouped by agentType; capabilities from a small static map)

  -> useAgentRun() / useAgentRuns()
    -> GET /api/agent-runs/[id]?workspaceId=... | GET /api/workspaces/[id]/agent-runs (new, this PR)
      -> getAgentExecutionRequestById() / listAgentExecutionRequests()
        -> agent_execution_requests table
```

## What Is Explicitly Not a New Persistence Path

Per Fase 9's "no inventar APIs, crear adapters" instruction and ADR-PMF-077/078: no new table was created by this PR. Every Route Handler above either reuses an existing endpoint verbatim (Recommendations, Evidence) or wraps an existing service function that had no HTTP route before (Decisions, Agents, Health) — none introduces a new Supabase query pattern outside what `src/lib/decision-governance`, `src/lib/agents`, `src/lib/raid`, `src/lib/schedule`, and `src/lib/critical-path` already implement and (for Decisions/Health) had simply never been exposed to the frontend.
