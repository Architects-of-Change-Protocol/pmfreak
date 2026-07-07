/**
 * Sprint 29R — Decision Support Shadow Capture Storage Adapter Persistence Readiness Review: corpus.
 *
 * Each case documents one expected fact about the Sprint 29R readiness review: either the expected
 * assessment of one of the 19 readiness domains (`kind: "domain_assessment"`), the expected overall
 * decision (`kind: "decision"`), a prohibited next action that must appear in the decision matrix
 * (`kind: "prohibited_action"`), an allowed next action that must appear in the decision matrix
 * (`kind: "allowed_action"`), or the expected recommended next sprint (`kind: "recommendation"`).
 *
 * This corpus does not execute any action, real or simulated — every case is a plain, declarative
 * expectation exercised against `buildDecisionSupportShadowPersistenceReadinessReview()`,
 * `assessDecisionSupportShadowPersistenceReadinessDomain()`, and
 * `createDecisionSupportShadowPersistenceReadinessDecisionMatrix()` by the Sprint 29R test file.
 */

export type DecisionSupportShadowPersistenceReadinessFixtureKind = "domain_assessment" | "decision" | "prohibited_action" | "allowed_action" | "recommendation";

export type DecisionSupportShadowPersistenceReadinessFixtureCase = {
  id: string;
  kind: DecisionSupportShadowPersistenceReadinessFixtureKind;
  /** The readiness domain this case is about, or a sentinel ("decision_matrix") for cases that are
   * about the overall decision/recommendation rather than one specific domain. */
  domain: string;
  expectedStatus?: "ready" | "partially_ready" | "not_ready" | "blocked";
  expectedRiskLevel?: "low" | "medium" | "high" | "critical";
  expectedScoreRange?: [number, number];
  expectedHasBlockingBlocker?: boolean;
  expectedDecision?: string;
  expectedRecommendedNextSprint?: string;
  expectedActionSubstring?: string;
  expectedRequiredBeforeRealPersistence?: string[];
  notes: string;
};

export const DECISION_SUPPORT_SHADOW_PERSISTENCE_READINESS_CASES: DecisionSupportShadowPersistenceReadinessFixtureCase[] = [
  // ─── Metric-dependent domains: ready against a clean Sprint 18R-style corpus ───────────
  {
    id: "psr-01",
    kind: "domain_assessment",
    domain: "storage_policy",
    expectedStatus: "ready",
    expectedRiskLevel: "low",
    expectedScoreRange: [100, 100],
    expectedHasBlockingBlocker: false,
    notes: "Sprint 26R storage policy stays clean (zero violations, 100% capture-harness-clean rate) against a policy-clean corpus.",
  },
  {
    id: "psr-02",
    kind: "domain_assessment",
    domain: "capture_harness",
    expectedStatus: "ready",
    expectedRiskLevel: "low",
    expectedScoreRange: [100, 100],
    expectedHasBlockingBlocker: false,
    notes: "Sprint 25R capture harness stays clean (100% acceptable/blocking-gate rate, zero retention counters) against a policy-clean corpus.",
  },
  {
    id: "psr-03",
    kind: "domain_assessment",
    domain: "storage_draft_mapping",
    expectedStatus: "ready",
    expectedRiskLevel: "low",
    expectedScoreRange: [100, 100],
    expectedHasBlockingBlocker: false,
    notes: "Sprint 27R storage draft mapping stays clean (100% valid-draft rate, zero forbidden-field inclusion counts).",
  },
  {
    id: "psr-04",
    kind: "domain_assessment",
    domain: "fake_adapter",
    expectedStatus: "ready",
    expectedRiskLevel: "low",
    expectedScoreRange: [100, 100],
    expectedHasBlockingBlocker: false,
    notes: "Sprint 28R fake adapter stays safe (100% fake-write-accepted/valid-draft/safety rate, every synthetic invalid draft rejected).",
  },
  {
    id: "psr-05",
    kind: "domain_assessment",
    domain: "privacy_minimization",
    expectedStatus: "ready",
    expectedRiskLevel: "low",
    expectedScoreRange: [100, 100],
    expectedHasBlockingBlocker: false,
    notes: "Every raw-input/full-candidate/user-visible-output/project-name/email/phone counter across capture harness, adapter plan, and fake adapter is zero.",
  },
  {
    id: "psr-06",
    kind: "domain_assessment",
    domain: "test_coverage",
    expectedStatus: "ready",
    expectedRiskLevel: "low",
    expectedScoreRange: [100, 100],
    expectedHasBlockingBlocker: false,
    notes: "Sprint 27R/28R evaluations produce non-empty draft metrics against the corpus, proving Sprint 24R-28R test coverage exists.",
  },

  // ─── Partially-ready domains: designed/planned but not implemented ─────────────────────
  {
    id: "psr-07",
    kind: "domain_assessment",
    domain: "schema_proposal",
    expectedStatus: "partially_ready",
    expectedRiskLevel: "medium",
    expectedScoreRange: [70, 70],
    expectedHasBlockingBlocker: false,
    notes: "Sprint 27R schema proposal exists (proposal_only) but must not become a migration without a security review — a warning-severity blocker, not blocking.",
  },
  {
    id: "psr-08",
    kind: "domain_assessment",
    domain: "migration_proposal",
    expectedStatus: "partially_ready",
    expectedRiskLevel: "high",
    expectedScoreRange: [50, 50],
    expectedHasBlockingBlocker: true,
    notes: "Sprint 27R migration proposal documents preconditions, none yet satisfied — never ready, always at most partially_ready, high risk.",
  },
  {
    id: "psr-09",
    kind: "domain_assessment",
    domain: "deletion_purge",
    expectedStatus: "partially_ready",
    expectedRiskLevel: "medium",
    expectedScoreRange: [70, 70],
    expectedHasBlockingBlocker: true,
    notes: "Sprint 28R fake adapter proves the delete/purge contract in-memory only — real deletion and real purge paths are both missing.",
  },
  {
    id: "psr-10",
    kind: "domain_assessment",
    domain: "retention",
    expectedStatus: "partially_ready",
    expectedRiskLevel: "medium",
    expectedScoreRange: [70, 70],
    expectedHasBlockingBlocker: true,
    notes: "Sprint 26R retention policy is modeled, but no real, scheduled retention enforcement exists.",
  },
  {
    id: "psr-11",
    kind: "domain_assessment",
    domain: "audit_trail",
    expectedStatus: "partially_ready",
    expectedRiskLevel: "medium",
    expectedScoreRange: [70, 70],
    expectedHasBlockingBlocker: true,
    notes: "Structural auditMetadata already exists on every in-memory record, but no real, durable audit trail policy exists.",
  },
  {
    id: "psr-12",
    kind: "domain_assessment",
    domain: "production_wiring",
    expectedStatus: "partially_ready",
    expectedRiskLevel: "medium",
    expectedScoreRange: [60, 60],
    expectedHasBlockingBlocker: true,
    notes: "Production stays untouched (evidence), but production wiring remains prohibited until a dedicated integration plan exists.",
  },

  // ─── Not-ready domains ──────────────────────────────────────────────────────────────────
  {
    id: "psr-13",
    kind: "domain_assessment",
    domain: "tenant_workspace_isolation",
    expectedStatus: "not_ready",
    expectedRiskLevel: "high",
    expectedScoreRange: [30, 30],
    expectedHasBlockingBlocker: true,
    notes: "No tenant/workspace isolation model, no RLS model, and no workspace ownership enforcement exist — three critical blockers.",
  },
  {
    id: "psr-14",
    kind: "domain_assessment",
    domain: "access_control",
    expectedStatus: "not_ready",
    expectedRiskLevel: "high",
    expectedScoreRange: [30, 30],
    expectedHasBlockingBlocker: true,
    notes: "No admin/read/write access-control model and no role-based visibility model exist — two critical blockers.",
  },
  {
    id: "psr-15",
    kind: "domain_assessment",
    domain: "observability",
    expectedStatus: "not_ready",
    expectedRiskLevel: "medium",
    expectedScoreRange: [40, 40],
    expectedHasBlockingBlocker: true,
    notes: "No runtime metrics or alerts exist for writes, deletes, purges, or violations.",
  },
  {
    id: "psr-16",
    kind: "domain_assessment",
    domain: "rollback",
    expectedStatus: "not_ready",
    expectedRiskLevel: "high",
    expectedScoreRange: [30, 30],
    expectedHasBlockingBlocker: true,
    notes: "No tested rollback plan exists, despite Sprint 27R documenting rollback requirements.",
  },
  {
    id: "psr-17",
    kind: "domain_assessment",
    domain: "security_review",
    expectedStatus: "not_ready",
    expectedRiskLevel: "critical",
    expectedScoreRange: [20, 20],
    expectedHasBlockingBlocker: true,
    notes: "A formal security/privacy review is required before any migration or real persistence — a critical blocker.",
  },
  {
    id: "psr-18",
    kind: "domain_assessment",
    domain: "feature_flagging",
    expectedStatus: "not_ready",
    expectedRiskLevel: "high",
    expectedScoreRange: [30, 30],
    expectedHasBlockingBlocker: true,
    notes: "The default-off feature flag is only named (Sprint 26R), never implemented or reviewed.",
  },
  {
    id: "psr-19",
    kind: "domain_assessment",
    domain: "data_subject_rights",
    expectedStatus: "not_ready",
    expectedRiskLevel: "high",
    expectedScoreRange: [25, 25],
    expectedHasBlockingBlocker: true,
    notes: "No DSR/delete/export policy exists for any future persisted shadow capture record — a critical blocker.",
  },

  // ─── Decision ───────────────────────────────────────────────────────────────────────────
  {
    id: "psr-20",
    kind: "decision",
    domain: "decision_matrix",
    expectedDecision: "do_not_build_real_persistence_yet",
    expectedRequiredBeforeRealPersistence: [
      "Tenant/workspace isolation",
      "Access-control model",
      "Real deletion path",
      "Real purge path",
      "Real retention enforcement",
      "Audit trail policy",
      "Observability/alerts",
      "Tested rollback plan",
      "Security/privacy review",
    ],
    notes: "Given the current domain assessments (several not_ready/critical-blocker domains), the decision must be do_not_build_real_persistence_yet.",
  },

  // ─── Prohibited next actions ────────────────────────────────────────────────────────────
  {
    id: "psr-21",
    kind: "prohibited_action",
    domain: "decision_matrix",
    expectedActionSubstring: "db table",
    notes: "The decision matrix must prohibit creating a DB table.",
  },
  {
    id: "psr-22",
    kind: "prohibited_action",
    domain: "decision_matrix",
    expectedActionSubstring: "migration file",
    notes: "The decision matrix must prohibit creating a migration file.",
  },
  {
    id: "psr-23",
    kind: "prohibited_action",
    domain: "decision_matrix",
    expectedActionSubstring: "sql file",
    notes: "The decision matrix must prohibit creating a SQL file.",
  },
  {
    id: "psr-24",
    kind: "prohibited_action",
    domain: "decision_matrix",
    expectedActionSubstring: "supabase",
    notes: "The decision matrix must prohibit creating Supabase writes.",
  },

  // ─── Allowed next actions ───────────────────────────────────────────────────────────────
  {
    id: "psr-25",
    kind: "allowed_action",
    domain: "decision_matrix",
    expectedActionSubstring: "shadow replay",
    notes: "The decision matrix must allow a controlled shadow replay using the fake adapter.",
  },
  {
    id: "psr-26",
    kind: "allowed_action",
    domain: "decision_matrix",
    expectedActionSubstring: "tenant/workspace isolation",
    notes: "The decision matrix must allow designing a tenant/workspace isolation model.",
  },
  {
    id: "psr-27",
    kind: "allowed_action",
    domain: "decision_matrix",
    expectedActionSubstring: "access-control",
    notes: "The decision matrix must allow designing an access-control model.",
  },
  {
    id: "psr-28",
    kind: "allowed_action",
    domain: "decision_matrix",
    expectedActionSubstring: "dsr",
    notes: "The decision matrix must allow designing a DSR/delete/export policy.",
  },
  {
    id: "psr-29",
    kind: "allowed_action",
    domain: "decision_matrix",
    expectedActionSubstring: "security review checklist",
    notes: "The decision matrix must allow preparing a security review checklist.",
  },

  // ─── Recommendation ─────────────────────────────────────────────────────────────────────
  {
    id: "psr-30",
    kind: "recommendation",
    domain: "decision_matrix",
    expectedRecommendedNextSprint: "Sprint 30R — Controlled Shadow Replay Evaluation",
    notes: "The recommended next sprint must be Sprint 30R — Controlled Shadow Replay Evaluation.",
  },
];
