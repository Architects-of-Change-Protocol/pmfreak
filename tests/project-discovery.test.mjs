import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20260605020000_project_discovery.sql', 'utf8');
const payloadHashMigration = fs.readFileSync('supabase/migrations/20260605030000_project_discovery_payload_hash.sql', 'utf8');
const agent = fs.readFileSync('src/lib/project-discovery/discovery-agent.ts', 'utf8');
const repository = fs.readFileSync('src/lib/project-discovery/discovery-repository.ts', 'utf8');
const route = fs.readFileSync('src/app/api/project-discovery/route.ts', 'utf8');
const processor = fs.readFileSync('src/lib/project-evidence/evidence-processor.ts', 'utf8');
const shell = fs.readFileSync('src/components/pmfreak/operational-shell.tsx', 'utf8');

test('project_discovery migration creates versioned traceable discovery table', () => {
  assert.match(migration, /create table if not exists public\.project_discovery/);
  for (const column of ['id', 'project_id', 'workspace_id', 'version', 'stakeholders_json', 'dependencies_json', 'risks_json', 'milestones_json', 'deliverables_json', 'assumptions_json', 'unknowns_json', 'confidence_score', 'evidence_count', 'generated_at', 'created_at', 'updated_at']) {
    assert.match(migration, new RegExp(`\\b${column}\\b`));
  }
  assert.match(migration, /unique\(project_id, version\)/);
  assert.match(migration, /confidence_score >= 0 and confidence_score <= 100/);
  assert.match(migration, /alter table public\.project_discovery enable row level security/);
  assert.match(migration, /public\.is_workspace_member\(workspace_id\)/);
});

test('project_discovery payload hash migration adds deduplication hash and lookup index', () => {
  assert.match(payloadHashMigration, /add column if not exists discovery_payload_hash text/);
  assert.match(payloadHashMigration, /create index if not exists project_discovery_project_payload_hash_idx/);
  assert.match(payloadHashMigration, /on public\.project_discovery\(project_id, discovery_payload_hash\)/);
});

test('discovery agent focuses on operational execution signals with evidence traceability', () => {
  for (const signal of ['stakeholders', 'dependencies', 'risks', 'milestones', 'deliverables', 'assumptions', 'unknowns']) {
    assert.match(agent, new RegExp(signal));
  }
  assert.match(agent, /PROJECT_DISCOVERY_AGENT_SYSTEM_PROMPT/);
  assert.match(agent, /Your objective is not to summarize/);
  assert.match(agent, /evidence_id/);
  assert.match(agent, /source_file_name/);
  assert.match(agent, /confidence_score/);
  assert.match(agent, /generateProjectDiscovery/);
});

test('discovery repository persists new versions and logs lifecycle events', () => {
  assert.match(repository, /regenerateProjectDiscovery/);
  assert.match(repository, /from\("project_evidence_content"\)/);
  assert.match(repository, /from\("project_discovery"\)/);
  assert.match(repository, /latestVersion \+ 1/);
  assert.match(repository, /discovery_payload_hash/);
  assert.match(repository, /hashDiscoveryPayload/);
  assert.match(repository, /Discovery Started/);
  assert.match(repository, /Discovery Completed/);
  assert.match(repository, /Discovery Failed/);
  assert.match(repository, /findingsCount/);
  assert.match(repository, /durationMs/);
});

test('project discovery API returns latest discovery with project read authorization', () => {
  assert.match(route, /export async function GET/);
  assert.match(route, /requireProjectAccess\(projectId, "read"\)/);
  assert.match(route, /from\("project_discovery"\)/);
  assert.match(route, /order\("version", \{ ascending: false \}\)/);
  assert.match(route, /discovery_payload_hash/);
  assert.match(route, /maybeSingle\(\)/);
});

test('canonical evidence processing triggers discovery regeneration', () => {
  assert.match(processor, /regenerateProjectDiscoveryInBackground/);
  assert.match(processor, /projectId: source\.project_id/);
});

test('operational shell displays discovery summary card counts and confidence', () => {
  assert.match(shell, /Discovery Summary/);
  assert.match(shell, /project-discovery/);
  for (const label of ['Stakeholders:', 'Dependencies:', 'Risks:', 'Milestones:', 'Deliverables:', 'Unknowns:', 'Discovery Confidence:']) {
    assert.match(shell, new RegExp(label));
  }
});


test('first project discovery regeneration inserts v1 with a payload hash', () => {
  assert.match(repository, /const latestVersion = Number\(latestDiscovery\?\.version \?\? 0\)/);
  assert.match(repository, /const nextVersion = latestVersion \+ 1/);
  assert.match(repository, /version: nextVersion/);
  assert.match(repository, /discovery_payload_hash: discoveryPayloadHash/);
});

test('identical project discovery regeneration skips inserting v2', () => {
  assert.match(repository, /latestDiscovery\?\.discovery_payload_hash === discoveryPayloadHash/);
  assert.match(repository, /skipped: true/);
  assert.match(repository, /reason: "unchanged_payload"/);
  assert.match(repository, /return latestDiscovery/);
});

test('changed project discovery payload continues versioning by inserting v2', () => {
  assert.match(repository, /generateProjectDiscovery\(typedEvidence\)/);
  assert.match(repository, /const discoveryPayloadHash = hashDiscoveryPayload\(discovery\)/);
  assert.match(repository, /const nextVersion = latestVersion \+ 1/);
  assert.match(repository, /\.insert\(\{[\s\S]*version: nextVersion[\s\S]*discovery_payload_hash: discoveryPayloadHash[\s\S]*\}\)/);
});

test('project discovery payload hash is deterministic despite object key ordering', () => {
  assert.match(repository, /Object\.keys\(value\)\s*\n\s*\.sort\(\)/);
  assert.match(repository, /deterministicDiscoveryPayloadStringify/);
  assert.match(repository, /createHash\("sha256"\)/);
  assert.doesNotMatch(repository, /JSON\.stringify\(buildDiscoveryPayload\(discovery\)\)/);
});
