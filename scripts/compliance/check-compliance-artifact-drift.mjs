#!/usr/bin/env node
// ============================================================================
// P2-15 — SEMANTIC compliance artifact drift gate.
//
// Replaces the `git diff --exit-code` byte-comparison that ip-compliance.yml
// carried. That check was structurally unsatisfiable: it could never pass on
// any commit, in any environment, even with zero dependency change, because
// the generators legitimately stamp five per-generation provenance fields.
// (It never actually ran — the workflow carried `timeout-minutes` at an
// invalid top level, so GitHub refused to parse it and every one of its 168
// runs failed with zero jobs. Repairing the workflow without repairing this
// check would merely convert a silent zero-job failure into a guaranteed job
// failure.)
//
// What this gate asserts instead: the COMMITTED compliance artifacts describe
// the SAME dependency, license and component substance that regenerating from
// the current lockfile would produce. Provenance metadata that legitimately
// moves on every generation is normalized away — but ONLY the fields named in
// VOLATILE_FIELDS below, each individually reviewed. There is deliberately no
// recursive "ignore anything called timestamp", no "ignore every UUID" and no
// "ignore metadata": a broad rule would silently swallow real drift in a field
// nobody ever looked at.
//
// The check NEVER rewrites tracked files. It regenerates into a throwaway
// directory whose inputs are symlinked back to the repository, so a gate can
// be run on a dirty or read-only tree without mutating the thing it audits.
//
// Usage:  node scripts/compliance/check-compliance-artifact-drift.mjs
// Exit:   0 — committed artifacts are semantically current
//         1 — real semantic drift (or the check could not run)
// ============================================================================

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();

const INVENTORY = "artifacts/compliance/third-party-license-inventory.json";
const SUMMARY = "artifacts/compliance/third-party-license-summary.md";
const SBOM = "artifacts/compliance/sbom.cdx.json";

// ---------------------------------------------------------------------------
// The explicit normalization allowlist.
//
// Every entry is a field that changes on a generation where NOTHING about the
// dependency graph changed, and whose movement therefore carries no compliance
// signal. Each is addressed by exact path — never by name-matching, never by
// shape. Anything not listed here is substance and is compared.
//
// `lockfile.sha256` is deliberately ABSENT: it is a pure function of
// package-lock.json, so it moves only when dependencies actually move. It is
// the single most direct evidence that committed artifacts are stale, and
// SBOM-POLICY.md requires regeneration "whenever dependencies change".
// ---------------------------------------------------------------------------
const VOLATILE_FIELDS = [
  {
    artifact: INVENTORY,
    path: "generatedAt",
    why: "wall-clock reading of the generation run",
  },
  {
    artifact: INVENTORY,
    path: "repositoryCommit",
    why: "HEAD at generation time; an artifact can never contain its own commit sha",
  },
  {
    artifact: SUMMARY,
    path: "Generated:",
    why: "the same wall-clock reading, rendered into the summary header",
  },
  {
    artifact: SUMMARY,
    path: "Commit:",
    why: "the same HEAD provenance, rendered into the summary header",
  },
  {
    artifact: SBOM,
    path: "serialNumber",
    why: "CycloneDX requires a fresh URN per BOM instance (crypto.randomUUID)",
  },
  {
    artifact: SBOM,
    path: "metadata.timestamp",
    why: "wall-clock reading of the BOM instance",
  },
  {
    artifact: SBOM,
    path: "metadata.component.properties[name=repositoryCommit]",
    why: "the same HEAD provenance, carried as a CycloneDX property",
  },
];

const errors = [];
const notes = [];

/** Regenerate into `dir` without touching the repository's own artifacts.
 *
 *  The generators resolve every path against `process.cwd()`, so pointing cwd
 *  at a scratch directory whose inputs are symlinked back here is enough to
 *  make them write their output somewhere harmless. `commit()` shells out to
 *  git with that cwd, finds no repository and returns 'UNKNOWN' — which is one
 *  of the normalized fields anyway, so it costs nothing. */
function regenerateInto(dir) {
  // node_modules is needed for the two workspace `link: true` lock entries,
  // whose license/version the generator reads from the linked package.json.
  for (const input of ["package.json", "package-lock.json", "config", "node_modules", "src"]) {
    const from = path.join(root, input);
    if (!fs.existsSync(from)) continue;
    fs.symlinkSync(from, path.join(dir, input));
  }
  fs.mkdirSync(path.join(dir, "artifacts/compliance"), { recursive: true });

  for (const generator of [
    "scripts/compliance/generate-third-party-license-inventory.mjs",
    "scripts/compliance/generate-sbom.mjs",
  ]) {
    const run = spawnSync(process.execPath, [path.join(root, generator)], {
      cwd: dir,
      encoding: "utf8",
    });
    if (run.status !== 0) {
      errors.push(`Could not regenerate via ${generator}: ${(run.stderr || run.stdout || "").trim().split("\n").slice(-3).join(" ")}`);
      return false;
    }
  }
  return true;
}

const readJson = (base, rel) => JSON.parse(fs.readFileSync(path.join(base, rel), "utf8"));
const readText = (base, rel) => fs.readFileSync(path.join(base, rel), "utf8");

/** Strip exactly the allowlisted fields — nothing structural, nothing inferred. */
function normalizeInventory(inv) {
  const { generatedAt, repositoryCommit, ...rest } = inv;
  void generatedAt;
  void repositoryCommit;
  return rest;
}

function normalizeSummary(text) {
  return text
    .split("\n")
    .map((line) =>
      line.startsWith("Generated:") || line.startsWith("Commit:") ? line.replace(/:.*$/, ": <normalized>") : line
    )
    .join("\n");
}

function normalizeSbom(bom) {
  const clone = JSON.parse(JSON.stringify(bom));
  delete clone.serialNumber;
  if (clone.metadata) {
    delete clone.metadata.timestamp;
    const properties = clone.metadata.component?.properties;
    if (Array.isArray(properties)) {
      clone.metadata.component.properties = properties.filter((p) => p?.name !== "repositoryCommit");
    }
  }
  return clone;
}

const key = (p) => `${p.name}@${p.version}`;

/** Named, reviewer-legible substance comparisons. A raw deep-diff of 686
 *  packages tells a reviewer nothing; these say what actually moved. */
function comparePackageSubstance(committed, fresh) {
  const before = new Map(committed.map((p) => [key(p), p]));
  const after = new Map(fresh.map((p) => [key(p), p]));

  const added = [...after.keys()].filter((k) => !before.has(k));
  const removed = [...before.keys()].filter((k) => !after.has(k));
  if (added.length) errors.push(`${added.length} package(s) present in the current lockfile but missing from the committed inventory: ${added.slice(0, 12).join(", ")}${added.length > 12 ? ` (+${added.length - 12} more)` : ""}`);
  if (removed.length) errors.push(`${removed.length} package(s) in the committed inventory no longer resolve from the current lockfile: ${removed.slice(0, 12).join(", ")}${removed.length > 12 ? ` (+${removed.length - 12} more)` : ""}`);

  // Fields whose change is a compliance fact, not a formatting difference.
  const MATERIAL = ["declaredLicense", "classification", "reviewStatus", "relationship", "scope", "missingOrUnknownLicense", "dependencyPath", "notes"];
  const changed = [];
  for (const [k, freshPkg] of after) {
    const committedPkg = before.get(k);
    if (!committedPkg) continue;
    for (const field of MATERIAL) {
      if (JSON.stringify(committedPkg[field]) !== JSON.stringify(freshPkg[field])) {
        changed.push(`${k}: ${field} ${JSON.stringify(committedPkg[field])} -> ${JSON.stringify(freshPkg[field])}`);
      }
    }
  }
  if (changed.length) errors.push(`${changed.length} license/classification change(s) against the committed inventory: ${changed.slice(0, 12).join("; ")}${changed.length > 12 ? ` (+${changed.length - 12} more)` : ""}`);
}

function compareCounts(committed, fresh) {
  for (const metric of Object.keys(fresh)) {
    if (committed[metric] !== fresh[metric]) {
      errors.push(`counts.${metric} differs: committed ${committed[metric]} -> current ${fresh[metric]}`);
    }
  }
}

/** Deep equality on everything the named checks above did not already cover,
 *  so an unreviewed field cannot drift silently just because no rule names it. */
function compareResidual(label, committed, fresh, skip = []) {
  const prune = (o) => {
    const clone = JSON.parse(JSON.stringify(o));
    for (const field of skip) delete clone[field];
    return clone;
  };
  const a = JSON.stringify(prune(committed));
  const b = JSON.stringify(prune(fresh));
  if (a !== b) errors.push(`${label} differs outside the reviewed volatile allowlist (regenerate the artifacts and review the diff).`);
}

// ---------------------------------------------------------------------------

for (const artifact of [INVENTORY, SUMMARY, SBOM]) {
  if (!fs.existsSync(path.join(root, artifact))) errors.push(`Missing committed compliance artifact: ${artifact}`);
}

let scratch = null;
if (!errors.length) {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), "pmfreak-compliance-drift-"));
  try {
    if (regenerateInto(scratch)) {
      const committedInv = readJson(root, INVENTORY);
      const freshInv = readJson(scratch, INVENTORY);

      // 1. Lockfile identity — the most direct staleness signal. Compared field
      //    by field so the reviewer is told WHICH input moved, and excluded from
      //    the residual sweep below so one fact is not reported twice.
      if (committedInv.lockfile?.sha256 !== freshInv.lockfile?.sha256) {
        errors.push(
          `Committed artifacts were generated from a different package-lock.json ` +
            `(inventory lockfile.sha256 ${String(committedInv.lockfile?.sha256).slice(0, 12)}… -> current ${String(freshInv.lockfile?.sha256).slice(0, 12)}…).`
        );
      }
      for (const field of ["path", "lockfileVersion"]) {
        if (committedInv.lockfile?.[field] !== freshInv.lockfile?.[field]) {
          errors.push(`inventory lockfile.${field} differs: ${committedInv.lockfile?.[field]} -> ${freshInv.lockfile?.[field]}`);
        }
      }
      if (committedInv.schemaVersion !== freshInv.schemaVersion) {
        errors.push(`inventory schemaVersion differs: ${committedInv.schemaVersion} -> ${freshInv.schemaVersion}`);
      }

      // 2. Counts, 3. package/license substance.
      compareCounts(committedInv.counts ?? {}, freshInv.counts ?? {});
      comparePackageSubstance(committedInv.packages ?? [], freshInv.packages ?? []);

      // 4. Anything else in the inventory that no named rule covered.
      compareResidual("Inventory", normalizeInventory(committedInv), normalizeInventory(freshInv), ["packages", "counts", "lockfile"]);

      // 5. Summary — the rendered projection of the same counts.
      if (normalizeSummary(readText(root, SUMMARY)) !== normalizeSummary(readText(scratch, SUMMARY))) {
        errors.push(`${SUMMARY} differs outside the reviewed volatile allowlist.`);
      }

      // 6. SBOM components and metadata.
      const committedSbom = normalizeSbom(readJson(root, SBOM));
      const freshSbom = normalizeSbom(readJson(scratch, SBOM));
      const sbomKey = (c) => `${c.name}@${c.version}`;
      const sbomBefore = new Map((committedSbom.components ?? []).map((c) => [sbomKey(c), c]));
      const sbomAfter = new Map((freshSbom.components ?? []).map((c) => [sbomKey(c), c]));
      const sbomAdded = [...sbomAfter.keys()].filter((k) => !sbomBefore.has(k));
      const sbomRemoved = [...sbomBefore.keys()].filter((k) => !sbomAfter.has(k));
      if (sbomAdded.length) errors.push(`SBOM is missing ${sbomAdded.length} component(s) present in the current lockfile: ${sbomAdded.slice(0, 12).join(", ")}${sbomAdded.length > 12 ? ` (+${sbomAdded.length - 12} more)` : ""}`);
      if (sbomRemoved.length) errors.push(`SBOM carries ${sbomRemoved.length} component(s) that no longer resolve: ${sbomRemoved.slice(0, 12).join(", ")}${sbomRemoved.length > 12 ? ` (+${sbomRemoved.length - 12} more)` : ""}`);
      for (const [k, freshComponent] of sbomAfter) {
        const committedComponent = sbomBefore.get(k);
        if (committedComponent && JSON.stringify(committedComponent) !== JSON.stringify(freshComponent)) {
          errors.push(`SBOM component ${k} differs (license, scope, purl or classification property).`);
        }
      }
      // The SBOM restates the lockfile digest as a CycloneDX property. Compared
      // explicitly (so a hand-edit of the SBOM alone is still caught) and then
      // excluded from the residual sweep, which would otherwise re-report the
      // lockfile change already named above.
      const sbomProperty = (bom, name) =>
        (bom.metadata?.component?.properties ?? []).find((p) => p?.name === name)?.value;
      if (sbomProperty(committedSbom, "lockfileSha256") !== sbomProperty(freshSbom, "lockfileSha256")) {
        errors.push("SBOM metadata.component.properties[lockfileSha256] does not match the current package-lock.json.");
      }
      const withoutLockfileProperty = (bom) => {
        const clone = JSON.parse(JSON.stringify(bom));
        if (Array.isArray(clone.metadata?.component?.properties)) {
          clone.metadata.component.properties = clone.metadata.component.properties.filter((p) => p?.name !== "lockfileSha256");
        }
        return clone;
      };
      compareResidual("SBOM metadata", withoutLockfileProperty(committedSbom), withoutLockfileProperty(freshSbom), ["components"]);

      notes.push(`Compared ${freshInv.packages.length} inventory packages and ${(freshSbom.components ?? []).length} SBOM components.`);

      // Ordering hazard, stated rather than guessed at: this gate reads the
      // WORKING TREE. Running it after something that regenerates in place
      // (`compliance:check` does) compares a fresh generation against a fresh
      // generation and passes trivially. `compliance:check` therefore calls it
      // BEFORE its generators. If the artifacts are already dirty the pass is
      // still true — they are current — but a reviewer should know which fact
      // they are looking at.
      const dirty = spawnSync("git", ["diff", "--quiet", "HEAD", "--", INVENTORY, SUMMARY, SBOM], { cwd: root });
      if (dirty.status === 1) {
        notes.push("NOTE: these artifacts already differ from HEAD — they were regenerated in this working tree, so this result describes the regenerated files, not what HEAD carries.");
      }
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

console.log("[compliance-drift] Semantic comparison of committed compliance artifacts against a fresh generation.");
console.log("[compliance-drift] Normalized volatile provenance fields (explicit allowlist, nothing inferred):");
for (const field of VOLATILE_FIELDS) console.log(`    - ${field.artifact} :: ${field.path}  (${field.why})`);
for (const note of notes) console.log(`[compliance-drift] ${note}`);

if (errors.length) {
  console.error(`\n[compliance-drift] SEMANTIC DRIFT DETECTED (${errors.length}):`);
  for (const message of errors) console.error(`[FAIL] ${message}`);
  console.error(
    "\nThe committed compliance artifacts no longer describe the current dependency graph.\n" +
      "Regenerate and review them:\n" +
      "  npm run compliance:licenses:generate && npm run compliance:sbom\n" +
      "Then confirm no new BLOCKED or REVIEW_REQUIRED entry appeared before committing.\n"
  );
  process.exit(1);
}

console.log("[compliance-drift] Committed compliance artifacts are semantically current.");
