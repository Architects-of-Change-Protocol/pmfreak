-- P2-09 - Outcome and Observation Contract
--
-- Canonical invariant:
--   Task completion != Outcome achievement.
--
-- Lineage:
--   decision-context Evidence -> Signal -> Recommendation -> Decision
--     -> Action -> Task -> Internal Execution -> expected Outcome
--
-- Independent LIVE observation lineage:
--   new LIVE external observation input -> Raw Input -> Normalized Event
--     -> LIVE Evidence -> Outcome Observation -> Outcome state transition
--
-- An expected outcome is never automatically marked achieved merely because
-- the source task or internal execution completed.
--
-- DEMO_FIXTURE evidence MUST NOT be allowed to prove an Outcome.
-- Outcome observation strictly requires canonical LIVE Evidence.

create table if not exists public.canonical_task_outcomes (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null,
    project_id uuid not null,

    task_id uuid not null
        references public.execution_tasks(id)
        on delete restrict,

    source_action_id uuid null,
    internal_execution_id uuid null,

    state text not null default 'expected'
        check (
            state in (
                'expected',
                'observing',
                'achieved',
                'partially_achieved',
                'not_achieved',
                'disputed',
                'inconclusive',
                'superseded'
            )
        ),

    expected_result text not null
        check (length(btrim(expected_result)) > 0),

    success_criteria jsonb not null default '[]'::jsonb,

    correlation_id text not null
        check (length(btrim(correlation_id)) > 0),

    causation_id text null,

    created_by uuid not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    fixture_label text null,

    constraint canonical_task_outcomes_fixture_label_check
        check (
            fixture_label is null
            or fixture_label = 'DEMO / FIXTURE'
        ),

    constraint canonical_task_outcomes_one_per_task
        unique (workspace_id, project_id, task_id)
);

comment on table public.canonical_task_outcomes is
'P2-09 canonical expected Outcome for an execution Task. Task completion never implies Outcome achievement.';

comment on column public.canonical_task_outcomes.state is
'Canonical Outcome lifecycle. Initial state is expected. Achievement requires an authorized evidence-backed Observation.';


create table if not exists public.canonical_outcome_observations (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null,
    project_id uuid not null,

    outcome_id uuid not null
        references public.canonical_task_outcomes(id)
        on delete restrict,

    task_id uuid not null
        references public.execution_tasks(id)
        on delete restrict,

    observation_state text not null
        check (
            observation_state in (
                'achieved',
                'partial',
                'failed',
                'disputed',
                'inconclusive'
            )
        ),

    summary text not null
        check (length(btrim(summary)) > 0),

    evidence_reference_ids uuid[] not null,

    confidence_score numeric(5,4) not null
        check (
            confidence_score >= 0
            and confidence_score <= 1
        ),

    missing_data_state text not null
        check (
            missing_data_state in (
                'COMPLETE',
                'PARTIAL',
                'UNKNOWN'
            )
        ),

    observed_by uuid not null,

    observed_at timestamptz not null,
    evaluated_at timestamptz not null,
    stale_at timestamptz null,
    recorded_at timestamptz not null default now(),

    correlation_id text not null
        check (length(btrim(correlation_id)) > 0),

    causation_id text null,

    idempotency_key text not null
        check (length(btrim(idempotency_key)) > 0),

    fixture_label text null,

    constraint canonical_outcome_observations_fixture_label_check
        check (
            fixture_label is null
            or fixture_label = 'DEMO / FIXTURE'
        ),

    constraint canonical_outcome_observations_idempotency
        unique (workspace_id, project_id, idempotency_key)
);

comment on table public.canonical_outcome_observations is
'P2-09 evidence-backed observation of a canonical expected Task Outcome.';


create index if not exists canonical_task_outcomes_project_idx
    on public.canonical_task_outcomes (
        workspace_id,
        project_id,
        created_at desc
    );

create index if not exists canonical_task_outcomes_task_idx
    on public.canonical_task_outcomes (
        task_id
    );

create index if not exists canonical_outcome_observations_outcome_idx
    on public.canonical_outcome_observations (
        workspace_id,
        project_id,
        outcome_id,
        recorded_at desc
    );

create index if not exists canonical_outcome_observations_task_idx
    on public.canonical_outcome_observations (
        task_id,
        recorded_at desc
    );


alter table public.canonical_task_outcomes
    enable row level security;

alter table public.canonical_outcome_observations
    enable row level security;


-- Read access follows the existing operational project membership boundary.
drop policy if exists canonical_task_outcomes_select
    on public.canonical_task_outcomes;

create policy canonical_task_outcomes_select
on public.canonical_task_outcomes
for select
to authenticated
using (
    public.can_access_operational_project(workspace_id, project_id)
);


drop policy if exists canonical_outcome_observations_select
    on public.canonical_outcome_observations;

create policy canonical_outcome_observations_select
on public.canonical_outcome_observations
for select
to authenticated
using (
    public.can_access_operational_project(workspace_id, project_id)
);


-- Narrowly-scoped authenticated RPC to capture a real LIVE operational observation input.
-- Creates or resolves an operational Source with is_fixture = false.
-- Retains identical canonical intake lineage: Source -> Raw Input -> Normalized Event.
create or replace function public.capture_live_operational_input(
    p_workspace_id uuid,
    p_project_id uuid,
    p_source_key text,
    p_idempotency_key text,
    p_title text,
    p_content text,
    p_occurred_at timestamptz,
    p_correlation_id uuid,
    p_causation_id uuid default null,
    p_external_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
    v_actor uuid := auth.uid();
    v_source public.operational_sources%rowtype;
    v_raw public.operational_raw_inputs%rowtype;
    v_event public.operational_normalized_events%rowtype;
    v_payload jsonb;
    v_raw_digest text;
    v_event_digest text;
    v_duplicate boolean := false;
    v_audit_id uuid;
begin
    if v_actor is null then
        raise exception 'intake_unauthenticated';
    end if;

    if not public.can_write_operational_project(p_workspace_id, p_project_id) then
        raise exception 'intake_access_denied';
    end if;

    if nullif(trim(coalesce(p_title, '')), '') is null
       or nullif(trim(coalesce(p_content, '')), '') is null then
        raise exception 'intake_malformed';
    end if;

    if p_occurred_at is null or p_occurred_at > now() + interval '5 minutes' then
        raise exception 'intake_occurred_at_invalid';
    end if;

    if nullif(trim(coalesce(p_source_key, '')), '') is null then
        raise exception 'intake_source_key_required';
    end if;

    if nullif(trim(coalesce(p_idempotency_key, '')), '') is null
       or char_length(trim(p_idempotency_key)) < 8 then
        raise exception 'intake_idempotency_key_invalid';
    end if;

    if p_correlation_id is null then
        raise exception 'intake_correlation_id_required';
    end if;

    select *
    into v_source
    from public.operational_sources
    where workspace_id = p_workspace_id
      and project_id = p_project_id
      and source_key = trim(p_source_key);

    if v_source.id is not null and v_source.is_fixture then
        raise exception 'intake_source_fixture_prohibited';
    end if;

    if v_source.id is null then
        insert into public.operational_sources (
            workspace_id,
            project_id,
            source_key,
            source_kind,
            display_name,
            status,
            is_fixture,
            fixture_label,
            fixture_expires_when,
            created_by
        )
        values (
            p_workspace_id,
            p_project_id,
            trim(p_source_key),
            'connector',
            'Live observation intake',
            'active',
            false,
            null,
            null,
            v_actor
        )
        on conflict (workspace_id, project_id, source_key) do nothing;

        select *
        into v_source
        from public.operational_sources
        where workspace_id = p_workspace_id
          and project_id = p_project_id
          and source_key = trim(p_source_key);
    end if;

    if v_source.id is null then
        raise exception 'intake_source_creation_failed';
    end if;

    if v_source.is_fixture then
        raise exception 'intake_source_fixture_prohibited';
    end if;

    case v_source.status
        when 'degraded' then raise exception 'intake_source_degraded';
        when 'stale' then raise exception 'intake_source_stale';
        when 'unavailable' then raise exception 'intake_source_unavailable';
        when 'revoked' then raise exception 'intake_source_revoked';
        else null;
    end case;

    v_payload := jsonb_build_object(
        'title', trim(p_title),
        'content', trim(p_content)
    );

    v_raw_digest := 'sha256:' || encode(
        extensions.digest(convert_to(v_payload::text, 'UTF8'), 'sha256'),
        'hex'
    );

    insert into public.operational_raw_inputs (
        workspace_id,
        project_id,
        source_id,
        external_id,
        idempotency_key,
        payload,
        content_digest,
        status,
        occurred_at,
        actor_user_id,
        correlation_id,
        causation_id,
        provenance
    )
    values (
        p_workspace_id,
        p_project_id,
        v_source.id,
        nullif(trim(coalesce(p_external_id, '')), ''),
        trim(p_idempotency_key),
        v_payload,
        v_raw_digest,
        'received',
        p_occurred_at,
        v_actor,
        p_correlation_id,
        p_causation_id,
        jsonb_build_object(
            'sourceId', v_source.id,
            'sourceKey', v_source.source_key,
            'capturedBy', v_actor,
            'isFixture', false
        )
    )
    on conflict (source_id, idempotency_key) do nothing
    returning *
    into v_raw;

    if v_raw.id is null then
        v_duplicate := true;
        select *
        into v_raw
        from public.operational_raw_inputs
        where source_id = v_source.id
          and idempotency_key = trim(p_idempotency_key);

        if v_raw.content_digest <> v_raw_digest then
            raise exception 'intake_idempotency_conflict';
        end if;
    end if;

    v_event_digest := 'sha256:' || encode(
        extensions.digest(
            convert_to(
                jsonb_build_object(
                    'eventType', 'manual_input.submitted',
                    'schemaVersion', 1,
                    'rawDigest', v_raw.content_digest,
                    'payload', v_payload
                )::text,
                'UTF8'
            ),
            'sha256'
        ),
        'hex'
    );

    insert into public.operational_normalized_events (
        workspace_id,
        project_id,
        source_id,
        raw_input_id,
        event_type,
        schema_version,
        normalizer_key,
        subject_type,
        subject_id,
        event_payload,
        event_digest,
        status,
        occurred_at,
        actor_user_id,
        correlation_id,
        causation_id,
        provenance
    )
    values (
        p_workspace_id,
        p_project_id,
        v_source.id,
        v_raw.id,
        'manual_input.submitted',
        1,
        'pmfreak/live-observation-normalizer:v1',
        'project',
        p_project_id,
        v_payload,
        v_event_digest,
        'accepted',
        p_occurred_at,
        v_actor,
        p_correlation_id,
        v_raw.id,
        jsonb_build_object(
            'sourceId', v_source.id,
            'rawInputId', v_raw.id,
            'rawDigest', v_raw.content_digest,
            'normalizer', 'pmfreak/live-observation-normalizer:v1'
        )
    )
    on conflict (raw_input_id, event_type, schema_version) do nothing
    returning *
    into v_event;

    if v_event.id is null then
        select *
        into v_event
        from public.operational_normalized_events
        where raw_input_id = v_raw.id
          and event_type = 'manual_input.submitted'
          and schema_version = 1;
    end if;

    if not v_duplicate then
        insert into public.platform_events (
            workspace_id,
            project_id,
            actor_id,
            actor_type,
            event_type,
            event_category,
            event_payload,
            source,
            correlation_id,
            causation_id,
            visibility,
            sensitivity_level,
            learning_eligible,
            raw_reference_table,
            raw_reference_id,
            metadata,
            occurred_at
        )
        values (
            p_workspace_id,
            p_project_id,
            v_actor,
            'user',
            'NORMALIZED_EVENT_RECORDED',
            'provenance',
            jsonb_build_object(
                'eventId', v_event.id,
                'eventType', v_event.event_type,
                'schemaVersion', v_event.schema_version,
                'eventDigest', v_event.event_digest
            ),
            'user_action',
            p_correlation_id,
            null,
            'project',
            'internal',
            false,
            'operational_raw_inputs',
            v_raw.id,
            jsonb_build_object(
                'sourceId', v_source.id,
                'normalizerKey', v_event.normalizer_key
            ),
            p_occurred_at
        )
        returning id
        into v_audit_id;
    end if;

    return jsonb_build_object(
        'disposition', case when v_duplicate then 'duplicate' else 'created' end,
        'source', to_jsonb(v_source),
        'rawInput', to_jsonb(v_raw),
        'normalizedEvent', to_jsonb(v_event),
        'auditEventId', v_audit_id,
        'evidenceCreated', false
    );
end;
$$;


create or replace function public.ensure_expected_task_outcome(
    p_workspace_id uuid,
    p_project_id uuid,
    p_task_id uuid,
    p_expected_result text,
    p_success_criteria jsonb default '[]'::jsonb,
    p_correlation_id text default null,
    p_causation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_actor_id uuid;
    v_task public.execution_tasks%rowtype;
    v_execution record;
    v_existing public.canonical_task_outcomes%rowtype;
    v_created public.canonical_task_outcomes%rowtype;
begin
    v_actor_id := auth.uid();

    if v_actor_id is null then
        raise exception 'unauthenticated';
    end if;

    if p_workspace_id is null
       or p_project_id is null
       or p_task_id is null then
        raise exception 'outcome_scope_required';
    end if;

    if nullif(btrim(coalesce(p_expected_result, '')), '') is null then
        raise exception 'expected_result_required';
    end if;

    if nullif(btrim(coalesce(p_correlation_id, '')), '') is null then
        raise exception 'correlation_id_required';
    end if;

    if not public.can_write_operational_project(
        p_workspace_id,
        p_project_id
    ) then
        raise exception 'outcome_write_denied';
    end if;

    select *
    into v_task
    from public.execution_tasks
    where id = p_task_id
      and workspace_id = p_workspace_id
      and project_id = p_project_id;

    if not found then
        raise exception 'canonical_task_not_found';
    end if;

    if coalesce(v_task.status::text, '') <> 'completed' then
        raise exception 'canonical_task_not_completed';
    end if;

    select ite.*
    into v_execution
    from public.internal_task_executions ite
    where ite.workspace_id = p_workspace_id
      and ite.project_id = p_project_id
      and ite.task_id = p_task_id
      and ite.status::text = 'completed'
    order by ite.completed_at desc nulls last,
             ite.created_at desc
    limit 1;

    if not found then
        raise exception 'completed_internal_execution_required';
    end if;

    select *
    into v_existing
    from public.canonical_task_outcomes
    where workspace_id = p_workspace_id
      and project_id = p_project_id
      and task_id = p_task_id;

    if found then
        return jsonb_build_object(
            'disposition', 'existing',
            'outcome', to_jsonb(v_existing),
            'achievementInferred', false
        );
    end if;

    insert into public.canonical_task_outcomes (
        workspace_id,
        project_id,
        task_id,
        source_action_id,
        internal_execution_id,
        state,
        expected_result,
        success_criteria,
        correlation_id,
        causation_id,
        created_by
    )
    values (
        p_workspace_id,
        p_project_id,
        p_task_id,
        v_execution.source_action_id,
        v_execution.id,
        'expected',
        btrim(p_expected_result),
        coalesce(p_success_criteria, '[]'::jsonb),
        btrim(p_correlation_id),
        nullif(btrim(coalesce(p_causation_id, '')), ''),
        v_actor_id
    )
    returning *
    into v_created;

    return jsonb_build_object(
        'disposition', 'created',
        'outcome', to_jsonb(v_created),
        'achievementInferred', false
    );
end;
$$;


create or replace function public.record_canonical_outcome_observation(
    p_workspace_id uuid,
    p_project_id uuid,
    p_outcome_id uuid,
    p_observation_state text,
    p_summary text,
    p_evidence_reference_ids uuid[],
    p_confidence_score numeric,
    p_missing_data_state text,
    p_observed_at timestamptz,
    p_evaluated_at timestamptz,
    p_stale_at timestamptz,
    p_correlation_id text,
    p_causation_id text,
    p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_actor_id uuid;
    v_outcome public.canonical_task_outcomes%rowtype;
    v_existing public.canonical_outcome_observations%rowtype;
    v_observation public.canonical_outcome_observations%rowtype;
    v_outcome_state text;
    v_evidence_count integer;
begin
    v_actor_id := auth.uid();

    if v_actor_id is null then
        raise exception 'unauthenticated';
    end if;

    if not public.can_write_operational_project(
        p_workspace_id,
        p_project_id
    ) then
        raise exception 'outcome_observation_write_denied';
    end if;

    if p_observation_state not in (
        'achieved',
        'partial',
        'failed',
        'disputed',
        'inconclusive'
    ) then
        raise exception 'observation_state_invalid';
    end if;

    if nullif(btrim(coalesce(p_summary, '')), '') is null then
        raise exception 'observation_summary_required';
    end if;

    if p_confidence_score is null
       or p_confidence_score < 0
       or p_confidence_score > 1 then
        raise exception 'observation_confidence_invalid';
    end if;

    if p_missing_data_state not in (
        'COMPLETE',
        'PARTIAL',
        'UNKNOWN'
    ) then
        raise exception 'observation_missing_data_state_invalid';
    end if;

    if p_observed_at is null
       or p_evaluated_at is null then
        raise exception 'observation_timestamp_required';
    end if;

    if p_observed_at > now() + interval '5 minutes'
       or p_evaluated_at > now() + interval '5 minutes' then
        raise exception 'observation_timestamp_future';
    end if;

    if p_stale_at is not null
       and p_stale_at <= p_evaluated_at then
        raise exception 'observation_evidence_stale';
    end if;

    if nullif(btrim(coalesce(p_correlation_id, '')), '') is null then
        raise exception 'observation_correlation_id_required';
    end if;

    if nullif(btrim(coalesce(p_idempotency_key, '')), '') is null then
        raise exception 'observation_idempotency_key_required';
    end if;

    if coalesce(cardinality(p_evidence_reference_ids), 0) = 0 then
        raise exception 'observation_evidence_required';
    end if;

    select *
    into v_existing
    from public.canonical_outcome_observations
    where workspace_id = p_workspace_id
      and project_id = p_project_id
      and idempotency_key = btrim(p_idempotency_key);

    if found then
        if v_existing.outcome_id <> p_outcome_id
           or v_existing.observation_state <> p_observation_state
           or v_existing.summary <> btrim(p_summary)
           or v_existing.evidence_reference_ids <> p_evidence_reference_ids then
            return jsonb_build_object(
                'disposition', 'conflict',
                'failureClass', 'idempotency_conflict'
            );
        end if;

        return jsonb_build_object(
            'disposition', 'existing',
            'observation', to_jsonb(v_existing)
        );
    end if;

    select *
    into v_outcome
    from public.canonical_task_outcomes
    where id = p_outcome_id
      and workspace_id = p_workspace_id
      and project_id = p_project_id
    for update;

    if not found then
        raise exception 'canonical_outcome_not_found';
    end if;

    if v_outcome.state = 'superseded' then
        raise exception 'canonical_outcome_superseded';
    end if;

    select count(*)
    into v_evidence_count
    from public.evidence_items e
    where e.id = any(p_evidence_reference_ids)
      and e.workspace_id = p_workspace_id
      and e.project_id = p_project_id
      -- P2-09 observations may only promote an Outcome from canonical,
      -- provenance-bearing live Evidence.
      and e.normalized_event_id is not null
      and e.fixture_state = 'LIVE'
      and e.freshness_state = 'CURRENT'
      and e.lifecycle = 'RECORDED'
      and e.rejection_reason is null
      and e.degraded_reason is null
      and e.evaluated_at is not null
      and (
          e.stale_at is null
          or e.stale_at > p_evaluated_at
      );

    if v_evidence_count <> cardinality(p_evidence_reference_ids) then
        raise exception 'observation_evidence_scope_invalid';
    end if;

    case p_observation_state
        when 'achieved' then
            v_outcome_state := 'achieved';
        when 'partial' then
            v_outcome_state := 'partially_achieved';
        when 'failed' then
            v_outcome_state := 'not_achieved';
        when 'disputed' then
            v_outcome_state := 'disputed';
        when 'inconclusive' then
            v_outcome_state := 'inconclusive';
        else
            raise exception 'observation_state_invalid';
    end case;

    insert into public.canonical_outcome_observations (
        workspace_id,
        project_id,
        outcome_id,
        task_id,
        observation_state,
        summary,
        evidence_reference_ids,
        confidence_score,
        missing_data_state,
        observed_by,
        observed_at,
        evaluated_at,
        stale_at,
        correlation_id,
        causation_id,
        idempotency_key
    )
    values (
        p_workspace_id,
        p_project_id,
        p_outcome_id,
        v_outcome.task_id,
        p_observation_state,
        btrim(p_summary),
        p_evidence_reference_ids,
        p_confidence_score,
        p_missing_data_state,
        v_actor_id,
        p_observed_at,
        p_evaluated_at,
        p_stale_at,
        btrim(p_correlation_id),
        nullif(btrim(coalesce(p_causation_id, '')), ''),
        btrim(p_idempotency_key)
    )
    returning *
    into v_observation;

    update public.canonical_task_outcomes
    set
        state = v_outcome_state,
        updated_at = now()
    where id = v_outcome.id;

    return jsonb_build_object(
        'disposition', 'created',
        'observation', to_jsonb(v_observation),
        'outcomeState', v_outcome_state,
        'learningCandidate', jsonb_build_object(
            'eventType', 'canonical_outcome_learning_candidate.v1',
            'outcomeId', v_outcome.id,
            'observationId', v_observation.id,
            'taskId', v_outcome.task_id,
            'sourceActionId', v_outcome.source_action_id,
            'evidenceReferenceIds', p_evidence_reference_ids,
            'observationState', p_observation_state,
            'confidenceScore', p_confidence_score,
            'correlationId', p_correlation_id,
            'causationId', p_causation_id,
            'occurredAt', p_observed_at,
            'recordedAt', v_observation.recorded_at
        )
    );
end;
$$;


revoke all on function public.capture_live_operational_input(
    uuid,
    uuid,
    text,
    text,
    text,
    text,
    timestamptz,
    uuid,
    uuid,
    text
) from public;

revoke all on function public.ensure_expected_task_outcome(
    uuid,
    uuid,
    uuid,
    text,
    jsonb,
    text,
    text
) from public;

revoke all on function public.record_canonical_outcome_observation(
    uuid,
    uuid,
    uuid,
    text,
    text,
    uuid[],
    numeric,
    text,
    timestamptz,
    timestamptz,
    timestamptz,
    text,
    text,
    text
) from public;


grant execute on function public.capture_live_operational_input(
    uuid,
    uuid,
    text,
    text,
    text,
    text,
    timestamptz,
    uuid,
    uuid,
    text
) to authenticated;

grant execute on function public.ensure_expected_task_outcome(
    uuid,
    uuid,
    uuid,
    text,
    jsonb,
    text,
    text
) to authenticated;

grant execute on function public.record_canonical_outcome_observation(
    uuid,
    uuid,
    uuid,
    text,
    text,
    uuid[],
    numeric,
    text,
    timestamptz,
    timestamptz,
    timestamptz,
    text,
    text,
    text
) to authenticated;


-- Direct writes remain denied to authenticated users.
revoke insert, update, delete, truncate
    on public.canonical_task_outcomes
    from authenticated;

revoke insert, update, delete, truncate
    on public.canonical_outcome_observations
    from authenticated;

grant select
    on public.canonical_task_outcomes
    to authenticated;

grant select
    on public.canonical_outcome_observations
    to authenticated;