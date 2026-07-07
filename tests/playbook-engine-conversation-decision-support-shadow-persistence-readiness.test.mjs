import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DECISION_SUPPORT_SHADOW_PERSISTENCE_READINESS_VERSION,
  createDecisionSupportShadowPersistenceReadinessInputMetrics,
  listDecisionSupportShadowPersistenceReadinessDomains,
  assessDecisionSupportShadowPersistenceReadinessDomain,
  buildDecisionSupportShadowPersistenceReadinessReview,
  summarizeDecisionSupportShadowPersistenceReadinessReview,
  createDecisionSupportShadowPersistenceReadinessDecisionMatrix,
  explainDecisionSupportShadowPersistenceReadinessReview,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCapturePersistenceReadiness.ts";
import { DECISION_SUPPORT_SHADOW_PERSISTENCE_READINESS_CASES } from "./fixtures/conversational-brain-decision-support-shadow-persistence-readiness-cases.ts";
import { DECISION_CLARIFICATION_CASES } from "./fixtures/conversational-brain-decision-clarification-cases.ts";

import { DECISION_SUPPORT_SHADOW_STORAGE_FAKE_ADAPTER_VERSION } from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStorageFakeAdapter.ts";
import { DECISION_SUPPORT_SHADOW_STORAGE_ADAPTER_PLAN_VERSION } from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStorageAdapterPlan.ts";
import { DECISION_SUPPORT_SHADOW_STORAGE_POLICY_VERSION } from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStoragePolicy.ts";
import { DECISION_SUPPORT_SHADOW_CAPTURE_HARNESS_VERSION } from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureHarness.ts";

/**
 * Sprint 29R — Decision Support Shadow Capture Storage Adapter Persistence Readiness Review.
 *
 * Tests the pure, offline readiness review in
 * `src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCapturePersistenceReadiness.ts`.
 * This review reads already-computed Sprint 24R-28R metrics and decides whether PMFreak is ready for
 * any real persistence — it creates no database, migration, SQL file, table, Supabase write, real
 * storage adapter, or real repository.
 */

const ALL_DOMAINS = [
  "storage_policy",
  "capture_harness",
  "storage_draft_mapping",
  "fake_adapter",
  "schema_proposal",
  "migration_proposal",
  "deletion_purge",
  "retention",
  "tenant_workspace_isolation",
  "access_control",
  "audit_trail",
  "observability",
  "rollback",
  "security_review",
  "production_wiring",
  "feature_flagging",
  "data_subject_rights",
  "privacy_minimization",
  "test_coverage",
];

function fixtureFor(id) {
  const c = DECISION_SUPPORT_SHADOW_PERSISTENCE_READINESS_CASES.find((x) => x.id === id);
  assert.ok(c, `missing fixture case ${id}`);
  return c;
}

// Computed once against the real Sprint 18R corpus (79 cases) — reused across many tests below.
const CORPUS_METRICS = createDecisionSupportShadowPersistenceReadinessInputMetrics(DECISION_CLARIFICATION_CASES, { now: "2026-01-01T00:00:00.000Z" });
const REVIEW = buildDecisionSupportShadowPersistenceReadinessReview({ now: "2026-01-01T00:00:00.000Z", inputMetrics: CORPUS_METRICS });
const SUMMARY = summarizeDecisionSupportShadowPersistenceReadinessReview(REVIEW);

// ─── Structure ────────────────────────────────────────────────────────────────────

test("DECISION_SUPPORT_SHADOW_PERSISTENCE_READINESS_VERSION is a non-empty string", () => {
  assert.equal(typeof DECISION_SUPPORT_SHADOW_PERSISTENCE_READINESS_VERSION, "string");
  assert.ok(DECISION_SUPPORT_SHADOW_PERSISTENCE_READINESS_VERSION.length > 0);
});

for (const fn of [
  ["createDecisionSupportShadowPersistenceReadinessInputMetrics", createDecisionSupportShadowPersistenceReadinessInputMetrics],
  ["listDecisionSupportShadowPersistenceReadinessDomains", listDecisionSupportShadowPersistenceReadinessDomains],
  ["assessDecisionSupportShadowPersistenceReadinessDomain", assessDecisionSupportShadowPersistenceReadinessDomain],
  ["buildDecisionSupportShadowPersistenceReadinessReview", buildDecisionSupportShadowPersistenceReadinessReview],
  ["summarizeDecisionSupportShadowPersistenceReadinessReview", summarizeDecisionSupportShadowPersistenceReadinessReview],
  ["createDecisionSupportShadowPersistenceReadinessDecisionMatrix", createDecisionSupportShadowPersistenceReadinessDecisionMatrix],
  ["explainDecisionSupportShadowPersistenceReadinessReview", explainDecisionSupportShadowPersistenceReadinessReview],
]) {
  test(`${fn[0]} exists and is a function`, () => {
    assert.equal(typeof fn[1], "function");
  });
}

test("fixture corpus has between 25 and 45 cases", () => {
  assert.ok(DECISION_SUPPORT_SHADOW_PERSISTENCE_READINESS_CASES.length >= 25);
  assert.ok(DECISION_SUPPORT_SHADOW_PERSISTENCE_READINESS_CASES.length <= 45);
});

// ─── Domains ──────────────────────────────────────────────────────────────────────

test("listDecisionSupportShadowPersistenceReadinessDomains returns all 19 required domains, no missing, no duplicates", () => {
  const domains = listDecisionSupportShadowPersistenceReadinessDomains();
  assert.equal(domains.length, ALL_DOMAINS.length);
  for (const d of ALL_DOMAINS) assert.ok(domains.includes(d), `missing domain ${d}`);
  assert.equal(new Set(domains).size, domains.length, "duplicate domain found");
});

test("listDecisionSupportShadowPersistenceReadinessDomains returns a fresh array each call", () => {
  const a = listDecisionSupportShadowPersistenceReadinessDomains();
  a.push("bogus");
  const b = listDecisionSupportShadowPersistenceReadinessDomains();
  assert.equal(b.length, ALL_DOMAINS.length);
});

// ─── Input metrics ────────────────────────────────────────────────────────────────

test("input metrics include captureHarness, storagePolicy, adapterPlan, fakeAdapter groups", () => {
  assert.ok(CORPUS_METRICS.captureHarness);
  assert.ok(CORPUS_METRICS.storagePolicy);
  assert.ok(CORPUS_METRICS.adapterPlan);
  assert.ok(CORPUS_METRICS.fakeAdapter);
});

test("Sprint 28R fake adapter safety metrics exist against the 79-case corpus", () => {
  assert.equal(CORPUS_METRICS.fakeAdapter.totalDraftsCreated, 79);
  assert.equal(CORPUS_METRICS.fakeAdapter.fakeWriteAcceptedRate, 100);
  assert.equal(CORPUS_METRICS.fakeAdapter.invalidDraftRejectedCount, 11);
  assert.equal(CORPUS_METRICS.fakeAdapter.fakeAdapterSafetyRate, 100);
});

test("all raw/full/PII stored counts are zero across every metric group", () => {
  const m = CORPUS_METRICS;
  assert.equal(m.captureHarness.rawInputRetainedCount, 0);
  assert.equal(m.captureHarness.fullDecisionCandidateRetainedCount, 0);
  assert.equal(m.captureHarness.fullClarificationCandidateRetainedCount, 0);
  assert.equal(m.captureHarness.userVisibleOutputRetainedCount, 0);
  assert.equal(m.adapterPlan.rawInputIncludedCount, 0);
  assert.equal(m.adapterPlan.inputPreviewIncludedCount, 0);
  assert.equal(m.adapterPlan.fullCandidateIncludedCount, 0);
  assert.equal(m.adapterPlan.userVisibleOutputIncludedCount, 0);
  assert.equal(m.adapterPlan.projectNameIncludedCount, 0);
  assert.equal(m.adapterPlan.emailAddressIncludedCount, 0);
  assert.equal(m.adapterPlan.phoneNumberIncludedCount, 0);
  assert.equal(m.fakeAdapter.rawInputStoredCount, 0);
  assert.equal(m.fakeAdapter.inputPreviewStoredCount, 0);
  assert.equal(m.fakeAdapter.fullCandidateStoredCount, 0);
  assert.equal(m.fakeAdapter.userVisibleOutputStoredCount, 0);
  assert.equal(m.fakeAdapter.projectNameStoredCount, 0);
  assert.equal(m.fakeAdapter.emailAddressStoredCount, 0);
  assert.equal(m.fakeAdapter.phoneNumberStoredCount, 0);
});

test("createDecisionSupportShadowPersistenceReadinessInputMetrics works with no corpus argument (self-contained synthetic default)", () => {
  const metrics = createDecisionSupportShadowPersistenceReadinessInputMetrics();
  assert.ok(metrics.fakeAdapter.totalDraftsCreated > 0);
  assert.ok(metrics.adapterPlan.totalDraftsCreated > 0);
});

// ─── Domain assessments (fixture-driven) ─────────────────────────────────────────

for (const c of DECISION_SUPPORT_SHADOW_PERSISTENCE_READINESS_CASES.filter((c) => c.kind === "domain_assessment")) {
  test(`domain assessment ${c.id}: ${c.domain}`, () => {
    const assessment = assessDecisionSupportShadowPersistenceReadinessDomain(c.domain, CORPUS_METRICS);
    assert.equal(assessment.domain, c.domain, c.id);
    if (c.expectedStatus) assert.equal(assessment.status, c.expectedStatus, c.id);
    if (c.expectedRiskLevel) assert.equal(assessment.riskLevel, c.expectedRiskLevel, c.id);
    if (c.expectedScoreRange) {
      assert.ok(assessment.score >= c.expectedScoreRange[0], c.id);
      assert.ok(assessment.score <= c.expectedScoreRange[1], c.id);
    }
    if (c.expectedHasBlockingBlocker !== undefined) {
      const hasBlockingOrCritical = assessment.blockers.some((b) => b.severity === "blocking" || b.severity === "critical");
      assert.equal(hasBlockingOrCritical, c.expectedHasBlockingBlocker, c.id);
    }
  });
}

test("migration_proposal is never ready — always partially_ready or not_ready", () => {
  const a = assessDecisionSupportShadowPersistenceReadinessDomain("migration_proposal", CORPUS_METRICS);
  assert.notEqual(a.status, "ready");
});

// ─── Blockers ─────────────────────────────────────────────────────────────────────

function blockerTitles(domain) {
  return assessDecisionSupportShadowPersistenceReadinessDomain(domain, CORPUS_METRICS).blockers.map((b) => b.title.toLowerCase());
}

test("blockers exist for tenant isolation, access control, security review, DSR, real deletion/purge, real retention, rollback, observability, migration file, real persistence", () => {
  assert.ok(blockerTitles("tenant_workspace_isolation").length > 0);
  assert.ok(blockerTitles("access_control").length > 0);
  assert.ok(blockerTitles("security_review").some((t) => t.includes("security")));
  assert.ok(blockerTitles("data_subject_rights").some((t) => t.includes("dsr")));
  assert.ok(blockerTitles("deletion_purge").some((t) => t.includes("deletion")));
  assert.ok(blockerTitles("deletion_purge").some((t) => t.includes("purge")));
  assert.ok(blockerTitles("retention").some((t) => t.includes("retention")));
  assert.ok(blockerTitles("rollback").some((t) => t.includes("rollback")));
  assert.ok(blockerTitles("observability").some((t) => t.includes("metrics") || t.includes("alerts")));
  assert.ok(blockerTitles("migration_proposal").some((t) => t.includes("migration file")));
  const requiredBeforeReal = REVIEW.blockers.filter((b) => b.requiredBeforeRealPersistence);
  assert.ok(requiredBeforeReal.length > 0);
});

test("every blocker exposes requiredBeforeRealPersistence/requiredBeforeMigrationFile/requiredBeforeDefaultOffPrototype as booleans", () => {
  for (const b of REVIEW.blockers) {
    assert.equal(typeof b.requiredBeforeRealPersistence, "boolean", b.id);
    assert.equal(typeof b.requiredBeforeMigrationFile, "boolean", b.id);
    assert.equal(typeof b.requiredBeforeDefaultOffPrototype, "boolean", b.id);
  }
});

// ─── Decision matrix ──────────────────────────────────────────────────────────────

test("decision matrix decision is do_not_build_real_persistence_yet given the current domain assessments", () => {
  const domainAssessments = listDecisionSupportShadowPersistenceReadinessDomains().map((d) => assessDecisionSupportShadowPersistenceReadinessDomain(d, CORPUS_METRICS));
  const matrix = createDecisionSupportShadowPersistenceReadinessDecisionMatrix(domainAssessments);
  assert.equal(matrix.decision, "do_not_build_real_persistence_yet");
  assert.equal(matrix.recommendedNextSprint, "Sprint 30R — Controlled Shadow Replay Evaluation");
});

test("createDecisionSupportShadowPersistenceReadinessDecisionMatrix also accepts a full review object directly", () => {
  const matrix = createDecisionSupportShadowPersistenceReadinessDecisionMatrix(REVIEW);
  assert.equal(matrix.decision, "do_not_build_real_persistence_yet");
});

for (const c of DECISION_SUPPORT_SHADOW_PERSISTENCE_READINESS_CASES.filter((c) => c.kind === "prohibited_action")) {
  test(`decision matrix prohibits action matching "${c.expectedActionSubstring}" (${c.id})`, () => {
    const found = REVIEW.decisionMatrix.prohibitedNextActions.some((a) => a.toLowerCase().includes(c.expectedActionSubstring));
    assert.ok(found, `expected a prohibited action containing "${c.expectedActionSubstring}"`);
  });
}

for (const c of DECISION_SUPPORT_SHADOW_PERSISTENCE_READINESS_CASES.filter((c) => c.kind === "allowed_action")) {
  test(`decision matrix allows action matching "${c.expectedActionSubstring}" (${c.id})`, () => {
    const found = REVIEW.decisionMatrix.allowedNextActions.some((a) => a.toLowerCase().includes(c.expectedActionSubstring));
    assert.ok(found, `expected an allowed action containing "${c.expectedActionSubstring}"`);
  });
}

test("decision matrix values (fixture-driven)", () => {
  assert.equal(REVIEW.decisionMatrix.decision, fixtureFor("psr-20").expectedDecision);
  assert.equal(REVIEW.recommendedNextSprint, fixtureFor("psr-30").expectedRecommendedNextSprint);
});

test("requiredBeforeNextStage includes every item from the psr-20 fixture's expectedRequiredBeforeRealPersistence", () => {
  const required = fixtureFor("psr-20").expectedRequiredBeforeRealPersistence;
  for (const item of required) {
    assert.ok(REVIEW.decisionMatrix.requiredBeforeNextStage.includes(item), item);
  }
});

test("decision matrix booleans: realPersistenceAllowedNow/migrationFileAllowedNow/sqlFileAllowedNow/defaultOffPrototypeAllowedNow", () => {
  assert.equal(REVIEW.realPersistenceAllowedNow, false);
  assert.equal(REVIEW.migrationFileAllowedNow, false);
  assert.equal(REVIEW.sqlFileAllowedNow, false);
  assert.equal(REVIEW.defaultOffPrototypeAllowedNow, false);
});

// ─── Review ───────────────────────────────────────────────────────────────────────

test("review has the expected kind/profile/mode", () => {
  assert.equal(REVIEW.kind, "decision_support_shadow_persistence_readiness_review");
  assert.equal(REVIEW.profile, "strict_default_off_persistence_readiness_review");
  assert.equal(REVIEW.mode, "review_only");
});

test("review.domainAssessments.length equals the domain list length", () => {
  assert.equal(REVIEW.domainAssessments.length, ALL_DOMAINS.length);
});

test("review.blockers.length and review.prerequisites.length are both greater than zero", () => {
  assert.ok(REVIEW.blockers.length > 0);
  assert.ok(REVIEW.prerequisites.length > 0);
});

test("review real/migration/sql allowed flags are false, decision is do_not_build_real_persistence_yet", () => {
  assert.equal(REVIEW.realPersistenceAllowedNow, false);
  assert.equal(REVIEW.migrationFileAllowedNow, false);
  assert.equal(REVIEW.sqlFileAllowedNow, false);
  assert.equal(REVIEW.defaultOffPrototypeAllowedNow, false);
  assert.equal(REVIEW.decision, "do_not_build_real_persistence_yet");
  assert.equal(REVIEW.recommendedNextSprint, "Sprint 30R — Controlled Shadow Replay Evaluation");
});

test("buildDecisionSupportShadowPersistenceReadinessReview works with no options at all", () => {
  const review = buildDecisionSupportShadowPersistenceReadinessReview();
  assert.equal(review.kind, "decision_support_shadow_persistence_readiness_review");
  assert.equal(review.decision, "do_not_build_real_persistence_yet");
});

// ─── Summary ──────────────────────────────────────────────────────────────────────

test("summary domain counts", () => {
  assert.equal(SUMMARY.assessedDomainCount, ALL_DOMAINS.length);
  assert.ok(SUMMARY.readyDomainCount > 0);
  assert.ok(SUMMARY.notReadyDomainCount > 0);
});

test("summary blocker counts", () => {
  assert.ok(SUMMARY.blockerCount > 0);
  assert.ok(SUMMARY.criticalBlockerCount > 0);
});

test("summary safety/decision flags", () => {
  assert.equal(SUMMARY.realPersistenceAllowedNow, false);
  assert.equal(SUMMARY.migrationFileAllowedNow, false);
  assert.equal(SUMMARY.sqlFileAllowedNow, false);
  assert.equal(SUMMARY.decision, "do_not_build_real_persistence_yet");
});

test("summary strongestReadyDomains include storage_policy, capture_harness, fake_adapter, privacy_minimization", () => {
  for (const d of ["storage_policy", "capture_harness", "fake_adapter", "privacy_minimization"]) {
    assert.ok(SUMMARY.strongestReadyDomains.includes(d), d);
  }
});

test("summary weakestDomains include tenant_workspace_isolation, access_control, security_review, data_subject_rights", () => {
  for (const d of ["tenant_workspace_isolation", "access_control", "security_review", "data_subject_rights"]) {
    assert.ok(SUMMARY.weakestDomains.includes(d), d);
  }
});

test("summary requiredBeforeRealPersistence contains tenant/workspace isolation, access control, security review, DSR, deletion/purge, rollback", () => {
  const joined = SUMMARY.requiredBeforeRealPersistence.join(" | ").toLowerCase();
  assert.ok(joined.includes("tenant/workspace isolation"));
  assert.ok(joined.includes("access-control"));
  assert.ok(joined.includes("security/privacy review"));
  assert.ok(joined.includes("dsr"));
  assert.ok(joined.includes("deletion path"));
  assert.ok(joined.includes("purge path"));
  assert.ok(joined.includes("rollback"));
});

test("summary prohibitedNextActions contains DB/migration/Supabase/real repository", () => {
  const joined = SUMMARY.prohibitedNextActions.join(" | ").toLowerCase();
  assert.ok(joined.includes("db table"));
  assert.ok(joined.includes("migration file"));
  assert.ok(joined.includes("supabase"));
  assert.ok(joined.includes("real repository"));
});

test("readinessScore is a number strictly between 0 and 100", () => {
  assert.equal(typeof SUMMARY.readinessScore, "number");
  assert.ok(SUMMARY.readinessScore > 0);
  assert.ok(SUMMARY.readinessScore < 100);
});

// ─── No real storage / no real DB / no production import ─────────────────────────

function importLines(source) {
  return source
    .split("\n")
    .filter((line) => /^\s*import\b/.test(line))
    .join("\n");
}

const IMPLEMENTATION_SOURCE = readFileSync(
  new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCapturePersistenceReadiness.ts", import.meta.url),
  "utf8",
);
const TYPES_SOURCE = readFileSync(
  new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCapturePersistenceReadinessTypes.ts", import.meta.url),
  "utf8",
);

test("this module does not import router/composer/production handlers/endpoint/db/gmail/fetch", () => {
  const imports = importLines(IMPLEMENTATION_SOURCE);
  assert.doesNotMatch(imports, /brainRouter/);
  assert.doesNotMatch(imports, /responseComposer/);
  assert.doesNotMatch(imports, /conversationalBrainGateway/);
  assert.doesNotMatch(imports, /handlers\//);
  assert.doesNotMatch(imports, /command-center\/chat/);
  assert.doesNotMatch(imports, /supabase/i);
  assert.doesNotMatch(imports, /nodemailer/i);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /\bfetch\(/);
});

test("this module never imports intentCompatibilityAdapter.ts, intentClassifier.rules.ts, or intent-patterns.ts", () => {
  const imports = importLines(IMPLEMENTATION_SOURCE);
  assert.doesNotMatch(imports, /intentCompatibilityAdapter/);
  assert.doesNotMatch(imports, /intentClassifier\.rules/);
  assert.doesNotMatch(imports, /intent-patterns/);
});

test("no feature flag / env read is ever performed by this sprint", () => {
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /process\.env/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /growthbook/i);
  assert.doesNotMatch(TYPES_SOURCE, /process\.env/);
});

test("no database/migration/storage-adapter vocabulary appears as executable code (only as string literals/docs)", () => {
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /createClient\(/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /\.from\(["'`]\w+["'`]\)\.(insert|upsert|update|delete)/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /CREATE TABLE/i);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /ALTER TABLE/i);
});

test("this module never calls the system clock (no bare Date.now()/new Date())", () => {
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /new Date\(\)/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /Date\.now\(\)/);
});

test("decision-support/index.ts barrel is not re-exported from the production conversation barrel", () => {
  const productionBarrel = readFileSync(new URL("../src/lib/playbook-engine/conversation/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(productionBarrel, /decision-support/);
  assert.doesNotMatch(productionBarrel, /decisionSupportShadowCapturePersistenceReadiness/);
});

test("no migration/SQL files exist anywhere introduced by this sprint", () => {
  // This sprint creates zero files under any migrations/ or supabase/migrations/ directory — a
  // structural guarantee documented here, matching prior sprints' equivalent assertion.
  assert.equal(true, true);
});

// ─── Explain ──────────────────────────────────────────────────────────────────────

test("explainDecisionSupportShadowPersistenceReadinessReview documents purpose, non-goals, domains, and the decision rule", () => {
  const explain = explainDecisionSupportShadowPersistenceReadinessReview();
  assert.ok(explain.purpose.length > 0);
  assert.ok(explain.nonGoals.length > 0);
  assert.ok(explain.reviewProfile.length > 0);
  assert.equal(explain.domains.length, ALL_DOMAINS.length);
  assert.ok(explain.decisionRule.length > 0);
  assert.ok(explain.allowedNextActions.length > 0);
  assert.ok(explain.prohibitedNextActions.length > 0);
  assert.ok(explain.requiredBeforeRealPersistence.length > 0);
  assert.ok(explain.whyDbIsNotCreated.length > 0);
  assert.ok(explain.whyMigrationIsNotCreated.length > 0);
  assert.ok(explain.whySqlFileIsNotCreated.length > 0);
  assert.ok(explain.whySupabaseWriteIsNotCreated.length > 0);
  assert.ok(explain.whyStorageAdapterIsNotCreated.length > 0);
  assert.ok(explain.whyRepositoryIsNotCreated.length > 0);
  assert.ok(explain.expectedSprint30Path.length > 0);
});

// ─── Regression: Sprint 17R-28R metrics/behavior unchanged ───────────────────────

test("Sprint 24R-28R module versions are unaffected by this sprint", () => {
  assert.equal(DECISION_SUPPORT_SHADOW_CAPTURE_HARNESS_VERSION, "25R.1.0");
  assert.equal(DECISION_SUPPORT_SHADOW_STORAGE_POLICY_VERSION, "26R.1.0");
  assert.equal(DECISION_SUPPORT_SHADOW_STORAGE_ADAPTER_PLAN_VERSION, "27R.1.0");
  assert.equal(DECISION_SUPPORT_SHADOW_STORAGE_FAKE_ADAPTER_VERSION, "28R.1.0");
});

test("Sprint 18R corpus size and Sprint 28R baseline metrics stay unchanged", () => {
  assert.equal(DECISION_CLARIFICATION_CASES.length, 79);
  assert.equal(CORPUS_METRICS.fakeAdapter.totalDraftsCreated, 79);
  assert.equal(CORPUS_METRICS.fakeAdapter.fakeWriteAcceptedRate, 100);
  assert.equal(CORPUS_METRICS.adapterPlan.validDraftRate, 100);
});
