// CERTIFIED PLATFORM AUTHORIZATION PROFILES.
//
// Remediations 28 through 35 certified what the database CONTAINS -- managed objects,
// extension provenance, schema ownership and ACLs. None of them read the authorization
// plane that decides WHO may act on any of it. `pg_roles`, `pg_auth_members` and the
// current database's own owner and ACL were read nowhere, so a target could carry
// role-level authorization drift while every certified object surface stayed exact stock.
//
// Concretely, and reproduced rather than inferred: `ALTER ROLE service_role LOGIN` turns a
// role that exists only to be assumed through `authenticator` into one that can open its
// own session, and it moves no object fingerprint at all. PostgreSQL permits a CREATEROLE
// holder with ADMIN OPTION over a non-superuser, non-replication role to make exactly this
// change, and the hosted platform grants `postgres` both.
//
// WHAT BINDS. A profile carries three things that are certified TOGETHER:
//
//   ROLE|rolname|super|inherit|createrole|createdb|canlogin|replication|connlimit|bypassrls|validuntil
//   MEMBER|granted|member|grantor|admin|inherit|set
//   DB|datname|owner|aclstate=...|acl=...
//
// Every role in the cluster, not a name-prefixed subset: the PostgreSQL predefined `pg_*`
// roles carry real privilege and their membership edges are how that privilege reaches a
// platform role. PostgreSQL 17 records ADMIN, INHERIT and SET independently on every
// membership edge, and each is security-semantic on its own, so all three bind -- an edge
// is never reduced to "member = yes". The database's owner and ACL are in the SAME profile
// as the roles, so a local role graph beside a hosted database ACL is refused.
//
// NO CREDENTIAL MATERIAL. `rolpassword` is never selected, stored, logged or digested.
// Neither are SCRAM/MD5 verifiers, connection passwords, JWT secrets, service keys or API
// tokens. Certification is over authorization STRUCTURE and non-secret attributes only, so
// a routine password rotation can never look like platform drift.
//
// `validuntil` carries the semantic value: "infinity" when the catalog holds NULL (the
// role never expires), otherwise the exact timestamp, so gaining an expiry is drift.
//
// Every field is stored as the STRING the probe emits, never as a JS boolean. A boolean
// `true` and the string "true" render identically through the serializer, so allowing both
// would make a type confusion invisible and let a hand-edited fixture disagree with the
// wire while still digesting the same.
//
// The digest is a sha256 over the canonical lines above, stable-sorted, joined with one LF
// and no trailing LF. It is verified at module load, so a hand-edited entry fails closed
// rather than silently widening what counts as stock.

import { createHash } from "node:crypto";

export const STOCK_AUTHORIZATION_PROFILES = Object.freeze([
  Object.freeze({
    id: "local-cli-stock",
    source: "Supabase CLI local development stack (supabase start), pristine, zero migrations",
    capturedAt: "2026-09-05",
    server: "PostgreSQL 17.6 on x86_64-pc-linux-gnu",
    cli: "v2.116.0",
    roleCount: 31,
    membershipCount: 25,
    digest: "5606507490ce723951a6c66fec66cc139d7d5a5b7ef5b71911527347026f8ec5",
    roles: Object.freeze([
      { rolname: "anon", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "authenticated", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "authenticator", super: "false", inherit: "false", createrole: "false", createdb: "false", canlogin: "true", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "dashboard_user", super: "false", inherit: "true", createrole: "true", createdb: "true", canlogin: "false", replication: "true", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pg_checkpoint", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pg_create_subscription", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pg_database_owner", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pg_execute_server_program", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pg_maintain", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pg_monitor", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pg_read_all_data", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pg_read_all_settings", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pg_read_all_stats", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pg_read_server_files", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pg_signal_backend", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pg_stat_scan_tables", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pg_use_reserved_connections", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pg_write_all_data", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pg_write_server_files", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pgbouncer", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "true", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "postgres", super: "false", inherit: "true", createrole: "true", createdb: "true", canlogin: "true", replication: "true", connlimit: "-1", bypassrls: "true", validuntil: "infinity" },
      { rolname: "service_role", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "true", validuntil: "infinity" },
      { rolname: "supabase_admin", super: "true", inherit: "true", createrole: "true", createdb: "true", canlogin: "true", replication: "true", connlimit: "-1", bypassrls: "true", validuntil: "infinity" },
      { rolname: "supabase_auth_admin", super: "false", inherit: "false", createrole: "true", createdb: "false", canlogin: "true", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "supabase_etl_admin", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "true", replication: "true", connlimit: "-1", bypassrls: "true", validuntil: "infinity" },
      { rolname: "supabase_functions_admin", super: "false", inherit: "false", createrole: "true", createdb: "false", canlogin: "true", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "supabase_privileged_role", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "supabase_read_only_user", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "true", replication: "false", connlimit: "-1", bypassrls: "true", validuntil: "infinity" },
      { rolname: "supabase_realtime_admin", super: "false", inherit: "false", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "supabase_replication_admin", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "true", replication: "true", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "supabase_storage_admin", super: "false", inherit: "false", createrole: "true", createdb: "false", canlogin: "true", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
    ]),
    memberships: Object.freeze([
      { granted: "anon", member: "authenticator", grantor: "supabase_admin", admin: "false", inherit: "false", set: "true" },
      { granted: "anon", member: "postgres", grantor: "supabase_admin", admin: "true", inherit: "true", set: "true" },
      { granted: "anon", member: "supabase_realtime_admin", grantor: "supabase_admin", admin: "false", inherit: "false", set: "true" },
      { granted: "authenticated", member: "authenticator", grantor: "supabase_admin", admin: "false", inherit: "false", set: "true" },
      { granted: "authenticated", member: "postgres", grantor: "supabase_admin", admin: "true", inherit: "true", set: "true" },
      { granted: "authenticated", member: "supabase_realtime_admin", grantor: "supabase_admin", admin: "false", inherit: "false", set: "true" },
      { granted: "authenticator", member: "postgres", grantor: "supabase_admin", admin: "true", inherit: "true", set: "true" },
      { granted: "authenticator", member: "supabase_storage_admin", grantor: "supabase_admin", admin: "false", inherit: "false", set: "true" },
      { granted: "pg_create_subscription", member: "postgres", grantor: "supabase_admin", admin: "true", inherit: "true", set: "true" },
      { granted: "pg_monitor", member: "postgres", grantor: "supabase_admin", admin: "true", inherit: "true", set: "true" },
      { granted: "pg_monitor", member: "supabase_etl_admin", grantor: "supabase_admin", admin: "false", inherit: "true", set: "true" },
      { granted: "pg_monitor", member: "supabase_read_only_user", grantor: "supabase_admin", admin: "false", inherit: "true", set: "true" },
      { granted: "pg_read_all_data", member: "postgres", grantor: "supabase_admin", admin: "true", inherit: "true", set: "true" },
      { granted: "pg_read_all_data", member: "supabase_etl_admin", grantor: "supabase_admin", admin: "false", inherit: "true", set: "true" },
      { granted: "pg_read_all_data", member: "supabase_read_only_user", grantor: "supabase_admin", admin: "false", inherit: "true", set: "true" },
      { granted: "pg_read_all_settings", member: "pg_monitor", grantor: "supabase_admin", admin: "false", inherit: "true", set: "true" },
      { granted: "pg_read_all_stats", member: "pg_monitor", grantor: "supabase_admin", admin: "false", inherit: "true", set: "true" },
      { granted: "pg_signal_backend", member: "postgres", grantor: "supabase_admin", admin: "true", inherit: "true", set: "true" },
      { granted: "pg_stat_scan_tables", member: "pg_monitor", grantor: "supabase_admin", admin: "false", inherit: "true", set: "true" },
      { granted: "service_role", member: "authenticator", grantor: "supabase_admin", admin: "false", inherit: "false", set: "true" },
      { granted: "service_role", member: "postgres", grantor: "supabase_admin", admin: "true", inherit: "true", set: "true" },
      { granted: "service_role", member: "supabase_realtime_admin", grantor: "supabase_admin", admin: "false", inherit: "false", set: "true" },
      { granted: "supabase_functions_admin", member: "postgres", grantor: "supabase_admin", admin: "false", inherit: "true", set: "true" },
      { granted: "supabase_privileged_role", member: "postgres", grantor: "supabase_admin", admin: "false", inherit: "true", set: "true" },
      { granted: "supabase_privileged_role", member: "supabase_etl_admin", grantor: "supabase_admin", admin: "false", inherit: "true", set: "true" },
    ]),
    database: Object.freeze({ name: "postgres", owner: "postgres", acl: "aclstate=explicit|acl==Tc/postgres,dashboard_user=CTc/postgres,postgres=CTc/postgres,supabase_etl_admin=C/postgres,supabase_storage_admin=C/postgres" }),
  }),
  // THE HOSTED PLATFORM, captured read-only from the validation project and reconstructed
  // strictly from that capture -- never derived from the local profile, which it provably
  // does not match: 30 roles against local's 31, 21 membership edges against local's 25.
  //
  // The hosted surface is a strict SUBSET of the local one. `supabase_functions_admin` is
  // local-only, and so are the four edges that role and `supabase_realtime_admin` carry
  // (anon, authenticated and service_role granted to supabase_realtime_admin, and
  // supabase_functions_admin granted to postgres). No role and no edge exists on hosted
  // that local lacks, and every role attribute they share is identical.
  //
  // The two platforms' DATABASE records are BYTE-IDENTICAL -- same owner, same explicit
  // ACL. That is a measured fact about these two platforms, not a weakness in the control:
  // a surface carrying local roles beside this database record IS the complete local
  // surface, indistinguishable from it on content, and content is the only authority here.
  // The anti-Frankenstein rule is therefore stated exactly: a surface may be certified only
  // when it equals ONE certified profile in full. Mixing components across profiles is
  // refused whenever the mixed components differ, and is a no-op where they coincide.
  Object.freeze({
    id: "hosted-platform-stock",
    source: "hosted Supabase validation project (independent read-only capture)",
    capturedAt: "2026-09-05",
    server: "PostgreSQL 17.6 (hosted platform image 17.6.1.141)",
    cli: null,
    roleCount: 30,
    membershipCount: 21,
    digest: "4aaa2140a8cbf26d4ebff4c812a9e634b8d9e450158fdd75222d82e167b9a9e5",
    roles: Object.freeze([
      { rolname: "anon", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "authenticated", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "authenticator", super: "false", inherit: "false", createrole: "false", createdb: "false", canlogin: "true", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "dashboard_user", super: "false", inherit: "true", createrole: "true", createdb: "true", canlogin: "false", replication: "true", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pg_checkpoint", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pg_create_subscription", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pg_database_owner", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pg_execute_server_program", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pg_maintain", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pg_monitor", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pg_read_all_data", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pg_read_all_settings", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pg_read_all_stats", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pg_read_server_files", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pg_signal_backend", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pg_stat_scan_tables", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pg_use_reserved_connections", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pg_write_all_data", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pg_write_server_files", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "pgbouncer", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "true", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "postgres", super: "false", inherit: "true", createrole: "true", createdb: "true", canlogin: "true", replication: "true", connlimit: "-1", bypassrls: "true", validuntil: "infinity" },
      { rolname: "service_role", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "true", validuntil: "infinity" },
      { rolname: "supabase_admin", super: "true", inherit: "true", createrole: "true", createdb: "true", canlogin: "true", replication: "true", connlimit: "-1", bypassrls: "true", validuntil: "infinity" },
      { rolname: "supabase_auth_admin", super: "false", inherit: "false", createrole: "true", createdb: "false", canlogin: "true", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "supabase_etl_admin", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "true", replication: "true", connlimit: "-1", bypassrls: "true", validuntil: "infinity" },
      { rolname: "supabase_privileged_role", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "supabase_read_only_user", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "true", replication: "false", connlimit: "-1", bypassrls: "true", validuntil: "infinity" },
      { rolname: "supabase_realtime_admin", super: "false", inherit: "false", createrole: "false", createdb: "false", canlogin: "false", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "supabase_replication_admin", super: "false", inherit: "true", createrole: "false", createdb: "false", canlogin: "true", replication: "true", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
      { rolname: "supabase_storage_admin", super: "false", inherit: "false", createrole: "true", createdb: "false", canlogin: "true", replication: "false", connlimit: "-1", bypassrls: "false", validuntil: "infinity" },
    ]),
    memberships: Object.freeze([
      { granted: "anon", member: "authenticator", grantor: "supabase_admin", admin: "false", inherit: "false", set: "true" },
      { granted: "anon", member: "postgres", grantor: "supabase_admin", admin: "true", inherit: "true", set: "true" },
      { granted: "authenticated", member: "authenticator", grantor: "supabase_admin", admin: "false", inherit: "false", set: "true" },
      { granted: "authenticated", member: "postgres", grantor: "supabase_admin", admin: "true", inherit: "true", set: "true" },
      { granted: "authenticator", member: "postgres", grantor: "supabase_admin", admin: "true", inherit: "true", set: "true" },
      { granted: "authenticator", member: "supabase_storage_admin", grantor: "supabase_admin", admin: "false", inherit: "false", set: "true" },
      { granted: "pg_create_subscription", member: "postgres", grantor: "supabase_admin", admin: "true", inherit: "true", set: "true" },
      { granted: "pg_monitor", member: "postgres", grantor: "supabase_admin", admin: "true", inherit: "true", set: "true" },
      { granted: "pg_monitor", member: "supabase_etl_admin", grantor: "supabase_admin", admin: "false", inherit: "true", set: "true" },
      { granted: "pg_monitor", member: "supabase_read_only_user", grantor: "supabase_admin", admin: "false", inherit: "true", set: "true" },
      { granted: "pg_read_all_data", member: "postgres", grantor: "supabase_admin", admin: "true", inherit: "true", set: "true" },
      { granted: "pg_read_all_data", member: "supabase_etl_admin", grantor: "supabase_admin", admin: "false", inherit: "true", set: "true" },
      { granted: "pg_read_all_data", member: "supabase_read_only_user", grantor: "supabase_admin", admin: "false", inherit: "true", set: "true" },
      { granted: "pg_read_all_settings", member: "pg_monitor", grantor: "supabase_admin", admin: "false", inherit: "true", set: "true" },
      { granted: "pg_read_all_stats", member: "pg_monitor", grantor: "supabase_admin", admin: "false", inherit: "true", set: "true" },
      { granted: "pg_signal_backend", member: "postgres", grantor: "supabase_admin", admin: "true", inherit: "true", set: "true" },
      { granted: "pg_stat_scan_tables", member: "pg_monitor", grantor: "supabase_admin", admin: "false", inherit: "true", set: "true" },
      { granted: "service_role", member: "authenticator", grantor: "supabase_admin", admin: "false", inherit: "false", set: "true" },
      { granted: "service_role", member: "postgres", grantor: "supabase_admin", admin: "true", inherit: "true", set: "true" },
      { granted: "supabase_privileged_role", member: "postgres", grantor: "supabase_admin", admin: "false", inherit: "true", set: "true" },
      { granted: "supabase_privileged_role", member: "supabase_etl_admin", grantor: "supabase_admin", admin: "false", inherit: "true", set: "true" },
    ]),
    database: Object.freeze({ name: "postgres", owner: "postgres", acl: "aclstate=explicit|acl==Tc/postgres,dashboard_user=CTc/postgres,postgres=CTc/postgres,supabase_etl_admin=C/postgres,supabase_storage_admin=C/postgres" }),
  }),
]);

// FAIL CLOSED AT LOAD. A profile is only evidence while it is the evidence that was
// certified: the digest is recomputed here, so a hand-edited entry throws before the gate
// can certify anything against it.
for (const profile of STOCK_AUTHORIZATION_PROFILES) {
  if (profile.roles.length !== profile.roleCount || profile.memberships.length !== profile.membershipCount) {
    throw new Error(`certified authorization profile ${profile.id} miscounts its own contents`);
  }
  // Every certified field must be a non-empty STRING. A boolean and its string render
  // identically through the serializer, so a type slip would digest the same while making
  // the fixture disagree with the wire the probe actually produces.
  for (const [kind, record, fields] of [
    ...profile.roles.map((r) => ["role", r, ["rolname", "super", "inherit", "createrole", "createdb", "canlogin", "replication", "connlimit", "bypassrls", "validuntil"]]),
    ...profile.memberships.map((m) => ["membership", m, ["granted", "member", "grantor", "admin", "inherit", "set"]]),
    ["database", profile.database, ["name", "owner", "acl"]],
  ]) {
    for (const key of fields) {
      if (typeof record?.[key] !== "string" || record[key].trim() === "") {
        throw new Error(`certified authorization profile ${profile.id} carries a non-string or empty ${kind} field ${key}`);
      }
    }
  }
  const lines = authorizationStateLines(profile);
  if (new Set(lines).size !== lines.length) {
    throw new Error(`certified authorization profile ${profile.id} carries a duplicate record`);
  }
  const digest = createHash("sha256").update([...lines].sort().join("\n"), "utf8").digest("hex");
  if (digest !== profile.digest) {
    throw new Error(
      `certified authorization profile ${profile.id} does not match its certified digest (computed ${digest}, expected ${profile.digest}). ` +
      "Re-certify it from a known-stock capture; do not adjust the digest to match an edit.",
    );
  }
}

/** The canonical, order-independent lines an authorization profile is compared on. */
export function authorizationStateLines(state) {
  return [
    ...(state.roles ?? []).map((r) =>
      `ROLE|${r.rolname}|${r.super}|${r.inherit}|${r.createrole}|${r.createdb}|${r.canlogin}|${r.replication}|${r.connlimit}|${r.bypassrls}|${r.validuntil}`),
    ...(state.memberships ?? []).map((m) =>
      `MEMBER|${m.granted}|${m.member}|${m.grantor}|${m.admin}|${m.inherit}|${m.set}`),
    ...(state.database ? [`DB|${state.database.name}|${state.database.owner}|${state.database.acl}`] : []),
  ];
}

/** The documented whole-profile digest: canonical lines, stable-sorted, LF, no trailing LF. */
export function authorizationProfileDigest(state) {
  return createHash("sha256").update(authorizationStateLines(state).sort().join("\n"), "utf8").digest("hex");
}
