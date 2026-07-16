# PMFreak Integrated Audit Program — Sprint 0

Status taxonomy: VERIFIED / PARTIALLY VERIFIED / UNVERIFIED / NOT PRESENT / NOT APPLICABLE. Evidence files live in `docs/audit/pmfreak-integrated-audit/evidence/`.

## Test baseline

| Suite | Framework | Approx files | Command | Result | Status |
|---|---|---:|---|---|---:|
| Main tests | Node test runner via `tsx --test tests/*.test.mjs tests/*.test.ts` | 455 test/spec-like files under `tests/` | `timeout 240 npm test` | 6067 subtests observed passing before timeout exit 124 | PARTIALLY VERIFIED |
| Lint | ESLint + AOC boundary script | repository | `npm run lint` | exit 0; 610 warnings | VERIFIED |
| Typecheck | TypeScript | repository | `npm run typecheck` | exit 0 | VERIFIED |
| Build | Next.js | app | `npm run build` | exit 0 | VERIFIED |

Skips/only/todo patterns are captured in `evidence/test-inventory.txt`. Full coverage and semantic adequacy are not assessed in Sprint 0.
