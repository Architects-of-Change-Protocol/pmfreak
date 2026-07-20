# PMFreak — Bounded Context Catalog (PR4)

Status: Ratified
Date: 2026-07-19
Companion to: `04-canonical-application-architecture.md` §10–§11
Authority: same order as the parent document.

This catalog gives full per-context detail for the twenty-five bounded contexts summarized in `04-canonical-application-architecture.md` §10. Each entry uses the same fixed format so that any future PR can extract exactly what it needs (PR5: aggregates/consistency; PR6: commands/queries; PR7: dependencies/prohibited responsibilities).

**Format:** Purpose · Ubiquitous language · Ownership · Aggregates · Commands · Queries · Events · Policies · Dependencies · Prohibited responsibilities · Consistency · Security scope · Extraction conditions · Example · Anti-example.

---

## 1. Identity and Access

- **Purpose:** Authenticate actors and resolve their membership, roles, and session scope for every other context.
- **Ubiquitous language:** Actor, Identity, Session, Membership, Role, Service Account.
- **Ownership:** User identity records, `workspace_memberships`-equivalent membership, role assignments.
- **Aggregates:** Membership (per actor per Workspace).
- **Commands:** (none in the catalog — identity commands, e.g. invite/accept membership, are Workspace Management commands that this context authorizes, not commands this context itself issues to the domain).
- **Queries:** (consumed internally by every other context's authorization coordination; not part of the public Query catalog in §14).
- **Events:** (none published to the domain event catalog; session lifecycle is an infrastructure concern, not a domain fact).
- **Policies:** WorkspaceIsolationPolicy is evaluated using this context's membership data as input.
- **Dependencies:** Identity Provider port (§19).
- **Prohibited responsibilities:** Must not encode business authorization rules beyond "who is this and what are they a member of" — role-to-permission mapping for a specific action belongs to the consuming context's policy.
- **Consistency:** Strong.
- **Security scope:** Highest — every other context's fail-closed guarantee depends on this context being correct.
- **Extraction conditions:** None identified; this is the least likely context to ever be extracted given how deeply every other context depends on it synchronously.
- **Example:** Resolving that Actor X is a member of Workspace A with role "PMO Admin" before PMO Governance evaluates a command.
- **Anti-example:** Identity and Access deciding "Actor X may approve this Recommendation" — that decision belongs to RecommendationApprovalPolicy in Recommendation Management, which merely *consumes* the role this context resolved.

## 2. Enterprise Administration

- **Purpose:** Own the Enterprise aggregate — the canonical root above Workspace (ADR-PMF-001).
- **Ubiquitous language:** Enterprise, Enterprise Admin, Enterprise Policy.
- **Ownership:** Enterprise.
- **Aggregates:** Enterprise.
- **Commands:** CreateEnterprise, UpdateEnterpriseProfile.
- **Queries:** GetEnterpriseOverview, GetEnterpriseHealth.
- **Events:** EnterpriseCreated.
- **Policies:** EnterpriseRatificationPolicy is defined here but exercised jointly with Enterprise Intelligence during knowledge ratification (§30 of the parent document).
- **Dependencies:** Identity and Access; Billing and Entitlements (entitlement checks); Enterprise Intelligence (read, for Enterprise-level knowledge display).
- **Prohibited responsibilities:** Must not directly manage Workspace membership or PMO configuration — those are downstream contexts' authority once an Enterprise exists.
- **Consistency:** Strong.
- **Security scope:** High — Enterprise is the isolation root; misconfiguration here has the widest blast radius short of Identity and Access itself.
- **Extraction conditions:** None identified.
- **Example:** CreateEnterprise for a consultancy that will manage multiple client Workspaces.
- **Anti-example:** Treating Enterprise as a billing plan tier — Enterprise is a structural aggregate, never a synonym for a subscription level (PR1 §15, §12 C-2).

## 3. Workspace Management

- **Purpose:** Own the Workspace aggregate — the operational, data, and access boundary (ADR-PMF-002).
- **Ubiquitous language:** Workspace, Workspace Owner, Workspace Policy, Tenant.
- **Ownership:** Workspace, Workspace-level policy configuration.
- **Aggregates:** Workspace.
- **Commands:** CreateWorkspace, ArchiveWorkspace, AssignWorkspaceMember, ChangeWorkspacePolicy.
- **Queries:** GetWorkspaceOverview, GetWorkspaceHealth-equivalent (via GetEnterpriseHealth rollup, §42).
- **Events:** WorkspaceCreated, WorkspacePolicyChanged.
- **Policies:** WorkspaceIsolationPolicy (owner; consumed by every other context).
- **Dependencies:** Enterprise Administration (parent, optional per progressive disclosure — ADR-PMF-012); Identity and Access.
- **Prohibited responsibilities:** Must not directly own PMO, Portfolio, Program, or Project data — it owns the boundary, not what's inside it.
- **Consistency:** Strong.
- **Security scope:** Highest operational scope — this is the RLS-equivalent tenancy boundary, live-tested in the current implementation (PR1 §16).
- **Extraction conditions:** None identified.
- **Example:** ArchiveWorkspace when a client relationship ends.
- **Anti-example:** Reusing the Workspace's `command_center_type`/`visibility_scope` fields to mean "Command Center" as an entity — Command Center is a projection (§9.5), never a Workspace-owned entity (PR1 §22).

## 4. PMO Governance

- **Purpose:** Own the PMO aggregate — the organizational governance entity (ADR-PMF-003).
- **Ubiquitous language:** PMO, PMO Admin, Governance Policy, Standards, Templates.
- **Ownership:** PMO.
- **Aggregates:** PMO.
- **Commands:** CreatePMO, UpdatePMOGovernancePolicy.
- **Queries:** GetPMOOverview, GetPMOHealth.
- **Events:** PMOCreated.
- **Policies:** MethodologyCompatibilityPolicy (co-owned with Configuration and Methodology).
- **Dependencies:** Workspace Management (parent); Portfolio Management, Program Management, Project Management (children, read/command relationship).
- **Prohibited responsibilities:** Must not double as an invisible universal default that every Project is silently forced into (PR1.1 §11 Contract: "no invisible universal default PMO as a technical requirement").
- **Consistency:** Strong.
- **Security scope:** High.
- **Extraction conditions:** None identified.
- **Example:** CreatePMO to establish standards and governance across a Workspace's Portfolios and Programs.
- **Anti-example:** "Create Command Center" as a button that actually creates a PMO without naming what it creates — a currently-real defect this architecture's naming discipline (§7.3 principle set) is meant to prevent going forward (PR1 §22).

## 5. Portfolio Management

- **Purpose:** Own the Portfolio aggregate — a strategic entity for prioritization, capacity, and investment grouping (ADR-PMF-004).
- **Ubiquitous language:** Portfolio, Primary Portfolio, Strategic Alignment.
- **Ownership:** Portfolio.
- **Aggregates:** Portfolio.
- **Commands:** CreatePortfolio, AssignProjectToPortfolio, RemoveProjectFromPortfolio.
- **Queries:** GetPortfolioOverview, GetPortfolioHealth.
- **Events:** PortfolioCreated, ProjectAssignedToPortfolio.
- **Policies:** PortfolioEligibilityPolicy (owner — enforces "at most one primary Portfolio per Project/Program," PR1.1 invariant 13).
- **Dependencies:** PMO Governance (parent); Program Management, Project Management (optional children).
- **Prohibited responsibilities:** Must not become a folder/tag/label for "all projects" — it must carry genuine strategic semantics (PR1.1 §12 Contract).
- **Consistency:** Strong (membership) / Eventual (health projections).
- **Security scope:** Standard Workspace-scoped.
- **Extraction conditions:** None identified.
- **Example:** AssignProjectToPortfolio when a Project is prioritized within a strategic investment grouping.
- **Anti-example:** Reusing `personal_portfolios` (a per-user saved-project list) as if it were this aggregate — that is an unrelated, real, per-user watchlist concept (PR1 §18), not the PMI Portfolio.

## 6. Program Management

- **Purpose:** Own the Program aggregate — coordination of related Projects for joint benefits (ADR-PMF-005).
- **Ubiquitous language:** Program, Primary Program, Roadmap, Epic, Sprint, Card (Program-tree-internal).
- **Ownership:** Program, and the Program-internal roadmap tree (Epic/Sprint/Card).
- **Aggregates:** Program.
- **Commands:** CreateProgram, AssignProjectToProgram, RemoveProjectFromProgram, CreateProgramEpic, CreateProgramSprint, CreateProgramCard, MoveProgramCard, SubmitRoadmapSource, ParseRoadmapSource, MaterializeRoadmap. The roadmap-tree commands (`04-command-query-event-catalog.md` §5.2a) exist specifically because this context's ownership already includes the Epic/Sprint/Card tree and the roadmap-parsing pipeline — a real, implemented capability (PR1 §19, §29–31) that the original catalog omitted, leaving it an uncatalogued write path in violation of ADR-PMF-025.
- **Queries:** GetProgramOverview, GetProgramHealth.
- **Events:** ProgramCreated, ProjectAssignedToProgram, RoadmapMaterialized.
- **Policies:** ProgramMembershipPolicy (owner — enforces "at most one primary Program per Project," PR1.1 invariant 17).
- **Dependencies:** PMO Governance (parent); Portfolio Management (optional parent); Project Management (children).
- **Prohibited responsibilities:** Must not be deleted or treated as dead weight for being currently disconnected from Project/PMO in the existing implementation — PR1.1 explicitly classifies this as "incomplete integration," not duplication (PR1 §19, PR1.1 §13 Contract).
- **Consistency:** Strong (membership) / Eventual (health).
- **Security scope:** Standard Workspace-scoped.
- **Extraction conditions:** None identified.
- **Example:** A roadmap-parsing capability producing Epics/Sprints/Cards inside a Program that coordinates three related Projects.
- **Anti-example:** Conflating Program with Portfolio — Program coordinates *related Projects for joint benefits*; Portfolio prioritizes *investment across possibly-unrelated Projects* (PR1.1 invariant 15).

## 7. Project Management

- **Purpose:** Own the Project aggregate — the central, best-implemented unit of execution (ADR-PMF-006).
- **Ubiquitous language:** Project, Project Owner, Project Context, Methodology.
- **Ownership:** Project.
- **Aggregates:** Project.
- **Commands:** CreateProject, UpdateProjectContext, ArchiveProject, ConfigureProjectMethodology.
- **Queries:** GetProjectOverview, GetProjectCommandCenter, GetProjectHealth.
- **Events:** ProjectCreated, ProjectArchived, ProjectMethodologyConfigured.
- **Policies:** ProjectAssignmentPolicy (owner), ProjectHealthPolicy (owner, consumed by Reporting).
- **Dependencies:** Workspace Management (parent, mandatory); PMO Governance, Portfolio Management, Program Management (optional parents); Work Execution, Schedule and Milestones, RAID Management, Stakeholder and Communication Management, Document and Evidence Management, Project Memory (children).
- **Prohibited responsibilities:** Must never let the hierarchy above it (PMO/Portfolio/Program) block fast Project creation — this is a binding invariant, not a UX preference (PR1.1 §14 Contract).
- **Consistency:** Strong.
- **Security scope:** Standard Workspace-scoped; the most heavily depended-upon context beneath Workspace.
- **Extraction conditions:** None identified.
- **Example:** CreateProject directly under a Workspace with no PMO assigned, per the Independent PM configuration (PR1.1 §20 Contract).
- **Anti-example:** Presenting three different UI names (Project/Context/Initiative) for this one aggregate — a known, unfixed naming inconsistency this document does not resolve (semantics only; UI-copy consolidation is future-PR work, PR1.1 D-06/D-19).

## 8. Work Execution

- **Purpose:** Track assignable, trackable units of work inside a Project.
- **Ubiquitous language:** Task, Assignee, Deliverable.
- **Ownership:** Task.
- **Aggregates:** Task.
- **Commands:** CreateTask, AssignTask, UpdateTaskStatus, CompleteTask.
- **Queries:** (surfaced via GetProjectCommandCenter; no standalone top-level query beyond the Project projection).
- **Events:** TaskCreated, TaskCompleted.
- **Policies:** (none owned; consumes ProjectHealthPolicy's inputs).
- **Dependencies:** Project Management (parent).
- **Prohibited responsibilities:** Must not be conflated with the Program-tree "Card" concept, which is a separate, methodology-specific work-item abstraction (PR1 §21).
- **Consistency:** Strong (writes) / Eventual (projections).
- **Security scope:** Standard Project-scoped.
- **Extraction conditions:** None identified.
- **Example:** CreateTask "Draft the vendor contract" inside a Project.
- **Anti-example:** Presenting a Program-tree Card as a Task in user-facing copy without qualification (PR2, Task definition, anti-example).

## 9. Schedule and Milestones

- **Purpose:** Represent dated, cross-methodology checkpoints in a Project's timeline.
- **Ubiquitous language:** Milestone, Baseline Date, Forecast Date, Timeline.
- **Ownership:** Milestone.
- **Aggregates:** Milestone.
- **Commands:** CreateMilestone, CompleteMilestone.
- **Queries:** (surfaced via GetProjectCommandCenter and Timeline cross-scope screen).
- **Events:** MilestoneCompleted.
- **Policies:** MethodologyCompatibilityPolicy applies here in reverse: Milestone must remain visible regardless of methodology (ADR-PMF-011 rule 9 — Milestone is not gated the way Sprint/Epic are).
- **Dependencies:** Project Management (parent).
- **Prohibited responsibilities:** Must not be reconciled silently with the Program-tree's `type='MILESTONE'` Card — these remain two distinct, currently-unreconciled representations pending future-PR verification work (PR1 §21, PR1.1 §19 Contract).
- **Consistency:** Strong.
- **Security scope:** Standard Project-scoped.
- **Extraction conditions:** None identified.
- **Example:** CompleteMilestone "Phase 1 sign-off" on a predictive-methodology Project with no Sprints at all.
- **Anti-example:** Making Milestone visibility conditional on methodology the way Sprint/Epic visibility is (PR2, Milestone definition, anti-example).

## 10. RAID Management

- **Purpose:** Track Risks, Issues, and Dependencies for a Project (or Workspace-level, when unattached).
- **Ubiquitous language:** Risk, Issue, Dependency, RAID.
- **Ownership:** Risk, Issue, Dependency.
- **Aggregates:** Risk, Issue, Dependency.
- **Commands:** RecordRisk, UpdateRiskAssessment, CloseRisk, RecordIssue, ResolveIssue.
- **Queries:** (surfaced via GetProjectCommandCenter and Health projections).
- **Events:** RiskRecorded, RiskClosed, IssueRecorded, IssueResolved.
- **Policies:** (feeds ProjectHealthPolicy; does not own it).
- **Dependencies:** Project Management (parent, optional link — a RAID item may be Workspace-scoped with `project_id` null).
- **Prohibited responsibilities:** Must not let a materialized Risk remain logged only as a Risk instead of being converted to an Issue once it occurs (PR2, Risk definition, anti-example).
- **Consistency:** Strong.
- **Security scope:** Standard Project/Workspace-scoped.
- **Extraction conditions:** None identified.
- **Example:** RecordIssue "Vendor missed delivery date" after a previously-tracked Risk materializes.
- **Anti-example:** Logging a not-yet-occurred concern as an Issue instead of a Risk (PR2, Issue definition, anti-example).

## 11. Stakeholder and Communication Management

- **Purpose:** Track Project stakeholders and the communications directed at them.
- **Ubiquitous language:** Stakeholder, Communication.
- **Ownership:** Stakeholder record.
- **Aggregates:** Stakeholder record.
- **Commands:** AddProjectStakeholder. This context, not Project Management, exposes and handles the command — it targets the Stakeholder record aggregate this context owns (§12 of the parent document), not the Project aggregate itself, per ADR-PMF-024's rule that a cross-context mutation is directed to the owning context.
- **Queries:** (surfaced via GetProjectCommandCenter).
- **Events:** (none in the top-level catalog; internal to this context today, integration-event candidate once external communication channels are wired — §44).
- **Policies:** (none owned).
- **Dependencies:** Project Management (parent); Integration Management (external channel adapters, via ACL).
- **Prohibited responsibilities:** Must not become the system of record for a full CRM — stakeholder tracking here is Project-scoped operational context, not a sales/marketing contact database.
- **Consistency:** Strong (writes) / Eventual (digest views).
- **Security scope:** Standard Project-scoped; may hold PII.
- **Extraction conditions:** None identified.
- **Example:** Recording a sponsor as a Stakeholder with a communication preference.
- **Anti-example:** Sending an external communication directly from this context without going through Notification Management and its channel-delivery separation (§45).

## 12. Document and Evidence Management

- **Purpose:** Own Evidence — source material substantiating a fact, Decision, or Recommendation.
- **Ubiquitous language:** Evidence, Source, Provenance.
- **Ownership:** Evidence.
- **Aggregates:** Evidence.
- **Commands:** SubmitEvidence, NormalizeSource.
- **Queries:** (surfaced via GetProjectIntelligenceFeed and Project Memory retrieval).
- **Events:** EvidenceSubmitted, EvidenceNormalized.
- **Policies:** EvidenceTrustPolicy (owner).
- **Dependencies:** Project Management (parent); Integration Management (ingestion sources, via ACL); Project Memory, Recommendation Management, Decision Management, Audit and Compliance (consumers).
- **Prohibited responsibilities:** Must not treat an unlinked file upload as "Evidence" when it substantiates no specific claim (PR2, Evidence definition, anti-example).
- **Consistency:** Strong (linkage) / Eventual (normalization pipeline).
- **Security scope:** High — Evidence may contain confidential source material and is a required input to the Knowledge Elevation gate (§30).
- **Extraction conditions:** None identified.
- **Example:** SubmitEvidence for an uploaded vendor contract, later cited as support for a cost Decision.
- **Anti-example:** Treating chat messages as Evidence automatically the moment they are typed — chat is one ingestion source among several, never automatically authoritative (PR1 §24, "chat-to-memory boundary, confirmed intact").

## 13. Recommendation Management

- **Purpose:** Own Recommendations — Agent- or governance-produced suggestions requiring explicit human review.
- **Ubiquitous language:** Recommendation, Confidence, Review.
- **Ownership:** Recommendation.
- **Aggregates:** Recommendation.
- **Commands:** CreateRecommendationFromProposal, ReviewRecommendation, ApproveRecommendation, RejectRecommendation. `CreateRecommendationFromProposal` is this context's own command — it is triggered by consuming Agent Orchestration's `AgentProposalApproved` event, never by Agent Orchestration writing to this context's aggregate directly (that would violate ADR-PMF-024's one-owner rule). There is no directly Agent-issuable command that creates a Recommendation without the prior human-gated `ApproveAgentProposal` step (§18 below; ADR-PMF-027, ADR-PMF-030).
- **Queries:** ListRecommendations, GetRecommendationDetails.
- **Events:** RecommendationGenerated, RecommendationApproved, RecommendationRejected.
- **Policies:** RecommendationApprovalPolicy (owner).
- **Dependencies:** Agent Orchestration (upstream producer, via the `AgentProposalApproved` → `CreateRecommendationFromProposal` Open Host Service contract); Document and Evidence Management (evidence references); Decision Management (downstream).
- **Prohibited responsibilities:** Must never auto-convert a Recommendation into a Decision — that conversion is always a separate, explicit act (ADR-PMF-008, ADR-PMF-030). Must never accept a Recommendation created by any path other than its own `CreateRecommendationFromProposal`, and never let another context write to the Recommendation aggregate directly.
- **Consistency:** Strong.
- **Security scope:** Standard Project-scoped; governs the human-authority boundary for AI output.
- **Extraction conditions:** None identified.
- **Example:** `CreateRecommendationFromProposal`, triggered by Agent Orchestration's `ApproveAgentProposal` approving a reviewed Proposal — "Consider reallocating budget from Task X to Task Y" — from the Cost Governance Agent, materializes it as a Recommendation.
- **Anti-example:** An Agent writing directly to an authoritative table without a Recommendation/Decision step in between (PR2, Recommendation definition, anti-example).

## 14. Decision Management

- **Purpose:** Own Decisions — distinct, attributable choices made by a human or governed process.
- **Ubiquitous language:** Decision, Authority, Rationale, Revocation.
- **Ownership:** Decision.
- **Aggregates:** Decision.
- **Commands:** RecordDecision, RevokeDecision.
- **Queries:** ListDecisions, GetDecisionDetails.
- **Events:** DecisionRecorded, DecisionRevoked.
- **Policies:** DecisionAuthorityPolicy (owner).
- **Dependencies:** Recommendation Management (upstream, optional — a Decision need not originate from a Recommendation); Action and Outcome Management (downstream); Audit and Compliance.
- **Prohibited responsibilities:** Must never allow destructive editing of a recorded Decision — corrections are made only by superseding, preserving full history (PR1.1 §27, invariant 29 restated).
- **Consistency:** Strong.
- **Security scope:** High — this is the authoritative governance record for the whole Recommendation-to-Outcome pipeline.
- **Extraction conditions:** None identified.
- **Example:** RecordDecision "Approved: extend Project timeline by two weeks."
- **Anti-example:** Treating an Agent's Recommendation as if it were already a Decision (PR2, Decision definition, anti-example).

## 15. Action and Outcome Management

- **Purpose:** Own Actions (execution of a Decision) and Outcomes (what actually happened).
- **Ubiquitous language:** Action, Outcome, Observation, Effectiveness.
- **Ownership:** Action, Outcome.
- **Aggregates:** Action, Outcome.
- **Commands:** CreateActionFromDecision, CompleteAction, CancelAction, RecordOutcome.
- **Queries:** ListActions, ListOutcomes.
- **Events:** ActionCreated, ActionCompleted, OutcomeRecorded.
- **Policies:** ActionCreationPolicy (owner).
- **Dependencies:** Decision Management (upstream, mandatory); Project Management (execution context); Enterprise Intelligence (downstream, via elevation only).
- **Prohibited responsibilities:** Must never treat Action completion as proof of Outcome — effectiveness requires separate observation (PR1.1 §28, invariant 30 restated).
- **Consistency:** Strong.
- **Security scope:** Standard Project-scoped.
- **Extraction conditions:** None identified.
- **Example:** RecordOutcome "Task Y completed one week early after reassignment" following the Action it resulted from.
- **Anti-example:** Recording an Action as its own Outcome with no observation step (PR2, Outcome definition, anti-example).

## 16. Project Memory

- **Purpose:** Own the governed, structured, traceable curated layer of Project knowledge (ADR-PMF-009).
- **Ubiquitous language:** Memory Record, Provenance, Lineage, Confidence, Validation Status, Supersession.
- **Ownership:** Project Memory Record.
- **Aggregates:** Project Memory Record.
- **Commands:** ProposeMemoryRecord, ApproveMemoryRecord, RejectMemoryRecord.
- **Queries:** GetProjectMemory.
- **Events:** MemoryRecordProposed, MemoryRecordApproved.
- **Policies:** (consumes KnowledgeElevationPolicy as its downstream gate; does not own it).
- **Dependencies:** Project Management (parent); Document and Evidence Management, Stakeholder and Communication Management (inputs); Agent Orchestration (consumer, via governed retrieval only — ACL required, §11).
- **Prohibited responsibilities:** Must never treat chat history as automatically authoritative memory the moment it's typed (PR2, Project Memory definition, anti-example); must never let the vector store or embeddings substitute for the canonical record.
- **Consistency:** Strong (governance) / Eventual (retrieval projection).
- **Security scope:** High — this is the trusted layer Agents and future Enterprise Intelligence elevation both depend on.
- **Extraction conditions:** None identified.
- **Example:** ApproveMemoryRecord for a confirmed scope change, with source, date, and confidence attached.
- **Anti-example:** Presenting a chat transcript as "the Project's memory" (PR2, Chat History definition, anti-example).

## 17. Enterprise Intelligence

- **Purpose:** Own governed, cross-Workspace-provenanced organizational knowledge, conceptually belonging to Enterprise (ADR-PMF-010).
- **Ubiquitous language:** Enterprise Knowledge Record, Candidate Pattern, Ratified Pattern, Ratification, Elevation.
- **Ownership:** Enterprise Knowledge Record, Pattern (Candidate/Ratified).
- **Aggregates:** Enterprise Knowledge Record, Pattern.
- **Commands:** ProposeEnterprisePattern, RatifyEnterpriseKnowledge, RevokeEnterpriseKnowledge.
- **Queries:** GetEnterpriseIntelligence, GetKnowledgeLineage.
- **Events:** EnterprisePatternProposed, EnterpriseKnowledgeRatified, EnterpriseKnowledgeRevoked.
- **Policies:** KnowledgeElevationPolicy (owner), EnterpriseRatificationPolicy (owner).
- **Dependencies:** Project Memory, Document and Evidence Management, Portfolio/Program/PMO Management (aggregation sources, all via anti-corruption layer, §11); Enterprise Administration (scope owner).
- **Prohibited responsibilities:** Must never let one Workspace's raw data be queried from another Workspace "because they share an Enterprise" (PR2, Enterprise Intelligence definition, anti-example); must never auto-elevate a Candidate Pattern to Ratified.
- **Consistency:** Strong (ratification gate) / Eventual (projections).
- **Security scope:** Highest — this is the one context whose entire purpose is to cross a boundary every other context is built to never cross, and it may only do so through the six-part gate (§30).
- **Extraction conditions:** Plausible only under a demonstrated regulatory need to physically isolate cross-tenant learning from operational data — not assumed by this PR.
- **Example:** RatifyEnterpriseKnowledge for a cost-overrun risk-factor pattern, elevated with full lineage back to its originating Projects.
- **Anti-example:** Any mechanism that lets Enterprise Intelligence become a generic vector store queried without the ratification gate (PR2, Enterprise Intelligence definition, anti-example).

## 18. Agent Orchestration

- **Purpose:** Run the governed AI/agent execution pipeline; own Agent Runs and Agent Proposals (ADR-PMF-027).
- **Ubiquitous language:** Agent, Agent Run, Agent Proposal, Tool, Context Assembly.
- **Ownership:** Agent Run, Agent Proposal.
- **Aggregates:** Agent Run, Agent Proposal.
- **Commands:** RequestAgentRun, CancelAgentRun, ApproveAgentProposal, RejectAgentProposal.
- **Queries:** GetAgentRun, ListAgentRuns.
- **Events:** AgentRunRequested, AgentRunStarted, AgentRunCompleted, AgentRunFailed, AgentProposalApproved.
- **Policies:** AgentExecutionPolicy (owner).
- **Dependencies:** Project Memory (governed retrieval only, ACL); Document and Evidence Management (evidence references); Recommendation Management (downstream, via the `AgentProposalApproved` Open Host Service contract — this context never writes to Recommendation Management's aggregate itself, only to the Agent Proposal it owns); AI Model Provider, Embedding Provider ports.
- **Prohibited responsibilities:** Must never write directly to any authoritative aggregate outside this context — its only output is an Agent Proposal (§12 rule 4, full pipeline in `04-ai-agent-application-architecture.md`). `ApproveAgentProposal` mutates only the Agent Proposal aggregate this context owns; it must never itself create a Recommendation Management-owned Recommendation — that materialization is Recommendation Management's own `CreateRecommendationFromProposal` command, triggered by the `AgentProposalApproved` event this command emits.
- **Consistency:** Strong (approval gate) / Eventual (run telemetry).
- **Security scope:** High — this context is the primary prompt-injection and tool-abuse attack surface (§36).
- **Extraction conditions:** Plausible under a demonstrated compliance need to run agent execution in an isolated blast radius, or under sustained model-call volume the shared deployment cannot absorb.
- **Example:** RequestAgentRun for the Cost Governance Agent, producing a typed assessment routed to Recommendation Management as an Agent Proposal.
- **Anti-example:** An Agent invoking a tool that writes to `project_decisions` directly, bypassing the Proposal → Recommendation → Decision chain.

## 19. Integration Management

- **Purpose:** Adapt external systems into normalized contracts PMFreak's domain can consume.
- **Ubiquitous language:** Integration, Adapter, Anti-Corruption Layer, Sync.
- **Ownership:** Integration connection/configuration, sync state.
- **Aggregates:** Integration connection.
- **Commands:** (integration-specific; not enumerated in the top-level catalog — each integration defines its own commands within this context's boundary).
- **Queries:** (integration-specific; surfaced via the Integrations administration screen).
- **Events:** (integration-specific integration events; each must be versioned per §21).
- **Policies:** (integration-specific rate-limit/conflict policies, owned per-integration within this context).
- **Dependencies:** Document and Evidence Management, Stakeholder and Communication Management, Work Execution (downstream consumers, all via ACL).
- **Prohibited responsibilities:** Must never let an external system's raw shape reach a domain command directly — every integration payload passes through this context's anti-corruption layer first (§11, §44).
- **Consistency:** Eventual.
- **Security scope:** High — external credentials, webhook authenticity, and data classification of inbound payloads are all in scope.
- **Extraction conditions:** Plausible given this context's release cadence is driven by external providers, not PMFreak's own roadmap.
- **Example:** A Jira sync adapter normalizing an external issue into a `SubmitEvidence` command against Document and Evidence Management.
- **Anti-example:** A webhook handler writing directly into `raid_items` without passing through RAID Management's own Command Handler and its authorization/invariant checks.

## 20. Notification Management

- **Purpose:** Deliver notification intents to user-preferred channels.
- **Ubiquitous language:** Notification Intent, Channel, Delivery Record, Preference.
- **Ownership:** Notification intent, delivery record.
- **Aggregates:** Notification intent.
- **Commands:** (notification-specific; not part of the top-level Command catalog since notifications are produced from consumed events, not directly actor-issued).
- **Queries:** (surfaced via in-app notification UI; not part of the top-level Query catalog).
- **Events:** (consumes RecommendationGenerated, DecisionRecorded, and other integration events; publishes none upstream).
- **Policies:** (per-user delivery preference resolution; no cross-cutting policy owned).
- **Dependencies:** Recommendation Management, Decision Management, Action and Outcome Management (event sources); Email/Calendar/Notification ports.
- **Prohibited responsibilities:** Must never be triggered directly from an aggregate — notifications are always produced by subscribing to an integration event, never called synchronously inside a command handler (§45).
- **Consistency:** Eventual.
- **Security scope:** Standard; may carry PII in delivery payloads.
- **Extraction conditions:** None identified.
- **Example:** Delivering an in-app notification when a Recommendation is generated for a Project the actor follows.
- **Anti-example:** A Decision Management command handler calling an email adapter directly instead of publishing `DecisionRecorded` for this context to consume.

## 21. Reporting and Analytics

- **Purpose:** Produce cross-entity reports, health rollups, and exports.
- **Ubiquitous language:** Report, Health, Export.
- **Ownership:** Report definitions and runs.
- **Aggregates:** Report definition/run (not a domain aggregate in the ownership sense — a projection-adjacent service).
- **Commands:** (report generation triggers; not part of the top-level Command catalog).
- **Queries:** (all Health queries in §14 are sourced from this context's projections, though "owned" per-scope by the originating context per §42).
- **Events:** (consumes events from every operational context; publishes none upstream).
- **Policies:** (consumes ProjectHealthPolicy and equivalent per-scope policies; does not own them).
- **Dependencies:** Project, Program, Portfolio, PMO, Enterprise Management contexts (read-only, via projections).
- **Prohibited responsibilities:** Must never become a second source of truth for any figure it reports — every report must be regenerable from source aggregates (§9.5, §43).
- **Consistency:** Eventual.
- **Security scope:** Standard; exports are an audited operation (§41).
- **Extraction conditions:** None identified.
- **Example:** GetPortfolioHealth aggregating Project-level health signals into a Portfolio rollup.
- **Anti-example:** A report value that cannot be traced back to the operational aggregate that produced it.

## 22. Audit and Compliance

- **Purpose:** Maintain the immutable audit trail across every context.
- **Ubiquitous language:** Audit Record, Actor, Authority, Correlation.
- **Ownership:** Audit Record.
- **Aggregates:** Audit Record (append-only).
- **Commands:** (audit records are appended as a side effect of every command handler, §15 — not independently actor-issued).
- **Queries:** GetAuditTrail.
- **Events:** (consumes every domain and integration event listed in §20–§21 of the parent document).
- **Policies:** DataRetentionPolicy (co-owned with Configuration and Methodology, enforced per-record-type here).
- **Dependencies:** Every context (as an event/audit-write consumer); Audit Sink port.
- **Prohibited responsibilities:** Must never expose an update or delete path on a written audit record (§18, §36).
- **Consistency:** Strong / durable.
- **Security scope:** Highest — tamper-evidence is the entire point of this context.
- **Extraction conditions:** Plausible under a demonstrated regulatory need for physically isolated, independently-retained audit storage.
- **Example:** An audit record capturing actor, action, target, before/after, timestamp, scope, and authority for a RevokeDecision command.
- **Anti-example:** An administrative "fix" script that edits a historical audit record instead of appending a correcting entry.

## 23. Billing and Entitlements

- **Purpose:** Own billing accounts, plans, and feature entitlements.
- **Ubiquitous language:** Plan, Entitlement, Usage.
- **Ownership:** Billing account, entitlement.
- **Aggregates:** Billing account.
- **Commands:** (billing-specific; not part of the top-level Command catalog — owned within this context).
- **Queries:** (entitlement checks consumed internally by other contexts' authorization coordination; not part of the top-level Query catalog).
- **Events:** (billing-provider webhook-derived events, integration-event candidates per §21).
- **Policies:** (entitlement resolution policy, owned here).
- **Dependencies:** Enterprise Administration, Workspace Management (entitlement targets); Billing Provider port.
- **Prohibited responsibilities:** Must never let a billing plan value stand in for the Enterprise aggregate — the current dead `plan='enterprise'` enum value is exactly this anti-pattern and is not carried forward as architecture (PR1 §12 C-2, §15).
- **Consistency:** Strong.
- **Security scope:** High — payment and entitlement data.
- **Extraction conditions:** None identified.
- **Example:** Resolving whether a Workspace's plan entitles it to the PMO capability tier.
- **Anti-example:** Using "enterprise" as a plan tier name interchangeably with the Enterprise domain aggregate.

## 24. Search and Discovery

- **Purpose:** Provide full-text and semantic retrieval over operational and knowledge data.
- **Ubiquitous language:** Search Index, Semantic Retrieval, Relevance.
- **Ownership:** Search/vector indexes (strictly derived).
- **Aggregates:** (none — this context owns no aggregate; it owns derived, rebuildable indexes only).
- **Commands:** (index maintenance is asynchronous and internal; not part of the top-level Command catalog).
- **Queries:** SearchWorkspace, SearchProject.
- **Events:** (consumes events from every indexed context; publishes none upstream).
- **Policies:** (consumes sensitivity classification from source contexts; owns no policy).
- **Dependencies:** Project Management, Project Memory, Enterprise Intelligence, Document and Evidence Management (index sources).
- **Prohibited responsibilities:** Must never be treated as a source of truth (§9.5, §43); must never return a semantic-retrieval result without a provenance reference back to the canonical record.
- **Consistency:** Eventual.
- **Security scope:** Standard, but must respect the sensitivity classification of everything it indexes.
- **Extraction conditions:** Plausible given independent scalability characteristics of indexing at volume.
- **Example:** SearchProject returning a semantic match to a Project Memory Record, with that record's canonical id attached.
- **Anti-example:** A vector-store result presented to a user or Agent with no reference back to the record it was derived from.

## 25. Configuration and Methodology

- **Purpose:** Own precedence-governed configuration and Project methodology selection.
- **Ubiquitous language:** Configuration, Policy Precedence, Methodology, Feature Entitlement, Feature Flag.
- **Ownership:** Configuration values, methodology selection.
- **Aggregates:** (configuration is a cross-cutting value set attached to the owning entity — Enterprise/Workspace/PMO/Project — not an independent aggregate of its own).
- **Commands:** ConfigureProjectMethodology is issued through Project Management's catalog against the Project aggregate; policy-level configuration commands are issued through each owning context (ChangeWorkspacePolicy, UpdatePMOGovernancePolicy, etc.).
- **Queries:** (configuration reads are embedded in each owning context's overview query; no standalone top-level query).
- **Events:** (WorkspacePolicyChanged and equivalent per-scope events are published by the owning context, not this one).
- **Policies:** MethodologyCompatibilityPolicy (owner, co-exercised with PMO Governance and Schedule and Milestones), DataRetentionPolicy (owner, co-exercised with Audit and Compliance).
- **Dependencies:** Enterprise Administration, Workspace Management, PMO Governance, Project Management (precedence chain, §46 of the parent document).
- **Prohibited responsibilities:** Must never let a lower-precedence configuration (Project, User) weaken a higher one (Enterprise, Workspace, PMO, or a security/legal constraint) — this precedence is absolute (§46).
- **Consistency:** Strong.
- **Security scope:** Standard, but security/legal-constraint-tier configuration is highest.
- **Extraction conditions:** None identified.
- **Example:** A Project selecting the "agile" methodology, which enables Sprint/Epic visibility but does not alter the Project's identity, security, or audit behavior (§47).
- **Anti-example:** A User Preference silently overriding a Workspace-level confidentiality policy.
