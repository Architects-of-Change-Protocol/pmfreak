// P0-PKG-05 — semantic collision guard.
//
// P0-PKG-04 found that PMFreak defined types under canonical @aoc/protocol names
// whose meaning differed from the canonical contract. Code compiled against a name
// that meant something else. This gate stops that from coming back.
//
// It does NOT ban the names. Importing them from @aoc/protocol is legitimate and
// expected. What it forbids is a LOCAL DECLARATION of one of these names inside
// PMFreak source, which is what makes a name ambiguous.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// Canonical @aoc/protocol names PMFreak previously redefined with divergent semantics.
const GUARDED = [
  'AgentScope',
  'AuditEventEnvelope',
  'CapabilityGrant',
  'CapabilityPermission',
  'CapabilityRequest',
  'CapabilityResourceType',
  'Delegation',
  'PolicyDecision',
];

// Canonical names PMFreak legitimately shares; a local redeclaration would still be
// a duplicate of a contract it should import, so these are guarded too.
const SHARED_IDS = ['WorkspaceId', 'ProjectId', 'AgentId'];

const ALL = [...GUARDED, ...SHARED_IDS];

// Directories that model the outside world rather than PMFreak's own domain may
// legitimately name a foreign payload after the foreign contract.
const EXEMPT_PREFIXES = [
  'src/features/pmfreak-integrations/',
];

export function collisionChecks(root) {
  const sources = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.next') continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(full)) sources.push(full);
    }
  };
  walk(join(root, 'src'));

  const violations = [];
  for (const file of sources) {
    const rel = relative(root, file).replaceAll(sep, '/');
    if (EXEMPT_PREFIXES.some((p) => rel.startsWith(p))) continue;

    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // A local declaration — not an import, not a re-export of someone else's type.
      const declared = line.match(/^\s*(?:export\s+)?(?:declare\s+)?(?:type|interface|enum|class)\s+([A-Za-z0-9_]+)\b/);
      if (!declared) continue;
      const name = declared[1];
      if (!ALL.includes(name)) continue;
      // `export type X = ... from "@aoc/protocol"` is a legitimate re-export.
      if (/from\s+["']@aoc\/protocol/.test(line)) continue;
      violations.push({
        file: rel,
        line: i + 1,
        name,
        text: line.trim(),
        kind: SHARED_IDS.includes(name)
          ? 'duplicates a canonical contract PMFreak already imports'
          : 'reintroduces a divergent local definition under a canonical name',
      });
    }
  }
  return { violations, scanned: sources.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { violations, scanned } = collisionChecks(process.cwd());
  if (violations.length) {
    console.error('Governance semantic collision guard failed.\n');
    console.error('A canonical @aoc/protocol name is declared locally. Either import it from');
    console.error('@aoc/protocol, or give the PMFreak concept a name of its own and record the');
    console.error('decision in governance-ownership.lock.json.\n');
    for (const v of violations) {
      console.error(`- ${v.file}:${v.line} — '${v.name}' ${v.kind}`);
      console.error(`    ${v.text}`);
    }
    process.exit(1);
  }
  console.log(`[collisions] semantic collision guard passed: no local redefinition of ${ALL.length} guarded canonical names across ${scanned} files.`);
}
