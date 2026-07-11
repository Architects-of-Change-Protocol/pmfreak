# XLSX Dependency Replacement Decision — Perilla 12 (RR-XLSX)

Decided: 2026-07-11. Context: Perilla 11 left the beta gate at
`CONDITIONAL GO` with RR-XLSX open — `xlsx@0.18.5` (the last npm-published
SheetJS build) carries a high-severity prototype-pollution advisory
(GHSA-4r6h-8v6p-xvw6) and a ReDoS advisory (GHSA-5pgg-2g8v-p4x9) with **no
fix available on the npm registry**. This document records the replacement
decision that closes RR-XLSX.

## Usage inventory (what actually had to be replaced)

Full-repo scan (`rg "from ['\"]xlsx['\"]|require\(['\"]xlsx['\"]\)|XLSX\."`)
found exactly two call sites:

| File | Usage | Runtime | Input trust | Required capability |
| ---- | ----- | ------- | ----------- | ------------------- |
| `src/lib/project-evidence/evidence-processor.ts` | `XLSX.read(buffer)` + `XLSX.utils.sheet_to_json(header:1, blankrows:false, raw:false)` | Node (background evidence extraction) | **Untrusted** (workspace evidence uploads) | Parse XLSX buffer → per-sheet rows of display text; sheet names; dates/numbers/booleans as text; skip blank rows |
| `src/app/(protected)/upload/page.tsx` | `utils.book_new` / `json_to_sheet` / `book_append_sheet` / `writeFileXLSX` | Browser (requirement-matrix export) | Internal (rows derived from analysis of uploaded docs → still sanitized on export) | Build single-sheet XLSX with headers + column widths; trigger download |

Not used anywhere: CSV parsing, formula evaluation, XLS (legacy binary)
parsing, styles beyond column width, merged cells, streaming. The required
API surface is deliberately tiny, which made a full replacement feasible.

## Options evaluated

| Option | Security | Maintenance | API fit | Migration effort | License | Bundle/Runtime | Decision |
| ------ | -------- | ----------- | ------- | ---------------- | ------- | -------------- | -------- |
| **1. exceljs@4.4.0 (npm)** | `npm audit`: 0 critical, 0 high; 1 moderate via transitive `uuid` (GHSA-w5hq-g745-h8pq — affects `v3/v5/v6` with a caller-supplied buffer; exceljs calls only `uuid.v4()` with no arguments → unreachable) | Active repo, 2M+ weekly downloads; last stable release 2023-10, prerelease activity 2024 — slow but alive | Covers both call sites: `workbook.xlsx.load(buffer)` for read, `workbook.xlsx.writeBuffer()` for browser export, column widths, TS types bundled | Small (2 call sites, both behind a new internal abstraction) | MIT | Server: Node-native. Browser: loaded lazily (dynamic import) so the export engine stays out of the initial bundle | **SELECTED** |
| 2. Official fixed SheetJS distribution (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`) | Fixes both advisories; official vendor artifact | Vendor-maintained | Drop-in | Trivial *if reachable* | Apache-2.0 | Same as today | **REJECTED — not implementable**: cdn.sheetjs.com is blocked by this build environment's egress policy (re-verified 2026-07-11: `CONNECT` → 403 from proxy; same result as the Perilla 11 attempt). Every `npm ci` (CI, Vercel, contributor machines behind the same policy) would need that host. A URL dependency outside the npm registry also weakens lockfile-centric supply-chain review |
| 3. Split by capability (dedicated reader + hand-rolled writer over `jszip`) | Smaller dependency surface in principle | Custom code = ours to maintain | Would require writing/maintaining an XLSX writer | Highest | — | Smallest bundle | **REJECTED**: unnecessary complexity — one maintained MIT library covers both needs; a bespoke OOXML writer is new attack/maintenance surface this security-only PR should not add |

## Why exceljs

* Eliminates the vulnerable package entirely (Result A of the PR contract) —
  `npm ls xlsx` → empty; the audit finding disappears rather than being
  allowlisted.
* Registry-installed and lockfile-pinned (`package-lock.json` integrity
  hashes) — reproducible `npm ci` with no special egress.
* Covers exactly the required capabilities with bundled TypeScript types,
  Buffer/ArrayBuffer support, browser + Node builds.
* Does not evaluate formulas and does not fetch external resources during
  `xlsx.load` — matches the boundary policy
  (docs/security/spreadsheet-processing-boundary.md).

## Functionality preserved / intentionally changed

Preserved: valid workbooks accepted; sheet order + names preserved; rows
converted to text consistently; numbers/booleans preserved; blank rows
skipped; multiple sheets; malformed workbooks rejected; requirement-matrix
export with identical columns/widths/filename.

Intentionally changed (documented behavior deltas):

* **Dates** now normalize to ISO-8601 (`2026-01-15` / full timestamp when a
  time component exists) instead of `raw:false` locale-format strings —
  deterministic and locale-independent.
* **Formula cells** now contribute only the cached result stored in the
  file ("" when none); the old parser exposed the same cached values but
  with format-dependent text.
* **Legacy XLS / non-zip content is rejected** (`not_a_spreadsheet`). The
  old parser would opportunistically parse other formats; the upload
  boundary only ever admitted `.xlsx` MIME, so no supported flow changes.
* **Hostile archives are rejected instead of partially processed**: VBA
  macros, external workbook links, OLE embeddings, declared-decompressed
  size over cap (zip bombs).
* **Exports neutralize formula injection**: leading `=`, `+`, `-`, `@`,
  tab, or CR in exported text cells is prefixed with `'`.

## Transitive-dependency review of the replacement

`exceljs@4.4.0` pulls (relevant here): `jszip` (already a direct dependency
of this repo), `fast-csv` family (CSV — unused by our call sites), `dayjs`,
`saxes` (XML), `readable-stream`, `uuid@8`. Audit result on the final tree:
**0 critical, 0 high**; the single moderate (`uuid`) is unreachable as
described above and allowlisted with justification in
`scripts/check-dependency-security.mjs`. No zip-handling, XML-parsing,
path-traversal, SSRF, RCE, or ReDoS advisories against the installed
versions at review time.

## Guardrails so this decision sticks

* `tests/spreadsheet-dependency-boundary.test.mjs` — fails if `xlsx`
  reappears in `package.json`, `package-lock.json`, or any `src/` import;
  fails if `exceljs` is imported outside `src/lib/spreadsheets/`.
* `scripts/check-dependency-security.mjs` — `FORBIDDEN_PACKAGES = ["xlsx"]`
  hard-fails the gate if the package returns at any version, advisory or
  not; the old RR-XLSX allowlist entry is removed.
* Upgrade procedure for exceljs itself:
  docs/security/spreadsheet-processing-boundary.md §Dependency provenance.
