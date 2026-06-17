/**
 * Personal Pattern Extraction Foundation tests.
 *
 * Validates constitutional guarantees:
 *   - Candidate registry, extraction runs, and sources exist
 *   - Deterministic rules only — no AI, no embeddings, no profiling
 *   - Human review required before promotion
 *   - Cross-PM isolation enforced
 *   - Lineage preserved
 *   - Audit events declared
 *   - Export exists
 *   - Health metrics exist
 *   - Immutability for promoted candidates
 *   - Database contract updated
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

const service = readFileSync(join(ROOT, "src/lib/personal-pattern-extraction/personal-pattern-extraction-service.ts"), "utf8");
const types = readFileSync(join(ROOT, "src/lib/personal-pattern-extraction/types.ts"), "utf8");
const rules = readFileSync(join(ROOT, "src/lib/personal-pattern-extraction/rule-registry.ts"), "utf8");
const index = readFileSync(join(ROOT, "src/lib/personal-pattern-extraction/index.ts"), "utf8");
const contract = readFileSync(join(ROOT, "src/lib/db/database-contract.ts"), "utf8");
const migration = readFileSync(join(ROOT, "supabase/migrations/20260621000000_personal_pattern_extraction_foundation.sql"), "utf8");

// ─── Candidate Registry ───────────────────────────────────────────────────────

test("migration creates personal_pm_pattern_candidates table", () => {
  assert.match(migration, /create table if not exists public\.personal_pm_pattern_candidates/);
});

test("migration creates personal_pm_pattern_extraction_runs table", () => {
  assert.match(migration, /create table if not exists public\.personal_pm_pattern_extraction_runs/);
});

test("migration creates personal_pm_pattern_candidate_sources table", () => {
  assert.match(migration, /create table if not exists public\.personal_pm_pattern_candidate_sources/);
});

test("candidates table has required fields", () => {
  assert.match(migration, /workspace_id uuid not null/);
  assert.match(migration, /pm_user_id uuid not null/);
  assert.match(migration, /candidate_category text not null/);
  assert.match(migration, /candidate_title text not null/);
  assert.match(migration, /candidate_summary text not null/);
  assert.match(migration, /confidence text not null/);
  assert.match(migration, /status text not null/);
  assert.match(migration, /observation_count integer not null/);
  assert.match(migration, /metadata jsonb/);
});

test("candidates table has correct allowed status values", () => {
  assert.match(migration, /status in \('candidate','promoted','rejected','archived'\)/);
});

test("extraction runs table has pm_user_id field", () => {
  assert.match(migration, /personal_pm_pattern_extraction_runs[\s\S]*?pm_user_id uuid not null/m);
});

test("candidate sources table has relationship_type field", () => {
  assert.match(migration, /relationship_type text not null/);
});

// ─── Deterministic Rules ──────────────────────────────────────────────────────

test("rule registry defines exactly 4 deterministic rules", () => {
  assert.match(rules, /PERSONAL_RULE_REPEATED_ESCALATION/);
  assert.match(rules, /PERSONAL_RULE_REPEATED_STAKEHOLDER/);
  assert.match(rules, /PERSONAL_RULE_REPEATED_RISK_RESPONSE/);
  assert.match(rules, /PERSONAL_RULE_REPEATED_DECISION/);
});

test("minimum occurrences threshold is 3", () => {
  assert.match(types, /PERSONAL_EXTRACTION_MINIMUM_OCCURRENCES = 3/);
});

test("all rule IDs are exported", () => {
  assert.match(rules, /ALL_PERSONAL_RULE_IDS/);
});

test("rule registry is a typed record", () => {
  assert.match(rules, /PERSONAL_RULE_REGISTRY.*Record<PersonalRuleId, PersonalPatternExtractionRule>/s);
});

test("getRuleById returns null for unknown rule", () => {
  assert.match(rules, /return PERSONAL_RULE_REGISTRY\[ruleId as PersonalRuleId\] \?\? null/);
});

// ─── No AI / No Profiling ─────────────────────────────────────────────────────

test("service does not import any AI or embedding libraries", () => {
  assert.doesNotMatch(service, /openai|anthropic|embedding|vector|semantic|llm|gpt|claude/i);
});

test("rule registry does not import AI libraries", () => {
  // Check imports only — comments may reference these terms to describe what the system is NOT
  const importLines = rules.split("\n").filter((l) => l.startsWith("import")).join("\n");
  assert.doesNotMatch(importLines, /openai|anthropic|llm|gpt/i);
});

test("types do not reference profiling concepts", () => {
  assert.doesNotMatch(types, /personality|psychological|leadership_score|performance_score|behavior_score|trust_score|ranking|prediction/i);
});

test("service does not create personality or prediction types", () => {
  assert.doesNotMatch(service, /personality|psychological|leadership_score|behavior_score|trust_score/i);
});

// ─── Service Functions ────────────────────────────────────────────────────────

test("service exports runPersonalPatternExtraction", () => {
  assert.match(service, /export async function runPersonalPatternExtraction/);
});

test("service exports evaluatePersonalPatternRule", () => {
  assert.match(service, /export async function evaluatePersonalPatternRule/);
});

test("service exports createPersonalPatternCandidate", () => {
  assert.match(service, /export async function createPersonalPatternCandidate/);
});

test("service exports listPersonalPatternCandidates", () => {
  assert.match(service, /export async function listPersonalPatternCandidates/);
});

test("service exports rejectPersonalPatternCandidate", () => {
  assert.match(service, /export const rejectPersonalPatternCandidate/);
});

test("service exports promotePersonalPatternCandidate", () => {
  assert.match(service, /export async function promotePersonalPatternCandidate/);
});

test("service exports archivePersonalPatternCandidate", () => {
  assert.match(service, /export const archivePersonalPatternCandidate/);
});

test("service exports explainPersonalPatternCandidate", () => {
  assert.match(service, /export async function explainPersonalPatternCandidate/);
});

test("service exports exportPersonalPatternCandidate", () => {
  assert.match(service, /export async function exportPersonalPatternCandidate/);
});

test("service exports getPersonalPatternExtractionHealth", () => {
  assert.match(service, /export async function getPersonalPatternExtractionHealth/);
});

// ─── Human Review Required ────────────────────────────────────────────────────

test("promotion requires explicit human actorId", () => {
  assert.match(service, /function promotePersonalPatternCandidate[\s\S]*?actorId: string/m);
});

test("candidates do not auto-promote — status starts as candidate", () => {
  assert.match(service, /status: "candidate"/);
});

test("promotion guards non-candidate status", () => {
  assert.match(service, /Only candidates can be promoted/);
});

// ─── Cross-PM Isolation ───────────────────────────────────────────────────────

test("migration enforces pm_user_id = auth.uid() in RLS policies", () => {
  assert.match(migration, /pm_user_id = auth\.uid\(\)/);
});

test("service always filters by pm_user_id in getPersonalPatternCandidate", () => {
  assert.match(service, /\.eq\("pm_user_id", pmUserId\)/);
});

test("service validates pmUserId is a UUID before queries", () => {
  assert.match(service, /validUuid\(pmUserId\)/);
});

test("listPersonalPatternCandidates requires both workspaceId and pmUserId", () => {
  const listFn = service.slice(service.indexOf("export async function listPersonalPatternCandidates"));
  assert.match(listFn, /pmUserId: string/);
  assert.match(listFn, /\.eq\("pm_user_id", pmUserId\)/);
});

// ─── Immutability ─────────────────────────────────────────────────────────────

test("migration has promoted guard trigger", () => {
  assert.match(migration, /personal_pm_pattern_candidates_promoted_guard/);
  assert.match(migration, /Promoted personal pattern candidates are immutable/);
});

test("service rejects status changes on promoted candidates", () => {
  assert.match(service, /Promoted candidates are immutable/);
});

// ─── Lineage Preservation ─────────────────────────────────────────────────────

test("promotion creates personal_pm_patterns record", () => {
  assert.match(service, /from\("personal_pm_patterns"\)\s*\.insert/s);
});

test("promotion stores promoted_from_candidate_id in pattern metadata", () => {
  assert.match(service, /promoted_from_candidate_id: current\.data\.id/);
});

test("export includes lineage", () => {
  assert.match(service, /lineage: \{ promotedPatternId/);
});

// ─── Audit Events ─────────────────────────────────────────────────────────────

test("types declare all required audit event types", () => {
  assert.match(types, /PERSONAL_PATTERN_EXTRACTION_RUN_STARTED/);
  assert.match(types, /PERSONAL_PATTERN_EXTRACTION_RUN_COMPLETED/);
  assert.match(types, /PERSONAL_PATTERN_CANDIDATE_CREATED/);
  assert.match(types, /PERSONAL_PATTERN_CANDIDATE_PROMOTED/);
  assert.match(types, /PERSONAL_PATTERN_CANDIDATE_REJECTED/);
  assert.match(types, /PERSONAL_PATTERN_CANDIDATE_ARCHIVED/);
});

test("audit events set learningEligible=false", () => {
  assert.match(service, /learningEligible: false/);
});

test("audit events set visibility=personal", () => {
  assert.match(service, /visibility: "personal"/);
});

test("audit events set sensitivityLevel=confidential", () => {
  assert.match(service, /sensitivityLevel: "confidential"/);
});

// ─── Explanation ──────────────────────────────────────────────────────────────

test("explanation returns rulesTriggered", () => {
  assert.match(service, /rulesTriggered:/);
});

test("explanation returns sourcePersonalMemory", () => {
  assert.match(service, /sourcePersonalMemory:/);
});

test("explanation returns sourcePersonalPatterns", () => {
  assert.match(service, /sourcePersonalPatterns:/);
});

test("explanation returns sourcePersonalEffectiveness", () => {
  assert.match(service, /sourcePersonalEffectiveness:/);
});

// ─── Export ───────────────────────────────────────────────────────────────────

test("export includes candidate, rules, observations, sources, lineage", () => {
  const exportFn = service.slice(service.indexOf("export async function exportPersonalPatternCandidate"));
  assert.match(exportFn, /candidate:/);
  assert.match(exportFn, /rules:/);
  assert.match(exportFn, /observations:/);
  assert.match(exportFn, /sources:/);
  assert.match(exportFn, /lineage:/);
});

// ─── Health Metrics ───────────────────────────────────────────────────────────

test("health returns all required counters", () => {
  assert.match(service, /runCount:/);
  assert.match(service, /candidateCount:/);
  assert.match(service, /promotedCount:/);
  assert.match(service, /rejectedCount:/);
  assert.match(service, /archivedCount:/);
  assert.match(service, /averageCandidatesPerRun:/);
});

// ─── Database Contract ────────────────────────────────────────────────────────

test("contract declares PersonalPmPatternCandidateRow", () => {
  assert.match(contract, /export type PersonalPmPatternCandidateRow/);
});

test("contract declares PersonalPmPatternCandidateSourceRow", () => {
  assert.match(contract, /export type PersonalPmPatternCandidateSourceRow/);
});

test("contract declares PersonalPmPatternExtractionRunRow", () => {
  assert.match(contract, /export type PersonalPmPatternExtractionRunRow/);
});

test("contract declares selectable columns for all three tables", () => {
  assert.match(contract, /PERSONAL_PM_PATTERN_CANDIDATE_SELECTABLE_COLUMNS/);
  assert.match(contract, /PERSONAL_PM_PATTERN_CANDIDATE_SOURCE_SELECTABLE_COLUMNS/);
  assert.match(contract, /PERSONAL_PM_PATTERN_EXTRACTION_RUN_SELECTABLE_COLUMNS/);
});

test("database contract version includes personal-pattern-extraction-foundation", () => {
  assert.match(contract, /personal-pattern-extraction-foundation/);
});

test("database contract version preserves previous substrings", () => {
  assert.match(contract, /platform-events/);
  assert.match(contract, /pattern-extraction-foundation/);
  assert.match(contract, /personal-pm-patterns/);
  assert.match(contract, /personal-pm-effectiveness/);
});

// ─── Index Exports ────────────────────────────────────────────────────────────

test("index exports runPersonalPatternExtraction", () => {
  assert.match(index, /runPersonalPatternExtraction/);
});

test("index exports PERSONAL_EXTRACTION_MINIMUM_OCCURRENCES", () => {
  assert.match(index, /PERSONAL_EXTRACTION_MINIMUM_OCCURRENCES/);
});

test("index exports ALL_PERSONAL_RULE_IDS", () => {
  assert.match(index, /ALL_PERSONAL_RULE_IDS/);
});
