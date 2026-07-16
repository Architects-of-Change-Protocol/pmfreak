# Founder Circle — Known Limitations (Sprint 01)

Honest inventory. Nothing here is hidden behind optimistic copy.

1. **Platform entry is not gated by the program.** PMFreak's existing signup
   and workspace bootstrap still apply to any authenticated user; the
   Founder Circle governs *program membership, curated onboarding, and
   evidence* — it is not a platform lockout. Closing open signup is a
   separate, pre-existing platform decision.
2. **The pilot agreement text is still a placeholder** (`0.1-draft`,
   `PILOT_AGREEMENT_IS_PLACEHOLDER = true`). Acceptance plumbing is real;
   the legal content is not. Production enablement of the program with real
   external participants remains blocked on legal copy (pre-existing gate,
   docs/release/pilot-agreement-readiness.md).
3. **Hosted infrastructure gates remain OPEN.** RR-MIGRATE (hosted fresh-DB
   apply) and RR-BACKUP are unchanged by this sprint; the new migration has
   been validated statically and by the repository's migration test suites
   only — no hosted database run happened in this environment.
4. **Email delivery**: only the invitation email is machine-sent, and only
   when the provider is configured; everything else is a documented manual
   send. No delivery-event table exists for founder invitations (the API
   response's `emailDelivery.ok` is the only signal).
5. **Operator granularity**: program operator == founder/internal. There is
   no per-person operator role, no two-person rule, and no operator UI for
   editing capacity (settings row is manual SQL by design).
6. **Usage checkpoints are approximations from real records**: any project /
   task / platform event in the program workspace counts once. They cannot
   distinguish who inside the workspace performed the action (single-seat
   workspaces make this acceptable at pilot scale).
7. **`first_command_center_visit` requires the command-center page hook**;
   visits through other surfaces are not counted.
8. **Retention depends on the participant status page** (return-visit events
   are recorded there, not on every page). Until participants revisit that
   page, day-N returns undercount. Metrics report this honestly as
   evidence-based counts, but the instrument itself is narrow.
9. **Analytics flag off ⇒ no return-visit evidence** (lifecycle funnels
   still work from the audit trail).
10. **Capacity race-safety relies on the SQL function**; the in-memory test
    double mirrors its semantics but a hosted concurrency test has not been
    run (blocked on the same hosted-DB gate as RR-MIGRATE).
11. **No i18n**: participant/operator surfaces are English-only.
12. **No automated data-retention jobs**: deletion/retention is a manual,
    documented operation (runbook §18).
13. **Discovery evidence is operator-typed**: it is structured testimony,
    not instrumentation; treat WTP signals accordingly.
