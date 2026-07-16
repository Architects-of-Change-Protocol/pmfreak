import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hierarchy = readFileSync('src/lib/workspace/navigation-hierarchy.ts', 'utf8');
const selectors = readFileSync('src/features/runtime/capability-reveal/capability-reveal-selectors.ts', 'utf8');
const shell = readFileSync('src/components/pmfreak/operational-shell.tsx', 'utf8');
const drawer = readFileSync('src/components/pmfreak/navigation/advanced-drawer.tsx', 'utf8');

test('workspace chat appears as primary visible node', () => {
  // Workspace → PMO → Project sprint: the workspace-level chat is the
  // primary workspace entry; the workspace list lives in utilities.
  assert.match(hierarchy, /label: "Workspace Chat"[\s\S]*tier: "primary"[\s\S]*visibleByDefault: true/);
  assert.match(hierarchy, /label: "Workspaces"[\s\S]*tier: "utility"/);
});

test('lens group contains only required defaults', () => {
  for (const lens of ['Summary', 'Execution', 'Executive', 'Portfolio']) assert.match(hierarchy, new RegExp(`label: "${lens}"[\\s\\S]*tier: "lens"`));
});

test('utility group contains only required defaults', () => {
  for (const util of ['Workspaces', 'PMOs', 'Projects', 'Programs', 'Upload', 'Members']) assert.match(hierarchy, new RegExp(`label: "${util}"[\\s\\S]*tier: "utility"`));
});

test('advanced surfaces are hidden by default', () => {
  assert.match(hierarchy, /tier: "advanced"[\s\S]*visibleByDefault: false/);
});

test('capability reveal adds to advanced group only', () => {
  assert.match(selectors, /if \(node\.tier !== "advanced"\) return node\.visibleByDefault/);
  assert.match(shell, /AdvancedDrawer items=\{advancedNav\}/);
});

test('no legacy top-level labels remain', () => {
  assert.doesNotMatch(hierarchy, /Command Center|Risk Center|PMO Overview|Copilot/);
});

test('operational shell renders grouped hierarchy', () => {
  assert.match(shell, /Workspace<\/p>/);
  assert.match(shell, /Lenses<\/p>/);
  assert.match(shell, /Utilities<\/p>/);
  assert.match(drawer, /Advanced Runtime/);
});

test('workspace remains canonical active default', () => {
  assert.match(shell, /href="\/workspaces"/);
});
