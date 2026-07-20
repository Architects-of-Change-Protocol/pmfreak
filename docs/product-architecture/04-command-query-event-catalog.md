# PMFreak — Command, Query and Event Catalog (PR4)

Status: Ratified
Date: 2026-07-19
Companion to: `04-canonical-application-architecture.md` §13–§21
Authority: same order as the parent document.

This catalog is the detailed reference for every Command, Query, and Event summarized in the parent document. None of these are implemented by this PR — this is a contract for PR5/PR6/PR7 to build against.

## 1. Naming Conventions

- **Commands** are imperative verb phrases: `CreateProject`, `RecordDecision`. They name the intent, not the storage operation (never `InsertProjectRow`).
- **Queries** are `Get`/`List`/`Search` + noun phrase: `GetProjectHealth`, `ListRecommendations`.
- **Domain events** are past-tense facts: `ProjectCreated`, `DecisionRevoked`. Never a future intent (`WillArchiveProject`) or a request (`ShouldApprove`).
- **Integration events** carry an explicit version suffix or envelope field (`ProjectCreated.v1`) once a second consumer outside the owning context depends on the shape.
- Every Command, Query, and Event name is globally unique across the catalog — no two contexts may reuse a name for different meanings.

## 2. Versioning

- A Command's request shape may add optional fields without a version bump; removing or repurposing a field requires a new Command name or an explicit major version.
- A Domain Event is versioned only once it becomes an Integration Event (§21 of the parent document) — purely internal events may evolve with their context, since no external consumer depends on their shape.
- An Integration Event's version is part of its contract; a consumer must be able to ignore fields it doesn't recognize (tolerant reader) and must reject a payload whose major version it does not support, rather than guess.

## 3. Correlation and Causation

Every Command carries a `correlationId` (traces one end-to-end user or system-triggered flow) and, when triggered by a prior Event or Command, a `causationId` (the immediate cause). Every resulting Event inherits its triggering Command's `correlationId` and sets its `causationId` to that Command's id. This chain is what makes a workflow's state (§25 of the parent document, and `04-application-workflows.md`) reconstructable after the fact.

## 4. Authorization and Error Behavior

Every Command handler evaluates authorization before validation, and validation before execution — never the reverse, since a validation error must not leak information to an actor who was never authorized to make the attempt in the first place. Every Command and Query documents the error categories (§38 of the parent document) it can return; none may return an error category outside that document's canonical list, and none may include a raw exception message, credential, or another tenant's data in a user-facing error.

---

## 5. Command Catalog

### 5.1 Enterprise and Workspace

| Command | Intent | Actor | Target aggregate | Prerequisites |
| --- | --- | --- | --- | --- |
| CreateEnterprise | Establish a new Enterprise root | Founder / platform-authorized actor | Enterprise | None |
| UpdateEnterpriseProfile | Change Enterprise-level profile fields | Enterprise Admin | Enterprise | Enterprise exists |
| CreateWorkspace | Establish a new tenancy boundary | Enterprise Admin / self-service user | Workspace | Enterprise exists (may be auto-created/hidden per ADR-PMF-012) |
| ArchiveWorkspace | Retire a Workspace | Workspace Owner / Enterprise Admin | Workspace | Workspace exists and is not already archived |
| AssignWorkspaceMember | Grant membership/role in a Workspace | Workspace Owner/Admin | Workspace | Actor and Workspace both exist |
| ChangeWorkspacePolicy | Update Workspace-level policy | Workspace Owner/Admin | Workspace | Workspace exists; new policy does not weaken a higher-precedence constraint (§46) |

| Command | Authorization | Idempotency key | Txn boundary | Resulting events | Failure modes | Human approval |
| --- | --- | --- | --- | --- | --- | --- |
| CreateEnterprise | Platform role check | requester + name | Enterprise creation | EnterpriseCreated | ValidationError, AuthorizationError, ConflictError | No |
| UpdateEnterpriseProfile | Enterprise Admin role | entity id + version | Single aggregate | (none — profile update; not in the domain-event catalog) | ValidationError, AuthorizationError, StaleVersionError | No |
| CreateWorkspace | Enterprise Admin role, or self-service entitlement | requester + name | Workspace creation | WorkspaceCreated | ValidationError, AuthorizationError, ConflictError | No |
| ArchiveWorkspace | Workspace Owner/Admin role | workspace id | Single aggregate | WorkspacePolicyChanged (archival is a policy-state transition) | AuthorizationError, InvariantViolation (active children block archival) | Yes — destructive |
| AssignWorkspaceMember | Workspace Owner/Admin role | workspace id + user id | Single aggregate | (none in domain-event catalog — membership is an Identity and Access concern) | ValidationError, AuthorizationError, ConflictError | No |
| ChangeWorkspacePolicy | Workspace Owner/Admin role | workspace id + policy version | Single aggregate | WorkspacePolicyChanged | ValidationError, AuthorizationError, PolicyViolation | No |

### 5.2 PMO, Portfolio and Program

| Command | Intent | Actor | Target aggregate | Prerequisites |
| --- | --- | --- | --- | --- |
| CreatePMO | Establish a governance entity under a Workspace | Workspace Owner/Admin | PMO | Workspace exists |
| UpdatePMOGovernancePolicy | Change PMO governance configuration | PMO Admin | PMO | PMO exists |
| CreatePortfolio | Establish a strategic grouping entity | PMO Admin | Portfolio | PMO exists |
| AssignProjectToPortfolio | Link a Project to a Portfolio as primary | PMO Admin / Portfolio Owner | Portfolio (Project link) | Project and Portfolio share a Workspace/PMO; Project has no other primary Portfolio |
| RemoveProjectFromPortfolio | Unlink a Project from a Portfolio | PMO Admin / Portfolio Owner | Portfolio (Project link) | Link exists |
| CreateProgram | Establish a coordination entity | PMO Admin | Program | PMO exists |
| AssignProjectToProgram | Link a Project to a Program as primary | PMO Admin / Program Owner | Program (Project link) | Project and Program share a Workspace/PMO; Project has no other primary Program |
| RemoveProjectFromProgram | Unlink a Project from a Program | PMO Admin / Program Owner | Program (Project link) | Link exists |

| Command | Authorization | Idempotency key | Txn boundary | Resulting events | Failure modes | Human approval |
| --- | --- | --- | --- | --- | --- | --- |
| CreatePMO | Workspace Owner/Admin role | workspace id + name | PMO creation | PMOCreated | ValidationError, AuthorizationError, ConflictError | No |
| UpdatePMOGovernancePolicy | PMO Admin role | PMO id + version | Single aggregate | (none in domain-event catalog) | ValidationError, AuthorizationError, StaleVersionError | No |
| CreatePortfolio | PMO Admin role | PMO id + name | Portfolio creation | PortfolioCreated | ValidationError, AuthorizationError, ConflictError | No |
| AssignProjectToPortfolio | PMO Admin/Portfolio Owner role; PortfolioEligibilityPolicy | project id + portfolio id | Link write on both aggregates | ProjectAssignedToPortfolio | InvariantViolation (already has a primary Portfolio), PolicyViolation | No |
| RemoveProjectFromPortfolio | Same as assign | project id + portfolio id | Link write | (none — removal is not separately cataloged as a domain event; covered by the same audit trail) | NotFoundError | No |
| CreateProgram | PMO Admin role | PMO id + name | Program creation | ProgramCreated | ValidationError, AuthorizationError, ConflictError | No |
| AssignProjectToProgram | PMO Admin/Program Owner role; ProgramMembershipPolicy | project id + program id | Link write | ProjectAssignedToProgram | InvariantViolation (already has a primary Program), PolicyViolation | No |
| RemoveProjectFromProgram | Same as assign | project id + program id | Link write | (none cataloged) | NotFoundError | No |

### 5.2a Program Roadmap Tree

Program Management owns the Epic/Sprint/Card roadmap tree internal to a Program (`04-bounded-context-catalog.md` §6), including the document-parsing capability that materializes a roadmap source into that tree. These commands were absent from the original catalog even though the underlying capability is real and already implemented (PR1 §19, §29–31: `programs`/`program_epics`/`program_sprints`/`program_cards`, plus `program_roadmap_sources`/`program_roadmap_parse_results`/`program_materializations`) — cataloguing them closes that gap per ADR-PMF-024/ADR-PMF-025 rather than leaving this active capability with an uncatalogued write path.

| Command | Intent | Actor | Target aggregate | Prerequisites |
| --- | --- | --- | --- | --- |
| CreateProgramEpic | Group related roadmap work under a Program | Program Owner / PMO Admin | Program (Epic) | Program exists |
| CreateProgramSprint | Time-box a batch of roadmap work under an Epic | Program Owner / PMO Admin | Program (Sprint) | Epic exists |
| CreateProgramCard | Create a roadmap work item | Program Owner / PMO Admin | Program (Card) | Program exists; Epic/Sprint optional |
| MoveProgramCard | Move a Card between Epics/Sprints or change its position | Program Owner / PMO Admin | Program (Card) | Card exists |
| SubmitRoadmapSource | Submit a source document for roadmap parsing | Program Owner / PMO Admin | Program (Roadmap Source) | Program exists |
| ParseRoadmapSource | Parse a submitted source into structured roadmap data | System (workflow step), triggered by Program Owner / PMO Admin | Program (Roadmap Source) | Source submitted |
| MaterializeRoadmap | Materialize parsed roadmap data into Epics/Sprints/Cards | Program Owner / PMO Admin | Program (Epic/Sprint/Card tree) | Parse results exist and passed validation |

| Command | Authorization | Idempotency key | Txn boundary | Resulting events | Failure modes | Human approval |
| --- | --- | --- | --- | --- | --- | --- |
| CreateProgramEpic | Program Owner/PMO Admin role | program id + epic name | Single aggregate (Program tree) | (none cataloged) | ValidationError, AuthorizationError | No |
| CreateProgramSprint | Program Owner/PMO Admin role | epic id + sprint name | Single aggregate (Program tree) | (none cataloged) | ValidationError, AuthorizationError | No |
| CreateProgramCard | Program Owner/PMO Admin role | program id + card fingerprint | Single aggregate (Program tree) | (none cataloged) | ValidationError, AuthorizationError | No |
| MoveProgramCard | Program Owner/PMO Admin role | card id + target position | Single aggregate (Program tree) | (none cataloged) | ValidationError, NotFoundError, StaleVersionError | No |
| SubmitRoadmapSource | Program Owner/PMO Admin role | program id + source checksum | Roadmap Source creation | (none cataloged) | ValidationError, ConflictError (duplicate checksum) | No |
| ParseRoadmapSource | System identity (workflow); Program Owner/PMO Admin triggers | source id | Single aggregate (Roadmap Source) | (none cataloged) | DataIntegrityError, DependencyUnavailable | No |
| MaterializeRoadmap | Program Owner/PMO Admin role | source id + parse result id | Program tree creation (Epics/Sprints/Cards) | RoadmapMaterialized | ValidationError, ConflictError, DataIntegrityError | Yes — materialization creates durable roadmap structure from parsed, potentially ambiguous input |

### 5.3 Project

| Command | Intent | Actor | Target aggregate | Prerequisites |
| --- | --- | --- | --- | --- |
| CreateProject | Establish the central execution aggregate | Any authorized Workspace/PMO member | Project | Workspace exists; PMO/Portfolio/Program optional (§7.3 principle preserving fast creation) |
| UpdateProjectContext | Change Project context fields | Authorized Project member | Project | Project exists |
| ArchiveProject | Retire a Project | Project Owner / PMO Admin | Project | Project exists, not already archived |
| ConfigureProjectMethodology | Select predictive/agile/hybrid/custom methodology | Project Owner | Project | Project exists |

| Command | Authorization | Idempotency key | Txn boundary | Resulting events | Failure modes | Human approval |
| --- | --- | --- | --- | --- | --- | --- |
| CreateProject | Workspace/PMO member role | requester + workspace id + name | Project creation | ProjectCreated | ValidationError, AuthorizationError, ConflictError | No |
| UpdateProjectContext | Project member role | project id + version | Single aggregate | (none cataloged; profile update) | ValidationError, AuthorizationError, StaleVersionError | No |
| ArchiveProject | Project Owner/PMO Admin role | project id | Single aggregate | ProjectArchived | AuthorizationError, InvariantViolation (open Decisions/Actions may block per policy) | Yes — destructive |
| ConfigureProjectMethodology | Project Owner role; MethodologyCompatibilityPolicy | project id + methodology | Single aggregate | ProjectMethodologyConfigured | ValidationError, PolicyViolation | No |

### 5.3a Stakeholder and Communication

Owned by the Stakeholder and Communication Management context (`04-bounded-context-catalog.md` §11), not Project Management — the target aggregate is the Stakeholder record, per the aggregate ownership matrix (§12 of the parent document) and ADR-PMF-024.

| Command | Intent | Actor | Target aggregate | Prerequisites |
| --- | --- | --- | --- | --- |
| AddProjectStakeholder | Add a stakeholder record to a Project | Authorized Project member | Stakeholder record | Project exists |

| Command | Authorization | Idempotency key | Txn boundary | Resulting events | Failure modes | Human approval |
| --- | --- | --- | --- | --- | --- | --- |
| AddProjectStakeholder | Project member role | project id + stakeholder ref | Single aggregate | (none cataloged) | ValidationError, AuthorizationError | No |

### 5.4 Execution

| Command | Intent | Actor | Target aggregate | Prerequisites |
| --- | --- | --- | --- | --- |
| CreateTask | Create a unit of work | Project member | Task | Project exists |
| AssignTask | Assign a Task to an actor | Project member | Task | Task exists |
| UpdateTaskStatus | Change Task status | Assignee / Project member | Task | Task exists |
| CompleteTask | Mark a Task complete | Assignee / Project member | Task | Task exists, not already complete |
| CreateMilestone | Create a dated checkpoint | Project member | Milestone | Project exists |
| CompleteMilestone | Mark a Milestone reached | Project member | Milestone | Milestone exists |

| Command | Authorization | Idempotency key | Txn boundary | Resulting events | Failure modes | Human approval |
| --- | --- | --- | --- | --- | --- | --- |
| CreateTask | Project member role | requester + project id + token | Task creation | TaskCreated | ValidationError, AuthorizationError | No |
| AssignTask | Project member role | task id + assignee | Single aggregate | (none cataloged) | ValidationError, NotFoundError | No |
| UpdateTaskStatus | Assignee/Project member role | task id + status + version | Single aggregate | (none cataloged; TaskCompleted covers the terminal transition) | ValidationError, StaleVersionError | No |
| CompleteTask | Assignee/Project member role | task id | Single aggregate | TaskCompleted | InvariantViolation (already complete) | No |
| CreateMilestone | Project member role | project id + name + date | Milestone creation | (none cataloged; MilestoneCompleted covers the terminal transition) | ValidationError, AuthorizationError | No |
| CompleteMilestone | Project member role | milestone id | Single aggregate | MilestoneCompleted | InvariantViolation (already complete) | No |

### 5.5 RAID

| Command | Intent | Actor | Target aggregate | Prerequisites |
| --- | --- | --- | --- | --- |
| RecordRisk | Log a potential future negative event | Project member / approved Agent Proposal | Risk | Project or Workspace scope exists |
| UpdateRiskAssessment | Update a Risk's assessment | Project member | Risk | Risk exists |
| CloseRisk | Close a Risk | Project member | Risk | Risk exists |
| RecordIssue | Log a realized problem | Project member / approved Agent Proposal | Issue | Project or Workspace scope exists |
| ResolveIssue | Resolve an Issue | Project member | Issue | Issue exists |

| Command | Authorization | Idempotency key | Txn boundary | Resulting events | Failure modes | Human approval |
| --- | --- | --- | --- | --- | --- | --- |
| RecordRisk | Project member role, or ApproveAgentProposal precedes this command when Agent-sourced | project id + fingerprint | Risk creation | RiskRecorded | ValidationError, ConflictError (duplicate fingerprint) | No — record only; see §33 for mitigation-action approval |
| UpdateRiskAssessment | Project member role | risk id + version | Single aggregate | (none cataloged) | ValidationError, StaleVersionError | No |
| CloseRisk | Project member role | risk id | Single aggregate | RiskClosed | InvariantViolation (already closed) | No |
| RecordIssue | Project member role, or ApproveAgentProposal precedes | project id + fingerprint | Issue creation | IssueRecorded | ValidationError, ConflictError | No |
| ResolveIssue | Project member role | issue id | Single aggregate | IssueResolved | InvariantViolation (already resolved) | No |

### 5.6 Intelligence Lifecycle

| Command | Intent | Actor | Target aggregate | Prerequisites |
| --- | --- | --- | --- | --- |
| SubmitEvidence | Ingest source material | Project member / Integration adapter | Evidence | Project exists |
| NormalizeSource | Normalize a raw source into structured Evidence | System (workflow step) | Evidence (derived) | Source submitted |
| ProposeMemoryRecord | Propose a candidate Project Memory Record | System (workflow step) / Agent | Project Memory Record (candidate) | Source event exists |
| ApproveMemoryRecord | Approve a candidate into canonical memory | Authorized Project member | Project Memory Record | Candidate exists |
| RejectMemoryRecord | Reject a candidate | Authorized Project member | Project Memory Record (candidate) | Candidate exists |
| ReviewRecommendation | Record human review of a Recommendation | Authorized Project member | Recommendation | Recommendation exists |
| ApproveRecommendation | Approve a Recommendation | Authorized Project member | Recommendation | Recommendation reviewed |
| RejectRecommendation | Reject a Recommendation | Authorized Project member | Recommendation | Recommendation reviewed |
| RecordDecision | Record an authoritative Decision | Human decision authority (role-gated) | Decision | DecisionAuthorityPolicy satisfied |
| RevokeDecision | Revoke a Decision | Original authority / escalated authority | Decision | Decision exists, active |
| CreateActionFromDecision | Create an Action executing a Decision | Authorized Project member | Action | Decision recorded and active |
| CompleteAction | Mark an Action complete | Authorized Project member | Action | Action exists, in Active or Blocked state |
| CancelAction | Cancel an Action | Authorized Project member | Action | Action exists, not already Completed or Cancelled |
| RecordOutcome | Record an observed Outcome | Project member / governed monitoring process | Outcome | Action exists |
| ProposeEnterprisePattern | Propose a candidate Enterprise Pattern | System (workflow step) / Enterprise Intelligence service | Pattern (Candidate) | Aggregated evidence batch exists |
| RatifyEnterpriseKnowledge | Ratify a Pattern into an Enterprise Knowledge Record | Enterprise Admin (governance role) | Enterprise Knowledge Record | Pattern passed six-part gate (§30) |
| RevokeEnterpriseKnowledge | Revoke a ratified Enterprise Knowledge Record | Enterprise Admin (governance role) | Enterprise Knowledge Record | Record exists |

| Command | Authorization | Idempotency key | Txn boundary | Resulting events | Failure modes | Human approval |
| --- | --- | --- | --- | --- | --- | --- |
| SubmitEvidence | Project member role / authenticated integration | source id + checksum | Evidence creation | EvidenceSubmitted | ValidationError, ConflictError (duplicate checksum) | No |
| NormalizeSource | System identity (workflow) | source id | Single aggregate | EvidenceNormalized | DataIntegrityError, DependencyUnavailable | No |
| ProposeMemoryRecord | System/Agent identity | source event id | Candidate creation | MemoryRecordProposed | ValidationError | No |
| ApproveMemoryRecord | Project member role (governance-designated) | candidate id | Single aggregate | MemoryRecordApproved | AuthorizationError, StaleVersionError | Yes — governance gate |
| RejectMemoryRecord | Project member role (governance-designated) | candidate id | Single aggregate | (none cataloged; rejection is a terminal candidate state) | AuthorizationError | Yes — governance gate |
| ReviewRecommendation | Project member role | recommendation id | Single aggregate | (none cataloged; review is a status annotation) | AuthorizationError | Yes — review is the human step |
| ApproveRecommendation | Project member role; RecommendationApprovalPolicy | recommendation id | Single aggregate | RecommendationApproved | AuthorizationError, PolicyViolation | Yes |
| RejectRecommendation | Project member role | recommendation id | Single aggregate | RecommendationRejected | AuthorizationError | Yes |
| RecordDecision | DecisionAuthorityPolicy | decision id (client-generated) | Decision creation | DecisionRecorded | AuthorizationError, PolicyViolation | Yes — always human/governed-process authored |
| RevokeDecision | Original/escalated authority; DecisionAuthorityPolicy | decision id + revocation reason | Single aggregate | DecisionRevoked | AuthorizationError, InvariantViolation (already revoked/closed) | Yes |
| CreateActionFromDecision | Project member role; ActionCreationPolicy | decision id + action fingerprint | Action creation | ActionCreated | PolicyViolation, ConflictError | Per Human-in-the-Loop Matrix (§33 of parent doc / AI-agent doc) |
| CompleteAction | Project member role | action id | Single aggregate | ActionCompleted | InvariantViolation (already terminal) | No |
| CancelAction | Project member role | action id + cancellation reason | Single aggregate | (none cataloged; cancellation is a terminal action state) | InvariantViolation (already terminal) | No |
| RecordOutcome | Project member role / monitoring process identity | action id + observation fingerprint | Outcome creation | OutcomeRecorded | ValidationError | No — observation, not authorization |
| ProposeEnterprisePattern | System identity; KnowledgeElevationPolicy | aggregation batch id | Pattern creation | EnterprisePatternProposed | PolicyViolation (insufficient evidence/confidence) | No |
| RatifyEnterpriseKnowledge | Enterprise Admin role; EnterpriseRatificationPolicy | pattern candidate id | Enterprise Knowledge Record creation | EnterpriseKnowledgeRatified | AuthorizationError, PolicyViolation | Yes — ratification is the gate |
| RevokeEnterpriseKnowledge | Enterprise Admin role | knowledge record id + revocation reason | Single aggregate | EnterpriseKnowledgeRevoked | AuthorizationError, InvariantViolation | Yes |

### 5.7 Agents

| Command | Intent | Actor | Target aggregate | Prerequisites |
| --- | --- | --- | --- | --- |
| RequestAgentRun | Trigger a governed Agent execution | Any authorized actor / scheduled trigger | Agent Run | AgentExecutionPolicy allows |
| CancelAgentRun | Cancel an in-progress run | Requesting actor / Admin | Agent Run | Run exists, not terminal |
| ApproveAgentProposal | Approve an Agent Proposal, converting it to a Recommendation | Authorized Project member | Agent Proposal → Recommendation | Proposal exists, validated |
| RejectAgentProposal | Reject an Agent Proposal | Authorized Project member | Agent Proposal | Proposal exists |

| Command | Authorization | Idempotency key | Txn boundary | Resulting events | Failure modes | Human approval |
| --- | --- | --- | --- | --- | --- | --- |
| RequestAgentRun | AgentExecutionPolicy | requester + context fingerprint | Agent Run creation | AgentRunRequested, AgentRunStarted | PolicyViolation, RateLimitExceeded | No |
| CancelAgentRun | Requesting actor / Admin role | run id | Single aggregate | (none cataloged; cancellation is a terminal run state) | InvariantViolation (already terminal) | No |
| ApproveAgentProposal | Project member role | proposal id | Proposal → Recommendation | RecommendationGenerated | AuthorizationError | Yes |
| RejectAgentProposal | Project member role | proposal id | Single aggregate | (none cataloged) | AuthorizationError | Yes |

`ApproveAgentProposal` is the sole command that produces a Recommendation from Agent-originated output. There is no separate, directly Agent-issuable command that creates a Recommendation without Human Review — an Agent's only output is an Agent Proposal (`04-ai-agent-application-architecture.md` §8), and `RecommendationGenerated` is emitted only when a human approves that Proposal.

---

## 6. Query Catalog

| Query | Consumer | Scope | Source read model | Filters | Freshness requirement |
| --- | --- | --- | --- | --- | --- |
| GetEnterpriseOverview | Enterprise Command Center | Enterprise | Enterprise read model | None | Seconds-scale staleness acceptable |
| GetWorkspaceOverview | Workspace Command Center | Workspace | Workspace read model | None | Seconds-scale |
| GetPMOOverview | PMO Command Center | PMO | PMO read model | None | Seconds-scale |
| GetPortfolioOverview | Portfolio Command Center | Portfolio | Portfolio read model | None | Seconds-scale |
| GetProgramOverview | Program Command Center | Program | Program read model | None | Seconds-scale |
| GetProjectOverview | Project Command Center | Project | Project read model | None | Seconds-scale |
| GetProjectCommandCenter | Project Command Center | Project | Composite Project read model | Widget selection | Seconds-scale |
| GetProjectIntelligenceFeed | Project Command Center | Project | Feed projection | Date range, source type, pipeline stage | Seconds-scale |
| GetProjectMemory | Project Memory screen, Agent context assembly | Project | Project Memory read model | Validation status, confidence threshold | Strong for approved records |
| GetProjectHealth | Project Command Center, Health Center | Project | Health projection | None | Minutes-scale acceptable |
| GetPortfolioHealth | Portfolio Command Center, Health Center | Portfolio | Health projection | None | Minutes-scale |
| GetProgramHealth | Program Command Center, Health Center | Program | Health projection | None | Minutes-scale |
| GetPMOHealth | PMO Command Center, Health Center | PMO | Health projection | None | Minutes-scale |
| GetEnterpriseHealth | Enterprise Command Center, Health Center | Enterprise | Health projection | None | Minutes-scale |
| SearchWorkspace | Global Search (Workspace variant) | Workspace | Search index | Query text, type filter | Minutes-scale (index lag) |
| SearchProject | Project Search variant | Project | Search index | Query text, type filter | Minutes-scale |
| ListRecommendations | Recommendation Queue | Project (or aggregated scope) | Recommendation read model | Status, confidence, date range | Seconds-scale |
| GetRecommendationDetails | Recommendation Queue detail view | Project | Recommendation read model | None | Strong (single-record) |
| ListDecisions | Decision Register | Project (or aggregated scope) | Decision read model | Status, date range | Seconds-scale |
| GetDecisionDetails | Decision Register detail view | Project | Decision read model | None | Strong |
| ListActions | Action Register | Project | Action read model | Status | Seconds-scale |
| ListOutcomes | Outcome Register | Project | Outcome read model | Status | Seconds-scale |
| GetAgentRun | Agent Center | Project / Workspace | Agent Run read model | None | Strong |
| ListAgentRuns | Agent Center | Project / Workspace | Agent Run read model | Status, agent, date range | Seconds-scale |
| GetEnterpriseIntelligence | Knowledge Center | Enterprise | Enterprise Knowledge read model | Applicability scope, ratification status | Strong for ratified |
| GetKnowledgeLineage | Knowledge Center detail view | Enterprise | Knowledge lineage projection | None | Strong |
| GetAuditTrail | Audit Timeline | Any (scope-gated) | Audit read model | Actor, action type, date range, target | Strong (durable) |

**Sensitive fields:** `GetProjectMemory`, `GetEnterpriseIntelligence`, `GetKnowledgeLineage`, and `GetAuditTrail` may return fields subject to field-level access control (§15 of the parent document, Query Handler responsibilities); a query handler must redact rather than error when the actor lacks visibility into a specific field but is otherwise authorized for the record.

**Cross-workspace constraints:** every query above defaults to single-Workspace scope. `GetEnterpriseOverview`, `GetEnterpriseHealth`, and `GetEnterpriseIntelligence` are the only queries permitted to aggregate across Workspaces within one Enterprise, and only for actors holding Enterprise-level authorization — never as a default projection available to a Workspace-scoped actor.

Queries never mutate state and never trigger automations as a side effect.

---

## 7. Domain Event Catalog

| Event | Producer context | Consumers | Payload (conceptual) | Crosses Workspace? |
| --- | --- | --- | --- | --- |
| EnterpriseCreated | Enterprise Administration | Workspace Management, Billing and Entitlements | enterpriseId, createdByActor | No |
| WorkspaceCreated | Workspace Management | Onboarding/Identity, Notification, Search | workspaceId, enterpriseId?, createdByActor | No |
| WorkspacePolicyChanged | Workspace Management | PMO Governance, Configuration and Methodology | workspaceId, policyVersion | No |
| PMOCreated | PMO Governance | Navigation projections, Notification | pmoId, workspaceId, pmoType | No |
| PortfolioCreated | Portfolio Management | Reporting, Notification | portfolioId, pmoId, workspaceId | No |
| ProjectAssignedToPortfolio | Portfolio Management | Project Management (read), Reporting | projectId, portfolioId | No |
| ProgramCreated | Program Management | Reporting, Notification | programId, pmoId, workspaceId | No |
| ProjectAssignedToProgram | Program Management | Project Management (read), Reporting | projectId, programId | No |
| RoadmapMaterialized | Program Management | Project Intelligence Feed projection, Reporting | programId, sourceId, epicIds, sprintIds, cardIds | No |
| ProjectCreated | Project Management | PMO Governance, Project Memory, Notification, Search, Audit | projectId, workspaceId, pmoId? | No |
| ProjectArchived | Project Management | Reporting, Search, Audit | projectId, archivedByActor | No |
| ProjectMethodologyConfigured | Project Management | Schedule and Milestones, Work Execution | projectId, methodology | No |
| TaskCreated | Work Execution | Project Intelligence Feed projection | taskId, projectId | No |
| TaskCompleted | Work Execution | Project Intelligence Feed projection, Reporting | taskId, projectId | No |
| MilestoneCompleted | Schedule and Milestones | Project Intelligence Feed projection, Reporting | milestoneId, projectId | No |
| RiskRecorded | RAID Management | Agent Orchestration (context input), Project Intelligence Feed | riskId, projectId | No |
| RiskClosed | RAID Management | Reporting | riskId, projectId | No |
| IssueRecorded | RAID Management | Agent Orchestration (context input), Project Intelligence Feed | issueId, projectId | No |
| IssueResolved | RAID Management | Reporting | issueId, projectId | No |
| EvidenceSubmitted | Document and Evidence Management | Project Intelligence Feed, Project Memory | evidenceId, projectId, sourceType | No |
| EvidenceNormalized | Document and Evidence Management | Project Memory, Recommendation Management | evidenceId, projectId | No |
| MemoryRecordProposed | Project Memory | (internal governance queue) | candidateId, projectId | No |
| MemoryRecordApproved | Project Memory | Agent Orchestration, Search | recordId, projectId | No |
| RecommendationGenerated | Recommendation Management | Notification, Project Intelligence Feed | recommendationId, projectId, agentRunId? | No |
| RecommendationApproved | Recommendation Management | Decision Management (read), Notification | recommendationId, approvedByActor | No |
| RecommendationRejected | Recommendation Management | Notification | recommendationId, rejectedByActor | No |
| DecisionRecorded | Decision Management | Action and Outcome Management, Audit, Notification | decisionId, projectId, authority | No |
| DecisionRevoked | Decision Management | Action and Outcome Management, Audit, Notification | decisionId, revokedByActor, reason | No |
| ActionCreated | Action and Outcome Management | Project Management projections | actionId, decisionId, projectId | No |
| ActionCompleted | Action and Outcome Management | Enterprise Intelligence pipeline (input), Reporting | actionId, projectId | No |
| OutcomeRecorded | Action and Outcome Management | Enterprise Intelligence pipeline (input), Reporting | outcomeId, actionId, projectId | Only if elevation is explicitly ratified (§30) |
| EnterprisePatternProposed | Enterprise Intelligence | Governance review queue | patternId, scopeContexts | Only with explicit per-record consent |
| EnterpriseKnowledgeRatified | Enterprise Intelligence | Enterprise Administration projections, Recommendation Management | knowledgeRecordId, ratifiedByActor | Yes — this is the governed crossing point itself |
| EnterpriseKnowledgeRevoked | Enterprise Intelligence | Enterprise Administration projections | knowledgeRecordId, revokedByActor, reason | Yes — same governed crossing point |
| AgentRunRequested | Agent Orchestration | Audit | runId, requestedByActor | No |
| AgentRunStarted | Agent Orchestration | Audit | runId | No |
| AgentRunCompleted | Agent Orchestration | Recommendation Management, Audit | runId, outputSummary | No |
| AgentRunFailed | Agent Orchestration | Audit, Notification (operator alert) | runId, errorCategory | No |

Every event whose consumer sits above the Workspace boundary is explicitly marked conditional on the Enterprise Intelligence elevation gate (§30 of the parent document) — none may be assumed safe to cross a tenant boundary by default.

## 8. Integration Event Candidates

Restating `04-canonical-application-architecture.md` §21: `ProjectCreated`, `TaskCompleted`, `MilestoneCompleted`, `RoadmapMaterialized`, `EvidenceSubmitted`, `MemoryRecordApproved`, `RecommendationGenerated`, `DecisionRecorded`, `DecisionRevoked`, `ActionCompleted`, `OutcomeRecorded`, `EnterpriseKnowledgeRatified`, `EnterpriseKnowledgeRevoked`, `WorkspaceCreated`, `PMOCreated`, `PortfolioCreated`, `ProgramCreated` are the events most likely to require a versioned integration contract, since each already has a consumer in a different bounded context — `TaskCompleted` and `MilestoneCompleted` specifically because §7's catalog names Reporting and Analytics as a consumer of both, and Reporting is a separate bounded context from Work Execution and Schedule and Milestones respectively. Every other event in §7 may remain a purely internal domain event until a second-context consumer is actually designed.
