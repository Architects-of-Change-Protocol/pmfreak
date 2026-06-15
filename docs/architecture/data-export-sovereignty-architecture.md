# PMFreak Data Export Sovereignty Architecture

## Purpose

This document defines the PMFreak customer data export architecture for customer ownership, portability, and auditability. The design is optimized to improve PMFreak's AOC Assurance Sovereignty Index posture by making customer data independently extractable, verifiable, complete, and usable outside PMFreak.

## Sovereignty principles

1. **Customer ownership by default** — every customer-created, customer-uploaded, customer-governed, and customer-derived record is exportable.
2. **Billing-independent access** — export rights survive delinquency, downgrade, cancellation, and contract termination, subject only to identity verification, abuse controls, legal hold, and tenant authorization.
3. **No proprietary lock-in** — canonical exports use JSON, CSV, Markdown, PDF, and ZIP with documented schemas and stable identifiers.
4. **Tenant isolation first** — exports are generated under the same workspace/PMO/project authorization boundaries enforced by Supabase RLS and PMFreak governance runtime checks.
5. **Evidence-grade integrity** — every package includes a manifest, schema version, row counts, hashes, authorization receipt, and audit trail.
6. **Asynchronous by design** — all non-trivial exports run as jobs with resumable chunking, progress events, retry semantics, and expiring signed downloads.
7. **Machine and human portability** — JSON/CSV support re-import and analytics; Markdown/PDF support board, regulator, and executive review.

## Exportable asset inventory

| Asset | Exported content | Primary formats | Notes |
| --- | --- | --- | --- |
| Workspace | Settings, metadata, plan state, feature flags, locale, retention policy, export policy | JSON, Markdown, PDF | Billing fields are included only as export-right metadata, not payment instrument data. |
| PMO | PMO profile, operating model, portfolio settings, governance cadence, templates | JSON, CSV, Markdown, PDF | Includes relationships to programs and projects. |
| Projects | Charters, status, lifecycle, milestones, dependencies, budget/resource summaries | JSON, CSV, Markdown, PDF | Includes project-level custom fields and governance state. |
| Programs | Program hierarchy, benefits, objectives, linked projects, dependency map | JSON, CSV, Markdown, PDF | Preserves cross-project relationship IDs. |
| Tasks | Work items, assignments, status history, dependencies, comments, due dates | JSON, CSV | Optional Markdown task digest. |
| Risks | Risk register, scoring, mitigation plans, owners, review history, AI flags | JSON, CSV, Markdown, PDF | Includes pre/post mitigation scores. |
| Issues | Issue log, severity, remediation, owners, linked decisions and evidence | JSON, CSV, Markdown, PDF | Includes escalation history. |
| Stakeholders | Directory, roles, influence/interest mapping, communication preferences, interaction log | JSON, CSV, Markdown | PII minimization controls apply. |
| Meetings | Agendas, attendees, transcripts/notes, action items, decisions, summaries | JSON, Markdown, PDF | Raw transcript optional by export scope. |
| Decisions | Decision records, rationale, options, approvers, reversals, linked evidence | JSON, CSV, Markdown, PDF | Preserves decision lineage. |
| Evidence | File metadata, binary files, attestations, links, checksums, chain-of-custody | JSON, ZIP files, Markdown index | Includes storage path mappings without exposing internal service credentials. |
| Audit Logs | Security events, data changes, exports, governance actions, admin actions | JSON, CSV | Append-only export; redaction policy is explicit. |
| Signals | AI/system/user signals, health indicators, risk signals, ingestion provenance | JSON, CSV | Includes scoring metadata and originating source. |
| Organizational Memory | Memory entries, embeddings metadata, source references, classifications, retention tags | JSON, Markdown | Embedding vectors are exportable when owned by customer and permitted by policy. |
| AI Conversations | Prompts, responses, tool calls, cited records, model metadata, redactions | JSON, Markdown, PDF | Provider secrets and internal chain-of-thought are never exported. |
| Governance Records | Policies, approvals, waivers, runtime decisions, capability claims, verification receipts | JSON, CSV, Markdown, PDF | Supports AOC assurance review. |
| Users | Workspace users, invitations, identities, status, profile metadata | JSON, CSV | Password hashes, auth secrets, MFA seeds, and provider tokens are excluded. |
| Roles | Role definitions, assignments, scope boundaries | JSON, CSV | Includes inherited and effective roles. |
| Permissions | Permission catalog, grants, denies, policy bindings, evaluation snapshots | JSON, CSV | Exports policy definitions and customer-visible evaluations. |
| Custom Fields | Definitions, options, validations, entity bindings, values | JSON, CSV | Values also appear in their parent entity exports. |

## Formats

### JSON

JSON is the canonical machine-readable format. Every JSON file uses UTF-8, ISO 8601 timestamps, stable PMFreak IDs, schema version metadata, and explicit relationship references.

### CSV

CSV is analytics-friendly and tabular. Each CSV includes a header row, UTF-8 BOM compatibility, RFC 4180 escaping, and `id`, `workspace_id`, `created_at`, `updated_at`, and `deleted_at` when applicable.

### Markdown

Markdown is the portable human-readable knowledge format. It is used for executive narratives, meeting notes, decisions, memory digests, governance records, and entity summaries.

### PDF

PDF is generated for board/regulatory review packets. PDFs are derived artifacts and include a footer with export ID, generation timestamp, page number, and package hash.

### ZIP package

ZIP is the canonical delivery container. It includes JSON, CSV, Markdown, PDF, binary evidence, schemas, and integrity metadata.

## Package structure

```text
workspace-export.zip
├── manifest.json
├── README.md
├── checksums.sha256
├── schemas/
│   ├── export-manifest.schema.json
│   ├── workspace.schema.json
│   ├── pmo.schema.json
│   ├── project.schema.json
│   ├── program.schema.json
│   ├── task.schema.json
│   ├── risk.schema.json
│   ├── issue.schema.json
│   ├── stakeholder.schema.json
│   ├── meeting.schema.json
│   ├── decision.schema.json
│   ├── evidence.schema.json
│   ├── audit-log.schema.json
│   ├── signal.schema.json
│   ├── memory.schema.json
│   ├── ai-conversation.schema.json
│   ├── governance-record.schema.json
│   ├── user.schema.json
│   ├── role.schema.json
│   ├── permission.schema.json
│   └── custom-field.schema.json
├── workspace/
│   ├── workspace.json
│   ├── settings.json
│   └── summary.md
├── pmo/
│   ├── pmos.json
│   ├── pmos.csv
│   └── pmo-summary.md
├── programs/
│   ├── programs.json
│   ├── programs.csv
│   └── summaries/
├── projects/
│   ├── projects.json
│   ├── projects.csv
│   └── summaries/
├── tasks/
│   ├── tasks.json
│   └── tasks.csv
├── risks/
│   ├── risks.json
│   ├── risks.csv
│   └── risk-register.pdf
├── issues/
│   ├── issues.json
│   ├── issues.csv
│   └── issue-log.pdf
├── stakeholders/
│   ├── stakeholders.json
│   ├── stakeholders.csv
│   └── stakeholder-map.md
├── meetings/
│   ├── meetings.json
│   ├── meeting-actions.csv
│   └── notes/
├── decisions/
│   ├── decisions.json
│   ├── decisions.csv
│   └── decision-log.pdf
├── evidence/
│   ├── evidence-index.json
│   ├── evidence-index.csv
│   └── files/
├── memory/
│   ├── organizational-memory.json
│   ├── memory-index.csv
│   └── memory-digest.md
├── ai-conversations/
│   ├── conversations.json
│   ├── conversations.csv
│   └── transcripts/
├── governance/
│   ├── governance-records.json
│   ├── governance-records.csv
│   ├── policies.json
│   ├── approvals.csv
│   └── governance-pack.pdf
├── audit/
│   ├── audit-logs.json
│   ├── audit-logs.csv
│   └── export-audit-receipt.json
├── identity/
│   ├── users.json
│   ├── users.csv
│   ├── roles.json
│   ├── roles.csv
│   ├── permissions.json
│   └── permissions.csv
└── customization/
    ├── custom-fields.json
    └── custom-field-values.csv
```

## Manifest

`manifest.json` is the package root of trust.

```json
{
  "$schema": "https://schemas.pmfreak.com/export/export-manifest.schema.json",
  "export_id": "exp_01J...",
  "workspace_id": "ws_01J...",
  "schema_version": "2026-06-15",
  "requested_by_user_id": "usr_01J...",
  "requested_at": "2026-06-15T12:00:00Z",
  "generated_at": "2026-06-15T12:04:12Z",
  "scope": {
    "level": "workspace",
    "entity_types": ["projects", "risks", "evidence", "audit_logs"],
    "date_range": { "from": "2020-01-01T00:00:00Z", "to": "2026-06-15T23:59:59Z" },
    "include_deleted": true,
    "include_evidence_files": true,
    "include_ai_conversations": true,
    "redaction_profile": "standard"
  },
  "formats": ["json", "csv", "markdown", "pdf", "zip"],
  "counts": { "projects": 42, "risks": 311, "evidence_files": 1280 },
  "hash_algorithm": "SHA-256",
  "package_sha256": "...",
  "files": [
    { "path": "projects/projects.json", "bytes": 123456, "sha256": "...", "records": 42 }
  ],
  "retention": {
    "download_expires_at": "2026-06-22T12:04:12Z",
    "job_metadata_deletes_at": "2026-09-13T12:04:12Z"
  }
}
```

## JSON schemas for major entities

All entity schemas share the following envelope fields unless explicitly marked optional: `id`, `workspace_id`, `created_at`, `updated_at`, `deleted_at`, `created_by_user_id`, `updated_by_user_id`, `source`, `custom_fields`, and `relationships`.

### Workspace

```json
{
  "type": "object",
  "required": ["id", "name", "created_at", "export_policy"],
  "properties": {
    "id": { "type": "string" },
    "name": { "type": "string" },
    "slug": { "type": "string" },
    "settings": { "type": "object" },
    "data_region": { "type": "string" },
    "retention_policy_id": { "type": "string" },
    "export_policy": { "type": "object" },
    "billing_export_rights": { "type": "object" },
    "created_at": { "type": "string", "format": "date-time" },
    "updated_at": { "type": "string", "format": "date-time" }
  }
}
```

### PMO

```json
{
  "type": "object",
  "required": ["id", "workspace_id", "name"],
  "properties": {
    "id": { "type": "string" },
    "workspace_id": { "type": "string" },
    "name": { "type": "string" },
    "operating_model": { "type": "string" },
    "governance_cadence": { "type": "string" },
    "portfolio_settings": { "type": "object" },
    "template_ids": { "type": "array", "items": { "type": "string" } },
    "relationships": { "type": "object" },
    "custom_fields": { "type": "object" }
  }
}
```

### Project and Program

```json
{
  "type": "object",
  "required": ["id", "workspace_id", "name", "status"],
  "properties": {
    "id": { "type": "string" },
    "workspace_id": { "type": "string" },
    "pmo_id": { "type": "string" },
    "program_id": { "type": ["string", "null"] },
    "name": { "type": "string" },
    "description": { "type": "string" },
    "status": { "type": "string" },
    "health": { "type": "string" },
    "start_date": { "type": ["string", "null"], "format": "date" },
    "target_date": { "type": ["string", "null"], "format": "date" },
    "owners": { "type": "array", "items": { "type": "string" } },
    "milestones": { "type": "array", "items": { "type": "object" } },
    "dependencies": { "type": "array", "items": { "type": "object" } },
    "budget": { "type": "object" },
    "governance_state": { "type": "object" },
    "custom_fields": { "type": "object" }
  }
}
```

Programs use the same schema with `program_id` removed and `project_ids`, `benefits`, and `objectives` added.

### Task

```json
{
  "type": "object",
  "required": ["id", "workspace_id", "title", "status"],
  "properties": {
    "id": { "type": "string" },
    "workspace_id": { "type": "string" },
    "project_id": { "type": "string" },
    "title": { "type": "string" },
    "description": { "type": "string" },
    "status": { "type": "string" },
    "priority": { "type": "string" },
    "assignee_user_ids": { "type": "array", "items": { "type": "string" } },
    "due_at": { "type": ["string", "null"], "format": "date-time" },
    "dependencies": { "type": "array", "items": { "type": "string" } },
    "status_history": { "type": "array", "items": { "type": "object" } },
    "comments": { "type": "array", "items": { "type": "object" } },
    "custom_fields": { "type": "object" }
  }
}
```

### Risk and Issue

```json
{
  "type": "object",
  "required": ["id", "workspace_id", "title", "status", "owner_user_id"],
  "properties": {
    "id": { "type": "string" },
    "workspace_id": { "type": "string" },
    "project_id": { "type": ["string", "null"] },
    "program_id": { "type": ["string", "null"] },
    "title": { "type": "string" },
    "description": { "type": "string" },
    "status": { "type": "string" },
    "severity": { "type": "string" },
    "probability": { "type": "number" },
    "impact": { "type": "number" },
    "score": { "type": "number" },
    "owner_user_id": { "type": "string" },
    "mitigation_or_remediation": { "type": "string" },
    "review_history": { "type": "array", "items": { "type": "object" } },
    "linked_evidence_ids": { "type": "array", "items": { "type": "string" } },
    "ai_flags": { "type": "array", "items": { "type": "object" } }
  }
}
```

Issues use the same schema and add `root_cause`, `resolution`, and `escalations`.

### Stakeholder

```json
{
  "type": "object",
  "required": ["id", "workspace_id", "display_name"],
  "properties": {
    "id": { "type": "string" },
    "workspace_id": { "type": "string" },
    "display_name": { "type": "string" },
    "organization": { "type": "string" },
    "role": { "type": "string" },
    "email": { "type": ["string", "null"] },
    "influence": { "type": "string" },
    "interest": { "type": "string" },
    "communication_preferences": { "type": "object" },
    "interaction_log": { "type": "array", "items": { "type": "object" } },
    "redaction_state": { "type": "object" }
  }
}
```

### Meeting

```json
{
  "type": "object",
  "required": ["id", "workspace_id", "title", "scheduled_at"],
  "properties": {
    "id": { "type": "string" },
    "workspace_id": { "type": "string" },
    "project_id": { "type": ["string", "null"] },
    "title": { "type": "string" },
    "scheduled_at": { "type": "string", "format": "date-time" },
    "attendee_user_ids": { "type": "array", "items": { "type": "string" } },
    "external_attendees": { "type": "array", "items": { "type": "object" } },
    "agenda": { "type": "array", "items": { "type": "object" } },
    "notes_markdown": { "type": "string" },
    "transcript": { "type": ["string", "null"] },
    "action_item_ids": { "type": "array", "items": { "type": "string" } },
    "decision_ids": { "type": "array", "items": { "type": "string" } }
  }
}
```

### Decision

```json
{
  "type": "object",
  "required": ["id", "workspace_id", "title", "decided_at"],
  "properties": {
    "id": { "type": "string" },
    "workspace_id": { "type": "string" },
    "title": { "type": "string" },
    "status": { "type": "string" },
    "context": { "type": "string" },
    "options_considered": { "type": "array", "items": { "type": "object" } },
    "decision": { "type": "string" },
    "rationale": { "type": "string" },
    "approver_user_ids": { "type": "array", "items": { "type": "string" } },
    "decided_at": { "type": "string", "format": "date-time" },
    "linked_evidence_ids": { "type": "array", "items": { "type": "string" } },
    "supersedes_decision_id": { "type": ["string", "null"] }
  }
}
```

### Evidence

```json
{
  "type": "object",
  "required": ["id", "workspace_id", "name", "evidence_type", "sha256"],
  "properties": {
    "id": { "type": "string" },
    "workspace_id": { "type": "string" },
    "name": { "type": "string" },
    "evidence_type": { "type": "string" },
    "mime_type": { "type": "string" },
    "bytes": { "type": "integer" },
    "sha256": { "type": "string" },
    "export_path": { "type": "string" },
    "source_uri": { "type": ["string", "null"] },
    "attestations": { "type": "array", "items": { "type": "object" } },
    "chain_of_custody": { "type": "array", "items": { "type": "object" } },
    "linked_entity_refs": { "type": "array", "items": { "type": "object" } }
  }
}
```

### Audit log

```json
{
  "type": "object",
  "required": ["id", "workspace_id", "event_type", "occurred_at", "actor"],
  "properties": {
    "id": { "type": "string" },
    "workspace_id": { "type": "string" },
    "event_type": { "type": "string" },
    "actor": { "type": "object" },
    "target": { "type": "object" },
    "occurred_at": { "type": "string", "format": "date-time" },
    "ip_address": { "type": ["string", "null"] },
    "user_agent": { "type": ["string", "null"] },
    "request_id": { "type": "string" },
    "before": { "type": ["object", "null"] },
    "after": { "type": ["object", "null"] },
    "redactions": { "type": "array", "items": { "type": "object" } }
  }
}
```

### Signal

```json
{
  "type": "object",
  "required": ["id", "workspace_id", "signal_type", "observed_at"],
  "properties": {
    "id": { "type": "string" },
    "workspace_id": { "type": "string" },
    "signal_type": { "type": "string" },
    "source": { "type": "object" },
    "subject_ref": { "type": "object" },
    "score": { "type": "number" },
    "confidence": { "type": "number" },
    "payload": { "type": "object" },
    "observed_at": { "type": "string", "format": "date-time" }
  }
}
```

### Organizational memory

```json
{
  "type": "object",
  "required": ["id", "workspace_id", "content", "classification"],
  "properties": {
    "id": { "type": "string" },
    "workspace_id": { "type": "string" },
    "content": { "type": "string" },
    "summary": { "type": "string" },
    "classification": { "type": "string" },
    "source_refs": { "type": "array", "items": { "type": "object" } },
    "embedding": { "type": ["array", "null"], "items": { "type": "number" } },
    "embedding_model": { "type": ["string", "null"] },
    "retention_tags": { "type": "array", "items": { "type": "string" } }
  }
}
```

### AI conversation

```json
{
  "type": "object",
  "required": ["id", "workspace_id", "messages", "created_at"],
  "properties": {
    "id": { "type": "string" },
    "workspace_id": { "type": "string" },
    "project_id": { "type": ["string", "null"] },
    "title": { "type": "string" },
    "messages": { "type": "array", "items": { "type": "object" } },
    "model_metadata": { "type": "object" },
    "tool_calls": { "type": "array", "items": { "type": "object" } },
    "cited_entity_refs": { "type": "array", "items": { "type": "object" } },
    "redactions": { "type": "array", "items": { "type": "object" } },
    "created_at": { "type": "string", "format": "date-time" }
  }
}
```

### Governance record

```json
{
  "type": "object",
  "required": ["id", "workspace_id", "record_type", "status"],
  "properties": {
    "id": { "type": "string" },
    "workspace_id": { "type": "string" },
    "record_type": { "type": "string" },
    "policy_id": { "type": ["string", "null"] },
    "status": { "type": "string" },
    "subject_ref": { "type": "object" },
    "request": { "type": "object" },
    "decision": { "type": "object" },
    "capability_claim": { "type": ["object", "null"] },
    "verification_receipt": { "type": ["object", "null"] },
    "approver_user_ids": { "type": "array", "items": { "type": "string" } },
    "occurred_at": { "type": "string", "format": "date-time" }
  }
}
```

### Users, roles, permissions, custom fields

```json
{
  "user": {
    "required": ["id", "workspace_id", "display_name", "status"],
    "properties": {
      "id": { "type": "string" },
      "workspace_id": { "type": "string" },
      "display_name": { "type": "string" },
      "email": { "type": "string" },
      "status": { "type": "string" },
      "identity_provider": { "type": "string" },
      "role_ids": { "type": "array", "items": { "type": "string" } }
    }
  },
  "role": {
    "required": ["id", "workspace_id", "name"],
    "properties": {
      "id": { "type": "string" },
      "workspace_id": { "type": "string" },
      "name": { "type": "string" },
      "scope": { "type": "string" },
      "permission_ids": { "type": "array", "items": { "type": "string" } }
    }
  },
  "permission": {
    "required": ["id", "workspace_id", "action", "effect"],
    "properties": {
      "id": { "type": "string" },
      "workspace_id": { "type": "string" },
      "action": { "type": "string" },
      "resource_type": { "type": "string" },
      "effect": { "type": "string", "enum": ["allow", "deny"] },
      "conditions": { "type": "object" }
    }
  },
  "custom_field": {
    "required": ["id", "workspace_id", "key", "entity_types", "field_type"],
    "properties": {
      "id": { "type": "string" },
      "workspace_id": { "type": "string" },
      "key": { "type": "string" },
      "label": { "type": "string" },
      "entity_types": { "type": "array", "items": { "type": "string" } },
      "field_type": { "type": "string" },
      "options": { "type": "array", "items": { "type": "object" } },
      "validation": { "type": "object" }
    }
  }
}
```

## Database impact

### New tables

| Table | Purpose |
| --- | --- |
| `export_jobs` | Tracks request, scope, status, progress, requester, governance decision, expiry, and failure reason. |
| `export_job_chunks` | Tracks chunked entity extraction with cursor, record counts, byte counts, retry count, and hash. |
| `export_artifacts` | Tracks generated ZIP/PDF/JSONL/CSV artifacts, storage location, checksum, size, and download expiry. |
| `export_access_grants` | Stores short-lived signed download grants and enterprise automation credentials. |
| `export_schema_versions` | Stores immutable schema metadata and compatibility notes. |
| `export_redaction_events` | Records redactions applied to PII, secrets, provider tokens, and legal-hold restricted fields. |

### RLS and authorization

- `export_jobs` is tenant-scoped by `workspace_id`.
- Requesters can read their own jobs; workspace owners/export administrators can read all workspace jobs.
- Only privileged export workers can write artifact storage paths or complete jobs.
- Service-role worker access must be constrained to export procedures and audited.
- Enterprise automation uses scoped service identities, never shared workspace owner credentials.

### Storage impact

- Export artifacts are stored in a private Supabase Storage bucket or compatible object store path: `exports/{workspace_id}/{export_id}/workspace-export.zip`.
- Download URLs are signed, short-lived, single-use where possible, and revocable.
- Evidence binaries are streamed into ZIP packages without persisting unencrypted temp files.
- Large exports can produce multi-part packages: `workspace-export.part-0001.zip`, `workspace-export.part-0002.zip`, plus a top-level manifest.

## API specification

### Create export job

`POST /api/v1/workspaces/{workspace_id}/exports`

Request:

```json
{
  "scope": {
    "level": "workspace",
    "entity_types": ["projects", "risks", "evidence", "audit_logs"],
    "project_ids": [],
    "date_range": { "from": "2020-01-01T00:00:00Z", "to": "2026-06-15T23:59:59Z" },
    "include_deleted": true,
    "include_evidence_files": true,
    "include_ai_conversations": true,
    "include_embeddings": false
  },
  "formats": ["json", "csv", "markdown", "pdf", "zip"],
  "redaction_profile": "standard",
  "delivery": { "type": "download" }
}
```

Response `202 Accepted`:

```json
{
  "export_id": "exp_01J...",
  "status": "queued",
  "status_url": "/api/v1/workspaces/ws_01J/exports/exp_01J",
  "estimated_completion_seconds": 180
}
```

### Get export job

`GET /api/v1/workspaces/{workspace_id}/exports/{export_id}`

Response:

```json
{
  "export_id": "exp_01J...",
  "status": "running",
  "progress": { "percent": 42, "current_entity_type": "evidence", "records_exported": 12000 },
  "created_at": "2026-06-15T12:00:00Z",
  "expires_at": null,
  "download_url": null,
  "failure": null
}
```

### List export jobs

`GET /api/v1/workspaces/{workspace_id}/exports?status=completed&limit=50`

### Cancel export job

`POST /api/v1/workspaces/{workspace_id}/exports/{export_id}/cancel`

### Create download grant

`POST /api/v1/workspaces/{workspace_id}/exports/{export_id}/download-grants`

Creates a short-lived signed URL after re-checking the caller's current authorization.

### Validate export integrity

`POST /api/v1/exports/validate`

Accepts manifest metadata and checksums, returning whether the package matches PMFreak's recorded export artifact hashes.

### Enterprise automation endpoints

- `POST /api/v1/workspaces/{workspace_id}/export-schedules`
- `GET /api/v1/workspaces/{workspace_id}/export-schedules/{schedule_id}`
- `PATCH /api/v1/workspaces/{workspace_id}/export-schedules/{schedule_id}`
- `DELETE /api/v1/workspaces/{workspace_id}/export-schedules/{schedule_id}`
- `POST /api/v1/workspaces/{workspace_id}/exports/{export_id}/deliveries`

Supported delivery targets: signed download, customer S3, customer GCS, customer Azure Blob, SFTP, webhook notification, and customer-managed archive API.

## Asynchronous export workflow

1. **Request validation** — validate scope, formats, date range, legal-hold constraints, export rights, and rate limits.
2. **Governance authorization** — evaluate requester permissions and workspace export policy. High-risk exports can require step-up authentication or approval.
3. **Job creation** — insert `export_jobs` with immutable request payload and status `queued`.
4. **Snapshot selection** — compute repeatable-read cursors, `as_of` timestamp, and entity query plan.
5. **Chunk extraction** — export each entity type in pages ordered by stable ID and timestamp. Persist chunk progress.
6. **File generation** — write JSONL/JSON arrays, CSV, Markdown, PDFs, schema files, evidence files, and checksums.
7. **Package assembly** — stream files into ZIP, compute SHA-256 hashes, and update manifest.
8. **Integrity verification** — re-open package, verify checksums, record row counts, and create export audit receipt.
9. **Delivery** — create a signed download grant or push to customer-managed destination.
10. **Notification** — notify requester and configured export webhooks.
11. **Retention enforcement** — expire signed URLs, delete artifacts, and retain minimal job/audit metadata according to policy.

## Large-workspace export strategy

- Use cursor-based pagination, not offset pagination.
- Use JSONL as internal staging for very large JSON files, then optionally wrap into JSON arrays for smaller packages.
- Stream evidence files directly from object storage into ZIP output.
- Split exports by entity type, project, date partition, or size threshold.
- Generate multi-part ZIP packages when a package exceeds configured limits.
- Support resumable chunk retries with idempotency keys.
- Emit progress events through polling and optional server-sent events.
- Cap per-job concurrency by workspace to protect production workloads.
- Use read replicas or low-priority background workers for enterprise full exports.
- For very large audit logs, export partitioned CSV/JSON by month: `audit/2026/06/audit-logs.csv`.

## Export security controls

| Control | Requirement |
| --- | --- |
| Authorization | Export requires `workspace.export` permission plus scope-specific data permissions. |
| RLS | Extraction queries must preserve workspace tenant boundary and use audited privileged procedures only where RLS cannot satisfy package assembly. |
| Step-up auth | Required for full workspace exports, AI conversations, audit logs, identity data, and evidence binaries. |
| Approval workflow | Enterprise tenants can require dual control for full exports or sensitive classes. |
| Redaction | Provider secrets, access tokens, password hashes, MFA seeds, internal system prompts marked non-customer, and private infrastructure metadata are excluded. |
| PII controls | Export profiles: `none`, `standard`, `strict`, and `legal_hold`. Strict masks emails/IP addresses unless explicitly permitted. |
| Audit | Every request, approval, chunk start/finish, artifact creation, download grant, download, cancellation, and failure is logged. |
| Encryption | Artifacts encrypted at rest; TLS in transit; optional customer-managed encryption key for enterprise delivery. |
| Download expiry | Default 7 days, configurable down to 1 hour and up to contractual maximum. |
| Rate limits | Per-user, per-workspace, and per-entity limits prevent exfiltration abuse. |
| Malware/file safety | Evidence files are exported as stored, with metadata and scan status; PMFreak does not modify customer evidence. |
| Integrity | Manifest, file hashes, package hash, and validation endpoint provide tamper evidence. |

## Retention policies

| Item | Default retention | Enterprise configurable | Notes |
| --- | --- | --- | --- |
| Completed export artifact | 7 days | 1 hour to 30 days | Legal agreements can require shorter retention. |
| Failed partial artifacts | 24 hours | 1 hour to 7 days | Deleted after troubleshooting window. |
| Export job metadata | 90 days | 30 days to 7 years | Metadata excludes full exported content. |
| Export audit logs | 7 years | Contract/legal policy | Immutable and separately exportable. |
| Signed download grant | 1 hour | 5 minutes to 24 hours | Revoked on role removal or workspace suspension for abuse. |
| Enterprise schedule config | Until deleted | Until deleted | Exported as governance/config metadata. |

## Billing-independent export rights

PMFreak must implement export access as a data ownership right, not a paid feature gate.

- Cancelled or delinquent workspaces retain owner/admin export access for at least 30 days after termination, unless a longer contractual period applies.
- Read-only export mode remains available even when write access, AI features, automations, or premium UI features are disabled.
- Payment method data is never required to initiate a final export.
- Billing suspension can restrict export frequency and automation, but cannot block a reasonable full export.
- Enterprise offboarding exports are supported through customer success or contractual admin channels when SSO is unavailable.
- Legal hold, sanctions, abuse, or verified security incident response may pause delivery, but the pause reason must be logged and reviewable.

## Enterprise export automation

Enterprise tenants can configure scheduled and event-driven exports.

### Scheduling

- Daily, weekly, monthly, quarterly, and custom cron schedules.
- Scope templates: full workspace, audit-only, evidence-only, project subset, governance pack, executive packet.
- Retention-aware incremental exports using `since_export_id` or `since_timestamp`.

### Delivery

- Customer-owned S3/GCS/Azure Blob with customer-managed keys.
- SFTP with SSH key authentication.
- Webhook with signed notification and pull-based download.
- Private link or VPC egress option for regulated customers.

### Automation security

- Dedicated export automation identity.
- Scoped credential vaulting and rotation reminders.
- Delivery target verification before first use.
- Per-schedule approval policy.
- Delivery receipt stored in `export_artifacts` and `governance_records`.

## UI flows

### Workspace settings export center

1. User navigates to **Workspace Settings → Data & Sovereignty → Exports**.
2. UI displays export rights, last exports, schedules, retention settings, and policy warnings.
3. User selects export scope, formats, date range, evidence inclusion, AI conversation inclusion, embeddings inclusion, and redaction profile.
4. UI previews estimated size, sensitive categories, required approvals, and retention window.
5. User confirms with step-up authentication.
6. UI shows queued/running/completed state, progress, and audit receipt.
7. When complete, user downloads ZIP or copies validation metadata.

### Project-level export

1. User opens project actions and selects **Export Project**.
2. UI defaults scope to the selected project and linked risks, issues, decisions, evidence, meetings, tasks, stakeholders, and governance records.
3. User chooses JSON/CSV/Markdown/PDF or ZIP bundle.
4. Job is created and visible in the export center.

### Offboarding mode

1. Suspended/cancelled workspace owners see a read-only **Download your data** screen.
2. Only export-related routes are enabled.
3. The screen explains remaining access window, available scopes, and support escalation path.

### Enterprise schedule flow

1. Admin opens **Export Automation**.
2. Admin creates a schedule, selects delivery target, tests credentials, and selects approval policy.
3. PMFreak sends a verification file or signed webhook challenge.
4. Schedule remains disabled until verification succeeds.
5. Every scheduled run appears as a normal export job with delivery receipts.

## Implementation phases

### Phase 1 — Export foundation

- Create export schema version registry.
- Add `export_jobs`, `export_job_chunks`, `export_artifacts`, `export_access_grants`, and `export_redaction_events`.
- Implement workspace/project export job creation and status APIs.
- Generate JSON and CSV for workspace, projects, programs, tasks, risks, issues, decisions, users, roles, permissions, and custom fields.
- Add manifest and checksum generation.

### Phase 2 — Evidence, audit, and governance packs

- Add evidence index and binary streaming.
- Add audit log export.
- Add governance records, approvals, verification receipts, policies, and capability claims.
- Add Markdown summaries and PDF packs.
- Add step-up authentication and approval hooks.

### Phase 3 — AI and organizational memory portability

- Add AI conversation exports with redaction policy.
- Add organizational memory exports and optional embedding vector export.
- Add signal exports with provenance.
- Add schema compatibility tests for customer re-import tooling.

### Phase 4 — Large workspace and enterprise automation

- Add chunked resumable workers, read-replica routing, multi-part ZIPs, and monthly audit partitions.
- Add scheduled exports and customer-managed delivery targets.
- Add webhook notifications, validation endpoint, and delivery receipts.

### Phase 5 — Sovereignty hardening

- Add offboarding export mode.
- Add customer-managed key support for artifacts and delivery.
- Add formal export SLA metrics, dashboards, and AOC assurance evidence pack.
- Add import dry-run tooling to validate portability outside PMFreak.

## Acceptance criteria

1. A workspace owner can request a full workspace export and receive a ZIP containing manifest, schemas, JSON, CSV, Markdown/PDF summaries, audit logs, governance records, and evidence binaries.
2. Every required exportable asset has a documented schema and appears in the package when in scope.
3. Export jobs are asynchronous, resumable, observable, cancellable, and audited.
4. Package checksums validate locally and through the validation API.
5. Suspended or cancelled customers can still complete a reasonable full export without payment reactivation.
6. RLS and governance checks prevent exporting data outside the caller's workspace and authorized scope.
7. Sensitive non-customer secrets are excluded and all redactions are disclosed in metadata.
8. Enterprise admins can schedule recurring exports to customer-owned storage with delivery receipts.
9. Large workspaces export without request timeouts and without loading the full dataset into application memory.
10. Export artifacts expire according to policy while immutable audit records remain available.
