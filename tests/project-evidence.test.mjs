import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(path, 'utf8');

const migration = read('supabase/migrations/20260605000000_project_evidence.sql');
const uploadRoute = read('src/app/api/upload/route.ts');
const evidenceRoute = read('src/app/api/project-evidence/route.ts');
const evidencePage = read('src/app/(protected)/evidence/page.tsx');
const shell = read('src/components/pmfreak/operational-shell.tsx');

test('project evidence migration creates required table and fields', () => {
  assert.match(migration, /create table if not exists public\.project_evidence/);
  for (const field of ['id', 'workspace_id', 'project_id', 'file_name', 'file_type', 'storage_path', 'uploaded_by', 'uploaded_at', 'status']) {
    assert.match(migration, new RegExp(`\\b${field}\\b`));
  }
});

test('project evidence migration constrains statuses and enables workspace RLS', () => {
  for (const status of ['uploaded', 'processing', 'processed', 'failed']) {
    assert.match(migration, new RegExp(`'${status}'`));
  }
  assert.match(migration, /enable row level security/);
  assert.match(migration, /is_workspace_member\(workspace_id\)/);
});

test('upload route supports all project evidence file types and persists evidence rows', () => {
  for (const mime of [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
  ]) {
    assert.match(uploadRoute, new RegExp(mime.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(uploadRoute, /from\("project_evidence"\)/);
  assert.match(uploadRoute, /status: "processing"/);
  assert.match(uploadRoute, /toEvidenceStatus/);
});

test('project evidence API lists and deletes evidence for a project', () => {
  assert.match(evidenceRoute, /export async function GET/);
  assert.match(evidenceRoute, /export async function DELETE/);
  assert.match(evidenceRoute, /requireProjectAccess\(projectId, "read"\)/);
  assert.match(evidenceRoute, /requireProjectAccess\(projectId, "write"\)/);
  assert.match(evidenceRoute, /getUploadProvider\(\)\.delete/);
});

test('project evidence UI renders required actions and columns', () => {
  for (const label of ['Upload Documents', 'View Evidence', 'Delete Evidence', 'File Name', 'Type', 'Upload Date', 'Status']) {
    assert.match(evidencePage, new RegExp(label));
  }
});

test('operational shell exposes project evidence card', () => {
  assert.match(shell, /Project Evidence/);
  assert.match(shell, /Upload Documents/);
  assert.match(shell, /View Evidence/);
  assert.match(shell, /Delete Evidence/);
});
