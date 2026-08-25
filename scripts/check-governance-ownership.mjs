// P0-PKG-05 — ownership map validation.
//
// governance-ownership.lock.json is the machine-readable record of where every
// symbol the active graph once imported from the pseudo-upstream trees now lives.
// This gate proves the record is complete, unambiguous, and true of the source.
import fs from 'node:fs';
import path from 'node:path';

const LOCK = 'governance-ownership.lock.json';

const VALID_DISPOSITIONS = [
  'CANONICAL_UPSTREAM',
  'PMFREAK_DOMAIN',
  'PMFREAK_PORT',
  'PMFREAK_ADAPTER',
  'PMFREAK_PERSISTENCE_PROJECTION',
  'PMFREAK_IMPLEMENTATION',
  'REMOVED_DEAD',
];

const EXPECTED_TOTAL = 44;
const REMOVED_TREES = ['src/aoc/protocol', 'src/aoc/enterprise'];

export function ownershipChecks(root) {
const issues = [];
const fail = (m) => issues.push(m);

if (!fs.existsSync(path.join(root, LOCK))) {
  return { failures: [`${LOCK} is missing`], counts: {} };
}
const lock = JSON.parse(fs.readFileSync(path.join(root, LOCK), 'utf8'));
const symbols = lock.symbols ?? [];

// 1. Every symbol accounted for, exactly once, with a valid disposition.
if (symbols.length !== EXPECTED_TOTAL) {
  fail(`expected ${EXPECTED_TOTAL} symbols (the P0-PKG-04 blocker inventory), found ${symbols.length}`);
}
const seen = new Map();
for (const entry of symbols) {
  const key = `${entry.symbol}@${entry.oldDefinitionPath}`;
  if (seen.has(key)) fail(`duplicate entry for '${entry.symbol}' from ${entry.oldDefinitionPath}`);
  seen.set(key, entry);

  if (!entry.newDisposition) fail(`${entry.symbol}: missing newDisposition`);
  else if (!VALID_DISPOSITIONS.includes(entry.newDisposition)) fail(`${entry.symbol}: invalid disposition '${entry.newDisposition}'`);
  if (/UNKNOWN|TBD|TODO/i.test(entry.newDisposition ?? '')) fail(`${entry.symbol}: unresolved disposition`);
  if (!entry.newOwner) fail(`${entry.symbol}: missing newOwner`);
  if (!entry.notes || entry.notes.length < 20) fail(`${entry.symbol}: missing or trivial rationale`);

  // A canonical adoption must name a real upstream export and claim compatibility.
  if (entry.newDisposition === 'CANONICAL_UPSTREAM') {
    if (!entry.upstreamExport) fail(`${entry.symbol}: CANONICAL_UPSTREAM requires an upstreamExport`);
    if (!entry.shapeCompatible || !entry.semanticCompatible) {
      fail(`${entry.symbol}: CANONICAL_UPSTREAM requires proven shape AND semantic compatibility`);
    }
  }
  // A PMFreak disposition must point at PMFreak-owned source.
  if (entry.newDisposition !== 'CANONICAL_UPSTREAM' && entry.newDisposition !== 'REMOVED_DEAD') {
    if (!entry.newDefinitionPath?.startsWith('src/')) {
      fail(`${entry.symbol}: PMFreak-owned symbol must have a src/ definition path, got '${entry.newDefinitionPath}'`);
    }
  }
}

// 2. Declared totals must match the entries.
const counts = {};
for (const e of symbols) counts[e.newDisposition] = (counts[e.newDisposition] ?? 0) + 1;
for (const disposition of VALID_DISPOSITIONS) {
  const declared = lock.totals?.[disposition] ?? 0;
  const actual = counts[disposition] ?? 0;
  if (declared !== actual) fail(`totals.${disposition}: declared ${declared}, actual ${actual}`);
}
const sum = VALID_DISPOSITIONS.reduce((a, d) => a + (counts[d] ?? 0), 0);
if (sum !== symbols.length) fail(`disposition counts sum to ${sum}, expected ${symbols.length}`);
if (lock.totals?.TOTAL !== symbols.length) fail(`totals.TOTAL is ${lock.totals?.TOTAL}, expected ${symbols.length}`);
if (lock.totals?.UNRESOLVED !== 0) fail(`totals.UNRESOLVED is ${lock.totals?.UNRESOLVED}, must be 0`);

// 3. No owned symbol may still be defined in a removed tree.
for (const entry of symbols) {
  if (REMOVED_TREES.some((t) => entry.newDefinitionPath?.includes(t))) {
    fail(`${entry.symbol}: newDefinitionPath still points into a removed tree`);
  }
}
for (const tree of REMOVED_TREES) {
  if (fs.existsSync(path.join(root, tree))) fail(`removed tree still present on disk: ${tree}`);
}

// 4. Every PMFreak definition path must exist, and actually declare the symbol.
for (const entry of symbols) {
  if (entry.newDisposition === 'CANONICAL_UPSTREAM' || entry.newDisposition === 'REMOVED_DEAD') continue;
  const target = path.join(root, entry.newDefinitionPath);
  if (!fs.existsSync(target)) {
    fail(`${entry.symbol}: newDefinitionPath does not exist (${entry.newDefinitionPath})`);
    continue;
  }
  const name = entry.newSymbol ?? entry.symbol;
  const content = fs.readFileSync(target, 'utf8');
  if (!new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(content)) {
    fail(`${entry.symbol}: '${name}' not found in ${entry.newDefinitionPath}`);
  }
}

// 5. The declared hard boundaries must all still hold as declared.
for (const [key, value] of Object.entries(lock.boundaries ?? {})) {
  if (value !== false) fail(`boundaries.${key} is ${value}; P0-PKG-05 asserts every boundary is false`);
}

return { failures: issues, counts, total: symbols.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { failures, counts: c, total } = ownershipChecks(process.cwd());
  if (failures.length) {
    console.error('Governance ownership map validation failed:\n');
    for (const i of failures) console.error(`- ${i}`);
    process.exit(1);
  }
  console.log(`[ownership] ${total}/${EXPECTED_TOTAL} symbols resolved, 0 unresolved.`);
  for (const d of VALID_DISPOSITIONS) console.log(`[ownership]   ${d} = ${c[d] ?? 0}`);
}
