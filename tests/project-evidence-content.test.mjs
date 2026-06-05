import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20260605010000_project_evidence_content.sql', 'utf8');
const processor = fs.readFileSync('src/lib/project-evidence/evidence-processor.ts', 'utf8');
const contentRoute = fs.readFileSync('src/app/api/project-evidence-content/route.ts', 'utf8');
const uploadRoute = fs.readFileSync('src/app/api/upload/route.ts', 'utf8');
const evidencePage = fs.readFileSync('src/app/(protected)/evidence/page.tsx', 'utf8');

test('migration creates canonical project_evidence_content with provenance and RLS', () => {
  assert.match(migration, /create table if not exists public\.project_evidence_content/);
  for (const column of ['evidence_id', 'project_id', 'workspace_id', 'source_file_name', 'source_file_type', 'source_uploaded_at', 'source_uploaded_by', 'extracted_text', 'content_hash', 'extraction_method', 'processing_started_at', 'processing_completed_at', 'created_at', 'updated_at']) {
    assert.match(migration, new RegExp(column));
  }
  assert.match(migration, /references public\.project_evidence\(id\) on delete cascade/);
  assert.match(migration, /alter table public\.project_evidence_content enable row level security/);
  assert.match(migration, /public\.is_workspace_member\(workspace_id\)/);
});

test('EvidenceProcessor exposes required pipeline methods and supported extractors', () => {
  for (const method of ['processEvidence', 'extractText', 'generateContentHash', 'storeCanonicalEvidence', 'markProcessed', 'markFailed']) {
    assert.match(processor, new RegExp(method));
  }
  for (const marker of ['application/pdf', 'wordprocessingml.document', 'spreadsheetml.sheet', 'presentationml.presentation', 'text/plain']) {
    assert.match(processor, new RegExp(marker.replace(/[.]/g, '\\.')));
  }
  assert.match(processor, /createHash\("sha256"\)/);
  assert.match(processor, /Processing Started/);
  assert.match(processor, /Processing Completed/);
  assert.match(processor, /Processing Failed/);
});

test('upload queues canonical extraction without awaiting extraction before response', () => {
  const queueIdx = uploadRoute.indexOf('processEvidenceInBackground(');
  const responseIdx = uploadRoute.indexOf('return Response.json');
  assert.ok(queueIdx > 0, 'upload route must enqueue evidence processing');
  assert.ok(responseIdx > queueIdx, 'upload response must be returned after queueing but without awaiting extraction');
  assert.doesNotMatch(uploadRoute, /await processEvidenceInBackground/);
});

test('content API enforces project read access and project filtering', () => {
  assert.match(contentRoute, /requireProjectAccess\(projectId, "read"\)/);
  assert.match(contentRoute, /from\("project_evidence_content"\)/);
  assert.match(contentRoute, /\.eq\("project_id", projectId\)/);
  assert.match(contentRoute, /countWords/);
  assert.match(contentRoute, /processing_duration_ms/);
});

test('evidence vault UI displays extraction status, hash, word count, and duration', () => {
  assert.match(evidencePage, /project-evidence-content/);
  assert.match(evidencePage, /Extracted:/);
  assert.match(evidencePage, /Hash:/);
  assert.match(evidencePage, /Processing Time:/);
  assert.match(evidencePage, /Awaiting extraction/);
});
