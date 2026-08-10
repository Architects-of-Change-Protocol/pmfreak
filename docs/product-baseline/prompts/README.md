# PMFreak P2 Implementation Prompts

This directory is the executable prompt sequence for `../PMFREAK_SEQUENTIAL_BUILD_PLAN_P2.md`. Normative sources, in order, are `../PMFREAK_PRODUCT_BASELINE_V2.md` (target), `../PMFREAK_FOCUSED_ASSESSMENT_P1.md` (observed state), then P2 (bridge). Do not use these prompts to reopen P0/P1.

## Execution protocol

1. Follow dependency metadata, not filename order. Start with P2-01. Founder critical path and parallel joins are in P2.
2. Status vocabulary is `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `IMPLEMENTED_NOT_VERIFIED`, `VERIFIED`, `REJECTED`. Only complete acceptance evidence earns `VERIFIED`.
3. Begin by reading the three sources, applicable `AGENTS.md`, and recording branch/HEAD/status. Stop on overlapping changes.
4. Use a dedicated branch/worktree per prompt. Never overlap parallel prompts in one working tree. Parallel work may consume only a `VERIFIED` contract explicitly permitted by P2.
5. End with the prompt's Required Delivery Report. Record exact commands/results, diff, commit, limitations, rollback and next unlocked prompt.
6. Update the P2 dashboard only after verification; code generation or a passing source scan is not progress.
7. A blocker records evidence, affected gate and human owner. Never skip a dependent prompt; resume only after prerequisites are rechecked.
8. Request human decision only for a Stop Condition or demonstrated planning exception. D1–D7 are already ratified.
9. Track C fixtures must be contract-conformant, visibly `DEMO / FIXTURE`, and replaced at the named prompt/gate. No hardcoded success.
10. No push/PR, destructive reset/rebase, migration deletion, legacy removal, AOC duplication or remote writeback without separate authority.

## Gates

- **G1:** P2-01/02 canonical spine.
- **G2:** P2-03–10 plus P2-20 governed execution/outcome/audit.
- **G3:** P2-11–15 authenticated Founder Invite.
- **G4:** P2-16/17 PMO Pilot.
- **Expansion:** P2-18/19 controlled learning.

## Prompt manifest

- [P2-01 — Canonical Domain Contract and Consumer Map](p2-01-canonical-domain-contract-and-consumer-map.md)
- [P2-02 — Compatibility Adapters, Correlation Spine and Legacy Safety Gate](p2-02-compatibility-adapters-correlation-spine-and-legacy-safety-gate.md)
- [P2-03 — Raw Input and Normalized Event Foundation](p2-03-raw-input-and-normalized-event-foundation.md)
- [P2-04 — Evidence Derivation and Manual Provenance Experience](p2-04-evidence-derivation-and-manual-provenance-experience.md)
- [P2-05 — Material Action and Governance Contract](p2-05-material-action-and-governance-contract.md)
- [P2-06 — In-Process AOC Decision-to-Action Vertical Slice](p2-06-in-process-aoc-decision-to-action-vertical-slice.md)
- [P2-07 — Canonical Action-to-Task Adapter](p2-07-canonical-action-to-task-adapter.md)
- [P2-08 — Idempotent Internal Dispatch and Execution Experience](p2-08-idempotent-internal-dispatch-and-execution-experience.md)
- [P2-09 — Outcome and Observation Contract](p2-09-outcome-and-observation-contract.md)
- [P2-10 — Outcome Review and Complete Lineage Experience](p2-10-outcome-review-and-complete-lineage-experience.md)
- [P2-11 — PM Execution Center Attention-to-Decision Experience](p2-11-pm-execution-center-attention-to-decision-experience.md)
- [P2-12 — PM Execution Center Action-to-Outcome and Accessibility Gate](p2-12-pm-execution-center-action-to-outcome-and-accessibility-gate.md)
- [P2-13 — Founder Invite Seed and Isolated Environment Harness](p2-13-founder-invite-seed-and-isolated-environment-harness.md)
- [P2-14 — Authenticated Two-Tenant Founder Browser Story](p2-14-authenticated-two-tenant-founder-browser-story.md)
- [P2-15 — Governance, Audit and Release Readiness Gate](p2-15-governance-audit-and-release-readiness-gate.md)
- [P2-16 — Schedule Exposure Adapter and Experience](p2-16-schedule-exposure-adapter-and-experience.md)
- [P2-17 — Qualified Portfolio Projection and PMO Attention Experience](p2-17-qualified-portfolio-projection-and-pmo-attention-experience.md)
- [P2-18 — Learning Candidate Eligibility and Lineage](p2-18-learning-candidate-eligibility-and-lineage.md)
- [P2-19 — Governed Ratification, Revocation and Learning Review](p2-19-governed-ratification-revocation-and-learning-review.md)
- [P2-20 — Closed-Loop Audit Export Compatibility Gate](p2-20-closed-loop-audit-export-compatibility-gate.md)

## Parallel work

After G1, P2-03 and P2-05 may run in isolated worktrees. P2-11 may begin after P2-04 using only the permitted labelled action contract fixture; it joins real P2-06 before P2-12. P2-13 and P2-16 may also begin after their listed verified dependencies. P2-18 waits for P2-10. When branches touch a shared contract, merge the contract owner first and revalidate consumers.

## Result recording

Copy the relevant dashboard row into the delivery report, update status only after commands run, and attach runtime/DB/browser evidence where required. `IMPLEMENTED_NOT_VERIFIED` blocks dependents exactly like `BLOCKED`. If rejected, preserve evidence and request an approved replacement plan.
