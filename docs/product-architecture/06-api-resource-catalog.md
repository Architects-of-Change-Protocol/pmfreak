# PR6 Companion — API Resource Catalog

Status: Documentary architecture (no implementation)
Parent: `06-canonical-api-contracts.md`

Purpose: name every resource PMFreak's API exposes, and for each, its collection endpoint, resource endpoint, search endpoint (where applicable), actions, permissions, and the Commands/Queries (from `04-command-query-event-catalog.md`) it invokes. Endpoint paths shown are illustrative and conceptual — exact route structure is PR9+ implementation detail; the resource names, hierarchy, and Command/Query bindings are the binding part of this catalog.

Conventions used throughout: `{enterpriseId}`, `{workspaceId}`, `{pmoId}`, `{portfolioId}`, `{programId}`, `{projectId}` are always server-resolved from the caller's session and the resource's parent chain (§16 of the parent document) — never accepted as arbitrary client input that overrides the resolved value. Action endpoints use the `:action` suffix convention (`POST /resource/{id}:archive`) to distinguish a Command from a resource-shaped `PATCH`.

---

## 1. Enterprise

| | |
|---|---|
| Collection | `GET /enterprises` (Enterprise-admin scope only; ordinary Workspace members never see the Enterprise collection) |
| Resource | `GET /enterprises/{enterpriseId}` |
| Search | Not applicable — Enterprise cardinality is low; no dedicated search endpoint |
| Actions | `POST /enterprises:create`, `PATCH /enterprises/{enterpriseId}` (profile fields only) |
| Permissions | Enterprise Administrator role only; no Workspace-scoped role reaches this resource |
| Commands | `CreateEnterprise`, `UpdateEnterpriseProfile` |
| Queries | `GetEnterpriseOverview`, `GetEnterpriseHealth` |

## 2. Workspace

| | |
|---|---|
| Collection | `GET /enterprises/{enterpriseId}/workspaces` |
| Resource | `GET /workspaces/{workspaceId}` |
| Search | Not applicable |
| Actions | `POST /enterprises/{enterpriseId}/workspaces:create`, `POST /workspaces/{workspaceId}:archive`, `POST /workspaces/{workspaceId}/members:assign`, `PATCH /workspaces/{workspaceId}/policy` |
| Permissions | Enterprise Administrator (create, archive); Workspace Owner/Admin (member assignment, policy) |
| Commands | `CreateWorkspace`, `ArchiveWorkspace`, `AssignWorkspaceMember`, `ChangeWorkspacePolicy` |
| Queries | `GetWorkspaceOverview` |

## 3. PMO

| | |
|---|---|
| Collection | `GET /workspaces/{workspaceId}/pmos` |
| Resource | `GET /pmos/{pmoId}` |
| Search | Not applicable |
| Actions | `POST /workspaces/{workspaceId}/pmos:create`, `PATCH /pmos/{pmoId}/governance-policy` |
| Permissions | Workspace Owner/Admin (create); PMO role holder (governance policy) |
| Commands | `CreatePMO`, `UpdatePMOGovernancePolicy` |
| Queries | `GetPMOOverview`, `GetPMOHealth` |

## 4. Portfolio

| | |
|---|---|
| Collection | `GET /pmos/{pmoId}/portfolios` |
| Resource | `GET /portfolios/{portfolioId}` |
| Search | Not applicable |
| Actions | `POST /pmos/{pmoId}/portfolios:create`, `POST /portfolios/{portfolioId}/projects/{projectId}:assign`, `POST /portfolios/{portfolioId}/projects/{projectId}:remove` |
| Permissions | PMO role holder; Project assignment additionally requires authorization on the target Project |
| Commands | `CreatePortfolio`, `AssignProjectToPortfolio`, `RemoveProjectFromPortfolio` |
| Queries | `GetPortfolioOverview`, `GetPortfolioHealth` |

## 5. Program

| | |
|---|---|
| Collection | `GET /pmos/{pmoId}/programs` |
| Resource | `GET /programs/{programId}` |
| Search | Not applicable |
| Actions | `POST /pmos/{pmoId}/programs:create`, `POST /programs/{programId}/projects/{projectId}:assign`, `POST /programs/{programId}/projects/{projectId}:remove` |
| Permissions | PMO role holder; Project assignment additionally requires authorization on the target Project |
| Commands | `CreateProgram`, `AssignProjectToProgram`, `RemoveProjectFromProgram` |
| Queries | `GetProgramOverview`, `GetProgramHealth` |

## 6. Project

| | |
|---|---|
| Collection | `GET /workspaces/{workspaceId}/projects` |
| Resource | `GET /projects/{projectId}` |
| Search | `GET /projects/search?q=...` (full-text, `06-canonical-api-contracts.md` §13) |
| Actions | `POST /workspaces/{workspaceId}/projects:create`, `PATCH /projects/{projectId}` (context fields), `POST /projects/{projectId}:archive`, `PATCH /projects/{projectId}/methodology`, `POST /projects/{projectId}/stakeholders:add` |
| Permissions | Workspace member with Project-creation capability (create); Project role holder (context, methodology, stakeholders); Workspace Owner/Admin or Project Owner (archive) |
| Commands | `CreateProject`, `UpdateProjectContext`, `ArchiveProject`, `ConfigureProjectMethodology`, `AddProjectStakeholder` |
| Queries | `GetProjectOverview`, `GetProjectCommandCenter`, `GetProjectIntelligenceFeed`, `GetProjectHealth` |

Project owns several sub-resources, always addressed through their owning Project (§9 below): Task, Milestone, Risk, Issue, Stakeholder.

## 7. Recommendation

| | |
|---|---|
| Collection | `GET /projects/{projectId}/recommendations` |
| Resource | `GET /recommendations/{recommendationId}` |
| Search | Not applicable — use `ListRecommendations` filters |
| Actions | `POST /recommendations/{id}:review`, `POST /recommendations/{id}:approve`, `POST /recommendations/{id}:reject` — creation is never a direct client action; a Recommendation is only created by `GenerateRecommendation`, itself only reachable via the Agent Run pipeline or an equivalent governed generation path, never a bare `POST /recommendations` |
| Permissions | Project role holder with review/approval capability; `approve`/`reject` require `RecommendationApprovalPolicy` to pass |
| Commands | `GenerateRecommendation` (system/pipeline-invoked, not a general client action — see `06-command-catalog.md`), `ReviewRecommendation`, `ApproveRecommendation`, `RejectRecommendation` |
| Queries | `ListRecommendations`, `GetRecommendationDetails` |

Per ADR-PMF-030's binding API implication, `approve` is a distinct endpoint from Decision's `record` action below — approving a Recommendation never itself records a Decision.

## 8. Decision

| | |
|---|---|
| Collection | `GET /projects/{projectId}/decisions` |
| Resource | `GET /decisions/{decisionId}` |
| Search | Not applicable — use `ListDecisions` filters |
| Actions | `POST /projects/{projectId}/decisions:record`, `POST /decisions/{id}:revoke` — no `PATCH` on rationale/authority fields; Decision content is never destructively edited (ADR-PMF-036) |
| Permissions | Actor holding the required Decision authority (`DecisionAuthorityPolicy`); revocation requires the same or higher authority plus explicit reason |
| Commands | `RecordDecision`, `RevokeDecision` |
| Queries | `ListDecisions`, `GetDecisionDetails` |

## 9. Action

| | |
|---|---|
| Collection | `GET /decisions/{decisionId}/actions` and `GET /projects/{projectId}/actions` |
| Resource | `GET /actions/{actionId}` |
| Search | Not applicable — use `ListActions` filters |
| Actions | `POST /decisions/{decisionId}/actions:create` |
| Permissions | Actor authorized under `ActionCreationPolicy`; an Action is never auto-created from a Decision without this explicit Command (ADR-PMF-030) |
| Commands | `CreateActionFromDecision` |
| Queries | `ListActions` |

Action status-transition and cancellation endpoints (completion, cancellation) are not yet individually named in the PR4 Command catalog beyond `CreateActionFromDecision` — this is recorded as an open gap for PR9+ (`06-command-catalog.md` §-notes), not resolved by invented Command names here.

## 10. Outcome

| | |
|---|---|
| Collection | `GET /actions/{actionId}/outcomes` and `GET /projects/{projectId}/outcomes` |
| Resource | `GET /outcomes/{outcomeId}` |
| Search | Not applicable — use `ListOutcomes` filters |
| Actions | `POST /actions/{actionId}/outcomes:record` |
| Permissions | Actor authorized to validate/record Outcomes for the owning Project; distinct from the actor who completed the Action (PR5 §18: completion and validation are distinct, separately recorded states) |
| Commands | `RecordOutcome` |
| Queries | `ListOutcomes` |

## 11. Evidence

| | |
|---|---|
| Collection | `GET /projects/{projectId}/evidence` |
| Resource | `GET /evidence/{evidenceId}` |
| Search | Not applicable at top level — Evidence surfaces primarily through `GetProjectIntelligenceFeed` and as links on Recommendation/Decision/Outcome |
| Actions | `POST /projects/{projectId}/evidence:submit` |
| Permissions | Project member with evidence-submission capability; classification-gated read access (PR5 §45) |
| Commands | `SubmitEvidence`, `NormalizeSource` (system-invoked, part of Evidence Normalization workflow, not a general client action) |
| Queries | No dedicated top-level Evidence Query is catalogued in `04-command-query-event-catalog.md`; Evidence is retrieved via its links on Recommendation/Decision/Outcome detail Queries and via `GetProjectIntelligenceFeed` — recorded here as an open gap, not resolved by inventing a Query name |

## 12. Project Memory

| | |
|---|---|
| Collection | `GET /projects/{projectId}/memory` |
| Resource | `GET /memory/{memoryRecordId}` |
| Search | Semantic retrieval only via the Agent Run pipeline's internal context assembly, never a direct client-facing vector search endpoint (§13 of the parent document) |
| Actions | `POST /projects/{projectId}/memory:propose`, `POST /memory/{id}:approve`, `POST /memory/{id}:reject` |
| Permissions | Proposal may originate from Agent pipeline or human authoring; approval/rejection require Project Memory governance capability (human-only per PR4 Human-in-the-Loop Matrix) |
| Commands | `ProposeMemoryRecord`, `ApproveMemoryRecord`, `RejectMemoryRecord` |
| Queries | `GetProjectMemory` |

## 13. Knowledge (Enterprise Knowledge)

| | |
|---|---|
| Collection | `GET /enterprises/{enterpriseId}/knowledge` |
| Resource | `GET /knowledge/{knowledgeRecordId}` |
| Search | Not applicable at top level — retrieved via `GetEnterpriseIntelligence` filters |
| Actions | `POST /enterprises/{enterpriseId}/knowledge:propose-pattern`, `POST /knowledge/{id}:ratify`, `POST /knowledge/{id}:revoke` |
| Permissions | Enterprise Intelligence governance capability; ratification requires the full six-part elevation gate (evidence, confidence, review, lineage, applicability, ratification — PR5 §19) and explicit per-Workspace consent for cross-Workspace provenance |
| Commands | `ProposeEnterprisePattern`, `RatifyEnterpriseKnowledge`, `RevokeEnterpriseKnowledge` |
| Queries | `GetEnterpriseIntelligence`, `GetKnowledgeLineage` |

## 14. Workflow

| | |
|---|---|
| Collection | `GET /workspaces/{workspaceId}/workflows?type=&status=` |
| Resource | `GET /workflows/{workflowInstanceId}` |
| Search | Not applicable |
| Actions | No standalone create/pause/resume endpoint — a Workflow instance is always created implicitly by its triggering Command (§24 of the parent document); cancellation is exposed only where the owning resource's Command catalog defines a cancellable state (e.g., Agent Run's `CancelAgentRun`) |
| Permissions | Same authorization as the triggering/owning resource — a Workflow's status is never more visible than the resource it tracks |
| Commands | None directly — Workflow state changes only as a side effect of the Commands catalogued against its owning resource (`06-command-catalog.md`) |
| Queries | A dedicated `GetWorkflowStatus`/`ListWorkflowSteps` Query, backed by `workflow_instances`/`workflow_steps` per ADR-PMF-038's API implication, is not yet individually named in the PR4 Query catalog — recorded here as a named target for PR9+, not invented as a ratified Query name |

## 15. Agent

| | |
|---|---|
| Collection | `GET /agents` (Agent Definitions, Workspace- or platform-scoped) |
| Resource | `GET /agents/{agentId}` |
| Search | Not applicable |
| Actions | Agent Definition/version/configuration management is not covered by a client-facing Command in the PR4 catalog — Agent Definitions are treated as platform/admin configuration, not an end-user-mutable resource, until a future PR establishes otherwise |
| Permissions | Read: Workspace member with Agent visibility; Write: not yet defined (open, §33 of the parent document) |
| Commands | None catalogued |
| Queries | Not individually catalogued in `04-command-query-event-catalog.md` beyond Agent Run-level Queries below — recorded as an open gap |

## 16. Agent Run

| | |
|---|---|
| Collection | `GET /workspaces/{workspaceId}/agent-runs?agent_id=&status=` and `GET /agents/{agentId}/runs` |
| Resource | `GET /agent-runs/{agentRunId}` |
| Search | Not applicable — use `ListAgentRuns` filters |
| Actions | `POST /agent-runs:request`, `POST /agent-runs/{id}:cancel` |
| Permissions | Requesting actor's own scope (never broader, PR4 §34); Agent identity itself may only call `RequestAgentRun`/`CancelAgentRun` for its own run, per ADR-PMF-027 |
| Commands | `RequestAgentRun`, `CancelAgentRun` |
| Queries | `GetAgentRun`, `ListAgentRuns` |

## 17. Audit

| | |
|---|---|
| Collection | `GET /workspaces/{workspaceId}/audit` and `GET /enterprises/{enterpriseId}/audit` (Enterprise-scoped audit) |
| Resource | `GET /audit/{auditRecordId}` |
| Search | Not applicable — use `GetAuditTrail` filters (actor, action type, date, target) |
| Actions | None — Audit records are written only as a side effect of other Commands (PR5 §21); no client-invoked write path exists |
| Permissions | Restricted to Compliance/Security/Workspace-Admin-equivalent roles; export of audit is itself audited (PR5 §23) |
| Commands | None — append-only, system-written |
| Queries | `GetAuditTrail` |

## 18. Notification

| | |
|---|---|
| Collection | `GET /me/notifications` (self-scoped) |
| Resource | `GET /notifications/{notificationId}` |
| Search | Not applicable |
| Actions | Notification delivery is entirely event-driven (Workflow 14, triggered by `RecommendationGenerated`/`DecisionRecorded`/`ActionCompleted`/`OutcomeRecorded`); no client-invoked "create notification" Command exists. A future preference-update Command (`UpdateNotificationPreferences`) is not yet catalogued in PR4 — recorded as an open gap |
| Permissions | Self-scoped by default; no cross-user notification access |
| Commands | None catalogued |
| Queries | Not individually catalogued in `04-command-query-event-catalog.md` — recorded as an open gap; `GetProjectIntelligenceFeed`/`GetEnterpriseHealth`-style feeds partially substitute today |

## 19. Integration

| | |
|---|---|
| Collection | `GET /workspaces/{workspaceId}/integrations` |
| Resource | `GET /integrations/{integrationId}` |
| Search | Not applicable |
| Actions | Integration connection, configuration, and sync-trigger Commands are per-integration and not individually catalogued at the top level in `04-command-query-event-catalog.md` — recorded as an open gap, deferred to per-integration design in PR9+ |
| Permissions | Workspace Owner/Admin for connection/configuration |
| Commands | Not individually catalogued |
| Queries | Not individually catalogued |

## 20. Search (Cross-Cutting)

| | |
|---|---|
| Collection | Not applicable — Search is not itself a persisted resource |
| Resource | Not applicable |
| Search | `GET /workspaces/{workspaceId}/search?q=...` (Workspace-wide), `GET /projects/{projectId}/search?q=...` (Project-scoped) |
| Actions | None — Search is read-only by definition |
| Permissions | Results are filtered to the caller's authorized scope and classification ceiling before being returned — never filtered client-side after an over-broad server response |
| Commands | None |
| Queries | `SearchWorkspace`, `SearchProject` |

---

## Project-Scoped Sub-Resources

These resources are always addressed through their owning Project — no top-level collection endpoint exists independent of a Project — reflecting their PR4 bounded-context ownership (Work Execution, Schedule and Milestones, RAID Management, Stakeholder and Communication Management).

| Sub-resource | Collection | Resource | Actions | Commands | Owning context |
|---|---|---|---|---|---|
| Task | `GET /projects/{projectId}/tasks` | `GET /tasks/{taskId}` | create, assign, update status, complete | `CreateTask`, `AssignTask`, `UpdateTaskStatus`, `CompleteTask` | Work Execution |
| Milestone | `GET /projects/{projectId}/milestones` | `GET /milestones/{milestoneId}` | create, complete | `CreateMilestone`, `CompleteMilestone` | Schedule and Milestones |
| Risk | `GET /projects/{projectId}/risks` | `GET /risks/{riskId}` | record, update assessment, close | `RecordRisk`, `UpdateRiskAssessment`, `CloseRisk` | RAID Management |
| Issue | `GET /projects/{projectId}/issues` | `GET /issues/{issueId}` | record, resolve | `RecordIssue`, `ResolveIssue` | RAID Management |
| Stakeholder | `GET /projects/{projectId}/stakeholders` | `GET /stakeholders/{stakeholderId}` | add | `AddProjectStakeholder` | Stakeholder and Communication Management |

None of these five is promoted to a top-level resource in this catalog — doing so would contradict PR4's ownership model, under which each is a Project-owned record, not an independent aggregate root (PR5 §8).

---

## Validation Notes

Every Command and Query cited in this catalog is taken verbatim from `04-command-query-event-catalog.md`. Where PR4 did not catalogue a Command or Query a resource would naturally need (Action status transitions, Evidence top-level Query, Workflow status Query, Agent Definition management, Notification preferences/listing, Integration commands), this catalog records the gap explicitly rather than inventing a new canonical name — closing those gaps, if warranted, is PR4-catalog work, not something this API-layer document may do unilaterally.
