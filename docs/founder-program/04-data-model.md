# Founder Circle — Data Model

Migration: `supabase/migrations/20260828000000_founder_program.sql`.
All tables live in `public`, are RLS-enabled, and follow the repository
conventions (`drop policy if exists` + `create policy`, explicit
`revoke`/`grant`, `touch_updated_at()` trigger where mutable, stable UUID
primary keys, `created_at` everywhere, `updated_at` on mutable tables).

**Why new entities?** See the ADR (00): the existing `early_access_invites`
and `workspace_invitations` models encode different lifecycles (immediate
trial activation; seat invites) and are hardened, tested flows — overloading
them would create hidden coupling and regress their contracts. The pilot
agreement table is reused as-is (single source of truth); users, workspaces,
memberships, security events and abuse-limit tables are all reused.

## Tables

### `founder_program_settings` (singleton)
Operator-managed capacity/configuration. One row enforced by a unique
`singleton` boolean. Columns: `display_name`, `program_enabled`,
`invite_only`, `applications_enabled`, `max_approved_participants` (default
10), `max_active_participants` (default 5), `max_invitations_per_batch`
(default 5), `invitation_expiry_days` (default 7), `required_agreement_version`
(default `0.1-draft`, must match `PILOT_AGREEMENT_VERSION` to activate),
`required_onboarding_version`, `capability_profile` (check: only `pilot`),
`support_contact`, `feedback_cadence_days`, `program_starts_on`,
`review_due_on`, timestamps. Seeded with one disabled row.
**RLS**: service-role only (operator surface reads it through founder-gated
routes). No authenticated grants.

### `founder_invitations`
One row per issued invitation. Columns: `email` (lowercased),
`token_hash` (unique; sha256 of a 192-bit CSPRNG token; plaintext never
stored), `archetype` (check), `nomination_note` (internal), `status`
(`pending|viewed|applied|expired|revoked`), `expires_at`, `viewed_at`,
`applied_at`, `revoked_at`, `revoke_reason`, `batch_id`, `created_by_user_id`,
timestamps. Uniqueness: at most one non-revoked/expired invitation per email
(partial unique index).
**RLS**: service-role only. Participants interact only via token-resolving
routes; operators via founder-gated routes. `token_hash` is never returned by
any API.

### `founder_participants`
The canonical lifecycle record (one per person), created with the
invitation. Columns: `invitation_id` (unique FK), `user_id` (unique, nullable
until application binds an account), `email`, `full_name` (from application),
`archetype`, `lifecycle_state` (check: the 18 canonical states),
`state_reason` (internal), `cohort`, `internal_owner_user_id`,
`workspace_id` (FK, set at activation), `application_id`,
`agreement_version_accepted`, `activated_at`, `paused_at`, `revoked_at`,
`completed_at`, timestamps.
**RLS**: authenticated self-`select` (`user_id = auth.uid()`) with a
**column-scoped grant** that excludes internal fields (`state_reason`,
`nomination` data, `internal_owner_user_id`); all writes service-role only.

### `founder_applications`
Intake answers (see 02). Columns: `participant_id` (unique FK), `user_id`
(FK auth.users), `full_name`, `role_title`, `company_status` (check),
`experience_range` (check), `pain_point`, `current_tools`,
`active_projects_range` (check), `joining_reason`, `consent_contact`,
`feedback_availability` (check), `referral_source`, `linkedin_url`,
`timezone`, `submitted_at`, `withdrawn_at`.
**RLS**: self-`select`; writes service-role only (submission is validated in
the route layer; participants cannot edit after submission — no update grant).

### `founder_membership_transitions`
Append-only lifecycle audit: `participant_id`, `from_state`, `to_state`,
`actor_type` (`participant|operator|system`), `actor_user_id`, `reason`,
`created_at`. Written only by the `founder_program_transition` SQL function.
**RLS**: service-role only; `insert/update/delete` revoked from clients.
Immutable: no update/delete grants for any client role.

### `founder_onboarding_checkpoints`
`participant_id`, `user_id`, `checkpoint` (check: the 13 canonical keys),
`reached_at`; unique `(participant_id, checkpoint)` — idempotent by design.
**RLS**: self-`select`; writes service-role only.

### `founder_program_events`
First-party analytics: `event_name` (check-constrained to the canonical
registry), `schema_version`, `participant_id` (nullable FK), `cohort`,
`properties` jsonb (allowlisted keys only — validated in
`src/lib/founder-program/analytics.ts` before insert). No email, no tokens,
no free text.
**RLS**: service-role only.

### `founder_feedback`
`participant_id`, `user_id`, `workspace_id` (nullable), `feedback_type`
(check: 8 categories), `severity` (check), `product_area`, `body` (free text,
participant-visible), `allow_contact`, `status` (check:
`new|triaged|planned|declined|resolved|duplicate`), `internal_owner_user_id`,
`internal_notes`, `resolution_ref`, timestamps.
**RLS**: self-`select` with column-scoped grant excluding
`internal_notes`/`internal_owner_user_id`; writes service-role only
(ownership enforced in the route layer AND by RLS on read).

### `founder_discovery_sessions`
Operator-recorded interview/observation evidence: `participant_id`,
`session_type` (check: 6 types), `status` (`scheduled|completed|cancelled`),
`scheduled_for`, `completed_on`, `facilitator_user_id`, `main_pain_point`,
`moment_of_value`, `main_friction`, `requested_capability`,
`willingness_to_pay` (check: bounded categories), `findings`,
`follow_up_actions`, `evidence_ref` (reference only — recordings are never
uploaded/stored by this system), `consent_status` (check), timestamps.
**RLS**: service-role only (operator-facing evidence).

### `founder_program_decisions`
Append-only decision-gate records (see 12): `decision` (check: 5 outcomes),
`decided_on`, `decision_owner_user_id`, `evidence_window_start/end`,
`participant_count`, `activation_count`, `retention_evidence_available`,
`positive_signals`, `negative_signals`, `critical_defects`,
`requested_capabilities`, `security_incidents`, `data_quality_limitations`,
`rationale`, `required_remediation`, `next_review_on`, `created_at`.
**RLS**: service-role only; no update/delete grants (immutable record).

## SQL function

`founder_program_transition(p_participant_id, p_expected_from, p_to,
p_actor_type, p_actor_user_id, p_reason, p_capacity_scope)` —
`security definer`, `search_path` pinned, execute granted **only to
`service_role`**. Behavior:

1. Locks the `founder_program_settings` row (`for update`).
2. If `p_capacity_scope = 'approved'`: counts participants in
   approved-or-later non-terminal states; returns `capacity_reached` at limit.
3. If `p_capacity_scope = 'active'`: counts access-granting states; same.
4. Compare-and-swap: `update … set lifecycle_state = p_to where id = … and
   lifecycle_state = p_expected_from`; zero rows → `state_conflict`
   (idempotency/duplicate-activation guard).
5. Inserts the `founder_membership_transitions` row.
6. Returns `ok`.

## Retention / deletion

- Participant personal data (application, name, email) is deleted on request
  per the runbook (10-operations-runbook.md §data deletion); lifecycle
  transition rows are retained with the participant id as pseudonymous
  program evidence.
- `on delete cascade` from `founder_participants` removes applications,
  checkpoints, feedback and discovery sessions if a participant row is
  purged; decisions and settings are program-level and unaffected.
- No automatic purge jobs are claimed — retention operations are manual and
  documented.

## Immutable fields / idempotency boundaries

- Immutable from all client roles: every table (no authenticated
  insert/update/delete grants anywhere in this domain).
- Immutable even via service role by convention (append-only, no code path
  updates them): `founder_membership_transitions`, `founder_program_decisions`,
  `founder_program_events`, `pilot_agreement_acceptances` (pre-existing).
- Idempotency boundaries: transition CAS (state_conflict), checkpoint unique
  key, one application per participant (unique FK), one participant per
  invitation (unique FK), one non-expired invitation per email (partial
  unique index), agreement unique `(workspace, user, version)` (pre-existing).
