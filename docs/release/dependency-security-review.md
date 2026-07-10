# Dependency Security Review — Perilla 11 (Beta Release Closure Gate)

Reviewed: 2026-07-10. Tooling: `npm audit --json` on a clean `npm ci` install
(Node v22.22.2 / npm 10.9.7). Re-runnable at any time via
`npm run check:dependency-security` (advisory gate inside
`npm run check:beta-release`; exit 0 = clean, 2 = only accepted findings,
1 = unexpected critical/high).

## Baseline (before remediation)

`npm audit` reported **9 vulnerabilities: 3 high, 5 moderate, 1 low.**

| Package | Severity | Direct/Transitive | Runtime/Dev | Reachable | Fix Available | Action |
| ------- | -------: | ----------------- | ----------- | --------- | ------------- | ------ |
| next | high | direct | runtime | **yes** — DoS w/ Server Components, middleware/proxy bypass via segment-prefetch routes, SSRF via WebSocket upgrades | 16.2.10 (in-range) | **fixed** — upgraded `next` + `eslint-config-next` to 16.2.10 |
| ws | high | transitive (`@supabase/realtime-js`) | runtime | potentially (websocket handling) | yes | **fixed** via `npm audit fix` |
| xlsx | high | direct | runtime | **yes** — parses untrusted uploaded workbooks (`src/lib/project-evidence/evidence-processor.ts`) | **no npm fix** (SheetJS ships ≥0.19.3/0.20.2 only via cdn.sheetjs.com; that host is unreachable from this build environment) | **mitigated + accepted with condition** — see below |
| dompurify | moderate | transitive (`jspdf`) | runtime (client PDF export) | potentially | yes | **fixed** via `npm audit fix` |
| js-yaml | moderate | transitive (changesets/eslint) | dev-only | no (build tooling) | yes | **fixed** via `npm audit fix` |
| brace-expansion | moderate | transitive (eslint/minimatch) | dev-only | no | yes | **fixed** via `npm audit fix` |
| qs | moderate | transitive (`stripe`) | runtime | potentially (stringify DoS) | yes | **fixed** via `npm audit fix` |
| postcss | moderate | transitive (bundled by `next`) | build-time | no (stringifies our own trusted CSS, never user input) | only in next canary; npm suggests a *downgrade* to next 9 (rejected) | **accepted** — RR-POSTCSS |
| @babel/core | low | transitive | dev-only | no | yes | **fixed** via `npm audit fix` |

## Result (after remediation)

`npm audit`: **3 findings — 1 high (xlsx), 2 moderate (postcss + next flagged
through its bundled postcss). 0 critical. 0 unexpected.** All three are
classified and accepted below; `check:dependency-security` exits 2
(CONDITIONAL).

### RR-XLSX — xlsx@0.18.5 (high, accepted with condition)

* Advisories: prototype pollution (GHSA-4r6h-8v6p-xvw6), ReDoS
  (GHSA-5pgg-2g8v-p4x9).
* Classification: **exploitable in principle** — the evidence-upload path
  parses untrusted workbooks server-side.
* Why not upgraded here: SheetJS stopped publishing to npm at 0.18.5; fixed
  builds are distributed only from `https://cdn.sheetjs.com`, which this
  build environment's egress policy blocks (verified: npm install of
  `xlsx-0.20.3.tgz` → 403 from proxy).
* Mitigations shipped in this perilla (defense-in-depth, not a substitute):
  * The parse now runs inside a **prototype-pollution canary**
    (`src/lib/security/prototype-pollution-guard.ts`): any parse that adds
    properties to `Object.prototype`/`Array.prototype` is rejected and the
    runtime is restored — a crafted workbook fails its own upload instead of
    poisoning the process. Tests: `tests/prototype-pollution-guard.test.mjs`.
  * Pre-existing bounds on the same path: authenticated + workspace-scoped
    access, upload size caps (`UPLOAD_MAX_FILE_SIZE_BYTES` etc.), and abuse
    rate limits (Perilla 9). ReDoS blast radius is one bounded serverless
    invocation.
* **Condition for the pilot** (residual-risk-register RR-XLSX): install the
  official SheetJS build (`npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`)
  from an unrestricted network, re-run `npm run check:beta-release`, and drop
  the allowlist entry in `scripts/check-dependency-security.mjs`.

### RR-POSTCSS — postcss bundled by next (moderate, accepted)

* Advisory: XSS via unescaped `</style>` in CSS *stringify* output.
* Classification: **not reachable** — postcss runs at build time over the
  repo's own CSS; no user-controlled CSS is ever stringified.
* No stable `next` release carries the patched postcss yet (the only npm
  "fix" is a downgrade to next 9.3.3, which is nonsensical). Re-check on each
  next patch release; drop the allowlist entry when a stable fix lands.

## Supply-chain controls (B.4)

* `package-lock.json` v3, integrity hashes intact; `npm ci` reproducible from
  clean state (verified twice during this gate).
* No git/URL dependencies; the only non-registry deps are the two
  **intentional** local AOC packages (`file:src/aoc/protocol`,
  `file:src/aoc/enterprise`) — their integrity is enforced by
  `npm run check:publish-integrity` (build reproducibility + package purity +
  tarball purity), which **passed**.
* `npm run check:package-purity`, `check:forbidden-imports`,
  `check:package-exports` — **passed** (see gate results).
* No install scripts from untrusted packages surfaced during `npm ci`; no
  secrets in `.npmrc`/npm configuration (none present in repo).
* Versions pinned exactly for the framework (`next`, `react`,
  `eslint-config-next`); remaining deps use caret ranges guarded by the
  lockfile.
