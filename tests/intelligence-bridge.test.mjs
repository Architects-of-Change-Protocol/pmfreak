import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const types = readFileSync('src/lib/intelligence-bridge/types.ts', 'utf8');
const service = readFileSync('src/lib/intelligence-bridge/bridge-service.ts', 'utf8');
const resolver = readFileSync('src/lib/intelligence-bridge/source-resolver.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260622000000_intelligence_bridge_foundation.sql', 'utf8');
const contract = readFileSync('src/lib/db/database-contract.ts', 'utf8');

test('types file exports ALLOWED_RELATIONSHIP_TYPES', () => {
  assert.match(types, /export const ALLOWED_RELATIONSHIP_TYPES/);
});

test('types file has all 13 relationship types', () => {
  for (const rt of [
    'personal_pattern_supports_org_pattern',
    'personal_pattern_contradicts_org_pattern',
    'personal_effectiveness_supports_org_effectiveness',
    'personal_effectiveness_contradicts_org_effectiveness',
    'personal_memory_supports_org_memory',
    'personal_memory_contradicts_org_memory',
    'personal_candidate_supports_org_candidate',
    'personal_candidate_contradicts_org_candidate',
    'org_pattern_contextualizes_personal_pattern',
    'org_memory_contextualizes_personal_memory',
    'org_effectiveness_contextualizes_personal_effectiveness',
    'shared_evidence',
    'related_to',
  ]) {
    assert.match(types, new RegExp(rt), `Missing relationship type: ${rt}`);
  }
});

test('types file exports INTELLIGENCE_BRIDGE_CAPABILITIES', () => {
  assert.match(types, /export const INTELLIGENCE_BRIDGE_CAPABILITIES/);
});

test('types file has all 8 capabilities', () => {
  for (const cap of [
    'INTELLIGENCE_BRIDGE_CREATE',
    'INTELLIGENCE_BRIDGE_UPDATE',
    'INTELLIGENCE_BRIDGE_INSPECT',
    'INTELLIGENCE_BRIDGE_EXPORT',
    'INTELLIGENCE_BRIDGE_FREEZE',
    'INTELLIGENCE_BRIDGE_ARCHIVE',
    'INTELLIGENCE_BRIDGE_DELETE',
    'INTELLIGENCE_BRIDGE_OBSERVE',
  ]) {
    assert.match(types, new RegExp(cap), `Missing capability: ${cap}`);
  }
});

test('bridge service exports createIntelligenceBridge', () => {
  assert.match(service, /export async function createIntelligenceBridge/);
});

test('bridge service exports getIntelligenceBridge', () => {
  assert.match(service, /export async function getIntelligenceBridge/);
});

test('bridge service exports listIntelligenceBridges', () => {
  assert.match(service, /export async function listIntelligenceBridges/);
});

test('bridge service exports updateIntelligenceBridge', () => {
  assert.match(service, /export async function updateIntelligenceBridge/);
});

test('bridge service exports archiveIntelligenceBridge', () => {
  assert.match(service, /export const archiveIntelligenceBridge/);
});

test('bridge service exports freezeIntelligenceBridge', () => {
  assert.match(service, /export const freezeIntelligenceBridge/);
});

test('bridge service exports deprecateIntelligenceBridge', () => {
  assert.match(service, /export const deprecateIntelligenceBridge/);
});

test('bridge service exports deleteIntelligenceBridge', () => {
  assert.match(service, /export async function deleteIntelligenceBridge/);
});

test('bridge service exports recordIntelligenceBridgeObservation', () => {
  assert.match(service, /export async function recordIntelligenceBridgeObservation/);
});

test('bridge service exports explainIntelligenceBridge', () => {
  assert.match(service, /export async function explainIntelligenceBridge/);
});

test('bridge service exports buildIntelligenceBridgeLineage', () => {
  assert.match(service, /export async function buildIntelligenceBridgeLineage/);
});

test('bridge service exports exportIntelligenceBridge', () => {
  assert.match(service, /export async function exportIntelligenceBridge/);
});

test('bridge service exports getIntelligenceBridgeHealth', () => {
  assert.match(service, /export async function getIntelligenceBridgeHealth/);
});

test('bridge service has learningEligible: false', () => {
  assert.match(service, /learningEligible: false/);
});

test('bridge service checks for frozen status', () => {
  assert.match(service, /status === "frozen"/);
});

test('bridge service emits INTELLIGENCE_BRIDGE_CREATED', () => {
  assert.match(service, /INTELLIGENCE_BRIDGE_CREATED/);
});

test('bridge service emits INTELLIGENCE_BRIDGE_OBSERVATION_RECORDED', () => {
  assert.match(service, /INTELLIGENCE_BRIDGE_OBSERVATION_RECORDED/);
});

test('source resolver exports resolveIntelligenceBridgeSources', () => {
  assert.match(resolver, /export async function resolveIntelligenceBridgeSources/);
});

test('source resolver handles personal_memory table mapping', () => {
  assert.match(resolver, /personal_memory.*personal_pm_memory/s);
});

test('source resolver handles unsupported source type', () => {
  assert.match(resolver, /unsupported_source_type/);
});

test('migration file has is_bridge_owner function', () => {
  assert.match(migration, /create or replace function public\.is_bridge_owner/);
});

test('database contract has IntelligenceBridgeLinkRow', () => {
  assert.match(contract, /IntelligenceBridgeLinkRow/);
});

test('database contract has -intelligence-bridge in version', () => {
  assert.match(contract, /intelligence-bridge/);
});

// ─── Additional constitutional guarantee tests ────────────────────────────────

import {
  ALLOWED_RELATIONSHIP_TYPES,
  ALLOWED_PERSONAL_SOURCE_TYPES,
  ALLOWED_ORGANIZATIONAL_SOURCE_TYPES,
  ALLOWED_BRIDGE_STATUSES,
  INTELLIGENCE_BRIDGE_CAPABILITIES,
} from '../src/lib/intelligence-bridge/types.ts';

test('no forbidden comparison relationship types in ALLOWED_RELATIONSHIP_TYPES', () => {
  const forbidden = ['better_than','worse_than','higher_performer','lower_performer',
    'performance_risk','trust_risk','manager_flag','ranked_above','ranked_below'];
  for (const t of forbidden) {
    assert.ok(!ALLOWED_RELATIONSHIP_TYPES.includes(t),
      `Forbidden type "${t}" must not appear in ALLOWED_RELATIONSHIP_TYPES`);
  }
});

test('no scoring/profiling/surveillance terms in bridge-service.ts', () => {
  for (const pattern of [/\bscore\b/,/\brating\b/,/\branking\b/,/\bleaderboard\b/,
    /\bsurveillance\b/,/\bprofil(e|ing)\b/,/\bperformance_risk\b/,/\btrust_risk\b/,/\bmanager_flag\b/]) {
    assert.ok(!pattern.test(service), `Forbidden term ${pattern} in bridge-service.ts`);
  }
});

test('RLS enforces pm_user_id isolation in select policy', () => {
  assert.match(migration, /is_bridge_owner\(workspace_id, pm_user_id\)/);
});

test('cross-PM access prevented: service requires pm_user_id match on every fetch', () => {
  assert.match(service, /\.eq\("pm_user_id", pmUserId\)/);
});

test('frozen bridge update blocked at service level', () => {
  assert.match(service, /governance_violation/);
  assert.match(service, /Frozen intelligence bridges cannot be edited/);
});

test('frozen bridge delete blocked at trigger level in migration', () => {
  assert.match(migration, /tg_op = 'DELETE' and old\.status = 'frozen'/);
  assert.match(migration, /Frozen intelligence bridge cannot be deleted/);
});

test('frozen bridge sources mutation blocked by RLS', () => {
  assert.match(migration, /b\.status <> 'frozen'/);
});

test('frozen bridge can only be archived — service check', () => {
  assert.match(service, /Frozen intelligence bridges can only be archived/);
});

test('export function includes all required fields', () => {
  assert.match(service, /export async function exportIntelligenceBridge/);
  assert.match(service, /lineage:/);
  assert.match(service, /unresolvedSources/);
  assert.match(service, /exportedAt:/);
});

test('health metrics clamped between 0 and 1', () => {
  assert.match(service, /Math\.min\(1, Math\.max\(0,/);
});

test('health returns relationshipTypeCounts initialized for all types', () => {
  assert.match(service, /relationshipTypeCounts/);
  assert.match(service, /ALLOWED_RELATIONSHIP_TYPES\.map/);
});

test('all bridge events set governance category and personal visibility', () => {
  assert.match(service, /eventCategory: "governance"/);
  assert.match(service, /visibility: "personal"/);
  assert.match(service, /sensitivityLevel: "confidential"/);
});

test('all 8 capability constants map to themselves', () => {
  for (const [k, v] of Object.entries(INTELLIGENCE_BRIDGE_CAPABILITIES)) {
    assert.equal(k, v);
  }
});

test('allowed bridge statuses are active archived frozen deprecated', () => {
  assert.deepEqual([...ALLOWED_BRIDGE_STATUSES].sort(), ['active','archived','deprecated','frozen']);
});

test('database contract version preserves prior substrings and appends intelligence-bridge', () => {
  assert.match(contract, /2026-06-18-platform-events/);
  assert.match(contract, /personal-pm-patterns/);
  assert.match(contract, /personal-pattern-extraction-foundation/);
  assert.match(contract, /intelligence-bridge/);
});

test('source resolver returns unresolved for personal_event (no table mapping)', () => {
  assert.match(resolver, /unsupported_source_type/);
});

test('migration defines frozen trigger on intelligence_bridge_links', () => {
  assert.match(migration, /intelligence_bridge_frozen_guard/);
  assert.match(migration, /before update or delete on public\.intelligence_bridge_links/);
});

test('migration defines observation summary not-empty constraint', () => {
  assert.match(migration, /chk_bridge_observation_summary_not_empty/);
});

test('migration defines updated_at trigger', () => {
  assert.match(migration, /intelligence_bridge_set_updated_at/);
});

test('migration indexes include workspace_id pm_user_id updated_at', () => {
  assert.match(migration, /idx_bridge_links_workspace_pm_updated/);
  assert.match(migration, /idx_bridge_links_workspace_pm_status_updated/);
});
