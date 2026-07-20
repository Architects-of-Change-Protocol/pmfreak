# PR6 Companion — Command API Catalog

Status: Documentary architecture (no implementation)
Parent: `06-canonical-api-contracts.md`

Purpose: give every Command already catalogued in `04-command-query-event-catalog.md` a wire contract — endpoint, request DTO, response DTO, validation, authorization, side effects, emitted events, and idempotency requirement. This document does not add, rename, or redefine a single Command; it exposes exactly the Commands PR4 ratified.

**Universal rules, binding for every Command below (not repeated per row):**
- Authorization is evaluated before domain validation's side effects run, per PR4 §38 and this PR's §3 principle 14/15.
- Every Command carries a `correlationId` and, where triggered by a prior event/Command, a `causationId` (PR4 §3) — propagated automatically by the API command port, never supplied by the client as a trust boundary.
- Every response is a Response DTO (`06-canonical-api-contracts.md` §9), never a raw aggregate.
- Every failure returns a canonical error from `06-error-model.md`; the "Failure Modes" column below names the categories a Command's own validation/authorization is expected to surface — `UnexpectedError`, `DependencyUnavailable`, and `RateLimitExceeded` may occur on any Command and are not repeated per row.
- "Human Approval" marks Commands PR4's Human-in-the-Loop Matrix (AI-agent doc §9) classifies as requiring human approval before taking effect, distinct from Commands an Agent identity may never call at all (ADR-PMF-027).

---

## 1. Enterprise and Workspace

| Command | Endpoint | Request (key fields) | Response |
|---|---|---|---|
| `CreateEnterprise` | `POST /enterprises:create` | name, billing profile reference | Enterprise Response DTO |
| `UpdateEnterpriseProfile` | `PATCH /enterprises/{enterpriseId}` | changed profile fields only | Enterprise Response DTO |
| `CreateWorkspace` | `POST /enterprises/{enterpriseId}/workspaces:create` | `enterprise_id` (server-derived), name, slug | Workspace Response DTO |
| `ArchiveWorkspace` | `POST /workspaces/{workspaceId}:archive` | reason | Workspace Response DTO |
| `AssignWorkspaceMember` | `POST /workspaces/{workspaceId}/members:assign` | actor identity, role | Workspace Membership Response DTO |
| `ChangeWorkspacePolicy` | `PATCH /workspaces/{workspaceId}/policy` | changed policy fields only | Workspace Response DTO |

| Command | Validation | Authorization | Side Effects | Emitted Events | Idempotent | Human Approval |
|---|---|---|---|---|---|---|
| `CreateEnterprise` | Name non-empty, no duplicate within permitted global scope | Platform/Enterprise Administrator only | Creates Enterprise aggregate | `EnterpriseCreated` | Yes (`Idempotency-Key`) | No |
| `UpdateEnterpriseProfile` | Changed fields well-formed | Enterprise Administrator | Mutates Enterprise profile | None catalogued | No | No |
| `CreateWorkspace` | Name/slug non-empty, slug unique within Enterprise | Enterprise Administrator or delegated Workspace-creation capability | Creates Workspace aggregate, `enterprise_id` derived server-side | `WorkspaceCreated` | Yes | No |
| `ArchiveWorkspace` | Workspace is currently Active; reason required | Enterprise Administrator or Workspace Owner | Transitions Workspace to Archived (Workflow 11); cascades archival eligibility to owned PMO/Portfolio/Program/Project per their own archival rules, never destructively | `WorkspacePolicyChanged` | Yes | Yes — destructive, requires explicit confirmation |
| `AssignWorkspaceMember` | Actor identity resolvable, role is a valid Workspace role | Workspace Owner/Admin | Creates/updates `workspace_memberships` record | None catalogued | Yes (assignment is naturally idempotent per `(workspace, actor)`) | No |
| `ChangeWorkspacePolicy` | Changed fields well-formed against policy schema | Workspace Owner/Admin | Mutates Workspace policy | `WorkspacePolicyChanged` | No | No |

## 2. PMO, Portfolio, and Program

| Command | Endpoint | Request (key fields) | Response |
|---|---|---|---|
| `CreatePMO` | `POST /workspaces/{workspaceId}/pmos:create` | name, `workspace_id` (server-derived) | PMO Response DTO |
| `UpdatePMOGovernancePolicy` | `PATCH /pmos/{pmoId}/governance-policy` | changed policy fields | PMO Response DTO |
| `CreatePortfolio` | `POST /pmos/{pmoId}/portfolios:create` | name, `pmo_id`/`workspace_id` (server-derived) | Portfolio Response DTO |
| `AssignProjectToPortfolio` | `POST /portfolios/{portfolioId}/projects/{projectId}:assign` | primary flag | Portfolio Assignment Response DTO |
| `RemoveProjectFromPortfolio` | `POST /portfolios/{portfolioId}/projects/{projectId}:remove` | reason | Portfolio Assignment Response DTO |
| `CreateProgram` | `POST /pmos/{pmoId}/programs:create` | name, `pmo_id`/`workspace_id` (server-derived) | Program Response DTO |
| `AssignProjectToProgram` | `POST /programs/{programId}/projects/{projectId}:assign` | primary flag | Program Assignment Response DTO |
| `RemoveProjectFromProgram` | `POST /programs/{programId}/projects/{projectId}:remove` | reason | Program Assignment Response DTO |

| Command | Validation | Authorization | Side Effects | Emitted Events | Idempotent | Human Approval |
|---|---|---|---|---|---|---|
| `CreatePMO` | Name non-empty, unique code within Workspace if supplied | Workspace Owner/Admin | Creates PMO aggregate | `PMOCreated` | Yes | No |
| `UpdatePMOGovernancePolicy` | Changed fields well-formed | PMO governance role holder | Mutates PMO governance policy | None catalogued | No | No |
| `CreatePortfolio` | Name non-empty, unique code within PMO if supplied | PMO role holder | Creates Portfolio aggregate | `PortfolioCreated` | Yes | No |
| `AssignProjectToPortfolio` | Project and Portfolio share a Workspace (PR5 §11 composite constraint); Project has no other active primary Portfolio if `primary=true` (PR1.1 invariant) | PMO role holder plus authorization on target Project | Creates/updates `project_portfolio_assignments` | `ProjectAssignedToPortfolio` | Yes | No |
| `RemoveProjectFromPortfolio` | Assignment currently exists | PMO role holder plus authorization on target Project | Ends `project_portfolio_assignments` record | None catalogued | Yes | No |
| `CreateProgram` | Name non-empty, unique code within PMO if supplied | PMO role holder | Creates Program aggregate | `ProgramCreated` | Yes | No |
| `AssignProjectToProgram` | Project and Program share a Workspace; Program and Portfolio belong to compatible PMOs where both apply; Project has no other active primary Program if `primary=true` | PMO role holder plus authorization on target Project | Creates/updates `project_program_assignments` | `ProjectAssignedToProgram` | Yes | No |
| `RemoveProjectFromProgram` | Assignment currently exists | PMO role holder plus authorization on target Project | Ends `project_program_assignments` record | None catalogued | Yes | No |

## 3. Project

| Command | Endpoint | Request (key fields) | Response |
|---|---|---|---|
| `CreateProject` | `POST /workspaces/{workspaceId}/projects:create` | name, key, `workspace_id` (server-derived), optional PMO/Portfolio/Program links | Project Response DTO |
| `UpdateProjectContext` | `PATCH /projects/{projectId}` | changed context fields | Project Response DTO |
| `ArchiveProject` | `POST /projects/{projectId}:archive` | reason | Project Response DTO |
| `ConfigureProjectMethodology` | `PATCH /projects/{projectId}/methodology` | methodology type + configuration | Project Response DTO |
| `AddProjectStakeholder` | `POST /projects/{projectId}/stakeholders:add` | stakeholder identity, role | Stakeholder Response DTO |

| Command | Validation | Authorization | Side Effects | Emitted Events | Idempotent | Human Approval |
|---|---|---|---|---|---|---|
| `CreateProject` | Name/key non-empty, key unique within Workspace, at most one primary Portfolio/Program if supplied at creation | Workspace member with Project-creation capability | Creates Project aggregate, `workspace_id` derived server-side | `ProjectCreated` | Yes | No |
| `UpdateProjectContext` | Changed fields well-formed; version supplied matches current (`If-Match`, §18 of parent) | Project role holder | Mutates Project context, increments `version` | None catalogued | No — protected by optimistic concurrency instead | No |
| `ArchiveProject` | Project is currently Active; reason required | Workspace Owner/Admin or Project Owner | Transitions Project to Archived (Workflow 10) | `ProjectArchived` | Yes | Yes — destructive, requires explicit confirmation |
| `ConfigureProjectMethodology` | Methodology type is a supported value; configuration schema valid for that type | Project Owner/Admin | Mutates Project methodology configuration | `ProjectMethodologyConfigured` | No | No |
| `AddProjectStakeholder` | Stakeholder identity resolvable, role valid | Project role holder with stakeholder-management capability | Creates `project_stakeholders` record | None catalogued | Yes (naturally idempotent per `(project, stakeholder)`) | No |

## 4. Work Execution and Schedule

| Command | Endpoint | Request (key fields) | Response |
|---|---|---|---|
| `CreateTask` | `POST /projects/{projectId}/tasks:create` | title, `project_id`/`workspace_id` (server-derived) | Task Response DTO |
| `AssignTask` | `POST /tasks/{taskId}:assign` | assignee identity | Task Response DTO |
| `UpdateTaskStatus` | `PATCH /tasks/{taskId}/status` | new status | Task Response DTO |
| `CompleteTask` | `POST /tasks/{taskId}:complete` | completion note (optional) | Task Response DTO |
| `CreateMilestone` | `POST /projects/{projectId}/milestones:create` | title, target date | Milestone Response DTO |
| `CompleteMilestone` | `POST /milestones/{milestoneId}:complete` | completion note (optional) | Milestone Response DTO |

| Command | Validation | Authorization | Side Effects | Emitted Events | Idempotent | Human Approval |
|---|---|---|---|---|---|---|
| `CreateTask` | Title non-empty | Project role holder with task-management capability | Creates Task, `workspace_id`+`project_id` derived server-side | `TaskCreated` | Yes | No |
| `AssignTask` | Assignee is a Project member | Project role holder or Task assignee (self-reassignment where policy allows) | Updates `task_assignments` | None catalogued | Yes (idempotent per assignee) | No |
| `UpdateTaskStatus` | New status is a valid transition from current status | Project role holder or Task assignee | Mutates Task status, appends `task_status_history` | None catalogued (`TaskCompleted` covers the terminal transition) | No | No |
| `CompleteTask` | Task is not already Completed/Cancelled | Project role holder or Task assignee | Transitions Task to Completed | `TaskCompleted` | Yes | No |
| `CreateMilestone` | Title non-empty, target date well-formed | Project role holder with schedule-management capability | Creates Milestone | None catalogued (`MilestoneCompleted` covers the terminal transition) | Yes | No |
| `CompleteMilestone` | Milestone is not already Completed | Project role holder with schedule-management capability | Transitions Milestone to Completed | `MilestoneCompleted` | Yes | No |

## 5. RAID Management

| Command | Endpoint | Request (key fields) | Response |
|---|---|---|---|
| `RecordRisk` | `POST /projects/{projectId}/risks:record` | description, likelihood, impact | Risk Response DTO |
| `UpdateRiskAssessment` | `PATCH /risks/{riskId}/assessment` | updated likelihood/impact | Risk Response DTO |
| `CloseRisk` | `POST /risks/{riskId}:close` | resolution note | Risk Response DTO |
| `RecordIssue` | `POST /projects/{projectId}/issues:record` | description, severity | Issue Response DTO |
| `ResolveIssue` | `POST /issues/{issueId}:resolve` | resolution note | Issue Response DTO |

| Command | Validation | Authorization | Side Effects | Emitted Events | Idempotent | Human Approval |
|---|---|---|---|---|---|---|
| `RecordRisk` | Description non-empty, likelihood/impact within defined scale | Project role holder with RAID-management capability | Creates Risk, appends `risk_assessments` | `RiskRecorded` | Yes | No |
| `UpdateRiskAssessment` | Likelihood/impact within defined scale | Project role holder with RAID-management capability | Appends new `risk_assessments` record (assessment history preserved, not overwritten) | None catalogued | No | No |
| `CloseRisk` | Risk is currently Open | Project role holder with RAID-management capability | Transitions Risk to Closed, appends `risk_status_history` | `RiskClosed` | Yes | No |
| `RecordIssue` | Description non-empty, severity within defined scale | Project role holder with RAID-management capability | Creates Issue | `IssueRecorded` | Yes | No |
| `ResolveIssue` | Issue is currently Open | Project role holder with RAID-management capability | Transitions Issue to Resolved, appends `issue_status_history` | `IssueResolved` | Yes | No |

## 6. Intelligence Lifecycle — Evidence and Project Memory

| Command | Endpoint | Request (key fields) | Response |
|---|---|---|---|
| `SubmitEvidence` | `POST /projects/{projectId}/evidence:submit` | source reference, content or object reference | Evidence Response DTO |
| `NormalizeSource` | System-invoked (Evidence Normalization workflow), not a general client action | source Evidence reference | Evidence Response DTO |
| `ProposeMemoryRecord` | `POST /projects/{projectId}/memory:propose` | content, source Evidence references | Project Memory Record Response DTO |
| `ApproveMemoryRecord` | `POST /memory/{memoryRecordId}:approve` | approval note (optional) | Project Memory Record Response DTO |
| `RejectMemoryRecord` | `POST /memory/{memoryRecordId}:reject` | rejection reason | Project Memory Record Response DTO |

| Command | Validation | Authorization | Side Effects | Emitted Events | Idempotent | Human Approval |
|---|---|---|---|---|---|---|
| `SubmitEvidence` | Source reference or content present; classification assignable | Project member with evidence-submission capability | Creates Evidence record, may trigger Document Ingestion workflow | `EvidenceSubmitted` | Yes | No |
| `NormalizeSource` | Source Evidence exists and is not already normalized | System/pipeline identity only (`EvidenceTrustPolicy`) | Produces normalized, structured Evidence content | `EvidenceNormalized` | Yes | No |
| `ProposeMemoryRecord` | Content non-empty; source Evidence references resolvable | Project member (human) or Agent pipeline (candidate only) | Creates candidate Project Memory Record (Proposed state) | `MemoryRecordProposed` | Yes | No — proposal itself is not the approval |
| `ApproveMemoryRecord` | Candidate is currently in `PendingApproval` state | Human actor with Project Memory governance capability — **never an Agent identity** (ADR-PMF-027) | Transitions record to Approved, becomes retrievable to Agents as authoritative | `MemoryRecordApproved` | Yes | Yes |
| `RejectMemoryRecord` | Candidate is currently in `PendingApproval` state | Human actor with Project Memory governance capability | Transitions record to Rejected | None catalogued | Yes | Yes |

## 7. Intelligence Lifecycle — Recommendation, Decision, Action, Outcome

| Command | Endpoint | Request (key fields) | Response |
|---|---|---|---|
| `GenerateRecommendation` | System/pipeline-invoked (Recommendation Generation workflow), not a general `POST /recommendations` | Agent Proposal reference or equivalent governed source | Recommendation Response DTO |
| `ReviewRecommendation` | `POST /recommendations/{id}:review` | review note | Recommendation Response DTO |
| `ApproveRecommendation` | `POST /recommendations/{id}:approve` | approval note (optional) | Recommendation Response DTO |
| `RejectRecommendation` | `POST /recommendations/{id}:reject` | rejection reason | Recommendation Response DTO |
| `RecordDecision` | `POST /projects/{projectId}/decisions:record` | rationale, authority reference, optional source Recommendation | Decision Response DTO |
| `RevokeDecision` | `POST /decisions/{id}:revoke` | revocation reason | Decision Response DTO |
| `CreateActionFromDecision` | `POST /decisions/{decisionId}/actions:create` | owner, due date | Action Response DTO |
| `RecordOutcome` | `POST /actions/{actionId}/outcomes:record` | observed result, metric, evidence references | Outcome Response DTO |

| Command | Validation | Authorization | Side Effects | Emitted Events | Idempotent | Human Approval |
|---|---|---|---|---|---|---|
| `GenerateRecommendation` | Source Agent Proposal (or equivalent) passed output validation | System/pipeline identity, gated by `RecommendationApprovalPolicy` eligibility | Creates Recommendation in `PendingReview` | `RecommendationGenerated` | Yes | No — generation itself is not approval |
| `ReviewRecommendation` | Recommendation is not already Approved/Rejected/Expired | Project role holder with review capability | Records review note, transitions to Reviewed | None catalogued | No | No |
| `ApproveRecommendation` | Recommendation is currently Reviewed (or PendingReview per policy) | Human actor holding `RecommendationApprovalPolicy` authority — **never an Agent identity** | Transitions to Approved; does **not** itself create a Decision (ADR-PMF-030) | `RecommendationApproved` | Yes | Yes |
| `RejectRecommendation` | Recommendation is not already Approved | Human actor holding `RecommendationApprovalPolicy` authority | Transitions to Rejected, records reason | `RecommendationRejected` | Yes | Yes |
| `RecordDecision` | Rationale non-empty; authority reference resolvable and sufficient for the Decision's scope | Human actor holding `DecisionAuthorityPolicy` authority for this scope — **never an Agent identity**, and never automatic from `ApproveRecommendation` (ADR-PMF-030) | Creates Decision, appends `decision_history`/`decision_authority` | `DecisionRecorded` | Yes | Yes |
| `RevokeDecision` | Decision is currently Active; reason required | Same or higher `DecisionAuthorityPolicy` authority as the original Decision | Marks Decision revoked via supersession record — rationale is never destructively edited (ADR-PMF-036) | `DecisionRevoked` | Yes | Yes |
| `CreateActionFromDecision` | Decision is currently Active; owner resolvable | Human actor holding `ActionCreationPolicy` authority — never automatic from `RecordDecision` (ADR-PMF-030) | Creates Action linked to Decision | `ActionCreated` | Yes | Per `ActionCreationPolicy` |
| `RecordOutcome` | Action is Completed or in a state permitting Outcome recording; evidence references resolvable | Actor authorized to validate Outcomes for the owning Project — distinct from the Action's completer (PR5 §18) | Creates Outcome, links Evidence/Action/Decision | `OutcomeRecorded` | Yes | No |

## 8. Intelligence Lifecycle — Enterprise Knowledge

| Command | Endpoint | Request (key fields) | Response |
|---|---|---|---|
| `ProposeEnterprisePattern` | `POST /enterprises/{enterpriseId}/knowledge:propose-pattern` | pattern description, supporting Evidence/Recommendation references | Pattern Candidate Response DTO |
| `RatifyEnterpriseKnowledge` | `POST /knowledge/{id}:ratify` | ratification note | Enterprise Knowledge Record Response DTO |
| `RevokeEnterpriseKnowledge` | `POST /knowledge/{id}:revoke` | revocation reason | Enterprise Knowledge Record Response DTO |

| Command | Validation | Authorization | Side Effects | Emitted Events | Idempotent | Human Approval |
|---|---|---|---|---|---|---|
| `ProposeEnterprisePattern` | Supporting evidence/lineage references resolvable | System/pipeline identity or human, gated by `KnowledgeElevationPolicy` eligibility | Creates Pattern Candidate | `EnterprisePatternProposed` | Yes | No — proposal is not ratification |
| `RatifyEnterpriseKnowledge` | Candidate passes all six elevation-gate criteria (evidence, confidence, review, lineage, applicability, ratification) and has explicit per-Workspace consent where cross-Workspace provenance applies | Human actor holding Enterprise Intelligence governance authority — **never an Agent identity, and never self-ratification of its own proposed Pattern by the same Agent Run** (PR4 AI-agent doc §14) | Creates Enterprise Knowledge Record (Enterprise-scoped) | `EnterpriseKnowledgeRatified` | Yes | Yes |
| `RevokeEnterpriseKnowledge` | Record is currently Ratified; reason required | Human actor holding Enterprise Intelligence governance authority | Marks record revoked via supersession, never destructively edited | `EnterpriseKnowledgeRevoked` | Yes | Yes |

## 9. Agent Orchestration

Per ADR-PMF-027's binding API implication, these four Commands are the **entire** agent-facing mutation surface — no endpoint permits an Agent identity to call any Command outside this set.

| Command | Endpoint | Request (key fields) | Response |
|---|---|---|---|
| `RequestAgentRun` | `POST /agent-runs:request` | agent reference, input context reference, scope (Workspace/Project) | Agent Run Response DTO |
| `CancelAgentRun` | `POST /agent-runs/{id}:cancel` | reason | Agent Run Response DTO |
| `ApproveAgentProposal` | `POST /agent-proposals/{id}:approve` | approval note (optional) | Recommendation Response DTO (the Proposal's converted form) |
| `RejectAgentProposal` | `POST /agent-proposals/{id}:reject` | rejection reason | Agent Proposal Response DTO |

| Command | Validation | Authorization | Side Effects | Emitted Events | Idempotent | Human Approval |
|---|---|---|---|---|---|---|
| `RequestAgentRun` | Agent reference resolvable; scope resolvable and within requester's own authorized scope | Requesting actor (human or service account); `AgentExecutionPolicy` must pass | Starts Agent Run pipeline (Workflow 9); Agent inherits requester's scope, never broader (PR4 §34) | `AgentRunRequested` (then system-emitted `AgentRunStarted`/`AgentRunCompleted`/`AgentRunFailed`) | Yes | No |
| `CancelAgentRun` | Run is currently in a cancellable state | Requesting actor who started the run, or Workspace Owner/Admin | Transitions run to Cancelled | None catalogued (terminal via run status) | Yes | No |
| `ApproveAgentProposal` | Proposal passed output validation; is currently Pending | Human actor with review capability — **never an Agent identity, including the Agent that produced the Proposal** | Converts Agent Proposal into a Recommendation via `GenerateRecommendation` — approving a Proposal is not itself `ApproveRecommendation` (ADR-PMF-030 remains binding downstream) | `RecommendationGenerated` | Yes | Yes |
| `RejectAgentProposal` | Proposal is currently Pending | Human actor with review capability | Discards Proposal, records reason | None catalogued | Yes | Yes |

---

## Notes on Gaps

Two intentional omissions, not oversights: (1) Action status-transition Commands beyond `CreateActionFromDecision` (completion, cancellation) are not individually catalogued in `04-command-query-event-catalog.md` — this catalog does not invent them; (2) Notification-preference and Integration-configuration Commands are not individually catalogued at the top level — both are recorded as open gaps in `06-api-resource-catalog.md` §18–19, deferred to PR9+ rather than resolved here.

## Validation Notes

Every Command name, owning aggregate, and emitted event in this catalog is taken verbatim from `04-command-query-event-catalog.md`. Endpoint paths, request/response DTO field lists, and the specific validation/authorization/idempotency statements are this PR's original contribution — the wire contract PR4 deliberately left unspecified.
