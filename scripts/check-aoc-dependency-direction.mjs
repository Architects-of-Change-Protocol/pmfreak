import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = [];

const walk = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && /\.(ts|tsx|js|mjs)$/.test(entry.name)) files.push(full);
  }
};

walk(path.join(root, 'src/aoc/protocol'));
walk(path.join(root, 'src/aoc/enterprise'));

const violations = [];
for (const full of files) {
  const rel = path.relative(root, full).replaceAll(path.sep, '/');
  const content = fs.readFileSync(full, 'utf8');

  if (rel.startsWith('src/aoc/protocol/') && /\.\.\/\.\.\/runtime\//.test(content)) {
    violations.push(`${rel}: protocol imports runtime internals`);
  }
  if (rel.startsWith('src/aoc/protocol/') && /@aoc-enterprise\/|@pmfreak\/aoc-enterprise-internal/.test(content)) {
    violations.push(`${rel}: protocol imports enterprise package`);
  }
  if (rel.startsWith('src/aoc/enterprise/') && /['\"]@\//.test(content)) {
    violations.push(`${rel}: enterprise imports app alias (@/)`);
  }
  if (rel.startsWith('src/aoc/enterprise/') && content.includes('getAocAdapter(') && rel !== 'src/aoc/enterprise/runtime/composition.ts') {
    violations.push(`${rel}: enterprise registry access is only allowed in runtime/composition.ts`);
  }
  if (rel.startsWith('src/aoc/enterprise/') && /\.\.\/\.\.\/runtime\/adapters/.test(content) && rel !== 'src/aoc/enterprise/runtime/composition.ts') {
    violations.push(`${rel}: enterprise runtime adapter registry import is only allowed in runtime/composition.ts`);
  }
}

if (violations.length) {
  console.error('AOC dependency direction checks failed:\n');
  for (const v of violations) console.error(`- ${v}`);
  process.exit(1);
}

console.log('AOC dependency direction checks passed.');
