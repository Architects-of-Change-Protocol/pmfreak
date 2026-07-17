-- Two data-integrity fixes that belong to 20260828000001 (the
-- Workspace → PMO → Project hierarchy migration) but must ship here
-- instead: that migration already merged to main and is recorded as
-- applied by migration runners on any database that ran it — editing its
-- SQL content after the fact is a no-op on those upgraded databases (the
-- runner only checks whether the filename ran, never diffs content), so a
-- new file is the only way these fixes actually reach them.
--
-- 1. Tighten context_conversations' scope-shape CHECK constraint so a
--    project-scoped row can never carry a non-null pmo_id. The scope-unique
--    index keys on (workspace_id, context_type, pmo_id, project_id): a
--    project-scoped row with a non-null pmo_id would no longer collide with
--    the pmo_id-less row for the same project on that index, letting two
--    "active" conversations exist for one project — silently fragmenting
--    its chat thread. The one real writer (getOrCreateConversation) never
--    sets pmo_id for project scope; this makes that invariant hold at the
--    schema level regardless of any future caller. No existing row can
--    violate this in practice (no writer ever sets it), but the cleanup
--    below makes the ALTER safe even if one somehow does.
--
-- 2. Add a BEFORE INSERT/UPDATE trigger binding context_messages.workspace_id
--    to its own conversation_id's real workspace_id — the same class of gap
--    already closed for projects.pmo_id/context_conversations.pmo_id in
--    20260828000001. context_messages.workspace_id is caller-supplied
--    (appendMessage takes it as a plain parameter) with no FK enforcing it
--    matches the conversation it's attached to; RLS only checks the
--    message's own workspace_id, so a direct Supabase call or future write
--    path pairing a workspace-A conversation id with workspace-B's
--    workspace_id would create a row readable/manageable by workspace B
--    under workspace A's conversation. The application layer already
--    derives workspace_id correctly, so the sanctioned API surface is safe;
--    this trigger closes the same gap at the database layer for any other
--    caller.
-- ─────────────────────────────────────────────────────────────────────────────

update context_conversations
set pmo_id = null
where context_type = 'project' and pmo_id is not null;

alter table context_conversations
  drop constraint if exists context_conversations_scope_shape;

alter table context_conversations
  add constraint context_conversations_scope_shape check (
    (context_type = 'workspace' and pmo_id is null and project_id is null)
    or (context_type = 'pmo' and pmo_id is not null and project_id is null)
    or (context_type = 'project' and project_id is not null and pmo_id is null)
  );

create or replace function enforce_context_message_same_workspace() returns trigger as $$
begin
  if (select workspace_id from context_conversations where id = new.conversation_id) is distinct from new.workspace_id then
    raise exception 'context_messages.workspace_id must match its conversation''s workspace (message workspace %, conversation %)', new.workspace_id, new.conversation_id
      using errcode = '23514';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists context_messages_same_workspace on context_messages;
create trigger context_messages_same_workspace
  before insert or update of conversation_id, workspace_id on context_messages
  for each row execute function enforce_context_message_same_workspace();
