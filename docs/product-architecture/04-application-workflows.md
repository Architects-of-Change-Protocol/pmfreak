# PMFreak — Application Workflows (PR4)

Status: Ratified
Date: 2026-07-19
Companion to: `04-canonical-application-architecture.md` §25, §22, §39
Authority: same order as the parent document.

Every workflow below is a long-running, explicit-state process (`04-canonical-application-architecture.md` §7.3 principle 29 — "Long-Running Workflows Require Explicit State"). None is implemented by this PR. Each follows the generic state shape in the parent document's §62.11 diagram unless noted.

**Format per workflow:** Trigger · Actors · States · Commands involved · Events involved · Policies · Retries · Timeouts · Compensation · Audit · Security · Terminal states.

---

## 1. Document Ingestion

- **Trigger:** `SubmitEvidence` command (user upload or Integration Management adapter).
- **Actors:** Project member, or an Integration Management adapter acting under a service-account identity.
- **States:** `Requested → Uploading → Uploaded → QueuedForNormalization → Normalizing → Normalized → Failed`.
- **Commands involved:** `SubmitEvidence`, `NormalizeSource`.
- **Events involved:** `EvidenceSubmitted`, `EvidenceNormalized`.
- **Policies:** `EvidenceTrustPolicy` classifies the source before normalization begins.
- **Retries:** 3x exponential backoff on transient storage/parsing errors.
- **Timeouts:** 5 minutes end-to-end; exceeding it transitions to `Failed` with a surfaced status, not a silent hang.
- **Compensation:** none required for a failed ingestion — the Evidence record remains in `Failed` state, re-triggerable manually; no partial Evidence is exposed as usable.
- **Audit:** `EvidenceSubmitted` and `EvidenceNormalized` are both audited with source, actor/adapter identity, and checksum.
- **Security:** content-classification and malware/format validation occur before an uploaded file is linked to any Project; EvidenceTrustPolicy result is recorded.
- **Terminal states:** `Normalized` (success), `Failed` (requires manual re-trigger, not auto-retried indefinitely).

## 2. Evidence Normalization

- **Trigger:** `EvidenceSubmitted` (chained from Document Ingestion) or a direct re-normalization request.
- **Actors:** System (workflow step) — no human actor in the nominal path.
- **States:** `Pending → Parsing → Structuring → Linked → Failed`.
- **Commands involved:** `NormalizeSource`.
- **Events involved:** `EvidenceNormalized`.
- **Policies:** `EvidenceTrustPolicy`.
- **Retries:** 3x, 2-minute cap per attempt.
- **Timeouts:** 2 minutes per attempt, 10 minutes total before manual escalation.
- **Compensation:** on repeated failure, Evidence remains in raw/unstructured form, visible as such — never silently promoted to "normalized" with partial data.
- **Audit:** structuring outcome and confidence recorded.
- **Security:** no cross-Workspace parsing service state is retained between runs.
- **Terminal states:** `Linked` (feeds Project Memory candidate proposal), `Failed`.

## 3. Recommendation Generation

- **Trigger:** `RequestAgentRun`, or a scheduled Agent Configuration trigger.
- **Actors:** Agent Orchestration (system), consuming actor who requested the run.
- **States:** `Requested → ContextAssembled → PolicyEvaluated → Retrieved → ModelInvoked → Validated → Proposed → Failed`.
- **Commands involved:** `RequestAgentRun`. Proposal creation is an internal pipeline step within the run, not a separate top-level Command — there is no directly Agent-issuable command that creates a Recommendation (see the note at the end of `04-command-query-event-catalog.md` §5.7).
- **Events involved:** `AgentRunRequested`, `AgentRunStarted`, `AgentRunCompleted` / `AgentRunFailed`. This workflow does not itself emit `RecommendationGenerated` — that event is produced only after the separate, human-gated `ApproveAgentProposal` command (Workflow 9, emitting `AgentProposalApproved`) is followed by Recommendation Management's own `CreateRecommendationFromProposal`, which is what actually triggers Workflow 4.
- **Policies:** `AgentExecutionPolicy`.
- **Retries:** model/tool calls retry per `04-ai-agent-application-architecture.md` §11; the workflow itself does not retry a rejected Proposal.
- **Timeouts:** per `AgentExecutionPolicy` (a bounded per-Agent-Definition ceiling).
- **Compensation:** a failed run produces `AgentRunFailed` with no domain effect — nothing to compensate.
- **Audit:** full Agent Run record (`04-ai-agent-application-architecture.md` §4).
- **Security:** context assembly is Workspace/Project-scoped only; tool invocations are allowlist-checked at each step.
- **Terminal states:** `Proposed` (an Agent Proposal awaiting `ApproveAgentProposal`/`RejectAgentProposal` per Workflow 9 — only approval hands off to Workflow 4), `Failed`.

## 4. Recommendation Review and Approval

- **Trigger:** `RecommendationGenerated`.
- **Actors:** Authorized Project member (reviewer).
- **States:** `PendingReview → Reviewed → Approved | Rejected → Superseded | Expired`.
- **Commands involved:** `ReviewRecommendation`, `ApproveRecommendation`, `RejectRecommendation`.
- **Events involved:** `RecommendationApproved`, `RecommendationRejected`.
- **Policies:** `RecommendationApprovalPolicy`.
- **Retries:** not applicable — this is a human-paced governance step, not a retryable technical operation.
- **Timeouts:** a Recommendation not reviewed within its configured window transitions to `Expired`, not silently discarded.
- **Compensation:** not applicable (no side effect exists to compensate prior to approval).
- **Audit:** reviewer identity, decision, and reasoning captured on every transition.
- **Security:** `RecommendationApprovalPolicy` enforces the reviewer holds the required role for the Recommendation's action class.
- **Terminal states:** `Approved` (may proceed to Decision recording — a separate, later act), `Rejected`, `Superseded`, `Expired`.

## 5. Decision-to-Action

- **Trigger:** `RecordDecision` (following an approved Recommendation or a directly authored Decision).
- **Actors:** Human decision authority; Project member creating the resulting Action(s).
- **States:** `Proposed → Recorded → Active → ActionsCreated → Superseded | Revoked → Closed`.
- **Commands involved:** `RecordDecision`, `RevokeDecision`, `CreateActionFromDecision`.
- **Events involved:** `DecisionRecorded`, `DecisionRevoked`, `ActionCreated`.
- **Policies:** `DecisionAuthorityPolicy`, `ActionCreationPolicy`.
- **Retries:** not applicable — human-authored governance step.
- **Timeouts:** none; a Decision may remain `Active` indefinitely until superseded, revoked, or closed.
- **Compensation:** revocation (`RevokeDecision`) is the explicit compensating act — it never destructively edits the original Decision record (`04-canonical-application-architecture.md` §27); Actions already created from a revoked Decision must be individually reviewed, not auto-cancelled.
- **Audit:** authority, rationale, alternatives, evidence, and consequences captured at recording; revocation reason and revoking authority captured at revocation.
- **Security:** `DecisionAuthorityPolicy` fails closed if the actor's authority level cannot be confirmed.
- **Terminal states:** `Closed` (normal completion), `Revoked` (explicit compensation).

## 6. Action-to-Outcome

- **Trigger:** `ActionCreated`.
- **Actors:** Project member executing the Action; human or governed monitoring process observing the Outcome.
- **States:** `Draft → Planned → Active → Blocked → Completed → Cancelled`; independently, `Expected → Observed → Validated → Disputed → Superseded` for the associated Outcome(s).
- **Commands involved:** `CompleteAction`, `CancelAction`, `RecordOutcome`.
- **Events involved:** `ActionCompleted`, `OutcomeRecorded`. `CancelAction` has no cataloged event (cancellation is a terminal Action state, `04-command-query-event-catalog.md` §5.6) — an implementation that needs to notify downstream consumers of cancellation should treat this as an open item for a future PR, not assume `ActionCompleted` covers it.
- **Policies:** `ActionCreationPolicy` (governs whether the Action itself required approval, per Workflow 5).
- **Retries:** not applicable to the human-execution steps; monitoring-process observation retries per its own job definition if automated.
- **Timeouts:** none on Action execution itself; a stale `Active` Action surfaces in Health projections rather than auto-transitioning.
- **Compensation:** none — Action completion does not imply Outcome success; a `Disputed` Outcome is the corrective mechanism, not a rollback. `CancelAction` is the explicit terminal path for an Action that will not complete.
- **Audit:** Action state transitions and Outcome observation are both recorded independently, preserving the execution/effectiveness distinction (`04-canonical-application-architecture.md` §28).
- **Security:** standard Project scope.
- **Terminal states:** Action: `Completed` or `Cancelled`. Outcome: `Validated`, `Disputed`, or `Superseded`.

## 7. Project Memory Promotion

- **Trigger:** `EvidenceNormalized`, or any governed source event proposing new knowledge.
- **Actors:** System (workflow step) / Agent (candidate proposal); Authorized Project member (approval).
- **States:** `Proposed → PendingApproval → Approved | Rejected → Superseded | Revoked`.
- **Commands involved:** `ProposeMemoryRecord`, `ApproveMemoryRecord`, `RejectMemoryRecord`.
- **Events involved:** `MemoryRecordProposed`, `MemoryRecordApproved`.
- **Policies:** feeds into `KnowledgeElevationPolicy` as its first stage.
- **Retries:** not applicable — human-paced governance step for approval; proposal generation retries per its own source workflow (1 or 2).
- **Timeouts:** a candidate not reviewed within its configured window surfaces as stale in the Knowledge Center, not silently dropped.
- **Compensation:** correction is by superseding a canonical record, never destructive edit (`04-canonical-application-architecture.md` §29).
- **Audit:** source, actor, confidence, and validation status recorded at every transition.
- **Security:** never mixes sources across Workspaces; a candidate always carries its originating Project's scope.
- **Terminal states:** `Approved` (canonical, feeds Workflow 8 as an aggregation input), `Rejected`.

## 8. Enterprise Intelligence Elevation

- **Trigger:** an aggregation batch of approved Project Memory Records / Outcomes reaching a Program/Portfolio/PMO scope.
- **Actors:** Enterprise Intelligence service (system, aggregation); PMO/Workspace reviewer; Enterprise Admin (ratifier).
- **States:** `Aggregated → CandidatePattern → UnderReview → WorkspaceRatified → EnterpriseRatified | Rejected → Expired | Revoked`.
- **Commands involved:** `ProposeEnterprisePattern`, `RatifyEnterpriseKnowledge`, `RevokeEnterpriseKnowledge`.
- **Events involved:** `EnterprisePatternProposed`, `EnterpriseKnowledgeRatified`, `EnterpriseKnowledgeRevoked`.
- **Policies:** `KnowledgeElevationPolicy`, `EnterpriseRatificationPolicy` — the six-part gate (evidence, confidence, review, lineage, applicability, ratification) must pass at every stage.
- **Retries:** not applicable — human-paced governance step throughout.
- **Timeouts:** a Candidate Pattern not reviewed within its configured window surfaces as stale, never silently auto-ratified (auto-ratification is explicitly prohibited, `04-canonical-application-architecture.md` §30).
- **Compensation:** `RevokeEnterpriseKnowledge` is the explicit compensating act; revocation lineage is preserved, never deleted.
- **Audit:** every stage transition records the evaluating actor, the evidence/confidence/lineage inputs, and the applicability scope.
- **Security:** this is the one workflow explicitly permitted to cross a Workspace boundary, and only through this gate — see `04-canonical-application-architecture.md` §62.12. No stage may skip a step in the gate, and no step may execute without the previous one's explicit pass.
- **Terminal states:** `EnterpriseRatified` (may later transition to `Revoked` or `Expired`), `Rejected`.

## 9. Agent Run

- **Trigger:** `RequestAgentRun`.
- **Actors:** Requesting actor (human or scheduled trigger); Agent Orchestration (system).
- **States:** per `04-ai-agent-application-architecture.md` §3's full pipeline — `Requested → Authorized → ContextAssembled → PolicyEvaluated → Retrieved → ModelInvoked → ToolsInvoked → Validated → Proposed → Completed | Failed | Cancelled`.
- **Commands involved:** `RequestAgentRun`, `CancelAgentRun`, `ApproveAgentProposal`, `RejectAgentProposal`.
- **Events involved:** `AgentRunRequested`, `AgentRunStarted`, `AgentRunCompleted`, `AgentRunFailed`. `ApproveAgentProposal` additionally emits `AgentProposalApproved` — a cross-context signal to Recommendation Management, never a direct write into its aggregate. Recommendation Management's own `CreateRecommendationFromProposal`, triggered by that event, is what actually emits `RecommendationGenerated` and triggers Workflow 4 (Recommendation Review and Approval); this two-command handoff is the only path by which a Recommendation comes into existence from Agent-originated output.
- **Policies:** `AgentExecutionPolicy`.
- **Retries:** model/tool call retries only (transient errors); a validation failure is not retried automatically.
- **Timeouts:** per `AgentExecutionPolicy`'s bound for the given Agent Definition.
- **Compensation:** none required — no domain mutation occurs until a resulting Proposal is separately approved (Workflow 4).
- **Audit:** full Agent Run record, per `04-ai-agent-application-architecture.md` §4.
- **Security:** tool allowlist enforcement, prompt-injection and exfiltration controls per `04-ai-agent-application-architecture.md` §11.
- **Terminal states:** `Completed` (with zero or more Proposals), `Failed`, `Cancelled`.

## 10. Project Archival

- **Trigger:** `ArchiveProject`.
- **Actors:** Project Owner / PMO Admin.
- **States:** `Active → PendingArchival → Archived`.
- **Commands involved:** `ArchiveProject`.
- **Events involved:** `ProjectArchived`.
- **Policies:** governed by whatever open-item policy a future PR defines for blocking archival on unresolved Decisions/Actions (not specified further by this PR — see `04-canonical-application-architecture.md` §55).
- **Retries:** not applicable.
- **Timeouts:** none.
- **Compensation:** un-archival, if supported, is a distinct future-PR decision — not designed here.
- **Audit:** actor, timestamp, and reason recorded.
- **Security:** requires explicit confirmation (destructive-adjacent, per Human-in-the-Loop Matrix principles even though Project archival itself is not an AI-originated action).
- **Terminal states:** `Archived`.

## 11. Workspace Archival

- **Trigger:** `ArchiveWorkspace`.
- **Actors:** Workspace Owner / Enterprise Admin.
- **States:** `Active → PendingArchival → Archived`.
- **Commands involved:** `ArchiveWorkspace`.
- **Events involved:** `WorkspacePolicyChanged` (archival modeled as a policy-state transition, per the parent document's command catalog).
- **Policies:** `WorkspaceIsolationPolicy` blocks archival if active PMOs/Projects require explicit handling first (exact blocking rule left to a future PR).
- **Retries:** not applicable.
- **Timeouts:** none.
- **Compensation:** not designed by this PR.
- **Audit:** actor, timestamp, and reason recorded; this is one of the highest-severity audited events in the system (`04-canonical-application-architecture.md` §41).
- **Security:** destructive; requires explicit confirmation and elevated authorization.
- **Terminal states:** `Archived`.

## 12. Cross-Workspace Knowledge Ratification

This is the Enterprise-scope-crossing portion of Workflow 8 (Enterprise Intelligence Elevation), called out separately here because it is the single workflow in this catalog explicitly permitted to touch more than one Workspace's provenance within one Enterprise.

- **Trigger:** a Candidate Pattern with supporting evidence originating from more than one Workspace reaching the ratification stage.
- **Actors:** Enterprise Admin (ratifier).
- **States:** `WorkspaceRatified (per originating Workspace) → EnterpriseRatified`.
- **Commands involved:** `RatifyEnterpriseKnowledge`.
- **Events involved:** `EnterpriseKnowledgeRatified`.
- **Policies:** `EnterpriseRatificationPolicy`; explicit per-record consent from each originating Workspace's data owner is required before this stage may even be attempted (`04-canonical-application-architecture.md` §30, prohibiting cross-client blending without consent).
- **Retries:** not applicable.
- **Timeouts:** none — this is a deliberately human-paced, high-scrutiny step.
- **Compensation:** `RevokeEnterpriseKnowledge`.
- **Audit:** every originating Workspace's contribution and consent is individually recorded in the resulting Enterprise Knowledge Record's lineage.
- **Security:** highest in this catalog — this is the one deliberate, governed exception to Workspace isolation (§35 of the parent document); any implementation must undergo dedicated security review before this stage is built (§36 of the parent document, "security review for cross-workspace features").
- **Terminal states:** `EnterpriseRatified`, `Revoked`.

## 13. Integration Synchronization

- **Trigger:** scheduled poll or inbound webhook from an external system.
- **Actors:** Integration Management adapter (service-account identity).
- **States:** `Idle → Syncing → PartiallySynced → Synced → Failed`.
- **Commands involved:** context-specific (each integration normalizes into `SubmitEvidence`, task-creation, or stakeholder-update commands via the anti-corruption layer, `04-canonical-application-architecture.md` §11).
- **Events involved:** integration-specific events, each versioned once published (§21 of the parent document).
- **Policies:** per-integration conflict-resolution policy (owned within Integration Management).
- **Retries:** exponential backoff on transient provider errors; dead-lettered after the integration's configured max attempts.
- **Timeouts:** per-integration, configured against the external provider's typical latency.
- **Compensation:** conflict resolution rules define whether PMFreak's or the external system's state wins per field; no silent last-write-wins without a defined rule.
- **Audit:** every sync attempt, its outcome, and any conflict resolution applied is recorded.
- **Security:** scoped, revocable credentials per integration; webhook payloads are authenticated before being trusted (§36 of the parent document).
- **Terminal states:** `Synced` (until the next scheduled/triggered sync), `Failed` (surfaced in the Integrations administration screen for manual intervention).

## 14. Notification Delivery

- **Trigger:** consumption of an integration event from Recommendation Management, Decision Management, or Action and Outcome Management (`04-canonical-application-architecture.md` §45).
- **Actors:** Notification Management (system).
- **States:** `IntentCreated → ChannelResolved → Sending → Delivered | Failed`.
- **Commands involved:** none in the top-level catalog (notification dispatch is internal to this context, §20 of `04-bounded-context-catalog.md`).
- **Events involved:** consumes `RecommendationGenerated`, `DecisionRecorded`, `ActionCompleted`, `OutcomeRecorded`, and equivalent integration events; publishes none upstream.
- **Policies:** per-user channel preference resolution.
- **Retries:** 5x with backoff, per channel.
- **Timeouts:** 30 seconds per channel attempt.
- **Compensation:** none — a failed delivery on one channel does not block delivery on another; the delivery record reflects per-channel status independently.
- **Audit:** delivery record (channel, timestamp, status) retained per notification intent.
- **Security:** notification payloads respect the sensitivity classification of the underlying event; PII is not sent to a channel the user has not opted into.
- **Terminal states:** `Delivered` (per channel), `Failed` (per channel, surfaced but not workflow-fatal).

---

## Cross-Workflow Notes

- Workflows 3 → 4 → 5 → 6 form the full Recommendation-to-Outcome chain (`04-canonical-application-architecture.md` §62.6); each is a distinct workflow with its own terminal states specifically so that a Recommendation's rejection, a Decision's revocation, or an Outcome's dispute never cascades as an uncontrolled rollback across the chain — each stage's terminal state is final for that stage alone.
- Workflows 7 → 8 form the full Project Memory → Enterprise Intelligence pipeline (`04-canonical-application-architecture.md` §62.7–§62.8); Workflow 12 is the specific cross-Workspace slice of Workflow 8, broken out because of its distinct security posture.
- No workflow in this catalog auto-retries a human governance step (review, approval, ratification) — only technical/transient failures are retried automatically (`04-canonical-application-architecture.md` §39).
