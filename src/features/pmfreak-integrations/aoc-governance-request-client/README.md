# PMFreak AOC Governance Request Client v1

Client ID:

```
pmfreak.integration.aoc.governance_request_client.v1
```

Repo:

```
PMFreak
```

## Purpose

This module lets PMFreak build and evaluate AOC governance requests for
attempted PMFreak agent actions.

## Runtime direction

```
PMFreak consumes AOC Governance.
```

```
PMFreak agent attempts an action
  ↓
PMFreak builds an AOC governance request
  ↓
PMFreak evaluates the request through an AOC governance client
  ↓
AOC / local mock returns a governed decision
  ↓
PMFreak receives the decision
```

This is the PMFreak-side client/request boundary for asking AOC Governance
before sensitive agent actions. It is deliberately the opposite direction
from a prior, closed integration attempt that modeled PMFreak as a passive
read-only data provider for AOC Enterprise to crawl — that direction is not
implemented here and is not what this module does.

## What this module does not do

- This module does not execute PMFreak actions.
- This module does not mutate PMFreak data.
- This module does not write back decisions.
- This module does not send communications.
- This module does not create invoices.
- This module does not certify invoice validity.
- This module does not certify customer acceptance.
- This module does not certify compliance.
- This module does not provide legal advice.
- The local/mock transport is not production AOC.
- The unsupported remote transport does not call a network.

Every one of the above is also enforced structurally:
`PMFreakAocGovernanceRequestClientConfig.allowProductionMutations`,
`allowActionExecution` and `allowDecisionWriteback` are typed `false` and
`createPMFreakAocGovernanceRequestClientConfig` forces any attempt to set
them `true` back to `false` (with a warning). `PMFREAK_AOC_GOVERNANCE_CLIENT_FORBIDDEN_OPERATIONS`
lists the operation names (`execute_action`, `create_invoice`,
`certify_compliance`, etc.) that `assertPMFreakAocGovernanceClientReadOnlyOperation`
rejects. Every output can be checked with
`assertNoPMFreakAocGovernanceOverclaim` / `evaluatePMFreakAocGovernanceClaimSafety`,
which scan for a fixed list of prohibited overclaim phrases (legal advice,
compliance certification, invoice validity certification, customer
acceptance certification, production authorization, etc.).

## Where this sits

```
PMFreak
  ↓ builds governance request
PMFreak AOC Governance Request Client   (this module)
  ↓ evaluates via local/mock/remote transport
AOC Governance
  ↓ returns governed decision
PMFreak receives decision
```

This module is standalone: it does not import from `src/aoc/protocol` or
`src/aoc/enterprise`. No stable AOC network API exists in this repository
yet, so the only working transport is a deterministic local/mock stand-in;
a real remote transport is a future PR (see below).

## Decision vocabulary

```
allow
deny
hold
require_evidence
require_pm_approval
require_customer_validation
require_billing_review
require_contract_review
require_security_review
require_executive_approval
```

## Example

```
Billing Readiness Agent wants to mark a milestone as ready for billing.
PMFreak builds an AOC governance request.
The local/mock transport returns require_evidence if customer acceptance evidence is missing.
PMFreak receives the decision.
PMFreak does not execute the billing action in this PR.
```

```ts
import { createPMFreakAocGovernanceRequestClient, demoPMFreakAocBillingReadinessActionAttempt } from "@/features/pmfreak-integrations/aoc-governance-request-client";

const client = createPMFreakAocGovernanceRequestClient();

const { request, response } = await client.buildAndEvaluate({
  actionAttempt: demoPMFreakAocBillingReadinessActionAttempt(),
  missingEvidenceIds: ["demo.evidence.customer-acceptance.v1"],
});

// response.decision === "require_evidence"
// PMFreak does not mark the milestone billing-ready here — it only received the decision.
```

## Module contents

| File | Responsibility |
| --- | --- |
| `pmfreak-aoc-governance-client-constants.ts` | Client ID/name, capabilities, forbidden operations, safe labels, disclaimers |
| `pmfreak-aoc-governance-client-types.ts` | Shared cross-cutting unions (environment, transport kind, request mode, redaction mode) |
| `pmfreak-aoc-governance-client-descriptor.ts` | `PMFreakAocGovernanceRequestClientDescriptor` + factory |
| `pmfreak-aoc-governance-client-config.ts` | `PMFreakAocGovernanceRequestClientConfig` + safe-by-default factory |
| `pmfreak-aoc-action-attempt.ts` | `PMFreakAocAgentActionAttempt` — a proposed action only |
| `pmfreak-aoc-governance-request.ts` | `PMFreakAocGovernanceRequest` model |
| `pmfreak-aoc-governance-response.ts` | `PMFreakAocGovernanceDecision` / `PMFreakAocGovernanceResponse` models |
| `pmfreak-aoc-request-builder.ts` | Deterministic, pure `createPMFreakAocGovernanceRequest` |
| `pmfreak-aoc-request-validator.ts` | Pure `validatePMFreakAocGovernanceRequest` |
| `pmfreak-aoc-transport.ts` | `PMFreakAocGovernanceTransport` interface |
| `pmfreak-aoc-local-governance-transport.ts` | Deterministic `local_mock_aoc` transport |
| `pmfreak-aoc-unsupported-remote-transport.ts` | Safe, network-free remote placeholder |
| `pmfreak-aoc-governance-client.ts` | `PMFreakAocGovernanceRequestClient` — builds/evaluates requests |
| `pmfreak-aoc-decision-summary.ts` | Safe, human-readable decision summary + next step |
| `pmfreak-aoc-no-mutation-guard.ts` | Rejects any of `PMFREAK_AOC_GOVERNANCE_CLIENT_FORBIDDEN_OPERATIONS` |
| `pmfreak-aoc-redaction.ts` | Deterministic redaction of emails/secrets/tokens and (in `strict` mode) metadata |
| `pmfreak-aoc-errors.ts` | `PMFreakAocGovernanceClientError` and its safe error codes |
| `pmfreak-aoc-health.ts` | `PMFreakAocGovernanceClientHealth` model |
| `pmfreak-aoc-fixtures.ts` | Deterministic, fake-only demo fixtures |
| `pmfreak-aoc-claim-safety.ts` | Prohibited-overclaim scan and safe-phrase corpus |
| `pmfreak-aoc-remote-governance-transport-constants.ts` | Remote transport ID/name, default endpoint path, capabilities, forbidden operations, safe labels, disclaimers |
| `pmfreak-aoc-remote-governance-transport-types.ts` | `PMFreakAocRemoteGovernanceAuthMode` |
| `pmfreak-aoc-remote-governance-transport-descriptor.ts` | `PMFreakAocRemoteGovernanceTransportDescriptor` + factory |
| `pmfreak-aoc-remote-governance-transport-config.ts` | `PMFreakAocRemoteGovernanceTransportConfig` + safe-by-default factory |
| `pmfreak-aoc-remote-governance-endpoint-types.ts` | Local compatibility DTOs for the AOC endpoint envelope (not imported from AOC Enterprise) |
| `pmfreak-aoc-remote-governance-request-serializer.ts` | Pure `serializePMFreakAocRemoteGovernanceRequest` (URL/headers/body) |
| `pmfreak-aoc-remote-governance-response-parser.ts` | Safe `parsePMFreakAocRemoteGovernanceEndpointBody` (never throws raw parse errors) |
| `pmfreak-aoc-remote-governance-response-validator.ts` | Pure `validatePMFreakAocRemoteAocGovernanceResponse` |
| `pmfreak-aoc-remote-governance-response-mapper.ts` | Pure `mapAocEndpointResponseToPMFreakAocGovernanceResponse` |
| `pmfreak-aoc-remote-governance-transport.ts` | `createRemoteHttpPMFreakAocGovernanceTransport` — the `remote_http` transport |
| `pmfreak-aoc-remote-governance-errors.ts` | `PMFreakAocRemoteGovernanceTransportError` and its safe error codes |
| `pmfreak-aoc-remote-governance-health.ts` | `PMFreakAocRemoteGovernanceTransportHealth` model |
| `pmfreak-aoc-remote-governance-redaction.ts` | Deterministic redaction of emails/secrets/tokens/bearer-tokens/connection-strings for transport payloads |
| `pmfreak-aoc-remote-governance-claim-safety.ts` | Prohibited-overclaim scan reusing the base module's phrase corpus |
| `pmfreak-aoc-remote-governance-fixtures.ts` | Deterministic, fake-only demo endpoint bodies + `fetchImpl` mock helpers |

## Determinism

No `Date.now()`, `Math.random()`, `crypto.randomUUID()`, `axios`,
`XMLHttpRequest`, LLM SDK, OCR, or PDF-parsing call exists anywhere in this
module (enforced by `tests/pmfreak-aoc-determinism.test.ts` and
`tests/pmfreak-aoc-remote-governance-determinism.test.ts`). Request and
response IDs are derived deterministically from the action attempt ID /
request ID (`pmfreak.aoc.request.<safe-action-attempt-id>.v1` /
`pmfreak.aoc.response.<safe-request-id>.v1`). The only literal `fetch(`
call site in this module is inside `pmfreak-aoc-remote-governance-transport.ts`,
guarded behind the `fetchImpl` option — tests inject a mock `fetchImpl` and
never perform a real network call.

# PMFreak AOC Remote Governance Transport v1

Transport ID:

```
pmfreak.integration.aoc.remote_governance_transport.v1
```

Repo:

```
PMFreak
```

## Purpose

Send PMFreak governance requests to the AOC Enterprise Remote Governance
Endpoint (`aoc.integration.pmfreak.remote_governance_endpoint.v1`) and
receive governed decisions back. This is the real, opt-in `remote_http`
implementation of the `PMFreakAocGovernanceTransport` interface — it
replaces neither `local_mock` (still the default) nor
`unsupported_remote` (still available as a network-free placeholder).

## Runtime direction

```
PMFreak consumes AOC Governance.
```

```
PMFreak agent attempts an action
  ↓
PMFreak builds an AOC governance request
  ↓
PMFreak remote transport serializes the request
  ↓
PMFreak remote transport sends a POST to the AOC endpoint
  ↓
AOC evaluates and returns a governed decision
  ↓
PMFreak validates and maps the response
  ↓
PMFreak receives the decision
```

PMFreak still does not execute the action in this PR.

## Default endpoint path

```
/api/aoc/pmfreak/governance/evaluate
```

## Usage

- The default client transport remains `local_mock` — nothing changes for
  existing callers.
- `remote_http` is opt-in only: it is never selected automatically by
  `createPMFreakAocGovernanceRequestClient`.
- `remote_http` requires `aocBaseUrl` — `createPMFreakAocRemoteGovernanceTransportConfig`
  throws a safe `invalid_config` error without it.
- Tests use `fetchImpl` mocks (`pmfreak-aoc-remote-governance-fixtures.ts`)
  and never call a real network.

## Auth modes

```
none_demo             — no auth header (default)
shared_secret_header  — a configured header name/value
bearer_token          — Authorization: Bearer <token>
unsupported           — safe config error if used to send a request
```

## Safety

- This transport does not execute PMFreak actions.
- This transport does not mutate PMFreak data.
- This transport does not write back decisions.
- This transport does not send communications.
- This transport does not create invoices.
- This transport does not certify invoice validity.
- This transport does not certify customer acceptance.
- This transport does not certify compliance.
- This transport does not provide legal advice.

As with the base client, every one of the above is also enforced
structurally: `PMFreakAocRemoteGovernanceTransportConfig.allowActionExecution`,
`allowProductionMutations`, `allowDecisionWriteback`, `allowInvoiceCreation`
and `allowCommunications` are typed `false`, and
`createPMFreakAocRemoteGovernanceTransportConfig` forces any attempt to set
them `true` back to `false` (with a warning, never leaking the attempted
secret/token value). Errors, headers and logs never include secrets, bearer
tokens, authorization headers, connection strings, or raw request/response
bodies — see `pmfreak-aoc-remote-governance-errors.ts` and
`pmfreak-aoc-remote-governance-redaction.ts`.

## Usage with the existing client

```ts
import {
  createRemoteHttpPMFreakAocGovernanceTransport,
  createPMFreakAocGovernanceRequestClient,
} from "@/features/pmfreak-integrations/aoc-governance-request-client";

const remoteTransport = createRemoteHttpPMFreakAocGovernanceTransport(
  {
    aocBaseUrl: "https://aoc.example.com",
    authMode: "shared_secret_header",
    sharedSecretHeaderName: "x-aoc-governance-secret",
    sharedSecretValue: "[configured-outside-code]",
  },
  {
    fetchImpl,
  }
);

const client = createPMFreakAocGovernanceRequestClient({
  config: {
    transportKind: "remote_http",
  },
  transport: remoteTransport,
});

const { request, response } = await client.buildAndEvaluate({
  actionAttempt: demoPMFreakAocBillingReadinessActionAttempt(),
});

// response.evaluatedBy === "aoc"
// PMFreak does not execute the action here — it only received the decision.
```

No real secret is included above — `sharedSecretValue` must be supplied by
the caller from outside this module (an env var, a secret manager, etc.).

## Next possible PRs

- PMFreak AOC Decision Display / Inbox v1
- PMFreak AOC Governed Action Gate v1

# PMFreak AOC Decision Display / Inbox v1

Feature ID:

```
pmfreak.integration.aoc.decision_display_inbox.v1
```

Repo:

```
PMFreak
```

## Purpose

Display AOC governance decisions inside PMFreak as safe inbox/view models.

## Runtime direction

```
PMFreak consumes AOC Governance.
```

```
PMFreak builds a governance request.
PMFreak evaluates it through local_mock or remote_http.
PMFreak receives a governance response.
PMFreak normalizes the response into a decision inbox item.
PMFreak displays the decision, reasons, missing evidence, missing approvals, warnings and safe next step.
PMFreak does not execute the action in this PR.
```

This feature is a display/inbox layer built on top of the governance
request client and remote governance transport above. It does not build
its own governance requests and does not evaluate them itself — it only
normalizes an already-received `PMFreakAocGovernanceResponse` (optionally
paired with the `PMFreakAocGovernanceRequest` that produced it) into a
safe, display-only view model.

## Supported decisions

```
allow
deny
hold
require_evidence
require_pm_approval
require_customer_validation
require_billing_review
require_contract_review
require_security_review
require_executive_approval
```

## Example

```ts
import {
  createLocalMockPMFreakAocGovernanceTransport,
  createPMFreakAocDecisionInboxDetailViewModel,
  createPMFreakAocDecisionInboxItemFromGovernanceResponse,
  createPMFreakAocGovernanceRequestClientConfig,
  demoPMFreakAocBillingMissingEvidenceRequest,
} from "@/features/pmfreak-integrations/aoc-governance-request-client";

const request = demoPMFreakAocBillingMissingEvidenceRequest();
const transport = createLocalMockPMFreakAocGovernanceTransport();
const response = await transport.evaluateGovernanceRequest(request, createPMFreakAocGovernanceRequestClientConfig());

const item = createPMFreakAocDecisionInboxItemFromGovernanceResponse({ request, response, createdAtLabel: "2026-01-01T00:00:00.000Z" });

// item.decision === "require_evidence"
// item.decisionStatus === "needs_evidence"
// item.safeNextStep === "Attach or link the missing evidence references before attempting execution."
// PMFreak does not execute the action here — it only displays the decision.

const detail = createPMFreakAocDecisionInboxDetailViewModel(item);
// detail.sections includes Decision, Context, Evidence, Approvals, Reasons, Warnings, Errors, Safety
```

## Safety

- This feature is display-only.
- This feature does not execute PMFreak actions.
- This feature does not mutate PMFreak data.
- This feature does not write decisions back.
- This feature does not send communications.
- This feature does not create invoices.
- This feature does not enforce decisions.
- This feature does not certify invoice validity.
- This feature does not certify customer acceptance.
- This feature does not certify compliance.
- This feature does not provide legal advice.

As with the base client, every one of the above is also enforced
structurally: `PMFreakAocDecisionInboxConfig.allowActionExecution`,
`allowProductionMutations`, `allowDecisionWriteback`, `allowInvoiceCreation`,
`allowCommunications` and `allowEnforcement` are typed `false`, and
`createPMFreakAocDecisionInboxConfig` forces any attempt to set them `true`
back to `false` (with a warning). `PMFREAK_AOC_DECISION_INBOX_FORBIDDEN_OPERATIONS`
lists the operation names (`execute_action`, `mark_milestone_billing_ready`,
`create_invoice`, `writeback_decision`, `certify_compliance`, etc.) that
`assertPMFreakAocDecisionInboxDisplayOnlyOperation` rejects. Every inbox
item, inbox collection and detail view model also carries its own
`displayOnly: true` / `actionExecutionCapable: false` /
`mutationCapable: false` / `writebackCapable: false` /
`enforcementCapable: false` flags. Every output can be checked with
`assertNoPMFreakAocDecisionInboxOverclaim` / `evaluatePMFreakAocDecisionInboxClaimSafety`,
which reuse and extend the base module's prohibited-overclaim phrase scan.

## Module contents

| File | Responsibility |
| --- | --- |
| `pmfreak-aoc-decision-inbox-constants.ts` | Feature ID/name/version, capabilities, forbidden operations, safe labels, disclaimers |
| `pmfreak-aoc-decision-inbox-types.ts` | `PMFreakAocDecisionInboxItem` and its supporting status/category/severity unions |
| `pmfreak-aoc-decision-inbox-descriptor.ts` | `PMFreakAocDecisionInboxDescriptor` + factory |
| `pmfreak-aoc-decision-inbox-config.ts` | `PMFreakAocDecisionInboxConfig` + safe-by-default factory |
| `pmfreak-aoc-decision-inbox-item.ts` | Deterministic `buildPMFreakAocDecisionInboxItemId` |
| `pmfreak-aoc-decision-inbox-status.ts` | `mapPMFreakAocDecisionToInboxStatus` |
| `pmfreak-aoc-decision-inbox-category.ts` | `mapPMFreakAocDecisionToInboxCategory` |
| `pmfreak-aoc-decision-inbox-severity.ts` | `mapPMFreakAocDecisionToInboxSeverity` |
| `pmfreak-aoc-decision-inbox-next-step.ts` | `createPMFreakAocDecisionInboxSafeNextStep` |
| `pmfreak-aoc-decision-inbox-normalizer.ts` | `createPMFreakAocDecisionInboxItemFromGovernanceResponse` |
| `pmfreak-aoc-decision-inbox-filters.ts` | `filterPMFreakAocDecisionInboxItems` |
| `pmfreak-aoc-decision-inbox-sorting.ts` | `sortPMFreakAocDecisionInboxItems` |
| `pmfreak-aoc-decision-inbox-grouping.ts` | `groupPMFreakAocDecisionInboxItems` |
| `pmfreak-aoc-decision-inbox-summary.ts` | `summarizePMFreakAocDecisionInboxItems` |
| `pmfreak-aoc-decision-inbox-collection.ts` | `PMFreakAocDecisionInbox` + `createPMFreakAocDecisionInbox` |
| `pmfreak-aoc-decision-inbox-detail-view-model.ts` | `createPMFreakAocDecisionInboxDetailViewModel` |
| `pmfreak-aoc-decision-inbox-empty-state.ts` | `createPMFreakAocDecisionInboxEmptyState` |
| `pmfreak-aoc-decision-inbox-error-state.ts` | `createPMFreakAocDecisionInboxErrorState` |
| `pmfreak-aoc-decision-inbox-no-action-guard.ts` | Rejects any of `PMFREAK_AOC_DECISION_INBOX_FORBIDDEN_OPERATIONS` |
| `pmfreak-aoc-decision-inbox-redaction.ts` | `redactPMFreakAocDecisionInboxValue`, reusing the base module's redaction |
| `pmfreak-aoc-decision-inbox-claim-safety.ts` | Prohibited-overclaim scan extending the base module's phrase corpus |
| `pmfreak-aoc-decision-inbox-fixtures.ts` | Deterministic, fake-only demo inbox items and collections |

## UI integration

This PR implements pure, deterministic view models only — no React/UI
components. The repository has several existing dashboard/panel
conventions (`src/components/dashboard/action-center/`,
`src/components/command-center/`, `src/components/governance/`) but none
of them is a single, stable convention for a decision-inbox-style feature,
and mapping this feature onto one of them is a larger, UI-specific
decision better made in its own follow-up PR/review rather than folded
into this display-model PR.

A future UI layer can consume this module directly and does not need to
know anything about AOC:

```ts
const inbox = createPMFreakAocDecisionInbox({ items: myInboxItems });
// inbox.items -> render as a list (each item.decisionLabel/decisionSeverity/safeNextStep)
// inbox.summary -> render as counters/badges

const grouped = groupPMFreakAocDecisionInboxItems(inbox.items, "severity");
// grouped -> render as sections

const detail = createPMFreakAocDecisionInboxDetailViewModel(selectedItem);
// detail.sections -> render as a detail panel (Decision/Context/Evidence/Approvals/Reasons/Warnings/Errors/Safety)

if (inbox.items.length === 0) {
  // render createPMFreakAocDecisionInboxEmptyState()
}
```

Any such UI components must, per this module's rules: only consume these
view models, never call a transport directly, never execute actions,
never mutate state, never write decisions back, never create invoices,
and never send communications.

## Determinism

No `Date.now()`, `Math.random()`, `crypto.randomUUID()`, `fetch`, `axios`,
`XMLHttpRequest`, LLM SDK, OCR, or PDF-parsing call exists anywhere in this
feature's files (enforced by `tests/pmfreak-aoc-decision-inbox-determinism.test.ts`).
Inbox item IDs are derived deterministically from the response ID
(`pmfreak.aoc.inbox.<safe-response-id>.v1`). `createdAtLabel` is a caller-supplied
string label, not a wall-clock timestamp, and defaults to `"unspecified"`
when omitted.

## Next possible PR

```
PMFreak AOC Governed Action Gate v1
```

The governed action gate should only be implemented after this
display/inbox layer is stable and reviewed.

# PMFreak AOC Governed Action Gate v1

Feature ID:

```
pmfreak.integration.aoc.governed_action_gate.v1
```

Repo:

```
PMFreak
```

## Purpose

Evaluate whether a proposed PMFreak agent action passes the AOC
governance gate.

## Runtime direction

```
PMFreak consumes AOC Governance.
```

```
PMFreak agent proposes an action.
PMFreak builds or receives an AOC governance request.
PMFreak evaluates the request through local_mock or remote_http.
PMFreak receives a governance response.
PMFreak may normalize the response into a decision inbox item.
PMFreak Governed Action Gate evaluates the response or inbox item.
PMFreak returns a gate result.
PMFreak does not execute the action in this PR.
```

This is the first controlled gate layer on top of the governance request
client, remote transport and decision inbox above. It does not build its
own governance requests, does not evaluate them itself, and does not
create a new decision inbox — it only evaluates an already-received
`PMFreakAocGovernanceResponse` and/or an already-normalized
`PMFreakAocDecisionInboxItem` into a gate result. The one exception is
`evaluatePMFreakAocGovernedActionAttemptGate`, which uses the *existing*,
already-non-mutating `PMFreakAocGovernanceRequestClient` to build and
evaluate a request from an action attempt before evaluating the gate
result — it does not create a new client or transport.

## Gate verdicts

```
passed
blocked
held
needs_evidence
needs_approval
needs_review
error
```

## Decision → verdict mapping

```
allow                        → passed
deny                         → blocked
hold                         → held
require_evidence             → needs_evidence
require_pm_approval          → needs_approval
require_customer_validation  → needs_review
require_billing_review       → needs_review
require_contract_review      → needs_review
require_security_review      → needs_review
require_executive_approval   → needs_approval
```

`canProceed` is `true` only for `passed`. Every other verdict — including
`held`, which blocks nothing on the AOC side but is not yet safe to act
on — sets `canProceed` to `false`.

## Example

```
Billing Readiness Agent wants to mark a milestone as ready for billing.

AOC decision: require_evidence
Gate result: needs_evidence
Can proceed: false
Safe next step: Attach or link the missing evidence references before attempting this action.
```

```ts
import {
  createPMFreakAocGovernanceRequestClient,
  demoPMFreakAocBillingReadinessActionAttempt,
  evaluatePMFreakAocGovernedActionAttemptGate,
} from "@/features/pmfreak-integrations/aoc-governance-request-client";

const client = createPMFreakAocGovernanceRequestClient();

const { gateResult } = await evaluatePMFreakAocGovernedActionAttemptGate({
  actionAttempt: demoPMFreakAocBillingReadinessActionAttempt(),
  governanceClient: client,
});

// gateResult.verdict === "needs_evidence" (or "passed" if evidence/approvals are already satisfied)
// gateResult.canProceed === false
// PMFreak does not mark the milestone billing-ready here — it only returns a gate result.
```

## Safety

- This feature is gate-only.
- This feature does not execute PMFreak actions.
- This feature does not mutate PMFreak data.
- This feature does not write decisions back.
- This feature does not send communications.
- This feature does not create invoices.
- This feature does not certify invoice validity.
- This feature does not certify customer acceptance.
- This feature does not certify compliance.
- This feature does not provide legal advice.

### Interpreting a `passed` gate result

A `passed` gate result means the proposed action passed the AOC
governance gate for the provided request context. It does **not** mean:

- the action was executed
- the action is legally approved
- the project is compliant
- the invoice is valid
- the customer accepted delivery
- the contract was satisfied

As with the base client and decision inbox, every safety property above
is also enforced structurally:
`PMFreakAocGovernedActionGateConfig.allowActionExecution`,
`allowProductionMutations`, `allowDecisionWriteback`,
`allowInvoiceCreation`, `allowCommunications`, `allowLegalCertification`,
`allowComplianceCertification` and `treatAllowAsExecutable` are typed
`false`, and `createPMFreakAocGovernedActionGateConfig` forces any
attempt to set them `true` back to `false` (with a warning).
`PMFREAK_AOC_GOVERNED_ACTION_GATE_FORBIDDEN_OPERATIONS` (split into
execution- and mutation-scoped subsets for
`assertPMFreakAocGovernedActionGateDoesNotExecute` and
`assertPMFreakAocGovernedActionGateDoesNotMutate`) lists the operation
names (`execute_action`, `mark_milestone_billing_ready`,
`create_invoice`, `writeback_decision`, `certify_compliance`, etc.) those
guards reject. Every gate result also carries its own `gateOnly: true` /
`actionExecutionCapable: false` / `mutationCapable: false` /
`writebackCapable: false` flags. Every output can be checked with
`assertNoPMFreakAocGovernedActionGateOverclaim` /
`evaluatePMFreakAocGovernedActionGateClaimSafety`, which extend the
decision inbox module's prohibited-overclaim phrase scan with a few
gate-specific phrases (`automatically executed`, `invoice approved`,
`customer accepted`).

## Module contents

| File | Responsibility |
| --- | --- |
| `pmfreak-aoc-governed-action-gate-constants.ts` | Feature ID/name/version, capabilities, forbidden operations, safe labels, disclaimers |
| `pmfreak-aoc-governed-action-gate-types.ts` | `PMFreakAocGovernedActionGateVerdict` / `Severity` / `ReasonCode` / `TraceStep` / `Source` |
| `pmfreak-aoc-governed-action-gate-descriptor.ts` | `PMFreakAocGovernedActionGateDescriptor` + factory |
| `pmfreak-aoc-governed-action-gate-config.ts` | `PMFreakAocGovernedActionGateConfig` + safe-by-default factory |
| `pmfreak-aoc-governed-action-gate-input.ts` | `PMFreakAocGovernedActionGateInput` + deterministic `createPMFreakAocGovernedActionGateInput` |
| `pmfreak-aoc-governed-action-gate-result.ts` | `PMFreakAocGovernedActionGateResult` + deterministic ID builder |
| `pmfreak-aoc-governed-action-gate-verdict.ts` | `mapPMFreakAocDecisionToGateVerdict`, `mapPMFreakAocGateVerdictToSeverity` |
| `pmfreak-aoc-governed-action-gate-policy.ts` | `createPMFreakAocGateFlagsFromVerdict` |
| `pmfreak-aoc-governed-action-gate-reason.ts` | `createPMFreakAocGateReasonCodes` |
| `pmfreak-aoc-governed-action-gate-next-step.ts` | `createPMFreakAocGateSafeNextStep` |
| `pmfreak-aoc-governed-action-gate-trace.ts` | `createPMFreakAocGovernedActionGateTrace` |
| `pmfreak-aoc-governed-action-gate-from-response.ts` | `evaluatePMFreakAocGovernedActionGateFromGovernanceResponse` |
| `pmfreak-aoc-governed-action-gate-from-inbox-item.ts` | `evaluatePMFreakAocGovernedActionGateFromDecisionInboxItem` |
| `pmfreak-aoc-governed-action-gate-evaluator.ts` | `evaluatePMFreakAocGovernedActionGate` (main dispatcher) + `evaluatePMFreakAocGovernedActionAttemptGate` (reuses the existing governance client) |
| `pmfreak-aoc-governed-action-gate-batch.ts` | `batchEvaluatePMFreakAocGovernedActionGateResults` |
| `pmfreak-aoc-governed-action-gate-summary.ts` | `summarizePMFreakAocGovernedActionGateResults` |
| `pmfreak-aoc-governed-action-gate-detail-view-model.ts` | `createPMFreakAocGovernedActionGateDetailViewModel` |
| `pmfreak-aoc-governed-action-gate-no-execution-guard.ts` | Rejects execution-scoped forbidden operations |
| `pmfreak-aoc-governed-action-gate-no-mutation-guard.ts` | Rejects mutation-scoped forbidden operations |
| `pmfreak-aoc-governed-action-gate-redaction.ts` | `redactPMFreakAocGovernedActionGateValue`, reusing the base module's redaction |
| `pmfreak-aoc-governed-action-gate-claim-safety.ts` | Prohibited-overclaim scan extending the decision inbox module's phrase corpus |
| `pmfreak-aoc-governed-action-gate-fixtures.ts` | Deterministic, fake-only demo gate results/inputs/batches |

## UI integration

This PR implements pure, deterministic models and a view-model factory
only — no React/UI components, for the same reason as the decision
inbox layer: no single, stable dashboard/panel convention exists yet for
a gate-result-style feature. A future UI layer can consume this module
directly:

```ts
const detail = createPMFreakAocGovernedActionGateDetailViewModel(gateResult);
// detail.gateBadge -> render as a status chip (verdict/severity)
// detail.sections -> render as a detail panel (Gate Result/AOC Decision/Action Context/Evidence/Approvals/Reasons/Trace/Safety)
// detail.canProceed -> gate a "Continue" affordance in a future execution-adapter PR, never here
```

## Determinism

No `Date.now()`, `Math.random()`, `crypto.randomUUID()`, `fetch`,
`axios`, `XMLHttpRequest`, LLM SDK, OCR, or PDF-parsing call exists
anywhere in this feature's files (enforced by
`tests/pmfreak-aoc-governed-action-gate-determinism.test.ts`). Gate
input/result IDs are derived deterministically from the first available
identifier on the input (governance response ID, request ID, inbox item
ID, or action attempt ID):
`pmfreak.aoc.gate.input.<safe-id>.v1` / `pmfreak.aoc.gate.result.<safe-id>.v1`.

## Next possible PRs

```
PMFreak AOC Gate Result UI v1
PMFreak Human Approval Handoff v1
PMFreak AOC Governed Action Execution Adapter v1
```

A governed execution adapter should only be implemented after this gate
is stable, reviewed and explicitly approved.

# PMFreak AOC Gate Result UI v1

Feature ID:

```
pmfreak.integration.aoc.gate_result_ui.v1
```

Repo:

```
PMFreak
```

## Purpose

Display PMFreak AOC governed action gate results safely.

## Runtime direction

```
PMFreak consumes AOC Governance.
```

```
PMFreak receives a governed action gate result.
PMFreak creates a UI-safe display model.
PMFreak may render a banner, card, detail panel, blocker panel, requirement list, trace and safety disclaimer.
PMFreak does not execute the action in this PR.
```

This is a presentation layer on top of the governed action gate above. It
does not build governance requests, does not evaluate them, does not
create a new decision inbox and does not create a new gate — it only
turns an already-computed `PMFreakAocGovernedActionGateResult` into
UI-safe view models.

## Supported verdicts

```
passed
blocked
held
needs_evidence
needs_approval
needs_review
error
```

## Interpreting a `passed` gate result

`passed` means the proposed action passed the AOC governance gate for
the provided request context. It does **not** mean:

- the action was executed
- the action is legally approved
- the project is compliance-certified
- the invoice is valid
- the customer accepted delivery

## Example

```ts
import {
  createPMFreakAocGateResultBannerViewModel,
  createPMFreakAocGateResultCardViewModel,
  createPMFreakAocGateResultDetailPanelViewModel,
  createPMFreakAocGateResultUIDisplayModel,
  demoPMFreakAocGovernedActionGateNeedsEvidenceResult,
} from "@/features/pmfreak-integrations/aoc-governance-request-client";

const result = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();

const display = createPMFreakAocGateResultUIDisplayModel({ result });
// display.badge.label === "Needs Evidence"
// display.canProceed === false
// display.safeNextStep === "Attach or link the missing evidence references before attempting this action."

const banner = createPMFreakAocGateResultBannerViewModel({ result });
const card = createPMFreakAocGateResultCardViewModel({ result });
const detail = createPMFreakAocGateResultDetailPanelViewModel({ result });
// detail.sections includes Gate Result, AOC Decision, Action Context, Requirements, Reasons, Trace, Warnings, Errors, Safety

// PMFreak does not execute the action here — it only displays the gate result.
```

## Safety

- This feature is presentation-only.
- This feature does not execute PMFreak actions.
- This feature does not mutate PMFreak data.
- This feature does not write decisions back.
- This feature does not send communications.
- This feature does not create invoices.
- This feature does not certify invoice validity.
- This feature does not certify customer acceptance.
- This feature does not certify compliance.
- This feature does not provide legal advice.

As with the governed action gate, every safety property above is also
enforced structurally: `PMFreakAocGateResultUIConfig.allowActionExecution`,
`allowProductionMutations`, `allowDecisionWriteback`, `allowInvoiceCreation`,
`allowCommunications`, `allowLegalCertification`,
`allowComplianceCertification`, `showExecutionButtons`,
`showMutationButtons`, `showInvoiceButtons` and `showCommunicationButtons`
are typed `false`, and `createPMFreakAocGateResultUIConfig` forces any
attempt to set them `true` back to `false` (with a warning).
`PMFREAK_AOC_GATE_RESULT_UI_FORBIDDEN_OPERATIONS` (split into action- and
mutation-scoped subsets for `assertPMFreakAocGateResultUIDoesNotAct` and
`assertPMFreakAocGateResultUIDoesNotMutate`) lists the operation names
(`execute_action`, `mark_milestone_billing_ready`, `create_invoice`,
`writeback_decision`, `certify_compliance`, etc.) those guards reject.
Every view model also carries its own `presentationOnly: true` flag (and
the display model additionally carries `actionExecutionCapable: false` /
`mutationCapable: false` / `writebackCapable: false` /
`invoiceCreationCapable: false` / `communicationCapable: false`). Every
output can be checked with `assertNoPMFreakAocGateResultUIOverclaim` /
`evaluatePMFreakAocGateResultUIClaimSafety`, which extend the governed
action gate module's prohibited-overclaim phrase scan with UI-specific
phrases (`click to execute`, `execute now`, `approve invoice`,
`legally approved`, `compliance passed`, etc.).

## Action hints

Action hints are informational only. Every hint returned by
`createPMFreakAocGateResultUIActionHints` is `enabled: false`,
`executesAction: false`, `mutatesState: false`, `createsInvoice: false`
and `sendsCommunication: false` — they describe what a user could do
next, they never do it.

## Module contents

| File | Responsibility |
| --- | --- |
| `pmfreak-aoc-gate-result-ui-constants.ts` | Feature ID/name/version, capabilities, forbidden operations (full + action/mutation subsets), safe labels, disclaimers |
| `pmfreak-aoc-gate-result-ui-types.ts` | `PMFreakAocGateResultUITone` / `IconHint` |
| `pmfreak-aoc-gate-result-ui-descriptor.ts` | `PMFreakAocGateResultUIDescriptor` + factory |
| `pmfreak-aoc-gate-result-ui-config.ts` | `PMFreakAocGateResultUIConfig` + safe-by-default factory |
| `pmfreak-aoc-gate-result-ui-labels.ts` | `mapPMFreakAocGateVerdictToUILabel`, `mapPMFreakAocGateVerdictToUITone` |
| `pmfreak-aoc-gate-result-ui-badge.ts` | `PMFreakAocGateResultUIBadge` + `createPMFreakAocGateResultUIBadge` |
| `pmfreak-aoc-gate-result-ui-display-model.ts` | `PMFreakAocGateResultUIDisplayModel` + `createPMFreakAocGateResultUIDisplayModel` |
| `pmfreak-aoc-gate-result-ui-banner-view-model.ts` | `createPMFreakAocGateResultBannerViewModel` |
| `pmfreak-aoc-gate-result-ui-card-view-model.ts` | `createPMFreakAocGateResultCardViewModel` |
| `pmfreak-aoc-gate-result-ui-detail-panel-view-model.ts` | `createPMFreakAocGateResultDetailPanelViewModel` |
| `pmfreak-aoc-gate-result-ui-blocker-view-model.ts` | `createPMFreakAocGateResultBlockerViewModel` |
| `pmfreak-aoc-gate-result-ui-requirement-list.ts` | `createPMFreakAocGateRequirementListViewModel` |
| `pmfreak-aoc-gate-result-ui-trace-view-model.ts` | `createPMFreakAocGateTraceViewModel` |
| `pmfreak-aoc-gate-result-ui-safety-disclaimer.ts` | `createPMFreakAocGateSafetyDisclaimerViewModel` |
| `pmfreak-aoc-gate-result-ui-action-hint.ts` | `createPMFreakAocGateResultUIActionHints` |
| `pmfreak-aoc-gate-result-ui-empty-state.ts` | `createPMFreakAocGateResultUIEmptyState` |
| `pmfreak-aoc-gate-result-ui-error-state.ts` | `createPMFreakAocGateResultUIErrorState` |
| `pmfreak-aoc-gate-result-ui-no-action-guard.ts` | Rejects action-scoped forbidden operations |
| `pmfreak-aoc-gate-result-ui-no-mutation-guard.ts` | Rejects mutation-scoped forbidden operations |
| `pmfreak-aoc-gate-result-ui-redaction.ts` | `redactPMFreakAocGateResultUIValue`, reusing the governed action gate module's redaction |
| `pmfreak-aoc-gate-result-ui-claim-safety.ts` | Prohibited-overclaim scan extending the governed action gate module's phrase corpus |
| `pmfreak-aoc-gate-result-ui-fixtures.ts` | Deterministic, fake-only demo display models and view models |

## UI integration

This PR implements pure, deterministic view models only — no React/UI
components. As with the decision inbox and governed action gate layers
before it, the repository has several existing dashboard/panel
conventions (`src/components/dashboard/action-center/`,
`src/components/command-center/`, `src/components/governance/`) but none
of them is a single, stable convention for a gate-result-style feature,
so mapping this feature onto one of them remains a larger, UI-specific
decision for its own follow-up PR/review.

A future UI layer can consume this module directly and does not need to
know anything about AOC:

```ts
const display = createPMFreakAocGateResultUIDisplayModel({ result: gateResult });
// display.badge -> render as a status chip (label/tone/iconHint)
// display.requirementList.items -> render as a checklist (status: required | missing)
// display.trace.steps -> render as a timeline (no timestamps)
// display.safetyDisclaimer.messages -> render as fine print
// display.actionHints -> render as informational callouts, never as clickable buttons

if (!gateResult) {
  // render createPMFreakAocGateResultUIEmptyState()
}
```

Any such UI components must, per this module's rules: only consume these
view models, never call the gate/transport/client directly, never
execute actions, never mutate state, never write decisions back, never
create invoices, never send communications, and never render an enabled
execution/mutation/invoice/communication button.

## Determinism

No `Date.now()`, `Math.random()`, `crypto.randomUUID()`, `fetch`,
`axios`, `XMLHttpRequest`, LLM SDK, OCR, or PDF-parsing call exists
anywhere in this feature's files (enforced by
`tests/pmfreak-aoc-gate-result-ui-determinism.test.ts`). The display
model ID is derived deterministically from the gate result ID:
`pmfreak.aoc.gate.ui.display.<safe-gate-result-id>.v1`.

## Next possible PRs

```
PMFreak Human Approval Handoff v1
PMFreak Evidence Requirement Handoff v1
PMFreak AOC Gate Result Command Center Panel v1
```

A governed execution adapter should only be implemented after the gate
result UI, human approval handoff, and evidence requirement handoff are
stable, reviewed and explicitly approved.

# PMFreak Evidence Requirement Handoff v1

Feature ID:

```
pmfreak.integration.aoc.evidence_requirement_handoff.v1
```

Repo:

```
PMFreak
```

## Purpose

Turn an AOC governance response, decision inbox item, governed action
gate result, or gate result UI display model that surfaces required
evidence, missing evidence, or required approvals into a safe,
deterministic, non-mutating "Evidence Requirement Handoff" package that a
human PM can review.

## Runtime direction

```
PMFreak consumes AOC Governance.
```

```
PMFreak receives a governance response, decision inbox item, gate result, or gate result UI display model.
PMFreak normalizes the evidence/approval context from that input.
PMFreak extracts evidence requirement items (required, missing, by type and priority).
PMFreak builds a handoff package: checklist, review packet, safe summary, safe next step.
A human PM reviews the handoff package.
PMFreak does not attach evidence, create tasks, execute actions, or mutate data in this PR.
```

This is a handoff-only layer built on top of the governance request
client, decision inbox, governed action gate and gate result UI above. It
does not build governance requests, does not evaluate them, does not
create a new decision inbox, does not create a new gate, and does not
create a new gate result UI — it only turns an already-received/already-
computed upstream model into a safe, review-ready evidence requirement
handoff package.

## Supported sources

```
governance_response
decision_inbox_item
gate_result
gate_result_ui_display_model
```

The `gate_result` source is the primary path: a
`PMFreakAocGovernedActionGateResult` carries the richest, most reliable
context (project/action/agent context, gate trace, gate-level evidence/
approval arrays) of the four. `gate_result_ui_display_model` legitimately
carries the least context (no project/action/client IDs) since it is a
presentation-only view model — that is expected and safe.

## Supported requirement types

```
customer_acceptance
billing_review
contract_review
security_review
pm_approval
executive_approval
delivery_confirmation
technical_validation
change_approval
risk_review
unknown
```

## Example

```ts
import {
  createPMFreakAocEvidenceRequirementHandoffDetailViewModel,
  createPMFreakAocEvidenceRequirementHandoffFromGateResult,
  demoPMFreakAocGovernedActionGateNeedsEvidenceResult,
} from "@/features/pmfreak-integrations/aoc-governance-request-client";

const gateResult = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();

const handoff = createPMFreakAocEvidenceRequirementHandoffFromGateResult({ gateResult });

// handoff.requirementItems[0].requirementType === "customer_acceptance"
// handoff.requirementItems[0].status === "missing"
// handoff.safeNextStep === "Collect or link customer acceptance evidence before attempting this action again."
// handoff.checklist.items[0].done === false
// handoff.reviewPacket.reviewQuestions includes "Which evidence references are missing?"

const detail = createPMFreakAocEvidenceRequirementHandoffDetailViewModel(handoff);
// detail.sections includes Handoff Summary, Source Context, Action Context, Required Evidence, Missing Evidence, Approval References, Review Packet, Safety

// PMFreak does not attach evidence here — it only hands off the requirement to a human PM.
```

## Safety

- This feature is handoff-only.
- This feature does not attach evidence.
- This feature does not upload files.
- This feature does not create tasks.
- This feature does not execute PMFreak actions.
- This feature does not mutate PMFreak data.
- This feature does not write decisions back.
- This feature does not send communications.
- This feature does not create invoices.
- This feature does not certify compliance.
- This feature does not certify customer acceptance.
- This feature does not certify invoice validity.
- This feature does not provide legal advice.

Every one of the above is also enforced structurally:
`PMFreakAocEvidenceRequirementHandoffConfig.allowEvidenceAttachment`,
`allowFileUpload`, `allowTaskCreation`, `allowActionExecution`,
`allowProductionMutations`, `allowDecisionWriteback`,
`allowInvoiceCreation`, `allowCommunications`, `allowLegalCertification`,
`allowComplianceCertification` and `allowCustomerAcceptanceCertification`
are typed `false`, and `createPMFreakAocEvidenceRequirementHandoffConfig`
forces any attempt to set them `true` back to `false` (with a warning).
`PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_FORBIDDEN_OPERATIONS` (split
into attachment-, task-, mutation- and communication-scoped subsets for
`assertPMFreakAocEvidenceRequirementHandoffDoesNotAttachEvidence`,
`assertPMFreakAocEvidenceRequirementHandoffDoesNotCreateTasks`,
`assertPMFreakAocEvidenceRequirementHandoffDoesNotMutate` and
`assertPMFreakAocEvidenceRequirementHandoffDoesNotCommunicate`) lists the
operation names (`attach_evidence`, `create_task`,
`mark_milestone_billing_ready`, `send_client_communication`,
`create_invoice`, `certify_compliance`, etc.) those guards reject. Every
handoff package, checklist, review packet and detail view model also
carries its own `handoffOnly: true` /
`evidenceAttachmentCapable: false` / `uploadCapable: false` /
`taskCreationCapable: false` / `mutationCapable: false` /
`communicationCapable: false` flags. Every checklist item is structurally
`done: false` / `actionable: false` — this checklist never marks
anything complete and never exposes an actionable control. Every output
can be checked with `assertNoPMFreakAocEvidenceRequirementHandoffOverclaim` /
`evaluatePMFreakAocEvidenceRequirementHandoffClaimSafety`, which extend
the governed action gate module's prohibited-overclaim phrase scan with
handoff-specific phrases (`evidence validated`, `evidence approved`,
`evidence attached`, `task created`, `email sent`, `customer notified`).

## Module contents

| File | Responsibility |
| --- | --- |
| `pmfreak-aoc-evidence-requirement-handoff-constants.ts` | Feature ID/name/version, capabilities, forbidden operations (full + attachment/task/mutation/communication subsets), safe labels, disclaimers |
| `pmfreak-aoc-evidence-requirement-handoff-descriptor.ts` | `PMFreakAocEvidenceRequirementHandoffDescriptor` + factory |
| `pmfreak-aoc-evidence-requirement-handoff-config.ts` | `PMFreakAocEvidenceRequirementHandoffConfig` + safe-by-default factory |
| `pmfreak-aoc-evidence-requirement-handoff-source.ts` | `PMFreakAocEvidenceRequirementSource` |
| `pmfreak-aoc-evidence-requirement-handoff-priority.ts` | `PMFreakAocEvidenceRequirementPriority` + `mapPMFreakAocEvidenceRequirementPriority` |
| `pmfreak-aoc-evidence-requirement-handoff-status.ts` | `PMFreakAocEvidenceRequirementStatus` |
| `pmfreak-aoc-evidence-requirement-handoff-item.ts` | `PMFreakAocEvidenceRequirementType` / `PMFreakAocEvidenceRequirementItem` + deterministic item ID builder |
| `pmfreak-aoc-evidence-requirement-handoff-extractor.ts` | `extractPMFreakAocEvidenceRequirementReferences` + `inferPMFreakAocEvidenceRequirementType` |
| `pmfreak-aoc-evidence-requirement-handoff-context.ts` | `normalizePMFreakAocEvidenceRequirementHandoffContext` |
| `pmfreak-aoc-evidence-requirement-handoff-next-step.ts` | `createPMFreakAocEvidenceRequirementHandoffSafeNextStep` |
| `pmfreak-aoc-evidence-requirement-handoff-package.ts` | `PMFreakAocEvidenceRequirementHandoffPackage` + deterministic handoff ID builder |
| `pmfreak-aoc-evidence-requirement-handoff-from-response.ts` | `createPMFreakAocEvidenceRequirementHandoffFromGovernanceResponse` |
| `pmfreak-aoc-evidence-requirement-handoff-from-inbox-item.ts` | `createPMFreakAocEvidenceRequirementHandoffFromDecisionInboxItem` |
| `pmfreak-aoc-evidence-requirement-handoff-from-gate-result.ts` | `createPMFreakAocEvidenceRequirementHandoffFromGateResult` (primary builder) |
| `pmfreak-aoc-evidence-requirement-handoff-from-ui-display.ts` | `createPMFreakAocEvidenceRequirementHandoffFromGateResultUIDisplayModel` |
| `pmfreak-aoc-evidence-requirement-handoff-checklist-view-model.ts` | `createPMFreakAocEvidenceRequirementChecklistViewModel` |
| `pmfreak-aoc-evidence-requirement-handoff-review-packet.ts` | `createPMFreakAocEvidenceRequirementReviewPacket` |
| `pmfreak-aoc-evidence-requirement-handoff-detail-view-model.ts` | `createPMFreakAocEvidenceRequirementHandoffDetailViewModel` |
| `pmfreak-aoc-evidence-requirement-handoff-summary.ts` | `summarizePMFreakAocEvidenceRequirementHandoffs` |
| `pmfreak-aoc-evidence-requirement-handoff-batch.ts` | `batchCreatePMFreakAocEvidenceRequirementHandoffs` |
| `pmfreak-aoc-evidence-requirement-handoff-empty-state.ts` | `createPMFreakAocEvidenceRequirementHandoffEmptyState` |
| `pmfreak-aoc-evidence-requirement-handoff-error-state.ts` | `createPMFreakAocEvidenceRequirementHandoffErrorState` |
| `pmfreak-aoc-evidence-requirement-handoff-no-attachment-guard.ts` | Rejects attachment-scoped forbidden operations |
| `pmfreak-aoc-evidence-requirement-handoff-no-task-guard.ts` | Rejects task-scoped forbidden operations |
| `pmfreak-aoc-evidence-requirement-handoff-no-mutation-guard.ts` | Rejects mutation-scoped forbidden operations |
| `pmfreak-aoc-evidence-requirement-handoff-no-communication-guard.ts` | Rejects communication-scoped forbidden operations |
| `pmfreak-aoc-evidence-requirement-handoff-redaction.ts` | `redactPMFreakAocEvidenceRequirementHandoffValue`, reusing the base module's redaction |
| `pmfreak-aoc-evidence-requirement-handoff-claim-safety.ts` | Prohibited-overclaim scan extending the governed action gate module's phrase corpus |
| `pmfreak-aoc-evidence-requirement-handoff-fixtures.ts` | Deterministic, fake-only demo handoff packages/items/checklists/review packets |

## Determinism

No `Date.now()`, `Math.random()`, `crypto.randomUUID()`, `fetch`,
`axios`, `XMLHttpRequest`, LLM SDK, OCR, or PDF-parsing call exists
anywhere in this feature's files (enforced by
`tests/pmfreak-aoc-evidence-requirement-handoff-determinism.test.ts`).
Handoff/review-packet/requirement-item IDs are derived deterministically
from the first available identifier on the normalized context (gate
result ID, response ID, inbox item ID, or display model ID):
`pmfreak.aoc.evidence.handoff.<safe-id>.v1` /
`pmfreak.aoc.evidence.review-packet.<safe-id>.v1` /
`pmfreak.aoc.evidence.requirement.<safe-reference-id>.v1`.

## Next possible PRs

```
PMFreak Human Approval Handoff v1
PMFreak Evidence Requirement Command Center Panel v1
PMFreak Evidence Attachment Workflow v1
```

An evidence attachment workflow should only be implemented after this
handoff layer is stable, reviewed, and explicitly approved.
