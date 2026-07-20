# ADR-PMF-038: Persisted Workflow State

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR4's application workflows document (`04-application-workflows.md`) defines fourteen long-running, multi-step workflows (Document Ingestion, Recommendation Generation, Decision-to-Action, Project Memory Promotion, Enterprise Intelligence Elevation, Agent Run, Integration Synchronization, Notification Delivery, and others), each with named states, retry behavior, and terminal states. These workflows span multiple steps, sometimes multiple human-in-the-loop pauses (e.g., Recommendation Review and Approval), and sometimes multiple bounded contexts. PR5 must decide whether this state lives durably in the database or transiently in application/process memory, since the latter would lose all in-flight workflow progress on a process restart or deployment — including workflows sitting at a human-approval step that could remain pending for hours or days (e.g., Cross-Workspace Knowledge Ratification, Workflow 12).

## Decision

**Long-running and multi-step workflows persist their instance state, step state, attempt history, and terminal status explicitly in the database — never relying solely on in-memory process state or an external job queue's transient state as the only record of workflow progress.** This applies to every workflow enumerated in PR4's application workflows catalog, and to any future workflow meeting the same "multi-step, potentially long-lived, potentially crossing a process restart or a human-approval pause" criteria.

## Persistence Rules

1. Every workflow execution is represented by a `workflow_instances` record carrying: `type`, `version`, `scope` (Workspace/Project/Enterprise as applicable), `status`, `current_state`, `trigger`, `started_by`, `correlation_id`, `started_at`, `updated_at`, `completed_at`, `timeout`, `cancellation` reason (if applicable), `failure_reason` (if applicable).
2. Each step within a workflow instance is represented by a `workflow_steps` record carrying: `name`, `state`, `attempt_count`, `retry_policy`, `started_at`, `completed_at`, `output_reference` (pointer to the canonical record the step produced or affected, never inlined full content), `error`, `compensation_state`.
3. Retries are tracked as `workflow_attempts` records, not overwritten in place — each attempt's outcome remains visible for diagnosis even after a later attempt succeeds.
4. A workflow instance's terminal state (Completed, Cancelled, Failed, or workflow-specific terminal states like Approved/Rejected/Expired/Revoked) is explicit and queryable — a workflow is never considered "done" merely because no further code path continues it; it must reach and record a terminal state.
5. Workflows that pause for human input (e.g., Recommendation Review and Approval, Cross-Workspace Knowledge Ratification's consent step) persist their paused state indefinitely until the human act occurs — a paused workflow is not timed out into a false terminal state without an explicit timeout policy applying.
6. No workflow auto-retries a human governance step; automatic retry applies only to technical/transient failures (network errors, transient provider failures), consistent with PR4's workflow state-shape rule.
7. Workflow state does not become the authoritative record of domain facts it produces — e.g., a Decision-to-Action workflow's `workflow_steps` record references the Decision and Action it produced by ID; it does not duplicate their authoritative content.

## Alternatives Considered

- **In-memory-only or job-queue-only workflow state, with no database persistence.** Rejected: a process restart, deployment, or job-queue eviction would silently lose in-flight workflow progress, which is unacceptable for workflows that may legitimately remain paused for hours or days awaiting human approval (Recommendation Review, Enterprise Intelligence Elevation, Cross-Workspace Knowledge Ratification).
- **Deriving workflow state implicitly from the presence/absence/status of the domain records it touches (e.g., inferring "Recommendation Generation is in ContextAssembled state" from partial Agent Run data).** Rejected: this conflates workflow orchestration state with domain aggregate state, making it impossible to distinguish "the workflow crashed mid-step" from "the workflow was never started" or "the workflow completed and the trace was cleaned up" — PR4 requires these to be distinguishable (explicit terminal states, explicit failure reasons).
- **A dedicated workflow engine/service as the sole source of workflow truth, external to the canonical database.** Rejected at this stage for the same reason as ADR-PMF-033 rejects a polyglot architecture without evidence: no workflow in the current catalog has demonstrated scale or feature requirements (e.g., long-running sagas across dozens of systems) that a relational `workflow_instances`/`workflow_steps` design cannot satisfy; a dedicated engine remains a future option if evidence emerges.

## Positive Consequences

- Workflow progress survives process restarts, deployments, and crashes, which is essential given several workflows' human-approval pauses can span arbitrarily long real-world time.
- Makes workflow diagnosis and support possible ("why is this Recommendation stuck in review") by querying durable, structured state rather than reconstructing it from logs or inferring it from side effects.
- Keeps workflow orchestration state and domain aggregate state cleanly separated, so a workflow's internal retry/step bookkeeping never contaminates the Decision, Recommendation, or Action tables it acts upon.

## Negative Consequences

- Adds schema and application complexity (workflow instance/step/attempt tables, a workflow execution loop that can resume from persisted state) versus a simpler, transient in-memory orchestration.
- Requires careful design to avoid workflow state tables becoming another unbounded-growth append-heavy surface needing its own retention policy (§24, similar to audit/event tables).

## Risks

- **Resumability bug risk:** a workflow engine that persists state but has a bug in its resume-from-persisted-state logic could either re-execute a step that already had a side effect (violating idempotency) or skip a step that never completed — step-level idempotency (working with ADR-PMF-037's idempotency infrastructure) is required to make resumption safe.
- **Stuck-workflow risk:** a workflow paused indefinitely for human input with no timeout or escalation policy could remain silently stuck — this ADR requires an explicit timeout field but does not itself mandate a specific escalation policy per workflow type, which remains a product decision.

## Security and Data Implications

- Workflow instances carry Workspace/Project/Enterprise scope (per ADR-PMF-034) so tenant isolation applies to workflow state the same way it applies to any operational record — a workflow instance must never be readable or resumable by an actor outside its scope.
- Cross-Workspace Knowledge Ratification (Workflow 12)'s per-Workspace consent state must be durably and distinctly recorded per originating Workspace, not collapsed into a single flag, given its status as PR4's highest security-stakes workflow.

## Application Implications

- Workflow execution logic reads persisted `workflow_instances`/`workflow_steps` state to determine what to do next, rather than assuming continuity from an in-memory call stack — this is a structural requirement on how workflow orchestration code is written, not merely a schema addition.
- Compensation logic (for workflows that need to undo a partial effect on failure) reads `workflow_steps.compensation_state` to know what has and has not yet been compensated.

## API Implications

- PR6 may expose workflow status endpoints (e.g., "get the status of this Recommendation's review workflow") backed directly by `workflow_instances`/`workflow_steps`, giving product surfaces a genuine status source rather than an inferred one.

## UX Implications

- Enables PR7/PR8 to show real, accurate in-progress status for long-running operations (e.g., "Evidence is being normalized," "Recommendation is awaiting review") instead of a generic spinner with no underlying state to query.

## Migration Implications

- No workflow-state infrastructure exists in the current schema per the current-state inventory; this is new, additive infrastructure introduced in an expand phase (ADR-PMF-044).

## Operational Implications

- Requires monitoring for stuck workflows (instances not reaching a terminal state within an expected window), failed steps, and compensation failures as new operational signals.

## Compatibility Implications

- Implementable entirely within PostgreSQL/Supabase (`workflow_instances`, `workflow_steps`, `workflow_attempts` tables); does not require adopting an external workflow engine, though one remains an option if future evidence justifies it (§67).

## Out of Scope

- The exact workflow execution/resumption mechanism (a scheduled poller, a queue-driven worker, or a dedicated workflow engine) — left open pending implementation-time evaluation.
- Per-workflow-type timeout and escalation policy values — left as domain-specific, configurable decisions.

## Validation

Validation criteria: (1) every workflow in `04-application-workflows.md`'s fourteen-workflow catalog has a corresponding persisted representation described in `05-event-workflow-persistence.md`; (2) no workflow is described as relying solely on in-memory or job-queue-transient state for its authoritative status; (3) every workflow step description includes an explicit terminal-state set matching PR4's per-workflow terminal states.

## References

- `docs/product-architecture/04-application-workflows.md`
- `docs/product-architecture/04-canonical-application-architecture.md` §23 (transaction boundaries), §62.11 (workflow state shape)
- `docs/product-architecture/05-event-workflow-persistence.md`
- `docs/adr/ADR-PMF-037-transactional-outbox-idempotent-inbox.md`
