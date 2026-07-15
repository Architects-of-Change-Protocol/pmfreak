# 11 — Roadmap

## Scenario A — Founder-led pilot launch

**Objective:** First real users, first design partners, manual support, tight risk control, a genuine PMF signal.

- **Scope:** Close F-04/F-05 (hosted-DB migration proof, backup restore drill). Publish F-01 (ToS/Privacy Policy). Fix F-06 (RLS bug) and F-07 (error leakage) — both cheap, high-signal. Un-orphan the PMO/PM-registry navigation (F-21) if any design partner is a PMO buyer. Instrument minimal activation analytics (F-10, narrow scope).
- **Exclusions:** OAuth/MFA, admin/support console beyond founder tooling, AOC consumer work, enterprise packaging, any work on the scaffolding layer beyond labeling it clearly as non-production in internal docs.
- **Dependencies:** Hosted Supabase project + credentials (blocks F-04/F-05).
- **Critical path:** F-04/F-05 → onboard first real external workspace. F-01 → allowed to onboard any external user at all, paid or not.
- **Risks:** Single-author execution risk (bus factor); scaffolding layer could be surfaced to a design partner during a demo if not curated — mitigate by demoing only `NAVIGATION_HIERARCHY`-reachable capability.
- **Team/size:** Founder (+ this audit's backlog as a guide), small — this is explicitly a founder-led stage.
- **Exit criteria:** N design partners onboarded with real data, hosted-DB proof closed, no P0 findings open.
- **Accepted debt:** No OAuth/MFA, no support console, hardcoded plan catalog, AOC self-implementation (disclosed internally, not marketed).
- **Prohibited debt:** Charging money without legal docs; onboarding real data without proven backup/restore.

## Scenario B — Public SaaS B2C/B2B

**Objective:** Self-service signup, real billing, real support, reliability, compliance, scalable onboarding.

- **Scope:** F-08 (OAuth + MFA), F-09 (deletion/export), F-10 (full funnel analytics), F-15 (coupons/tax/native trials), F-16 (real support console, incremental — lookup first, impersonation last), F-17 (external alerting), F-18 (pentest), F-12/F-13 (remaining RLS hardening), F-19 (fix test-reimplementation drift for reachable modules), F-14 (DB-driven plans if B2B custom terms are needed).
- **Exclusions:** SCIM, SSO (defer to Scenario C unless a specific early B2B deal requires it sooner — treat as a pull-forward exception, not baseline scope), AOC external consumption (no external provider exists yet to consume), Kubernetes/microservices/multi-region (see `13-do-not-build.md`).
- **Dependencies:** Scenario A must be exited (hosted-DB proof, legal docs, P0s closed) before this scope begins.
- **Critical path:** Legal (F-01, already done in A) → OAuth/deletion (F-08/F-09) → analytics (F-10) → pentest (F-18) → public launch. Support console (F-16) can proceed in parallel once a second human joins support.
- **Risks:** Support console impersonation tooling is genuinely security-sensitive — build audit trail from day one, don't retrofit. Scaling AI cost (F-20's fail-open cost ceiling) becomes a real financial risk at public-launch volume — fix before Scenario B ends.
- **Team/size:** Founder + at minimum one additional engineer and one support/success hire by the end of this scenario.
- **Exit criteria:** Self-service signup live, pentest remediated, external alerting live, support console operational, no P0/P1 findings open from `04-critical-findings.md`.
- **Accepted debt:** SCIM/SSO absent (unless pulled forward for a specific deal); Consultant/Agency packaging still manual; PMFreak remains the self-issuing AOC authority (still disclosed, not yet resolved — no external provider exists).
- **Prohibited debt:** Any P0/P1 security or compliance finding open at public launch; support impersonation shipped without an audit trail.

## Scenario C — Enterprise-ready

**Objective:** SSO, SCIM, SLA, advanced audit, retention, assurance, enterprise contracting.

- **Scope:** SSO + SCIM implementation; formal SLA + retention policy (code-enforced, not just documented); F-02 resolution to whatever extent an external AOC Protocol/Enterprise/Assurance provider exists by this point (build the `AgentIdentityPort`/`AgentPassportPort`/`RevocationStatusPort`/`PolicyEvaluationPort`/`AssuranceStatusPort` adapters against the real external contract, retire the in-process authority path for enterprise tenants); DPA + subprocessor list finalized; dedicated support/CSM model; DB-driven plan catalog for negotiated terms (F-14, if not already done).
- **Exclusions:** Marketplace, public developer API beyond the existing internal SDK, partner portal, reseller program, complex agent economy (see `13-do-not-build.md`) — none of these are enterprise prerequisites.
- **Dependencies:** An external AOC Protocol/Enterprise/Assurance provider must actually exist and publish a consumable contract — this scenario cannot fully close F-02 before that is true. PMFreak's own extraction-prep work (ports/adapters/dependency-direction lint) already gives it a head start once that provider exists.
- **Critical path:** External AOC provider availability → port/adapter implementation against the real contract → SSO/SCIM → first enterprise contract.
- **Risks:** Overselling AOC-verified trust/assurance before F-02 is genuinely resolved is the single largest risk in this scenario — an enterprise security review will specifically probe self-issued vs. externally-verified trust claims.
- **Team/size:** Founder + engineering team of several + dedicated enterprise sales/CSM function.
- **Exit criteria:** At least one signed enterprise contract with SSO/SCIM live, SLA in force, assurance status genuinely externally sourced (not self-certified).
- **Accepted debt:** Marketplace/partner-ecosystem features remain out of scope indefinitely unless a specific enterprise deal requires them.
- **Prohibited debt:** Any AOC-related marketing claim that PMFreak cannot back with a genuine external consumption relationship.
