# Platform Events Invariants

## Rationale

Raw data belongs to the customer. Events record what happened. History is never rewritten. Corrections are represented as new events.

Platform events are the evidence layer for PMFreak activity, recommendations, governance actions, and future organizational-memory sovereignty capabilities. They must preserve history without turning the event log into raw-content storage.

## Invariants

1. **Immutable history** — `platform_events` are immutable after insert.
2. **Append-only event store** — updates and deletes are rejected by database triggers, including service-role attempts. Corrections must be emitted as compensating events.
3. **Raw sensitive content prohibited** — events may contain metadata, identifiers, hashes, summaries, and action facts, but must not contain raw email bodies, contract text, document text, passwords, secrets, tokens, or API keys.
4. **Recursive sensitive-key detection** — payload validation recursively inspects objects, arrays, and arbitrarily deep structures. Events are rejected rather than silently redacted, and the validation error includes the offending path.
5. **Workspace ownership integrity** — when `project_id` is present, the database verifies that `project.workspace_id` equals `platform_events.workspace_id` through a composite foreign key and insert trigger.
6. **Actor consistency** — user events require `actor_id`; system and AI-agent events may omit it when the actor is represented by `actor_type` and event metadata.

## Database enforcement

The `20260616000000_platform_events_invariants.sql` migration adds:

- `prevent_platform_event_mutation()`.
- `platform_events_prevent_update` trigger.
- `platform_events_prevent_delete` trigger.
- Recursive forbidden-key detection through `find_forbidden_platform_event_payload_key()`.
- Insert-time payload validation through `validate_platform_event_payload()`.
- Workspace/project ownership validation through `platform_events_project_workspace_fkey` and `validate_platform_event_project_workspace()`.

The append-only exception message is:

```text
platform_events are append-only. Emit a compensating event instead of mutating history.
```

The recursive payload validation error includes the full path, for example:

```text
Forbidden payload key detected: data.credentials.api_key
```

## Operational guidance

- Use `INSERT` for new facts.
- Use compensating events for corrections, reversals, redactions, supersession, and governance decisions.
- Store raw customer-owned content in customer-governed content stores, not in event payloads.
- Reference raw content by durable identifiers, content hashes, evidence IDs, or exportable customer-owned records.
