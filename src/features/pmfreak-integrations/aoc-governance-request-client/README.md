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
