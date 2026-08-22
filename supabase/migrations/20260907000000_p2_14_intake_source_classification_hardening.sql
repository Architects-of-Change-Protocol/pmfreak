-- ============================================================================
-- P2-14 review repair — symmetric Source classification for canonical intake.
--
-- WHAT WAS WRONG
--
-- `derive_operational_evidence` stamps `fixture_state` from exactly one fact:
-- `operational_sources.is_fixture` of the Source the Normalized Event hangs off.
-- Both capture contracts MINT that Source on first use of a key, and until now
-- only ONE of them checked what it had resolved:
--
--   * `capture_live_operational_input` refused a Source that was already a
--     fixture, but on a fresh (workspace, project, source_key) it created a NEW
--     Source with `is_fixture = false` for ANY key — including the DEMO key.
--   * `capture_operational_input` inserted its Source with `is_fixture = true`
--     `on conflict do nothing`, then re-selected WITHOUT ever checking that the
--     row it got back was actually a fixture.
--
-- Two collisions followed, both reachable by an ordinary authorized writer:
--
--   PROMOTION.  Call live intake against `manual-demo:v1` on a project that has
--   not used manual intake yet. A NON-fixture Source now exists under the DEMO
--   key. Every later DEMO capture silently reuses it, and the Evidence derived
--   from that demo material is stamped `fixture_state = 'LIVE'` — which makes it
--   Observation-eligible under P2-09 and lets demo input support an achieved
--   Outcome. This is a direct breach of DEMO_FIXTURE != LIVE.
--
--   DENIAL OF SERVICE.  The mirror. Call demo intake against
--   `live-observation:v1` on a fresh project. A FIXTURE Source now exists under
--   the LIVE key, and every genuine live capture afterwards is refused with
--   `intake_source_fixture_prohibited`. `operational_sources` has no application
--   update or supersession path and is referenced `on delete restrict`, so the
--   project is locked out of live intake without manual intervention.
--
-- WHAT THIS MIGRATION DOES
--
-- The product boundary now pins the Source key server-side, so the browser can
-- no longer name a Source at all. That alone would leave the database trusting
-- its caller, so the contract defends its own semantics independently and direct
-- RPC misuse cannot poison these identities either:
--
--   1. Each reserved key belongs to exactly one lineage. Naming the other
--      lineage's reserved key raises `intake_source_key_reserved` BEFORE any
--      Source can be minted — closing both collisions at their origin.
--   2. `capture_operational_input` now asserts the Source it resolved IS a
--      fixture (`intake_source_kind_mismatch`), mirroring the assertion live
--      intake already made. A pre-existing mismatched row is REFUSED, never
--      relabelled: the classification of a Source that already has provenance
--      hanging off it is not this contract's to rewrite.
--
-- Additive and forward-only. No schema change, no RLS or policy change, no data
-- change, no signature change: the two contracts are replaced body-for-body with
-- their guards added, and `create or replace` preserves their existing ACLs
-- (re-issued below regardless, so the grant state is explicit in this file).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Reserved intake identities.
--
-- Declarative on purpose. These two keys are the built-in lineages the product
-- exposes, and the invariant is not "a fixture source is a fixture" but "THIS
-- key means fixture and THAT key means live, whoever is asking". Expressed once
-- here, both contracts test the same statement rather than two copies of it.
-- ----------------------------------------------------------------------------
create or replace function public.reserved_intake_source_class(p_source_key text)
returns text
language sql
immutable
as $$
    select case nullif(trim(coalesce(p_source_key, '')), '')
        when 'manual-demo:v1' then 'FIXTURE'
        when 'live-observation:v1' then 'LIVE'
        else null
    end;
$$;

revoke all on function public.reserved_intake_source_class(text) from public;
grant execute on function public.reserved_intake_source_class(text) to authenticated;

comment on function public.reserved_intake_source_class(text) is
    'Lineage a reserved built-in intake source key belongs to (FIXTURE | LIVE), or null for a caller-defined key. The two lineages may never write against each other''s reserved identity.';

-- ----------------------------------------------------------------------------
-- DEMO / FIXTURE intake — body unchanged except for the two guards marked
-- `P2-14 repair`.
-- ----------------------------------------------------------------------------
create or replace function public.capture_operational_input(
  p_workspace_id uuid, p_project_id uuid, p_source_key text, p_idempotency_key text,
  p_title text, p_content text, p_occurred_at timestamptz, p_correlation_id uuid,
  p_causation_id uuid default null, p_external_id text default null
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_actor uuid := auth.uid();
  v_source public.operational_sources;
  v_raw public.operational_raw_inputs;
  v_event public.operational_normalized_events;
  v_payload jsonb;
  v_raw_digest text;
  v_event_digest text;
  v_duplicate boolean := false;
  v_audit_id uuid;
begin
  if v_actor is null then raise exception 'intake_unauthenticated'; end if;
  if not public.can_write_operational_project(p_workspace_id, p_project_id) then raise exception 'intake_access_denied'; end if;
  if nullif(trim(p_title), '') is null or nullif(trim(p_content), '') is null then raise exception 'intake_malformed'; end if;
  if p_occurred_at > now() + interval '5 minutes' then raise exception 'intake_occurred_at_invalid'; end if;

  -- P2-14 repair. Refused before the insert, so the fixture lineage can never MINT a
  -- fixture Source under the reserved LIVE key and lock the project out of live intake.
  if public.reserved_intake_source_class(p_source_key) = 'LIVE' then
    raise exception 'intake_source_key_reserved';
  end if;

  insert into public.operational_sources(workspace_id, project_id, source_key, source_kind, display_name, status, is_fixture, fixture_label, fixture_expires_when, created_by)
  values (p_workspace_id, p_project_id, p_source_key, 'manual_demo', 'Manual demo submission', 'active', true, 'DEMO / FIXTURE', array['P2-04','P2-13','P2-17'], v_actor)
  on conflict (workspace_id, project_id, source_key) do nothing;
  select * into v_source from public.operational_sources
    where workspace_id=p_workspace_id and project_id=p_project_id and source_key=p_source_key;

  -- P2-14 repair. The insert above is `do nothing`, so on conflict this SELECT returns
  -- whatever Source already holds the key — which is NOT necessarily a fixture. Without
  -- this assertion a pre-existing non-fixture Source was silently adopted and the Evidence
  -- derived from demo material came out `fixture_state = 'LIVE'`. Mirrors the assertion
  -- live intake already makes. The row is refused, never relabelled.
  if v_source.id is null then raise exception 'intake_source_creation_failed'; end if;
  if not v_source.is_fixture then raise exception 'intake_source_kind_mismatch'; end if;

  case v_source.status
    when 'degraded' then raise exception 'intake_source_degraded';
    when 'stale' then raise exception 'intake_source_stale';
    when 'unavailable' then raise exception 'intake_source_unavailable';
    when 'revoked' then raise exception 'intake_source_revoked';
    else null;
  end case;

  v_payload := jsonb_build_object('title', trim(p_title), 'content', trim(p_content));
  v_raw_digest := 'sha256:' || encode(extensions.digest(convert_to(v_payload::text, 'UTF8'), 'sha256'), 'hex');
  insert into public.operational_raw_inputs(workspace_id,project_id,source_id,external_id,idempotency_key,payload,content_digest,status,occurred_at,actor_user_id,correlation_id,causation_id,provenance)
  values(p_workspace_id,p_project_id,v_source.id,nullif(trim(p_external_id),''),trim(p_idempotency_key),v_payload,v_raw_digest,'received',p_occurred_at,v_actor,p_correlation_id,p_causation_id,
    jsonb_build_object('sourceId',v_source.id,'sourceKey',v_source.source_key,'capturedBy',v_actor,'fixtureLabel',v_source.fixture_label))
  on conflict (source_id,idempotency_key) do nothing returning * into v_raw;
  if v_raw.id is null then
    v_duplicate := true;
    select * into v_raw from public.operational_raw_inputs where source_id=v_source.id and idempotency_key=trim(p_idempotency_key);
    if v_raw.content_digest <> v_raw_digest then raise exception 'intake_idempotency_conflict'; end if;
  end if;

  v_event_digest := 'sha256:' || encode(extensions.digest(convert_to(jsonb_build_object('eventType','manual_input.submitted','schemaVersion',1,'rawDigest',v_raw.content_digest,'payload',v_payload)::text,'UTF8'),'sha256'),'hex');
  insert into public.operational_normalized_events(workspace_id,project_id,source_id,raw_input_id,event_type,schema_version,normalizer_key,subject_type,subject_id,event_payload,event_digest,status,occurred_at,actor_user_id,correlation_id,causation_id,provenance)
  values(p_workspace_id,p_project_id,v_source.id,v_raw.id,'manual_input.submitted',1,'pmfreak/manual-input-normalizer:v1','project',p_project_id,v_payload,v_event_digest,'accepted',p_occurred_at,v_actor,p_correlation_id,v_raw.id,
    jsonb_build_object('sourceId',v_source.id,'rawInputId',v_raw.id,'rawDigest',v_raw.content_digest,'normalizer','pmfreak/manual-input-normalizer:v1'))
  on conflict (raw_input_id,event_type,schema_version) do nothing returning * into v_event;
  if v_event.id is null then select * into v_event from public.operational_normalized_events where raw_input_id=v_raw.id and event_type='manual_input.submitted' and schema_version=1; end if;

  if not v_duplicate then
    insert into public.platform_events(workspace_id,project_id,actor_id,actor_type,event_type,event_category,event_payload,source,correlation_id,causation_id,visibility,sensitivity_level,learning_eligible,raw_reference_table,raw_reference_id,metadata,occurred_at)
    values(p_workspace_id,p_project_id,v_actor,'user','NORMALIZED_EVENT_RECORDED','provenance',jsonb_build_object('eventId',v_event.id,'eventType',v_event.event_type,'schemaVersion',v_event.schema_version,'eventDigest',v_event.event_digest),'user_action',p_correlation_id,null,'project','internal',false,'operational_raw_inputs',v_raw.id,jsonb_build_object('sourceId',v_source.id,'normalizerKey',v_event.normalizer_key),p_occurred_at)
    returning id into v_audit_id;
  end if;

  return jsonb_build_object('disposition',case when v_duplicate then 'duplicate' else 'created' end,'source',to_jsonb(v_source),'rawInput',to_jsonb(v_raw),'normalizedEvent',to_jsonb(v_event),'auditEventId',v_audit_id,'evidenceCreated',false);
end $$;

revoke all on function public.capture_operational_input(uuid,uuid,text,text,text,text,timestamptz,uuid,uuid,text) from public;
grant execute on function public.capture_operational_input(uuid,uuid,text,text,text,text,timestamptz,uuid,uuid,text) to authenticated;

comment on function public.capture_operational_input(uuid,uuid,text,text,text,text,timestamptz,uuid,uuid,text) is
    'DEMO / FIXTURE canonical intake. Writes only against a Source whose persisted classification is fixture, and never against the reserved LIVE identity.';

-- ----------------------------------------------------------------------------
-- LIVE intake — body unchanged except for the guard marked `P2-14 repair`.
-- ----------------------------------------------------------------------------
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

    -- P2-14 repair. Refused before the Source is resolved, so live intake can never MINT a
    -- non-fixture Source under the reserved DEMO key. Without this, the DEMO key could be
    -- claimed as a connector Source and every later demo capture would inherit it, deriving
    -- `fixture_state = 'LIVE'` from demo material. The existing fixture refusals below only
    -- catch the case where a fixture Source ALREADY exists; this catches the fresh project,
    -- which is exactly where the collision was reachable.
    if public.reserved_intake_source_class(p_source_key) = 'FIXTURE' then
        raise exception 'intake_source_key_reserved';
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

comment on function public.capture_live_operational_input(uuid,uuid,text,text,text,text,timestamptz,uuid,uuid,text) is
    'LIVE canonical intake. Writes only against a Source whose persisted classification is non-fixture, and never against the reserved DEMO / FIXTURE identity.';
