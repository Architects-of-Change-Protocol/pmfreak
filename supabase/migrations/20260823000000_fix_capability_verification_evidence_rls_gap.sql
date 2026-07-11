-- Fresh-database migration proof (Perilla 13) found that
-- capability_verification_snapshots, capability_verification_receipts, and
-- capability_verification_audit_records (created in
-- 20260512120000_deterministic_verification_phase_6_4.sql) were never given
-- row level security or an explicit grant restriction. On a real Supabase
-- project, anon/authenticated normally receive table-level grants on public
-- schema tables by default, so these tables were readable by any
-- anon/authenticated caller with no RLS check. No runtime code reads or
-- writes these tables today (append-only verification evidence, service-role
-- concern only), so this restricts access to service_role without changing
-- any observed application behavior. Idempotent and safe on both fresh and
-- existing databases.

alter table public.capability_verification_snapshots enable row level security;
alter table public.capability_verification_receipts enable row level security;
alter table public.capability_verification_audit_records enable row level security;

revoke all on public.capability_verification_snapshots from anon, authenticated;
revoke all on public.capability_verification_receipts from anon, authenticated;
revoke all on public.capability_verification_audit_records from anon, authenticated;
