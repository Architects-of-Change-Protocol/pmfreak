# Customer-Owned Organizational Memory Framework

## Purpose

This document defines PMFreak's implementation-ready Customer-Owned Organizational Memory framework. Organizational memory includes project activity, decisions, risks, lessons learned, stakeholder interactions, AI-assisted recommendations, and governance events. The operating principle is that customer memory is a customer asset: PMFreak may process, secure, index, and present it only under customer-controlled authority.

## Architecture

### Ownership model

1. **Customer is the data controller and beneficial owner** of all memory records generated from customer activity, customer content, customer-configured AI workflows, imported systems, stakeholder interactions, and governance actions.
2. **PMFreak is the processor/custodian** that stores, computes, indexes, and transfers memory only for authorized product functions, support operations, legal obligations, and customer-approved subprocessors.
3. **Derived memory remains customer-owned** when it is generated from customer data, including summaries, lessons, classifications, risk patterns, embeddings, vector metadata, AI recommendations, relationship graphs, and governance scores.
4. **PMFreak-owned operational telemetry is excluded** unless it is merged into customer-governed memory. Excluded data includes infrastructure logs, abuse-prevention signals, billing fraud indicators, internal reliability metrics, provider secrets, and proprietary model routing metadata.
5. **Customer sovereignty survives account lifecycle events**. Export, retention, deletion, freeze, and recovery rights are not revoked by cancellation, downgrade, billing dispute, or termination, except when limited by identity verification, legal hold, abuse controls, or customer-authorized policy.
6. **Tenant boundary is the ownership boundary**. Every memory record is scoped to `tenant_id`, normally further scoped by `workspace_id`, `pmo_id`, `program_id`, `project_id`, and optional source entity references.
7. **Customer-appointed roles control memory**. PMFreak staff cannot view or mutate customer memory without just-in-time customer authorization, break-glass logging, or a legally required hold process.

### Core services

| Service | Responsibility | Implementation notes |
| --- | --- | --- |
| Memory Ingestion Service | Converts activity, decisions, risks, lessons, stakeholder events, AI recommendations, and governance events into canonical memory records. | Validates tenant scope, source provenance, sensitivity, and retention policy before writing. |
| Memory Classification Service | Applies category, sensitivity, visibility, retention, AI-origin, and sovereignty tags. | Produces explainable classifications and routes uncertain classifications to review. |
| Memory Governance Service | Enforces approval, freeze, delete, archive, export, and legal hold workflows. | Uses policy-as-data and records all decisions in audit logs. |
| Memory Access Service | Evaluates visibility, permissions, row-level security, relationship access, and purpose limitation. | Deny-by-default with explicit grants and inherited scopes. |
| Memory Versioning Service | Stores immutable versions and diffs for every customer-visible mutation. | Latest record is a projection; history is append-only. |
| Memory Export Service | Builds verifiable customer-owned packages. | Includes schema, manifest, checksums, audit receipt, and optional embeddings. |
| Memory Recovery Service | Restores deleted or archived memory within customer policy windows. | Supports point-in-time recovery and selective restore. |
| Memory Sovereignty Scoring Service | Measures whether a tenant can prove ownership, portability, governance, and reversibility. | Produces scorecards for admins and enterprise auditors. |

## Memory lifecycle

| Stage | Trigger | Required controls | Resulting state |
| --- | --- | --- | --- |
| Creation | User activity, connector event, AI recommendation, governance event, import, bulk upload, or manual entry. | Tenant scope, provenance, creator identity, category, sensitivity, visibility, retention policy, and duplicate check. | `draft`, `active`, or `pending_review`. |
| Update | User edit, workflow update, connector sync, AI enrichment, review correction, or policy reclassification. | Permission check, optimistic concurrency, reason code, version creation, material-change detection. | New version with status unchanged or moved to `pending_review`. |
| Review | Scheduled review, low confidence classification, AI-generated high-impact content, sensitive content, or customer policy. | Reviewer assignment, separation of duties, evidence inspection, approval/rejection notes. | `active`, `rejected`, `needs_revision`, or `frozen`. |
| Archive | End of project, retention transition, manual archive, or low-relevance policy. | Archive authority, export eligibility confirmation, search demotion, retention clock update. | `archived` but exportable and recoverable. |
| Freeze | Legal hold, investigation, board lock, regulatory request, incident response, or customer admin action. | Freeze reason, authority, scope, expiration/review date, override policy. | Immutable `frozen`; no edits/deletes except authorized hold metadata. |
| Delete | User/admin request, retention expiry, privacy erasure, connector removal, or workspace termination. | Deletion eligibility, dependency analysis, hold check, approval workflow, tombstone creation. | `soft_deleted`, then `purged` after recovery window. |
| Export | Customer request, scheduled backup, termination package, regulator package, or API export. | Export permission, scope validation, redaction policy, manifest, checksum, audit receipt. | Export job and downloadable package. |

## Memory categories

| Category | Examples | Default review | Default retention |
| --- | --- | --- | --- |
| Project Activity | Status changes, milestones, task transitions, blockers, delivery signals. | Automated unless high impact. | Project life + 7 years. |
| Decision Memory | Decision records, options, rationale, approvers, reversals. | Required for strategic/financial decisions. | 7 years or customer policy. |
| Risk and Issue Memory | Risks, mitigations, issues, escalations, controls, residual risk. | Required for severe/critical records. | 7 years or regulatory period. |
| Lesson Learned | Retrospectives, root causes, playbook updates, delivery insights. | Optional peer review. | 5 years; extend if reused. |
| Stakeholder Interaction | Meeting notes, commitments, sentiment, approvals, objections. | Required when sensitive or external. | 3 years unless contractual. |
| AI Recommendation | AI summaries, predictions, remediation recommendations, confidence metadata. | Required for high-impact, automated, or externally visible use. | Same as linked source; minimum 1 year. |
| Governance Event | Approvals, waivers, policy changes, board actions, compliance reviews. | Required. | 7 years or legal policy. |
| Evidence and Artifact Memory | Files, links, attestations, chain-of-custody references. | Required when used for governance. | Same as linked record. |
| Relationship Memory | Dependency graphs, stakeholder mappings, entity relationships. | Automated unless sensitive. | Same as longest linked record. |
| Imported Memory | Connector/imported records from Jira, Slack, GitHub, CSV, APIs. | Based on source trust and category. | Source policy mapped to customer policy. |

## Visibility controls

Visibility is evaluated before permissions and never expands beyond tenant scope.

| Visibility | Meaning | Typical use |
| --- | --- | --- |
| `private_to_creator` | Creator and explicitly granted reviewers only. | Draft notes, early lessons, sensitive observations. |
| `project` | Members with project access. | Project activity, risks, decisions. |
| `program` | Program-level authorized users and child project authorized users when policy allows. | Cross-project dependencies and lessons. |
| `pmo` | PMO governance users. | Portfolio-level risks, standards, governance. |
| `workspace` | All workspace users with memory read permission. | General lessons and reusable playbooks. |
| `executive` | Executive/admin roles only. | Board decisions, strategic risks, mergers. |
| `external_stakeholder` | Named external contacts through portal or export. | Customer/vendor commitments and meeting summaries. |
| `restricted` | Explicit allow-list only; no inheritance. | Legal, HR, regulated, or incident memory. |
| `sealed` | No normal UI access; only legal hold/export/delete governance workflows. | Litigation hold or investigation evidence. |

Controls include sensitivity labels, field-level redaction, purpose-based access, watermarking for restricted exports, and policy-driven suppression from AI retrieval.

## Permissions

| Permission | Capability |
| --- | --- |
| `memory:create` | Create memory in authorized scope. |
| `memory:read` | Read records allowed by visibility and scope. |
| `memory:update` | Edit mutable fields. |
| `memory:classify` | Change category, sensitivity, visibility, and retention tags. |
| `memory:review` | Review and approve submitted records. |
| `memory:freeze` | Place or release freeze/legal hold. |
| `memory:archive` | Archive active records. |
| `memory:delete.request` | Request deletion. |
| `memory:delete.approve` | Approve deletion. |
| `memory:delete.purge` | Execute irreversible purge after recovery window. |
| `memory:export.request` | Request export jobs. |
| `memory:export.approve` | Approve sensitive or large exports. |
| `memory:export.download` | Download completed export packages. |
| `memory:recover` | Restore soft-deleted or archived records. |
| `memory:audit.read` | View audit and version history. |
| `memory:policy.manage` | Manage retention, classification, review, and sovereignty policies. |

### Role defaults

| Role | Default permissions |
| --- | --- |
| Workspace Owner | All permissions except support-only break-glass review. |
| Memory Sovereignty Admin | Policy, export, delete, recovery, audit, freeze, and scorecard permissions. |
| PMO Governance Lead | Review, classify, archive, export request, audit read within PMO scope. |
| Project Manager | Create/read/update/archive and request export/delete within project scope. |
| Contributor | Create/read/update own records and read visible project/workspace memory. |
| Executive Viewer | Read executive/workspace memory, approve high-impact governance exports. |
| External Stakeholder | Read explicitly shared memory and download approved external packages. |
| PMFreak Support | No access by default; time-boxed break-glass read only with customer authorization. |

## Editing rules

1. Immutable fields after creation: `tenant_id`, original `source_system`, original `source_entity_id`, `created_by`, `created_at`, and first provenance receipt.
2. Customer-visible content edits always create a new version.
3. Material edits require a reason code: `correction`, `context_update`, `classification_change`, `policy_update`, `source_sync`, `ai_enrichment`, `redaction`, or `review_remediation`.
4. AI-generated edits are stored as proposed changes until approved when record impact is high, sensitivity is restricted, or customer policy requires review.
5. Frozen or sealed records cannot be content-edited; only hold metadata and access-review notes may change.
6. Connector-synced records preserve both source truth and customer annotations. Source updates append versions instead of overwriting customer governance history.
7. Redactions create redacted projections but preserve original content when retention and legal policy allow; redacted fields remain exportable only to authorized roles.
8. Conflicting edits use optimistic locking with `version_number` and `etag`; stale clients must rebase.

## Approval workflow

1. **Submission**: creation/update sets `review_status = pending` when required by policy.
2. **Routing**: Memory Governance Service selects reviewers by category, sensitivity, scope, monetary/risk impact, AI-origin, and separation-of-duties rules.
3. **Review**: reviewer can approve, reject, request revision, reclassify, freeze, redact, or escalate.
4. **Escalation**: severe risk, strategic decision, legal/HR content, high-impact AI recommendation, or export of restricted content escalates to Memory Sovereignty Admin or Executive Viewer.
5. **Decision recording**: every decision writes an approval record, audit event, and version annotation.
6. **SLA**: default review SLA is 3 business days; critical risk/governance events are 1 business day; overdue reviews notify scope owners.
7. **Separation of duties**: creator cannot be the sole approver for restricted, governance, deletion, freeze release, or high-impact AI memory.

## Export workflow

1. Requester selects scope, categories, date range, format, redaction profile, embeddings inclusion, and recipient.
2. System verifies `memory:export.request`, visibility, sensitivity, tenant policy, legal hold, rate limits, and destination policy.
3. Sensitive, restricted, sealed, cross-workspace, external-recipient, or full-tenant exports require approval.
4. Export job snapshots matching records, versions, approvals, audit trail, retention policies, schemas, relationship graph, and provenance receipts.
5. Package is generated as ZIP containing JSON, CSV, Markdown, optional PDF, optional embeddings, schema files, manifest, and `checksums.sha256`.
6. Customer receives an export receipt with requester, approver, scope, row counts, hashes, redactions, expiry, and download events.
7. Downloads use short-lived signed URLs and optional customer-managed encryption keys.

## Deletion workflow

1. Requester submits deletion with scope, reason, legal basis, and impact acknowledgement.
2. System performs dependency analysis for linked decisions, risks, evidence, exports, audits, legal holds, and downstream AI memory.
3. Records on legal hold, freeze, active governance dependency, or statutory retention are blocked or converted to redaction requests.
4. Deletion requires approval for restricted, governance, decision, risk, stakeholder, AI-recommendation, and bulk requests.
5. Approved deletion creates a tombstone, removes record from normal search and AI retrieval, and starts the recovery window.
6. After recovery window, purge job removes content, embeddings, derived summaries, files, and relationship edges, while preserving minimal audit tombstone.
7. Deletion receipts are exportable and include proof of purge without exposing deleted content.

## Recovery workflow

1. Authorized requester selects deleted or archived memory from recovery center.
2. System verifies recovery window, purge status, legal holds, original visibility, and dependency integrity.
3. Selective restore can restore content, metadata, relationships, files, embeddings, and versions independently when policy allows.
4. Recovery writes a new version with `recovered_from_version_id`, restores search/AI eligibility according to policy, and records audit event.
5. Purged records cannot be restored from application storage; only customer-provided backups or tenant-owned export imports can recreate them as new imported memory.

## Audit trail

Audit is append-only and customer-exportable. Events include create, read of restricted/sealed records, update, classification change, approval, rejection, archive, freeze, unfreeze, deletion request, deletion approval, soft delete, purge, recovery, export request, export approval, package generation, download, support access, policy change, permission change, and failed access attempts.

Each audit event stores actor, impersonator/support context, tenant, scope, action, target, previous hash, new hash, policy evaluation result, IP/device metadata where available, reason code, correlation ID, and timestamp.

## Version history

1. Every content, classification, visibility, retention, relationship, and review-state change writes an immutable version row.
2. Versions include full normalized content for evidence-grade reconstruction plus optional field-level diff for UI display.
3. Version chains are hash-linked by `previous_version_hash` and `version_hash`.
4. A record projection points to `current_version_id`; historical versions remain exportable unless purged by policy.
5. AI proposals are stored as versions with `is_proposed = true` until approved.

## Retention policies

| Policy | Default | Notes |
| --- | --- | --- |
| Active project memory | Project close + 7 years | Customer can extend or shorten where lawful. |
| Strategic decisions/governance | 7 years | Extend for regulated customers. |
| Risks/issues | 7 years | Severe risks may map to statutory control evidence. |
| Lessons learned | 5 years | Reset retention when reused in new project playbook. |
| Stakeholder interactions | 3 years | PII minimization and privacy rights apply. |
| AI recommendations | Source retention, minimum 1 year | Delete with source unless governance-approved independent record. |
| Audit logs | 7 years | Minimal tombstones survive content purge. |
| Soft-delete recovery | 30 days default | Configurable 7-180 days by tenant policy. |
| Export packages | 7 days download availability | Manifest/audit receipt retained per audit policy. |

## Memory sovereignty scoring criteria

Score each tenant from 0-100 using weighted controls:

| Dimension | Weight | Criteria |
| --- | ---: | --- |
| Ownership clarity | 15 | Explicit owner metadata, customer-controller terms, derived-memory ownership, support access restrictions. |
| Portability | 15 | Complete export coverage, open schemas, relationship preservation, embeddings option, API export. |
| Governance control | 15 | Customer-managed policies, approval workflows, legal holds, review SLAs. |
| Access sovereignty | 10 | Visibility controls, field redaction, purpose limitation, break-glass controls. |
| Deletion and reversibility | 10 | Deletion workflow, recovery window, purge proof, derived data deletion. |
| Auditability | 10 | Append-only audit, version hashes, export receipts, policy evaluation records. |
| Retention alignment | 10 | Category policies, legal hold, privacy erasure, expiry automation. |
| AI data control | 10 | AI-origin tagging, retrieval suppression, training opt-out, model/provider receipts. |
| Enterprise readiness | 5 | SSO/SCIM role mapping, customer-managed encryption, DLP, compliance reporting. |

Thresholds: `90-100 sovereign`, `75-89 governed`, `60-74 partially governed`, `<60 remediation required`.

## Enterprise governance controls

- Customer-managed encryption key option for memory content, files, and export packages.
- SSO/SCIM role synchronization with scoped role mappings.
- Policy-as-data for retention, classification, approval, export, deletion, and AI retrieval.
- Legal hold and freeze management with release approval.
- Data residency and subprocessor controls by tenant.
- DLP classification and redaction before export or external sharing.
- AI training opt-out enforced by contract, configuration, and provider routing.
- Break-glass support access with customer approval, time limit, screen/session reason, and audit receipt.
- Quarterly access review and policy attestation for enterprise tenants.
- Compliance evidence pack covering ownership, exports, deletion, retention, access, and audit integrity.

## Database schema

The schema assumes PostgreSQL/Supabase with row-level security on `tenant_id`. IDs use UUIDs. JSONB columns store policy-evaluable metadata while core workflow fields remain first-class columns.

```sql
create type memory_status as enum ('draft', 'pending_review', 'active', 'archived', 'frozen', 'sealed', 'soft_deleted', 'purged', 'rejected');
create type memory_visibility as enum ('private_to_creator', 'project', 'program', 'pmo', 'workspace', 'executive', 'external_stakeholder', 'restricted', 'sealed');
create type memory_origin as enum ('manual', 'activity', 'connector', 'ai', 'governance', 'import', 'system');
create type memory_review_status as enum ('not_required', 'pending', 'approved', 'rejected', 'needs_revision', 'escalated');

create table organizational_memory_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  workspace_id uuid,
  pmo_id uuid,
  program_id uuid,
  project_id uuid,
  category text not null,
  status memory_status not null default 'draft',
  visibility memory_visibility not null default 'project',
  sensitivity text not null default 'internal',
  origin memory_origin not null,
  source_system text,
  source_entity_type text,
  source_entity_id text,
  source_uri text,
  title text not null,
  summary text,
  current_version_id uuid,
  owner_user_id uuid not null,
  steward_user_id uuid,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  archived_at timestamptz,
  frozen_at timestamptz,
  deleted_at timestamptz,
  purged_at timestamptz,
  retention_policy_id uuid,
  retain_until timestamptz,
  legal_hold boolean not null default false,
  ai_generated boolean not null default false,
  ai_retrieval_allowed boolean not null default true,
  export_allowed boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  search_tsv tsvector
);

create table organizational_memory_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  memory_id uuid not null references organizational_memory_records(id),
  version_number integer not null,
  title text not null,
  body text,
  normalized_content jsonb not null default '{}'::jsonb,
  classification jsonb not null default '{}'::jsonb,
  relationships jsonb not null default '{}'::jsonb,
  change_reason text not null,
  change_summary text,
  is_proposed boolean not null default false,
  proposed_by_ai boolean not null default false,
  previous_version_id uuid,
  previous_version_hash text,
  version_hash text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique (memory_id, version_number)
);

create table organizational_memory_relationships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  from_memory_id uuid not null references organizational_memory_records(id),
  to_memory_id uuid references organizational_memory_records(id),
  related_entity_type text,
  related_entity_id text,
  relationship_type text not null,
  strength numeric(5,4),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table organizational_memory_permissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  memory_id uuid references organizational_memory_records(id),
  principal_type text not null check (principal_type in ('user', 'role', 'group', 'external_contact')),
  principal_id text not null,
  permission text not null,
  effect text not null check (effect in ('allow', 'deny')),
  granted_by uuid not null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table organizational_memory_approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  memory_id uuid not null references organizational_memory_records(id),
  version_id uuid references organizational_memory_versions(id),
  workflow_type text not null,
  status memory_review_status not null,
  requested_by uuid not null,
  assigned_to uuid,
  decided_by uuid,
  decision_reason text,
  due_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table organizational_memory_export_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  requested_by uuid not null,
  approved_by uuid,
  status text not null check (status in ('requested', 'pending_approval', 'approved', 'running', 'completed', 'failed', 'expired', 'cancelled')),
  scope jsonb not null,
  formats text[] not null,
  redaction_profile text not null default 'standard',
  include_versions boolean not null default true,
  include_audit boolean not null default true,
  include_embeddings boolean not null default false,
  package_uri text,
  manifest_hash text,
  row_counts jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table organizational_memory_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  requested_by uuid not null,
  approved_by uuid,
  status text not null check (status in ('requested', 'pending_approval', 'approved', 'blocked', 'soft_deleted', 'purged', 'cancelled', 'rejected')),
  scope jsonb not null,
  reason text not null,
  dependency_report jsonb not null default '{}'::jsonb,
  recovery_until timestamptz,
  purge_after timestamptz,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  purged_at timestamptz
);

create table organizational_memory_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  actor_user_id uuid,
  actor_type text not null,
  action text not null,
  target_type text not null,
  target_id uuid,
  memory_id uuid,
  policy_result jsonb not null default '{}'::jsonb,
  before_hash text,
  after_hash text,
  reason text,
  ip_address inet,
  user_agent text,
  correlation_id text not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table organizational_memory_retention_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  category text,
  retain_for interval,
  soft_delete_recovery_for interval not null default interval '30 days',
  archive_after interval,
  legal_basis text,
  purge_strategy text not null default 'content_and_derivatives',
  is_default boolean not null default false,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table organizational_memory_sovereignty_scores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  score numeric(5,2) not null,
  dimension_scores jsonb not null,
  remediation_items jsonb not null default '[]'::jsonb,
  measured_at timestamptz not null default now(),
  measured_by text not null default 'system'
);
```

## API contracts

All APIs require tenant-scoped authentication and return policy evaluation metadata in `meta.policy` when debug governance mode is enabled.

### Memory records

```http
POST /api/memory-records
Content-Type: application/json
```

Request:
```json
{
  "workspaceId": "uuid",
  "projectId": "uuid",
  "category": "decision",
  "visibility": "project",
  "sensitivity": "internal",
  "origin": "manual",
  "title": "Approve vendor migration",
  "body": "Decision rationale in Markdown",
  "source": { "system": "pmfreak", "entityType": "decision", "entityId": "D-123" },
  "relationships": [{ "type": "mitigates", "entityType": "risk", "entityId": "R-99" }]
}
```

Response `201`:
```json
{
  "id": "uuid",
  "status": "pending_review",
  "currentVersionId": "uuid",
  "reviewRequired": true
}
```

```http
GET /api/memory-records?workspaceId={id}&category=risk&status=active&visibility=project
GET /api/memory-records/{memoryId}
PATCH /api/memory-records/{memoryId}
POST /api/memory-records/{memoryId}/archive
POST /api/memory-records/{memoryId}/freeze
POST /api/memory-records/{memoryId}/unfreeze
GET /api/memory-records/{memoryId}/versions
GET /api/memory-records/{memoryId}/audit-events
```

Patch request requires optimistic concurrency:
```json
{
  "expectedVersion": 4,
  "changeReason": "correction",
  "title": "Updated title",
  "body": "Updated Markdown",
  "visibility": "restricted"
}
```

### Approval APIs

```http
POST /api/memory-approvals
GET /api/memory-approvals?assignedTo=me&status=pending
POST /api/memory-approvals/{approvalId}/approve
POST /api/memory-approvals/{approvalId}/reject
POST /api/memory-approvals/{approvalId}/request-revision
POST /api/memory-approvals/{approvalId}/escalate
```

Approval decision request:
```json
{
  "decisionReason": "Validated evidence and classification.",
  "classificationChanges": { "sensitivity": "confidential", "visibility": "executive" }
}
```

### Export APIs

```http
POST /api/memory-exports
GET /api/memory-exports/{exportJobId}
POST /api/memory-exports/{exportJobId}/approve
GET /api/memory-exports/{exportJobId}/download
GET /api/memory-exports/{exportJobId}/receipt
```

Export request:
```json
{
  "scope": { "workspaceId": "uuid", "projectIds": ["uuid"], "categories": ["decision", "risk"], "from": "2026-01-01", "to": "2026-06-16" },
  "formats": ["json", "csv", "markdown"],
  "redactionProfile": "standard",
  "includeVersions": true,
  "includeAudit": true,
  "includeEmbeddings": false,
  "recipient": { "type": "user", "id": "uuid" }
}
```

### Deletion and recovery APIs

```http
POST /api/memory-deletions
GET /api/memory-deletions/{deletionRequestId}
POST /api/memory-deletions/{deletionRequestId}/approve
POST /api/memory-deletions/{deletionRequestId}/cancel
POST /api/memory-deletions/{deletionRequestId}/purge
GET /api/memory-recovery?status=soft_deleted&workspaceId={id}
POST /api/memory-recovery/{memoryId}/restore
```

Deletion request:
```json
{
  "scope": { "memoryIds": ["uuid"] },
  "reason": "Customer privacy erasure request",
  "requestedPurgeAfter": "2026-07-16T00:00:00Z"
}
```

Recovery request:
```json
{
  "restoreRelationships": true,
  "restoreEmbeddings": false,
  "reason": "Deleted in error during project cleanup"
}
```

### Policy and score APIs

```http
GET /api/memory-policies/retention
POST /api/memory-policies/retention
PATCH /api/memory-policies/retention/{policyId}
GET /api/memory-sovereignty-score
POST /api/memory-sovereignty-score/recalculate
GET /api/memory-governance/evidence-pack
```

## Governance model

### Governance bodies

- **Memory Sovereignty Admins** own tenant-level memory policy, export, deletion, recovery, freeze, and scoring controls.
- **PMO Governance Leads** enforce category-specific review rules for project delivery memory.
- **Data Protection/Legal Officers** own legal holds, privacy erasure exceptions, restricted records, and sealed records.
- **Executive Approvers** approve strategic, high-impact, external, or enterprise-wide memory actions.
- **PMFreak Trust Operations** may support only under customer-authorized break-glass or contractual processing purposes.

### Policy hierarchy

1. Law/regulatory hold and court orders.
2. Customer enterprise policy.
3. Workspace/PMO/project policy.
4. Category default policy.
5. PMFreak safety and abuse-prevention minimums.

When policies conflict, the most restrictive lawful control wins and the decision is recorded in audit.

## Security controls

- Row-level security by `tenant_id` and scope-specific membership.
- Attribute-based access control using category, sensitivity, visibility, status, relationship, purpose, and export destination.
- Encryption at rest for content, files, exports, and embeddings; customer-managed keys for enterprise tenants.
- Short-lived signed URLs for export packages and evidence files.
- Append-only audit with hash chaining for versions and export manifests.
- DLP scan and redaction policies for restricted and external exports.
- AI retrieval controls: `ai_retrieval_allowed`, sensitivity gates, prompt-context receipts, and customer AI opt-out.
- Connector provenance receipts and import quarantine for untrusted sources.
- Break-glass access with customer approval, maximum duration, least privilege, and mandatory audit notification.
- Rate limits and anomaly detection for bulk reads, exports, deletion, and restricted record access.

## UI design specification

### Memory Center

Primary navigation item for customer-owned memory.

- **Overview tab**: total records, categories, pending reviews, retention expiries, export jobs, deletion requests, sovereignty score.
- **Memory Explorer**: faceted search by category, project, source, sensitivity, visibility, status, owner, date, AI-generated, legal hold, and retention date.
- **Record Detail**: content, provenance, relationships, versions, approvals, audit events, retention, export eligibility, AI retrieval status.
- **Timeline View**: chronological memory by project/program with decisions, risks, lessons, stakeholder events, and governance events.
- **Graph View**: relationship graph of decisions, risks, lessons, evidence, and stakeholder interactions.

### Governance Console

- **Review Queue**: assigned approvals with SLA, impact, sensitivity, source, diffs, and approve/reject/escalate actions.
- **Policy Builder**: retention, review, visibility, export, deletion, AI retrieval, and legal hold rules with simulation preview.
- **Access Matrix**: role and explicit grants by category, scope, and sensitivity.
- **Audit Explorer**: filterable audit stream with exportable receipts and support-access alerts.
- **Sovereignty Scorecard**: score trend, dimension breakdown, failed controls, remediation actions, and evidence-pack generation.

### Export and Deletion Center

- **Export Wizard**: scope picker, format picker, redaction profile, version/audit/embedding toggles, estimated package size, approval route, and recipient confirmation.
- **Deletion Wizard**: scope picker, dependency report, hold blockers, recovery window, purge date, approval route, and acknowledgement.
- **Recovery Center**: deleted/archived records, days remaining, dependency preview, restore options, and audit receipt.

### UX requirements

- Every memory record shows ownership banner: "Owned by customer; processed by PMFreak under tenant policy."
- Restricted records show sensitivity label, allowed viewers, and last access review date.
- AI-generated memory shows model/provider metadata available to the customer, confidence, source citations, and review status.
- Destructive actions require typed confirmation and display recovery/purge consequences.
- Export screens display open formats, included/excluded data, redactions, and manifest hash after completion.

## Acceptance criteria

1. Customer-owned memory records can be created for activity, decisions, risks, lessons, stakeholder interactions, AI recommendations, and governance events.
2. Every record has tenant ownership, provenance, category, visibility, sensitivity, retention, current version, and audit metadata.
3. Visibility and permissions prevent cross-tenant access and enforce restricted/sealed access by explicit grants only.
4. Every content or classification change creates an immutable version with reason code and hash.
5. Approval workflows route high-impact, restricted, governance, deletion, freeze release, and sensitive export actions to authorized reviewers.
6. Export jobs produce verifiable packages with schemas, manifest, checksums, row counts, redaction report, and audit receipt.
7. Deletion workflow blocks legal holds, creates tombstones, suppresses AI retrieval/search, supports recovery window, and purges derivatives.
8. Recovery can restore soft-deleted records before purge and records a new auditable version.
9. Retention policies can be configured by category and scope and can trigger archive, review, soft delete, or purge workflows.
10. Sovereignty score is calculated from ownership, portability, governance, access, deletion, audit, retention, AI control, and enterprise readiness dimensions.
11. PMFreak support access is denied by default and only allowed through time-boxed audited break-glass authorization.
12. UI exposes Memory Center, Governance Console, Export/Deletion Center, Recovery Center, version history, audit trail, and sovereignty scorecard.
13. All APIs are tenant-scoped, policy-evaluated, audit-logged, and return deterministic error codes for denied, blocked-by-hold, approval-required, and stale-version states.
14. Enterprise tenants can enable SSO/SCIM mapping, customer-managed keys, DLP, data residency, legal hold, and compliance evidence packs.
