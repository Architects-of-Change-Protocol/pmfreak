import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  calculateDecisionEffectiveness,
  classifyEffectivenessLevel,
} from '../src/lib/operational-decision-outcome/effectiveness-engine.ts';
import { calculateRecommendationQuality } from '../src/lib/operational-decision-outcome/quality-engine.ts';
import {
  calculateOutcomeVariance,
  classifyOutcomeByEffectiveness,
} from '../src/lib/operational-decision-outcome/variance-engine.ts';
import { generateOutcomeLearning } from '../src/lib/operational-decision-outcome/learning-engine.ts';
import { updateRecommendationEffectiveness } from '../src/lib/operational-decision-outcome/evolution-engine.ts';
import { compareDecisionOutcomes } from '../src/lib/operational-decision-outcome/comparison-engine.ts';
import { validateOutcomeEvidence } from '../src/lib/operational-decision-outcome/evidence-engine.ts';
import {
  OUTCOME_STATUSES,
  RECOMMENDATION_QUALITIES,
  OUTCOME_OBSERVATION_TYPES,
  OUTCOME_EFFECT_TYPES,
  LEARNING_FEEDBACK_TYPES,
} from '../src/lib/operational-decision-outcome/types.ts';

const migration = readFileSync('supabase/migrations/20260713000000_operational_decision_outcome_engine.sql', 'utf8');
const types     = readFileSync('src/lib/operational-decision-outcome/types.ts', 'utf8');
const docs      = readFileSync('docs/decision-outcome-engine.md', 'utf8');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uuid(n = 1) {
  return `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;
}

function makeOutcome(overrides = {}) {
  return {
    id: uuid(1),
    workspace_id: uuid(2),
    decision_id: uuid(3),
    outcome_status: 'evaluated',
    expected_impact_score: 90,
    actual_impact_score: 82,
    effectiveness_score: 91,
    recommendation_quality: 'excellent',
    outcome_variance: -8,
    observed_at: '2026-07-13T10:00:00.000Z',
    evaluated_at: '2026-07-13T11:00:00.000Z',
    created_at: '2026-07-13T09:00:00.000Z',
    updated_at: '2026-07-13T11:00:00.000Z',
    ...overrides,
  };
}

function makeObservation(type, value) {
  return {
    id: uuid(10),
    workspace_id: uuid(2),
    outcome_id: uuid(1),
    observation_type: type,
    observation_value: value,
    observation_source: 'system_health_check',
    observed_by: uuid(99),
    observed_at: '2026-07-13T10:00:00.000Z',
    created_at: '2026-07-13T10:00:00.000Z',
  };
}

function makeEffect(type, before, after) {
  const improvement = before !== 0
    ? ((after - before) / Math.abs(before)) * 100
    : after > 0 ? 100 : 0;
  return {
    id: uuid(20),
    workspace_id: uuid(2),
    outcome_id: uuid(1),
    effect_type: type,
    before_value: before,
    after_value: after,
    improvement_percentage: improvement,
    created_at: '2026-07-13T10:00:00.000Z',
  };
}

function makeLearning(shouldRecommend = true) {
  return {
    id: uuid(30),
    workspace_id: uuid(2),
    outcome_id: uuid(1),
    learning_type: 'decision_pattern',
    learning_summary: 'Test learning summary.',
    confidence_score: 0.85,
    should_recommend_again: shouldRecommend,
    created_at: '2026-07-13T11:00:00.000Z',
  };
}

// ─── Migration ────────────────────────────────────────────────────────────────

test('migration creates operational_decision_outcomes table', () => {
  assert.match(migration, /create table if not exists public\.operational_decision_outcomes/);
});

test('migration creates operational_outcome_observations table', () => {
  assert.match(migration, /create table if not exists public\.operational_outcome_observations/);
});

test('migration creates operational_outcome_effects table', () => {
  assert.match(migration, /create table if not exists public\.operational_outcome_effects/);
});

test('migration creates operational_learning_feedback table', () => {
  assert.match(migration, /create table if not exists public\.operational_learning_feedback/);
});

test('migration defines all outcome_status values', () => {
  for (const s of ['pending', 'observed', 'evaluated', 'successful', 'partially_successful', 'unsuccessful', 'archived']) {
    assert.match(migration, new RegExp(s));
  }
});

test('migration defines all recommendation_quality values', () => {
  for (const q of ['poor', 'fair', 'good', 'very_good', 'excellent']) {
    assert.match(migration, new RegExp(`'${q}'`));
  }
});

test('migration defines all observation_type values', () => {
  for (const t of ['governance_health', 'execution_health', 'risk_reduction', 'authority_recovery', 'ratification_speed']) {
    assert.match(migration, new RegExp(t));
  }
});

test('migration enables RLS on all four tables', () => {
  assert.match(migration, /alter table public\.operational_decision_outcomes enable row level security/);
  assert.match(migration, /alter table public\.operational_outcome_observations enable row level security/);
  assert.match(migration, /alter table public\.operational_outcome_effects enable row level security/);
  assert.match(migration, /alter table public\.operational_learning_feedback enable row level security/);
});

test('migration uses is_workspace_member for RLS policies', () => {
  const count = (migration.match(/is_workspace_member/g) || []).length;
  assert.ok(count >= 4, `Expected ≥4 is_workspace_member usages, found ${count}`);
});

test('migration enforces FK from decision_outcomes to operational_decisions', () => {
  assert.match(migration, /odo_decision_workspace_fk/);
  assert.match(migration, /references public\.operational_decisions\(id, workspace_id\)/);
});

test('migration includes updated_at trigger', () => {
  assert.match(migration, /odo_updated_at/);
});

// ─── Types ────────────────────────────────────────────────────────────────────

test('types exports OutcomeStatus union', () => {
  for (const s of OUTCOME_STATUSES) {
    assert.ok(typeof s === 'string');
  }
  assert.equal(OUTCOME_STATUSES.length, 7);
});

test('types exports RecommendationQuality union', () => {
  assert.deepEqual(RECOMMENDATION_QUALITIES, ['poor', 'fair', 'good', 'very_good', 'excellent']);
});

test('types exports OutcomeObservationType array', () => {
  assert.equal(OUTCOME_OBSERVATION_TYPES.length, 8);
  assert.ok(OUTCOME_OBSERVATION_TYPES.includes('governance_health'));
  assert.ok(OUTCOME_OBSERVATION_TYPES.includes('risk_reduction'));
});

test('types exports OutcomeEffectType array', () => {
  assert.equal(OUTCOME_EFFECT_TYPES.length, 8);
});

test('types exports LearningFeedbackType array', () => {
  assert.equal(LEARNING_FEEDBACK_TYPES.length, 6);
  assert.ok(LEARNING_FEEDBACK_TYPES.includes('decision_pattern'));
  assert.ok(LEARNING_FEEDBACK_TYPES.includes('recommendation_calibration'));
});

// ─── Variance Engine ──────────────────────────────────────────────────────────

test('variance: positive when actual > expected', () => {
  const v = calculateOutcomeVariance(80, 90);
  assert.ok(v.variance > 0);
  assert.match(v.variancePercentage, /\+/);
});

test('variance: negative when actual < expected', () => {
  const v = calculateOutcomeVariance(90, 82);
  assert.ok(v.variance < 0);
  assert.match(v.variancePercentage, /-/);
});

test('variance: zero when equal', () => {
  const v = calculateOutcomeVariance(75, 75);
  assert.equal(v.variance, 0);
  assert.equal(v.variancePercentage, '0%');
});

test('variance: handles zero expected', () => {
  const v = calculateOutcomeVariance(0, 50);
  assert.equal(v.variancePercentage, '0%');
});

test('variance: returns correct expected and actual', () => {
  const v = calculateOutcomeVariance(90, 82);
  assert.equal(v.expected, 90);
  assert.equal(v.actual, 82);
});

// ─── Effectiveness Engine ─────────────────────────────────────────────────────

test('effectiveness: perfect score with full match', () => {
  const observations = [
    makeObservation('governance_health', 90),
    makeObservation('execution_health', 90),
  ];
  const effects = [
    makeEffect('governance_health', 70, 88),
    makeEffect('risk_reduction', 40, 80),
  ];
  const score = calculateDecisionEffectiveness({
    expectedImpactScore: 90,
    actualImpactScore: 90,
    observations,
    effects,
  });
  assert.ok(score > 60, `score should be > 60, got ${score}`);
});

test('effectiveness: zero when no observations and no actual impact', () => {
  const score = calculateDecisionEffectiveness({
    expectedImpactScore: 90,
    actualImpactScore: 0,
    observations: [],
    effects: [],
  });
  assert.equal(score, 0);
});

test('effectiveness: returns value in 0–100 range', () => {
  const score = calculateDecisionEffectiveness({
    expectedImpactScore: 100,
    actualImpactScore: 95,
    observations: [makeObservation('governance_health', 80)],
    effects: [makeEffect('risk_reduction', 50, 90)],
  });
  assert.ok(score >= 0 && score <= 100);
});

test('effectiveness level: very_low for score 0–20', () => {
  assert.equal(classifyEffectivenessLevel(10), 'very_low');
  assert.equal(classifyEffectivenessLevel(0), 'very_low');
  assert.equal(classifyEffectivenessLevel(20), 'very_low');
});

test('effectiveness level: low for score 21–40', () => {
  assert.equal(classifyEffectivenessLevel(21), 'low');
  assert.equal(classifyEffectivenessLevel(40), 'low');
});

test('effectiveness level: medium for score 41–60', () => {
  assert.equal(classifyEffectivenessLevel(41), 'medium');
  assert.equal(classifyEffectivenessLevel(60), 'medium');
});

test('effectiveness level: high for score 61–80', () => {
  assert.equal(classifyEffectivenessLevel(61), 'high');
  assert.equal(classifyEffectivenessLevel(80), 'high');
});

test('effectiveness level: excellent for score 81–100', () => {
  assert.equal(classifyEffectivenessLevel(81), 'excellent');
  assert.equal(classifyEffectivenessLevel(100), 'excellent');
});

// ─── Recommendation Quality Engine ───────────────────────────────────────────

test('quality: poor for 0–20', () => {
  assert.equal(calculateRecommendationQuality(0), 'poor');
  assert.equal(calculateRecommendationQuality(20), 'poor');
});

test('quality: fair for 21–40', () => {
  assert.equal(calculateRecommendationQuality(21), 'fair');
  assert.equal(calculateRecommendationQuality(40), 'fair');
});

test('quality: good for 41–60', () => {
  assert.equal(calculateRecommendationQuality(41), 'good');
  assert.equal(calculateRecommendationQuality(60), 'good');
});

test('quality: very_good for 61–80', () => {
  assert.equal(calculateRecommendationQuality(61), 'very_good');
  assert.equal(calculateRecommendationQuality(80), 'very_good');
});

test('quality: excellent for 81–100', () => {
  assert.equal(calculateRecommendationQuality(81), 'excellent');
  assert.equal(calculateRecommendationQuality(100), 'excellent');
});

// ─── Outcome Classification ───────────────────────────────────────────────────

test('classification: successful for score 90+', () => {
  assert.equal(classifyOutcomeByEffectiveness(90), 'successful');
  assert.equal(classifyOutcomeByEffectiveness(100), 'successful');
});

test('classification: partially_successful for score 70–89', () => {
  assert.equal(classifyOutcomeByEffectiveness(70), 'partially_successful');
  assert.equal(classifyOutcomeByEffectiveness(89), 'partially_successful');
});

test('classification: unsuccessful for score 0–69', () => {
  assert.equal(classifyOutcomeByEffectiveness(0), 'unsuccessful');
  assert.equal(classifyOutcomeByEffectiveness(69), 'unsuccessful');
});

// ─── Learning Feedback Engine ─────────────────────────────────────────────────

test('learning: generates decision_pattern for high effectiveness', () => {
  const l = generateOutcomeLearning({
    decisionId: uuid(1),
    decisionCategory: 'governance',
    effectivenessScore: 91,
    effectivenessLevel: 'excellent',
    recommendationQuality: 'excellent',
    outcomeStatus: 'successful',
  });
  assert.equal(l.learningType, 'decision_pattern');
  assert.ok(l.shouldRecommendAgain);
  assert.ok(l.confidenceScore > 0.5);
});

test('learning: generates quality_signal for medium effectiveness', () => {
  const l = generateOutcomeLearning({
    decisionId: uuid(1),
    decisionCategory: 'execution',
    effectivenessScore: 55,
    effectivenessLevel: 'medium',
    recommendationQuality: 'good',
    outcomeStatus: 'partially_successful',
  });
  assert.equal(l.learningType, 'quality_signal');
});

test('learning: generates effectiveness_signal for low effectiveness', () => {
  const l = generateOutcomeLearning({
    decisionId: uuid(1),
    decisionCategory: 'risk',
    effectivenessScore: 30,
    effectivenessLevel: 'low',
    recommendationQuality: 'fair',
    outcomeStatus: 'unsuccessful',
  });
  assert.equal(l.learningType, 'effectiveness_signal');
  assert.equal(l.shouldRecommendAgain, false);
});

test('learning: should_recommend_again false when score < 60', () => {
  const l = generateOutcomeLearning({
    decisionId: uuid(1),
    decisionCategory: 'authority',
    effectivenessScore: 59,
    effectivenessLevel: 'medium',
    recommendationQuality: 'good',
    outcomeStatus: 'partially_successful',
  });
  assert.equal(l.shouldRecommendAgain, false);
});

test('learning: learning_summary includes category and score', () => {
  const l = generateOutcomeLearning({
    decisionId: uuid(1),
    decisionCategory: 'ratification',
    effectivenessScore: 91,
    effectivenessLevel: 'excellent',
    recommendationQuality: 'excellent',
    outcomeStatus: 'successful',
  });
  assert.ok(l.learningSummary.includes('ratification'));
  assert.ok(l.learningSummary.includes('91'));
});

test('learning: confidence_score is between 0 and 1', () => {
  for (const score of [0, 50, 91, 100]) {
    const l = generateOutcomeLearning({
      decisionId: uuid(1),
      decisionCategory: 'governance',
      effectivenessScore: score,
      effectivenessLevel: classifyEffectivenessLevel(score),
      recommendationQuality: calculateRecommendationQuality(score),
      outcomeStatus: 'evaluated',
    });
    assert.ok(l.confidenceScore >= 0 && l.confidenceScore <= 1,
      `confidence_score out of range for score ${score}: ${l.confidenceScore}`);
  }
});

// ─── Recommendation Evolution Engine ─────────────────────────────────────────

test('evolution: produces correct effectiveness level', () => {
  const r = updateRecommendationEffectiveness({
    decisionId: uuid(1),
    workspaceId: uuid(2),
    effectivenessScore: 91,
    learningRecords: [makeLearning(true)],
  });
  assert.equal(r.effectivenessLevel, 'excellent');
  assert.equal(r.recommendationQuality, 'excellent');
  assert.equal(r.shouldRecommendAgain, true);
  assert.equal(r.evidenceCount, 1);
});

test('evolution: majority vote for shouldRecommendAgain', () => {
  const records = [makeLearning(true), makeLearning(true), makeLearning(false)];
  const r = updateRecommendationEffectiveness({
    decisionId: uuid(1),
    workspaceId: uuid(2),
    effectivenessScore: 75,
    learningRecords: records,
  });
  assert.equal(r.shouldRecommendAgain, true);
  assert.equal(r.evidenceCount, 3);
});

test('evolution: falls back on score when no learning records', () => {
  const r = updateRecommendationEffectiveness({
    decisionId: uuid(1),
    workspaceId: uuid(2),
    effectivenessScore: 59,
    learningRecords: [],
  });
  assert.equal(r.shouldRecommendAgain, false);
  assert.equal(r.evidenceCount, 0);
});

test('evolution: includes decisionId and workspaceId', () => {
  const r = updateRecommendationEffectiveness({
    decisionId: uuid(1),
    workspaceId: uuid(2),
    effectivenessScore: 85,
    learningRecords: [],
  });
  assert.equal(r.decisionId, uuid(1));
  assert.equal(r.workspaceId, uuid(2));
});

// ─── Outcome Comparison Engine ────────────────────────────────────────────────

test('comparison: correct winner when A > B', () => {
  const a = makeOutcome({ id: uuid(1), effectiveness_score: 91 });
  const b = makeOutcome({ id: uuid(2), effectiveness_score: 64 });
  const c = compareDecisionOutcomes(a, b);
  assert.equal(c.winner, 'a');
  assert.ok(c.effectivenessDifference > 0);
});

test('comparison: correct winner when B > A', () => {
  const a = makeOutcome({ id: uuid(1), effectiveness_score: 55 });
  const b = makeOutcome({ id: uuid(2), effectiveness_score: 80 });
  const c = compareDecisionOutcomes(a, b);
  assert.equal(c.winner, 'b');
});

test('comparison: tie when scores equal', () => {
  const a = makeOutcome({ id: uuid(1), effectiveness_score: 75 });
  const b = makeOutcome({ id: uuid(2), effectiveness_score: 75 });
  const c = compareDecisionOutcomes(a, b);
  assert.equal(c.winner, 'tie');
});

test('comparison: ranking is ordered descending', () => {
  const a = makeOutcome({ id: uuid(1), effectiveness_score: 91 });
  const b = makeOutcome({ id: uuid(2), effectiveness_score: 64 });
  const c = compareDecisionOutcomes(a, b);
  assert.equal(c.ranking[0].rank, 1);
  assert.ok(c.ranking[0].effectivenessScore >= c.ranking[1].effectivenessScore);
});

test('comparison: effectivenessDifference is correct sign', () => {
  const a = makeOutcome({ id: uuid(1), effectiveness_score: 91 });
  const b = makeOutcome({ id: uuid(2), effectiveness_score: 64 });
  const c = compareDecisionOutcomes(a, b);
  assert.equal(c.effectivenessDifference, 27);
});

// ─── Evidence Validation Engine ───────────────────────────────────────────────

test('evidence: valid when all three sources present', () => {
  const r = validateOutcomeEvidence({
    outcomeId: uuid(1),
    observations: [makeObservation('governance_health', 80)],
    effects: [makeEffect('governance_health', 60, 80)],
    learning: [makeLearning()],
  });
  assert.equal(r.isValid, true);
  assert.equal(r.validationStatus, 'valid');
  assert.equal(r.missingRequirements.length, 0);
});

test('evidence: insufficient_observations when no observations', () => {
  const r = validateOutcomeEvidence({
    outcomeId: uuid(1),
    observations: [],
    effects: [makeEffect('governance_health', 60, 80)],
    learning: [makeLearning()],
  });
  assert.equal(r.isValid, false);
  assert.equal(r.validationStatus, 'insufficient_observations');
  assert.ok(r.missingRequirements.length > 0);
});

test('evidence: insufficient_effects when no effects', () => {
  const r = validateOutcomeEvidence({
    outcomeId: uuid(1),
    observations: [makeObservation('governance_health', 80)],
    effects: [],
    learning: [makeLearning()],
  });
  assert.equal(r.isValid, false);
  assert.equal(r.validationStatus, 'insufficient_effects');
});

test('evidence: no_learning when no learning records', () => {
  const r = validateOutcomeEvidence({
    outcomeId: uuid(1),
    observations: [makeObservation('governance_health', 80)],
    effects: [makeEffect('governance_health', 60, 80)],
    learning: [],
  });
  assert.equal(r.isValid, false);
  assert.equal(r.validationStatus, 'no_learning');
});

test('evidence: counts are reported correctly', () => {
  const r = validateOutcomeEvidence({
    outcomeId: uuid(1),
    observations: [makeObservation('governance_health', 80), makeObservation('execution_health', 70)],
    effects: [makeEffect('risk_reduction', 40, 80)],
    learning: [makeLearning(), makeLearning()],
  });
  assert.equal(r.observationCount, 2);
  assert.equal(r.effectCount, 1);
  assert.equal(r.learningCount, 2);
});

// ─── Docs ─────────────────────────────────────────────────────────────────────

test('docs: decision-outcome-engine.md exists', () => {
  assert.ok(docs.length > 0);
});

test('docs: covers architecture section', () => {
  assert.match(docs, /[Aa]rchitecture/);
});

test('docs: covers effectiveness model', () => {
  assert.match(docs, /[Ee]ffectiveness/);
});

test('docs: covers quality model', () => {
  assert.match(docs, /[Qq]uality/);
});

test('docs: covers learning model', () => {
  assert.match(docs, /[Ll]earning/);
});

test('docs: covers lineage', () => {
  assert.match(docs, /[Ll]ineage/);
});

test('docs: covers variance', () => {
  assert.match(docs, /[Vv]ariance/);
});
