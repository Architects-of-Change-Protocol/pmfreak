-- Local fresh-replay compatibility only. Supabase CLI loads roles.sql before
-- versioned migrations when it initializes or resets the disposable database.
--
-- Historical migration 20260611000000 fixes its function search_path to
-- `public` and calls digest(text, text), while current local Supabase images
-- install pgcrypto in `extensions`. This bridge lets an empty disposable local
-- database replay immutable history without inserting a backdated migration
-- into the deployment ledger. Hosted migration deployment does not execute
-- this local roles bootstrap; the only forward P2-03 migration is 20260901000000.
create extension if not exists pgcrypto with schema extensions;

create or replace function public.digest(p_data text, p_type text)
returns bytea
language sql
immutable
strict
set search_path = pg_catalog, extensions
as $$ select extensions.digest(convert_to(p_data, 'UTF8'), p_type) $$;

revoke all on function public.digest(text, text) from public;
grant execute on function public.digest(text, text) to authenticated, service_role;
