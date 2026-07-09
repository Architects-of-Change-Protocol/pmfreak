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
