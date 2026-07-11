# Spreadsheet Processing Boundary — Perilla 12

Runbook for every path where PMFreak touches spreadsheet files. Code:
`src/lib/spreadsheets/` (the only module allowed to import the engine,
enforced by `tests/spreadsheet-dependency-boundary.test.mjs`).

## Where spreadsheets are processed

| Path | Direction | Trust |
| ---- | --------- | ----- |
| Evidence upload → `EvidenceProcessor` → `readSpreadsheetWorkbook` | parse | **Untrusted** — treat every uploaded workbook as hostile |
| Requirement-matrix download → `createWorkbookBlob`/`downloadWorkbook` | generate | Internal rows, but cell text derives from uploaded documents → sanitized on export |

## Supported / unsupported formats

* **Supported (parse)**: `.xlsx` (OOXML, zip container) only.
* **Unsupported (rejected)**: legacy `.xls` (CFB binary), `.xlsm`/anything
  carrying VBA (`vbaProject.bin`), CSV-as-spreadsheet, any non-zip payload
  (`not_a_spreadsheet`). Upstream, the upload route already restricts MIME +
  extension + magic bytes; the reader re-checks independently — neither
  layer trusts the other.

## File limits (env-configurable, clamped — src/lib/spreadsheets/limits.ts)

| Variable | Default | Range | Enforced |
| -------- | ------- | ----- | -------- |
| `SPREADSHEET_MAX_FILE_BYTES` | 10 MiB | 1 KiB – 50 MiB | before any parsing |
| `SPREADSHEET_MAX_DECOMPRESSED_BYTES` | 100 MiB | 1 MiB – 1 GiB | from zip central-directory metadata, before inflating (zip-bomb defense) |
| `SPREADSHEET_MAX_SHEETS` | 20 | 1 – 100 | post-parse |
| `SPREADSHEET_MAX_ROWS_PER_SHEET` | 10,000 | 1 – 200,000 | post-parse |
| `SPREADSHEET_MAX_COLUMNS` | 256 | 1 – 16,384 | post-parse |
| `SPREADSHEET_MAX_CELL_LENGTH` | 8,192 chars | 16 – 32,767 | during normalization |
| `SPREADSHEET_PARSE_TIMEOUT_MS` | 10,000 | 500 – 120,000 | deadline around the engine parse |

Unparsable or out-of-range env values fall back to the default — a typo can
never widen or disable a bound, and limits cannot be turned off in
production.

## Formula policy

Formulas are **never evaluated**. A formula cell contributes only the
cached result stored inside the file ("" when none). No add-in, DDE, or
defined-name execution path exists. On **export**, any text cell starting
with `=`, `+`, `-`, `@`, tab, or CR is prefixed with `'` (Excel's
treat-as-text marker) so exported files opened in desktop applications
cannot fire formula/CSV/DDE injection (`sanitizeCellForExport`).

## Macro / external-link / embedded-object policy

Rejected outright before parsing, from the archive's entry list:

* `**/vbaProject.bin` → `macro_content_rejected`
* `xl/externalLinks/**` → `external_links_rejected`
* `xl/embeddings/**`, any `oleObject*` → `embedded_objects_rejected`

Hyperlink cells yield display text only; targets are never fetched. No
remote resource is ever resolved during parse.

## Normalization behavior (the internal contract, types.ts)

`SpreadsheetWorkbook = { sheets: [{ name, rows: string[][] }] }` — sheets in
workbook order, names preserved; blank rows omitted; empty cells → `""`;
numbers/booleans stringified; dates → ISO-8601 (date-only when midnight
UTC); rich text concatenated; formula → cached result; error cells → their
error code text.

## Security checks, in order

1. `assertSpreadsheetBuffer` — non-empty, ≤ max file size, zip magic
   (`PK\x03\x04`).
2. `inspectSpreadsheetArchive` — workbook-shaped entry list required;
   macro/external-link/OLE rejection; declared decompressed-size cap
   (nothing is inflated to check this).
3. Engine parse inside `withPrototypePollutionGuardAsync` (Perilla 11
   canary, retained as defense-in-depth: a parse that mutates
   `Object.prototype`/`Array.prototype` is rejected and the runtime
   restored) and a `SPREADSHEET_PARSE_TIMEOUT_MS` deadline.
4. Post-parse sheet/row/column/cell-length caps during normalization.
5. Workspace authorization is upstream: evidence processing only runs for
   rows already created by the authenticated, workspace-scoped,
   rate-limited upload route (Perillas 8/9).

## Error handling

All failures surface as `SpreadsheetSecurityError` with a stable `code` and
a fixed, generic message (`src/lib/spreadsheets/security.ts`). Library
internals, stack traces, and file content never reach callers or API
responses; the evidence pipeline logs the safe message and marks the
evidence row `failed`. `PrototypePollutionError` propagates distinctly so
incidents are visible in logs.

## Dependency provenance & upgrade procedure

* Engine: `exceljs@^4.4.0` from the public npm registry, pinned by
  `package-lock.json` integrity hashes. Selection rationale + alternatives:
  docs/release/xlsx-replacement-decision.md.
* The removed `xlsx` package is permanently forbidden:
  `scripts/check-dependency-security.mjs` (`FORBIDDEN_PACKAGES`) and
  `tests/spreadsheet-dependency-boundary.test.mjs` both fail if it returns.
* To upgrade the engine: bump the version, run `npm run check:dependency-security`
  (re-verify the `uuid` allowlist note still holds — exceljs must still only
  call `uuid.v4()`), then `npx tsx --test tests/spreadsheet-*.test.*` and the
  full `npm run check:beta-release`.
* To swap the engine: reimplement `workbook-reader.ts`/`workbook-writer.ts`
  behind the unchanged `types.ts` contract; the reader/writer contract tests
  are engine-agnostic and must pass unmodified.

## Tests

* `tests/spreadsheet-reader-contract.test.ts` — normalized-shape contract.
* `tests/spreadsheet-security-boundary.test.ts` — limits, hostile archives
  (macro/external-link/OLE/zip-bomb), pollution hygiene, error sanitization.
* `tests/spreadsheet-export-workbook.test.ts` — export round-trip +
  formula-injection neutralization.
* `tests/spreadsheet-dependency-boundary.test.mjs` — xlsx never returns;
  engine stays behind the abstraction.
* `tests/prototype-pollution-guard.test.mjs` — canary semantics (sync +
  async) and reader integration.
