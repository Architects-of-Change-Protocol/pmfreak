# Backup / Restore Drill — Pilot Gate Sprint 01 (RR-BACKUP evidence)

Date: 2026-07-15 (session clock). Executed against the fully-migrated
PostgreSQL 16.13 database from
[`pilot-gate-migration-proof.md`](./pilot-gate-migration-proof.md)
(409 tables, RLS-seeded two-workspace dataset).

## Current backup posture (documented)

- **Hosted (target for pilot)**: Supabase daily automated backups on all
  paid tiers; PITR is a Pro-tier add-on. **Tier/PITR status of the actual
  pilot project is UNCONFIRMED** — no hosted project/credentials exist in
  this environment. This is the sole remaining item for RR-BACKUP.
- **Logical backup path (rehearsed here)**: `pg_dump -Fc` → `pg_restore`
  to a scratch database. This is also the documented operator path for
  ad-hoc pre-migration snapshots and the RR-EXPORT operator commitment.

## Drill procedure (reproducible)

```bash
# 1. Capture pre-backup integrity state (10 metrics incl. data checksum)
psql -d pmfreak_fresh -f <state-capture.sql>   # see below
# 2. Timed logical backup
time pg_dump -h <host> -U postgres -d pmfreak_fresh -Fc -f pmfreak_fresh.dump
# 3. Timed restore to a scratch database
createdb pmfreak_restore_drill
time pg_restore -d pmfreak_restore_drill --no-owner pmfreak_fresh.dump
# 4. Re-capture state on the restored DB and diff
# 5. Re-run RLS spot-checks on the restored DB
```

State capture: public table count, RLS-enabled table count, policy count,
FK count, index count, row counts (workspaces / projects / memberships /
auth.users), and an md5 checksum over workspace ids+names.

## Measured results

| Metric | Value |
| --- | --- |
| Backup (pg_dump -Fc, 409-table schema + seed data) | **0.35 s**, 2.7 MB dump |
| Restore (pg_restore, full schema + data) | **13.5 s**, exit 0, **zero warnings** |
| Integrity diff (10 metrics pre vs post) | **IDENTICAL** (including data checksum `84101f51…`) |
| RLS on restored DB | Enforced — user A sees own workspace (1), foreign workspace (0), foreign project (0) |

Schema-only durations scale with data volume; the numbers above are the
empty-pilot baseline. Re-run the drill once pilot data exists to get a
realistic RTO envelope.

## RPO / RTO statement

- **RPO (logical path)**: equals dump cadence — on-demand today, so RPO is
  operator-defined. For the pilot: take a dump before every migration deploy
  and at least daily (runbook step added). Hosted daily backups give ≤24 h;
  PITR (if enabled on the pilot project) gives ~2 min granularity.
- **RTO (measured)**: 13.5 s restore on the empty-pilot dataset + operator
  time. Pilot-scale estimate: minutes, not hours. Hosted-restore RTO is
  Supabase-managed and must be confirmed with the tier check below.

## Consistency validation

- `pg_restore` completed with zero errors/warnings.
- All 854 RLS policies present post-restore; RLS behavior re-verified live.
- Row counts and the content checksum match exactly.

## Remaining to close RR-BACKUP (operator step, ~15 min once hosted project exists)

1. Confirm the pilot Supabase project's backup tier; enable PITR if the
   budget allows (recommended for real partner data).
2. Perform one hosted restore rehearsal to a scratch project (dashboard
   restore or `supabase db dump` + restore) and record its timings in this
   document.
3. Then — and only then — move RR-BACKUP to Closed in the risk register.
