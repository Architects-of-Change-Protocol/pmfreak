import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["src", "tests"];
const forbiddenMatchers = [
  /from\s+["']@\/lib\/security\/governance-runtime["']/g,
  /from\s+["']src\/lib\/security\/governance-runtime["']/g,
  /from\s+["'][^"']*security\/governance-runtime["']/g,
  /import\s*\(\s*["']@\/lib\/security\/governance-runtime["']\s*\)/g,
  /import\s*\(\s*["'][^"']*security\/governance-runtime["']\s*\)/g,
];

const allowlist = new Map([
  ["src/lib/governance/authority/runtime/index.ts", "PMFreak governance runtime barrel"],
]);

const files = [];
const walk = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && /\.(ts|tsx|js|mjs)$/.test(entry.name)) files.push(full);
  }
};

for (const relRoot of scanRoots) walk(path.join(root, relRoot));

const violations = [];
const allowedInternalUsages = [];
for (const full of files) {
  const rel = path.relative(root, full).replaceAll(path.sep, "/");
  const content = fs.readFileSync(full, "utf8");

  if (allowlist.has(rel)) {
    if (content.includes("governance-runtime")) {
      allowedInternalUsages.push({ file: rel, reason: allowlist.get(rel) });
    }
    continue;
  }

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes("governance-runtime")) continue;
    if (forbiddenMatchers.some((re) => re.test(line))) {
      violations.push({ file: rel, line: i + 1, text: line.trim() });
    }
  }
}

if (violations.length) {
  console.error("AOC boundary violations detected: direct legacy governance runtime imports are forbidden outside approved internal locations.\n");
  console.error("Remediation: import from '@/lib/aoc/enterprise/runtime' and call enforceRuntimeAuthorization/evaluateRuntimeAuthorization.\n");
  for (const v of violations) {
    console.error(`- ${v.file}:${v.line}`);
    console.error(`  ${v.text}`);
  }
  process.exit(1);
}

console.log("AOC boundary lint passed: no forbidden product/API/SDK/test imports of legacy governance runtime.");
if (allowedInternalUsages.length) {
  console.log("Allowed internal legacy usage (expected during migration):");
  for (const item of allowedInternalUsages) {
    console.log(`- ${item.file} (${item.reason})`);
  }
}
