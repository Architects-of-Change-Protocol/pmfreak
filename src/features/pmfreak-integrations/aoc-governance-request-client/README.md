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

## Determinism

No `Date.now()`, `Math.random()`, `crypto.randomUUID()`, `fetch`, `axios`,
`XMLHttpRequest`, LLM SDK, OCR, or PDF-parsing call exists anywhere in this
module (enforced by `tests/pmfreak-aoc-determinism.test.ts`). Request and
response IDs are derived deterministically from the action attempt ID /
request ID (`pmfreak.aoc.request.<safe-action-attempt-id>.v1` /
`pmfreak.aoc.response.<safe-request-id>.v1`).

## Next possible PRs

- PMFreak AOC Decision Display / Inbox v1
- PMFreak AOC Governed Action Gate v1
- PMFreak AOC Remote Governance Transport v1
