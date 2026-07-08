# AOC Domain Policy Pack Runtime — Jurisdiction Pack Runtime v1

## Purpose

Provides deterministic infrastructure for jurisdiction-aware policy pack
resolution, validation, composition, evidence requirements, approval
escalation, export metadata and Control Plane summaries.

This runtime does not encode jurisdiction-specific law.
This runtime does not provide legal advice.
This runtime does not certify legal or regulatory compliance.
This runtime does not replace counsel.
This runtime does not claim completeness.

Future jurisdiction-specific packs may be added by customers or
counsel-reviewed pack authors and must preserve safe metadata and
validation status.

## Where this sits

```
AOC Core Protocol
  ↓
Domain Policy Pack Runtime        (domain/ — minimal shared pack-domain seed)
  ↓
Global Legal Baseline Pack        (aoc.global_legal_baseline.v1 — not part of this PR)
  ↓
Jurisdiction Pack Runtime v1      (jurisdiction/ — this module)
  ↓
Future jurisdiction packs         (e.g. aoc.jurisdiction.costa_rica.base.v1 — not part of this PR)
  ↓
Policy Pack Enforcement Wiring / Approval Runtime / Evidence Runtime / Control Plane
```

The `domain/` folder is intentionally thin: it only exists so a
jurisdiction pack can declare which policy pack domain it belongs to
(`PolicyPackDomain = "jurisdiction" | "general"`) without this runtime
inventing a second, parallel policy pack concept. It is not a general
Domain Policy Pack Runtime implementation.

`jurisdiction/` is the actual Jurisdiction Pack Runtime v1: pack
construction, validation, registration/resolution, composition with a
baseline pack, Approval/Evidence Runtime mappings, Verifiable Export
metadata, and Control Plane summaries.

## What this is not

- Not a legal engine and not a law interpreter.
- Not a jurisdictional compliance certifier.
- Not a replacement for customer validation or counsel review.
- Not connected to any network, LLM, OCR, PDF parser, or external legal
  database — every function here is a deterministic, offline, pure
  transformation of its inputs.

Approval Runtime and Evidence / Source / Citation Runtime do not exist yet
in this repository (see `src/features/recognition-runtime/README.md` —
only Recognition Runtime has shipped so far). Rather than build a second
approval/evidence system, this runtime's review and evidence requirement
records carry optional `approvalRuntimeRef` / `sourceRuntimeRef` /
`citationRuntimeRef` / `proofRuntimeRef` string fields — the seam a future
Approval Runtime / Evidence Runtime sprint is expected to plug into, the
same way Recognition Runtime's `require_human_approval` /
`require_more_evidence` outcomes are seams rather than workflows.

## Validation statuses

```
demo_baseline             — fixture/demo metadata only, no real review
customer_provided         — supplied by the customer, unreviewed
customer_validated        — customer has confirmed accuracy, no counsel review
counsel_review_requested  — a counsel review has been requested but not completed
counsel_reviewed          — reviewed and signed off by counsel
counsel_attested          — counsel has issued a formal attestation
expired                   — the validation itself has lapsed
superseded                — replaced by a newer validation
```

**Key merge gate:** `demo_baseline`, `customer_provided`, and
`customer_validated` must never satisfy a `counsel_reviewed` requirement.
Only `counsel_reviewed` and `counsel_attested` do
(`jurisdiction-pack-resolver.ts`'s `validationStatusSatisfies`, ranked in
`JURISDICTION_VALIDATION_STATUS_RANK` in `jurisdiction-pack-types.ts`).
`expired`/`superseded` never satisfy anything.

Note `JurisdictionPackStatus` (pack lifecycle: draft/active/deprecated/
expired/superseded/disabled) and `JurisdictionValidationStatus` are
separate axes — a pack can be lifecycle-`active` while carrying a
`validationStatus` of `expired` (its review went stale without the pack
itself being retired yet), and both are checked independently by the
resolver.

## Decision priority

Most severe first — `resolveJurisdictionPacks` combines every concern it
finds and returns the single most severe:

```
deny
require_counsel_review
require_legal_review
require_compliance_review
require_customer_validation
require_approval
require_review
hold
allow
```

## Determinism

- No `Date.now()`, no random IDs, no network calls, no LLM calls, no OCR,
  no PDF parsing anywhere in this module.
- `resolveJurisdictionPacks`'s `evaluatedAt` is taken verbatim from
  `input.requestedAt` — callers own time, this runtime doesn't generate it.
- Every exported function is a pure transformation: same input, same
  registry state, same output.

## No-overclaim guarantee

`assertNoJurisdictionOverclaim` (`jurisdiction-pack-no-overclaim.ts`)
stringifies a value and checks it against
`JURISDICTION_PROHIBITED_OVERCLAIM_PHRASES`
(`jurisdiction-pack-constants.ts`). `tests/jurisdiction-pack-no-overclaim.test.ts`
runs it against pack metadata, validation results, resolutions,
compositions, approval mappings, evidence mappings, export metadata, and
Control Plane summaries produced across the whole test suite.

## Fixtures

`jurisdiction-pack-fixtures.ts` provides demo-only jurisdiction packs for
tests (CR/PA/US-DE descriptors, one per validation status). None of them
encode real law — the country/subdivision codes exist only to exercise
descriptor-based registry lookups. Do not add real jurisdictional rules
here; that belongs in a future, separately-reviewed jurisdiction pack.
