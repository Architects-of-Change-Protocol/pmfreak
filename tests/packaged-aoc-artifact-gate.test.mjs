/**
 * P0-PKG-04 / P0-PKG-05 — negative controls for the packaged AOC artifact gate.
 *
 * A gate that has only ever seen a healthy repository proves nothing: it might pass
 * because everything is correct, or because it never actually looks. These tests
 * build synthetic repository roots in a temp directory, poison exactly one thing in
 * each, and assert the gate rejects it — most importantly that reintroducing
 * `file:src/aoc/protocol` / `file:src/aoc/enterprise` FAILS rather than quietly
 * restoring the pre-P0-PKG-04 local-source coupling.
 *
 * Only the declaration-level half of the gate runs here (`staticChecks`); the
 * installation-level half needs a real node_modules tree and is exercised by
 * `npm run check:packaged-aoc-artifacts` against this repository.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { staticChecks } from "../scripts/check-packaged-aoc-artifacts.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

/**
 * Build a minimal but genuine repository root: the real lock file and the real
 * manifest shape, plus both legacy copies with their markers. `mutate` receives the
 * writable fixture and breaks exactly one thing.
 */
function fixture(mutate) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "packaged-aoc-gate-"));
  const lock = readJson(path.join(repositoryRoot, "vendor/aoc-consumer.lock.json"));
  const realManifest = readJson(path.join(repositoryRoot, "package.json"));

  const state = {
    root,
    lock,
    manifest: {
      name: "pmfreak-fixture",
      dependencies: {
        "@aoc/protocol": realManifest.dependencies["@aoc/protocol"],
        "@aoc-enterprise/runtime": realManifest.dependencies["@aoc-enterprise/runtime"],
      },
    },
    tsconfig: { compilerOptions: { paths: { "@/*": ["./src/*"] } } },
    // P0-PKG-05 removed the real local copies. These synthetic manifests keep the
    // legacy-copy controls alive: they prove that if a local copy is ever
    // reintroduced, the gate still rejects it for impersonating the canonical name
    // or for dropping its marker. They are fixtures, not a description of the repo.
    localCopies: {
      "src/aoc/protocol": {
        name: "@pmfreak/aoc-protocol-internal",
        version: "0.1.0",
        aocCanonicalStatus: "NON_CANONICAL_LEGACY_COPY",
      },
      "src/aoc/enterprise": {
        name: "@pmfreak/aoc-enterprise-internal",
        version: "0.1.0",
        aocCanonicalStatus: "NON_CANONICAL_LEGACY_COPY",
      },
    },
    sources: {},
  };

  mutate(state);

  fs.mkdirSync(path.join(root, "vendor"), { recursive: true });
  fs.writeFileSync(path.join(root, "vendor/aoc-consumer.lock.json"), JSON.stringify(state.lock, null, 2));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify(state.manifest, null, 2));
  fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify(state.tsconfig, null, 2));
  for (const [directory, manifest] of Object.entries(state.localCopies)) {
    fs.mkdirSync(path.join(root, directory), { recursive: true });
    fs.writeFileSync(path.join(root, directory, "package.json"), JSON.stringify(manifest, null, 2));
  }
  for (const [file, contents] of Object.entries(state.sources)) {
    fs.mkdirSync(path.join(root, path.dirname(file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), contents);
  }
  return root;
}

const failuresFor = (mutate) => staticChecks(fixture(mutate)).failures.join("\n");

test("POSITIVE CONTROL: an unpoisoned fixture passes every declaration-level check", () => {
  assert.equal(failuresFor(() => {}), "", "a healthy fixture must produce no failures");
});

test("NEGATIVE CONTROL: reintroducing file:src/aoc/protocol fails the gate", () => {
  const failures = failuresFor((state) => {
    state.manifest.dependencies["@aoc/protocol"] = "file:src/aoc/protocol";
  });
  assert.match(failures, /@aoc\/protocol: declared as "file:src\/aoc\/protocol"/);
  assert.match(failures, /forbidden local-source specifier "file:src\/aoc\/protocol"/);
});

test("NEGATIVE CONTROL: reintroducing file:src/aoc/enterprise fails the gate", () => {
  const failures = failuresFor((state) => {
    state.manifest.dependencies["@aoc-enterprise/runtime"] = "file:src/aoc/enterprise";
  });
  assert.match(failures, /@aoc-enterprise\/runtime: declared as "file:src\/aoc\/enterprise"/);
  assert.match(failures, /forbidden local-source specifier "file:src\/aoc\/enterprise"/);
});

test("NEGATIVE CONTROL: a local-source specifier under ANY package name fails the gate", () => {
  // The coupling would come back just as completely through a differently-named
  // dependency, so the check is not scoped to the two upstream names.
  const failures = failuresFor((state) => {
    state.manifest.dependencies["@pmfreak/aoc-protocol-internal"] = "file:./src/aoc/protocol";
  });
  assert.match(failures, /forbidden local-source specifier/);
});

test("NEGATIVE CONTROL: a link: or workspace: specifier into local source fails the gate", () => {
  assert.match(
    failuresFor((state) => { state.manifest.dependencies["@aoc/protocol"] = "link:src/aoc/protocol"; }),
    /forbidden local-source specifier "link:src\/aoc\/protocol"/,
  );
  assert.match(
    failuresFor((state) => { state.manifest.dependencies["@aoc/protocol"] = "workspace:*"; }),
    /forbidden local-source specifier "workspace:\*"/,
  );
});

test("NEGATIVE CONTROL: a TypeScript alias mapping an upstream name into local source fails the gate", () => {
  const failures = failuresFor((state) => {
    state.tsconfig.compilerOptions.paths["@aoc/protocol/*"] = ["./src/aoc/protocol/*"];
  });
  assert.match(failures, /tsconfig\.json aliases upstream package name\(s\) into local source/);
});

test("NEGATIVE CONTROL: a legacy copy reclaiming the canonical upstream name fails the gate", () => {
  const failures = failuresFor((state) => {
    state.localCopies["src/aoc/protocol"].name = "@aoc/protocol";
  });
  assert.match(failures, /reclaims the canonical upstream name "@aoc\/protocol"/);
});

test("NEGATIVE CONTROL: a legacy copy dropping its NON_CANONICAL_LEGACY_COPY marker fails the gate", () => {
  const failures = failuresFor((state) => {
    delete state.localCopies["src/aoc/enterprise"].aocCanonicalStatus;
  });
  assert.match(failures, /missing the NON_CANONICAL_LEGACY_COPY marker/);
});

test("NEGATIVE CONTROL: a deep or private import into an upstream package fails the gate", () => {
  for (const specifier of [
    "@aoc/protocol/dist/claims/index.js",
    "@aoc/protocol/src/internal",
    "@aoc-enterprise/runtime/dist/src/runtime/enforcement/authorization-pipeline",
  ]) {
    const failures = failuresFor((state) => {
      state.sources["src/probe.ts"] = `import x from "${specifier}";\nexport default x;\n`;
    });
    assert.match(failures, /is not a declared export key of/, `expected ${specifier} to be rejected`);
  }
});

test("POSITIVE CONTROL: a declared export key import is accepted", () => {
  const failures = failuresFor((state) => {
    state.sources["src/probe.ts"] = 'import { canonicalizeJSON } from "@aoc/protocol/canonical";\nexport default canonicalizeJSON;\n';
  });
  assert.equal(failures, "", "importing a declared export key must not fail the gate");
});

test("NEGATIVE CONTROL: importing a Frontera-private workspace package fails the gate", () => {
  const failures = failuresFor((state) => {
    state.sources["src/probe.ts"] = 'import x from "@aoc-enterprise/governed-authority";\nexport default x;\n';
  });
  assert.match(failures, /imports Frontera-private workspace package/);
});

test("NEGATIVE CONTROL: a direct dependency on a Frontera-private workspace fails the gate", () => {
  const failures = failuresFor((state) => {
    state.manifest.dependencies["@aoc-enterprise/scoped-access"] = "^0.1.0";
  });
  assert.match(failures, /direct dependency on Frontera-private workspace package/);
});

test("NEGATIVE CONTROL: a lock that stops forbidding local-source fallback fails the gate", () => {
  const failures = failuresFor((state) => {
    state.lock.localSourceFallback.allowed = true;
  });
  assert.match(failures, /localSourceFallback\.allowed must be false/);
});

test("NEGATIVE CONTROL: a wrong pinned tarball in the manifest fails the gate", () => {
  const failures = failuresFor((state) => {
    state.manifest.dependencies["@aoc/protocol"] = "file:vendor/aoc-protocol-9.9.9.tgz";
  });
  assert.match(failures, /expected the pinned tarball "file:vendor\/aoc-protocol-0\.2\.0-rc\.0\.tgz"/);
});
