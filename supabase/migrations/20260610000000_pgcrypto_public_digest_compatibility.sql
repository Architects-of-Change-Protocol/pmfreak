-- Fresh Supabase installs place pgcrypto in `extensions`. The following
-- historical migration intentionally restricts function search_path to public,
-- so provide the legacy signature without rewriting recorded migration history.
create or replace function public.digest(p_data text, p_type text)
returns bytea
language sql
immutable
strict
set search_path = pg_catalog, extensions
as $$ select extensions.digest(convert_to(p_data, 'UTF8'), p_type) $$;

revoke all on function public.digest(text, text) from public;
grant execute on function public.digest(text, text) to authenticated, service_role;
