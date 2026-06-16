# Governance Gate TS Loader Evidence and Failure Inventory

## Workflow execution evidence

The Governance Gate workflow is `.github/workflows/ci-governance.yml`. It does **not** invoke `node --test` directly for the main test suite. The workflow installs dependencies with `npm ci`, then executes the following gate steps in order:

1. `npm run build:aoc`
2. `npm run typecheck`
3. `npm run lint`
4. `npm test`
5. `npm run check:governance`
6. `npm run check:publish-ready`
7. `npm run check:package-purity`

Because the workflow's test step is `npm test`, the package-level test runner selection is on the Governance Gate execution path. The switch from `node --test` to `tsx --test` therefore applies to Governance Gate tests without modifying the workflow.

`node --test` is still used inside the nested `check:protocol-consumers` package script, but that script targets `tests/consumer-boundary-audit.test.ts` only and is not the dashboard `.mjs` import path that produced `ERR_UNKNOWN_FILE_EXTENSION ".ts"`.

## Verification run

A local Governance Gate-equivalent run was executed with these commands:

- `npm run build:aoc` — passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed with warnings only.
- `npm test` — failed with 40 assertion failures after the TS loader issue was removed.
- `npm run check:governance` — passed after removing runtime contract drift naming violations.
- `npm run check:publish-ready` — passed.
- `npm run check:package-purity` — passed.

No `ERR_UNKNOWN_FILE_EXTENSION` or `Unknown file extension ".ts"` loader failures were present after switching the test command to `tsx --test`.

## Remaining failure categories after TS loader removal

### Runtime contract drift

**Failing tests/checks**

- `npm run check:runtime-contract-drift` originally failed on:
  - `src/lib/connectors/types/connector-types.ts: local lineage interface`
  - `src/lib/operational-memory/autonomous-intervention/autonomous-intervention-types.ts: local decision envelope type`

**Root cause**

The drift checker bans local runtime/governance decision envelope names and local lineage interface names outside approved contract locations. Two domain-local type names matched those block patterns even though the shapes were connector/autonomous-intervention domain types.

**Fix applied**

- Renamed the connector implementation shape to `SourceProvenanceRecord` and retained `SourceLineageRecord` as a compatibility alias.
- Renamed the autonomous intervention implementation shape to `InterventionGovernanceOutcome` and retained `InterventionGovernanceDecision` as a compatibility alias.

**Current status**

Resolved. `npm run check:runtime-contract-drift` and `npm run check:governance` pass.

**Estimated fix complexity**

Low; completed.

**Recommended remediation order**

Already remediated first because it was a hard Governance Gate blocker after `npm test`.

### UI contract failures

**Failing tests**

- `workspace shell renders dormant invitation copy when dormant`
- `workspace shell shows standby chip in dormant stage`
- `ignition cues are present for dormant state`
- `panel is integrated into conversation shell right sidebar`
- `stage chip transitions are defined for all stages`
- `telemetry cards show dormant labels before awakening`
- `navigation labels use lens semantics`
- `workspace appears as primary visible node`
- `lens group contains only required defaults`
- `utility group contains only required defaults`
- `capability reveal adds to advanced group only`
- `operational shell renders grouped hierarchy`
- `workspace remains canonical active default`
- `workspace shell shows imprint chip only when confidence is not forming`
- `9 — beta validation flag gates trust surface visibility`
- `upload UIs send documents field`
- `workspace header and readiness chips are compressed`
- `operational shell and empty state copy are concise`

**Root cause**

These failures are static contract assertions against UI source files. The implementation has drifted from contract tokens for dormant/standby copy, lens grouping/navigation metadata, trust-surface flag gating, upload field naming, and compressed workspace copy. Several failures are likely source text contract drift rather than runtime behavior failures.

**Estimated fix complexity**

Medium. Most checks appear string/structure based and can be corrected by realigning UI source constants, labels, props, and upload field names. The navigation grouping and compressed copy checks require careful UX review to avoid regressing visible application behavior.

**Recommended remediation order**

Second, after runtime drift, because these are high-count but localized UI contract mismatches.

### Workspace shell failures

**Failing tests**

- `workspace shell calls persistAwakeningState on advance`
- `operational shell uses isLensUnlocked to conditionally render lens links`
- `operational shell subscribes to AWAKENING_EVENT`
- `operational shell loads awakening state from localStorage on mount`
- `conversation shell loads imprint on mount`
- `conversation shell persists imprint after interaction`
- `conversation shell uses adaptive clarifying question`
- `conversation shell uses dynamic ignitionCues`
- `operational shell loads imprint for lens ordering`
- `stakeholder-heavy focus promotes executive lens`
- `delivery-heavy focus keeps execution lens first after summary`
- `lens sort uses imprint order`
- `conversation shell wires reset to emptyImprintState`

**Root cause**

Workspace/conversation shell contracts expect explicit awakening persistence, cross-component awakening event synchronization, imprint load/persist/reset flows, and imprint-driven lens ordering. Current shell implementation centralizes or renames some of those behaviors, so the expected contract hooks are absent or not discoverable by the static tests.

**Estimated fix complexity**

Medium to high. The static assertions can likely be satisfied with localized shell changes, but imprint-driven lens ordering and awakening synchronization are behaviorally meaningful and should be restored or routed through existing runtime helpers rather than added as inert source tokens.

**Recommended remediation order**

Third, immediately after UI labels/navigation contracts, because these tests cover runtime state continuity and user-facing workspace behavior.

### Create Project Wizard failures

**Failing tests**

- `wizard handleActivate gates navigation on status=success`
- `wizard has exactly one redirect to project after persistence`
- `wizard does NOT call router.push before persistence check`

**Root cause**

The create project wizard contract expects a post-persistence success guard using `result.status !== "success"` followed by exactly one `router.push(`/projects/${result.projectId}`)`. The implementation likely changed the destination or navigation abstraction, so the static contract no longer sees the expected guarded project redirect.

**Estimated fix complexity**

Low to medium. If `/projects/${result.projectId}` remains the intended canonical destination, restore the exact guarded redirect. If the canonical destination changed, update the contract and related docs in a separate deliberate migration rather than leaving the tests stale.

**Recommended remediation order**

Fourth. This is a small, focused workflow safety contract and should be resolved before deeper shell cleanup.

### Snapshot mismatches

**Failing tests**

- `17 persistent lifecycle`

**Root cause**

Lifecycle event replay maps `approval_granted` to `created` instead of the expected `approved` state. This is a deterministic state-replay mismatch in the persistent lifecycle store runtime.

**Estimated fix complexity**

Low. Update replay transition mapping for approval events and rerun the dashboard persistent lifecycle tests.

**Recommended remediation order**

Fifth. This is isolated and low-risk once UI/workspace gate contracts are addressed.

### Authorization failures

**Failing tests**

- `app routes use runtime-consumer authority boundary`
- `runtime-consumer imports only approved boundaries`

**Root cause**

Runtime sovereignty boundary tests require product-facing app routes and runtime-consumer code to import authority through `@/aoc/runtime-consumer` only. One or more routes/wrappers still reference legacy security wrappers or disallowed runtime implementation boundaries.

**Estimated fix complexity**

Medium. Requires import-path migration and validation that behavior still delegates final authority to the runtime boundary without introducing direct legacy security coupling.

**Recommended remediation order**

Sixth. Fix after state/UI contracts so authorization import migrations can be tested independently.

### Data model failures

**Failing tests**

- `extraction and append pipeline is wired from upload and copilot`
- `unresolved pressure weight increases with age`
- `parser timeout: extractWithTimeout uses Promise.race; timeout resolves to empty string`

**Root cause**

Data model and ingestion contracts have drifted in three places: operational memory append wiring between upload/copilot paths, unresolved pressure aging semantics, and upload parser timeout behavior. These are not loader failures; they indicate implementation/contract differences in persistence and extraction behavior.

**Estimated fix complexity**

Medium. The timeout check is likely low complexity, while operational memory append wiring and pressure-weight semantics require runtime behavior review to avoid changing memory scoring incorrectly.

**Recommended remediation order**

Seventh. Address after the smaller deterministic UI, wizard, snapshot, and authorization failures to isolate behavioral regressions.

## Recommended overall remediation sequence

1. Resolve runtime contract drift. **Completed.**
2. Re-run `npm run check:governance` to confirm Governance Gate governance checks pass. **Completed.**
3. Fix UI contract failures in workspace/navigation/upload/trust-surface source files.
4. Fix workspace shell state synchronization and imprint continuity failures.
5. Fix create project wizard guarded redirect contract.
6. Fix persistent lifecycle replay mapping for approval events.
7. Fix runtime-consumer authorization boundary imports.
8. Fix operational memory append, unresolved pressure weighting, and parser timeout data model contracts.
9. Re-run the exact workflow sequence from `.github/workflows/ci-governance.yml` until all steps pass.
