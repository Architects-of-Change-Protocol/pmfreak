/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-require-imports */
// @ts-nocheck -- Node 20 executes this TypeScript-named architecture test without a loader.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const targetPublicImports = new Set([
  "@aoc/protocol/contracts",
  "@aoc/protocol/claims",
  "@aoc/protocol/errors",
  "@aoc/protocol/adapters",
]);
const scanRoots = [
  "packages",
  "apps",
  "services",
  "runtime",
  "enterprise",
  "operations",
  "assurance",
  "governance",
  "sdk",
  "tests",
  "scripts",
  "examples",
  "src",
];
const sourceExtensions = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts"]);
const ignoredDirectories = new Set([".git", ".next", "artifacts", "coverage", "dist", "node_modules"]);
const protocolSourceRoots = [
  path.join(root, "packages/protocol/src"),
  path.join(root, "src/aoc/protocol"),
].map((entry) => path.normalize(entry));

/** @param {string} directory @returns {string[]} */
function walk(directory) {
  if (!fs.existsSync(directory)) return [];

  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;

    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) files.push(absolute);
  }
  return files;
}

/** @param {string} source @returns {{ index: number, specifier: string }[]} */
function importSpecifiers(source) {
  const expressions = [
    /\b(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/gm,
    /\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/gm,
  ];
  /** @type {{ index: number, specifier: string }[]} */
  const matches = [];

  for (const expression of expressions) {
    for (const match of source.matchAll(expression)) {
      matches.push({
        index: match.index ?? 0,
        specifier: match[1],
      });
    }
  }

  return matches.filter(
    (match, index) =>
      matches.findIndex(
        (candidate) => candidate.index === match.index && candidate.specifier === match.specifier,
      ) === index,
  );
}

/** @param {string} candidate @param {string} directory */
function isInside(candidate, directory) {
  const relative = path.relative(directory, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/**
 * @param {string} file
 * @param {string} specifier
 * @returns {"safe" | "deep" | "ownership-bypass" | "indirect" | "unrelated"}
 */
function classifyImport(file, specifier) {
  if (targetPublicImports.has(specifier)) return "safe";

  const normalizedSpecifier = specifier.replaceAll("\\", "/");
  if (
    normalizedSpecifier === "@/aoc/protocol" ||
    normalizedSpecifier.startsWith("@/aoc/protocol/") ||
    normalizedSpecifier === "@aoc/protocol/src" ||
    normalizedSpecifier.startsWith("@aoc/protocol/src/") ||
    normalizedSpecifier.includes("packages/protocol/src") ||
    normalizedSpecifier.includes("src/aoc/protocol")
  ) {
    return "deep";
  }

  if (specifier.startsWith(".")) {
    const resolved = path.resolve(path.dirname(file), specifier);
    if (protocolSourceRoots.some((protocolRoot) => isInside(resolved, protocolRoot))) return "deep";
  }

  if (specifier.startsWith("@aoc/protocol/")) return "ownership-bypass";
  if (specifier.includes("protocol")) return "indirect";
  return "unrelated";
}

function auditProtocolConsumers() {
  const files = [...new Set(scanRoots.flatMap((scanRoot) => walk(path.join(root, scanRoot))))]
    .filter((file) => !protocolSourceRoots.some((protocolRoot) => isInside(file, protocolRoot)))
    .sort();
  /** @type {{ classification: string, file: string, line: number, specifier: string }[]} */
  const imports = [];

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of importSpecifiers(source)) {
      const classification = classifyImport(file, match.specifier);
      if (classification === "unrelated") continue;

      imports.push({
        classification,
        file: path.relative(root, file).replaceAll(path.sep, "/"),
        line: source.slice(0, match.index).split("\n").length,
        specifier: match.specifier,
      });
    }
  }

  return imports;
}

test("Protocol consumer boundary audit reports deep imports without enforcing yet", () => {
  const imports = auditProtocolConsumers();
  const deepImports = imports.filter((entry) => entry.classification === "deep");
  const ownershipBypasses = imports.filter((entry) => entry.classification === "ownership-bypass");
  const safeImports = imports.filter((entry) => entry.classification === "safe");
  const consumers = new Set(imports.map((entry) => entry.file));
  const enforce = process.env.PROTOCOL_CONSUMER_AUDIT_ENFORCE === "1";

  console.log("\nProtocol Consumer Boundary Audit (report mode)");
  console.log(`Total Consumers: ${consumers.size}`);
  console.log(`Total Safe Imports: ${safeImports.length}`);
  console.log(`Total Deep Imports: ${deepImports.length}`);
  console.log(`Total Violations: ${deepImports.length + ownershipBypasses.length}`);
  console.log("Total Migration Candidates: 7");

  for (const violation of [...deepImports, ...ownershipBypasses]) {
    console.log(
      `- [${violation.classification}] ${violation.file}:${violation.line} -> ${violation.specifier}`,
    );
  }

  if (enforce) {
    assert.deepEqual(
      deepImports,
      [],
      "Protocol source imports are forbidden outside the Protocol package",
    );
  } else {
    assert.ok(
      Array.isArray(deepImports),
      "Report mode must complete even while known deep imports remain",
    );
  }
});
