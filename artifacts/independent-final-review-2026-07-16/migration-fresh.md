# Fresh Database Migration — Independent Re-Verification

Executed against a genuinely fresh local PostgreSQL 16 database
(`pmfreak_fresh_v2`, created in this review session, not reused from the
prior sprint) using the repository's own checker script.

```
$ psql -h 127.0.0.1 -p 54329 -U postgres -c "create database pmfreak_fresh_v2"
$ psql ... -d pmfreak_fresh_v2 -f <supabase-environment-shim>.sql   # auth/storage schema stubs, mirrors docs/release/fresh-database-migration-proof.md
$ FRESH_DB_URL="postgresql://postgres@127.0.0.1:54329/pmfreak_fresh_v2" \
  ALLOW_DESTRUCTIVE_FRESH_DB_TEST=true \
  node scripts/check-fresh-db-migrations.mjs

PMFreak Fresh Database Migration Proof
Mode: local
Migration files discovered: 149
[apply:local] target: postgresql://[redacted]@127...[redacted]
  Tables in public schema: 413
  Tables without RLS enabled: 1

Environment safety........ PASS
Migration inventory....... PASS
Migration ordering........ PASS
Fresh apply............... PASS
Schema contracts.......... PASS
Decision.................. PASS
```

## Additional independent checks (not part of the checker script)

```sql
select n.nspname||'.'||c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;
```
→ `public.agent_attestation_nonces` only — a pre-existing nonce table
unrelated to this refactor (confirmed: not touched by this branch's diff).

```sql
select tgname, tgrelid::regclass from pg_trigger where tgname like '%same_workspace%';
```
→
```
 projects_pmo_same_workspace          | projects
 context_conversations_same_workspace | context_conversations
```
Both cross-workspace-consistency triggers present and correctly attached.

```
\d pmos   -- Policies: "workspace managers can manage pmos", "workspace members can read pmos" — present
```

## Verdict

**Pass.** Zero migration errors across all 149 files, zero manual
intervention required, all governance/RLS/trigger objects present at the
schema level. Reproduced independently of, and consistent with, the prior
sprint's own fresh-apply evidence.
