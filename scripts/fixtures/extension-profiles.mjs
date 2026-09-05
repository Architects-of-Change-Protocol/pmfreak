// CERTIFIED EXTENSION PROFILES.
//
// name/version/schema is not provenance. PostgreSQL lets the owner of an extension attach
// an existing object to it WITHOUT changing the extension version, so a custom application
// object can acquire extension membership and disappear from every inventory that treats
// membership as platform provenance. A certified member can also be altered in place --
// gaining SECURITY DEFINER, say -- with its extension, version and membership untouched.
// Both were reproduced on a disposable scratch PostgreSQL 17 before this file existed.
//
// A profile therefore binds three things together, and a target must match ONE profile in
// FULL: the extension installation metadata, the COMPLETE membership graph (every
// pg_depend deptype 'e' edge, in whatever schema), and the exact structure of every member.
// Never a per-extension, per-member or per-field union across profiles.
//
// DIGEST. Canonical lines, stable-sorted, joined with one LF, no trailing LF, SHA-256 over
// the UTF-8 bytes, lowercase hex:
//
//   EXT|name|version|schema|owner|relocatable|config|condition
//   MEM|extname|classCatalog|objectType|schema|identity|owner|fingerprint
//
// extconfig is stored by oid, and oids are per-database, so `config` carries the RESOLVED
// identities instead. Member fingerprints are the same exact-byte structural hash the
// managed-object profiles use, over losslessly transported definitions.
//
// Version-controlled positive evidence. NEVER learned from the target under inspection:
// re-certifying is an explicit maintenance operation against a known-stock project.

import { createHash } from "node:crypto";

export const STOCK_EXTENSION_PROFILES = Object.freeze([
  Object.freeze({
    id: "local-cli-stock",
    source: "Supabase CLI local development stack (supabase start)",
    capturedAt: "2026-09-05",
    server: "PostgreSQL 17.6 on x86_64-pc-linux-gnu",
    cli: "v2.116.0",
    extensionCount: 5,
    memberCount: 70,
    byExtension: Object.freeze({"pg_stat_statements":9,"pgcrypto":36,"plpgsql":4,"supabase_vault":11,"uuid-ossp":10}),
    byClass: Object.freeze({"pg_class":4,"pg_language":1,"pg_proc":57,"pg_type":8}),
    digest: "4ef390d3d2d35dd73b720e485ad91f958694631fbab03a63854fee91a1423722",
    extensions: Object.freeze([
      { extname: "pg_stat_statements", extversion: "1.11", schema: "extensions", owner: "supabase_admin", relocatable: "true", config: "(none)", condition: "(none)" },
      { extname: "pgcrypto", extversion: "1.3", schema: "extensions", owner: "supabase_admin", relocatable: "true", config: "(none)", condition: "(none)" },
      { extname: "plpgsql", extversion: "1.0", schema: "pg_catalog", owner: "supabase_admin", relocatable: "false", config: "(none)", condition: "(none)" },
      { extname: "supabase_vault", extversion: "0.3.1", schema: "vault", owner: "supabase_admin", relocatable: "false", config: "vault.secrets", condition: "" },
      { extname: "uuid-ossp", extversion: "1.1", schema: "extensions", owner: "supabase_admin", relocatable: "true", config: "(none)", condition: "(none)" },
    ]),
    members: Object.freeze([
      { extname: "pg_stat_statements", classCatalog: "pg_class", objectType: "view", schema: "extensions", identity: "extensions.pg_stat_statements", owner: "supabase_admin", fingerprint: "0e2a629aeb553070981dba1c" },
      { extname: "pg_stat_statements", classCatalog: "pg_class", objectType: "view", schema: "extensions", identity: "extensions.pg_stat_statements_info", owner: "supabase_admin", fingerprint: "474bcf5d21eab8db923c6d70" },
      { extname: "pg_stat_statements", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pg_stat_statements(boolean)", owner: "supabase_admin", fingerprint: "3385933e4feaae7fcfabd8d0" },
      { extname: "pg_stat_statements", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pg_stat_statements_info()", owner: "supabase_admin", fingerprint: "458f7f151d1249b097739bfe" },
      { extname: "pg_stat_statements", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pg_stat_statements_reset(pg_catalog.oid,pg_catalog.oid,bigint,boolean)", owner: "supabase_admin", fingerprint: "5f28723a7d2665436cf22bed" },
      { extname: "pg_stat_statements", classCatalog: "pg_type", objectType: "type", schema: "extensions", identity: "extensions.pg_stat_statements", owner: "supabase_admin", fingerprint: "b98a39bb50c621d5809eccf6" },
      { extname: "pg_stat_statements", classCatalog: "pg_type", objectType: "type", schema: "extensions", identity: "extensions.pg_stat_statements[]", owner: "supabase_admin", fingerprint: "1509bcca1a6ad2b3fe0fcbb8" },
      { extname: "pg_stat_statements", classCatalog: "pg_type", objectType: "type", schema: "extensions", identity: "extensions.pg_stat_statements_info", owner: "supabase_admin", fingerprint: "c8e9dab25d536707537abcb3" },
      { extname: "pg_stat_statements", classCatalog: "pg_type", objectType: "type", schema: "extensions", identity: "extensions.pg_stat_statements_info[]", owner: "supabase_admin", fingerprint: "1509bcca1a6ad2b3fe0fcbb8" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.armor(pg_catalog.bytea)", owner: "supabase_admin", fingerprint: "fc69eb53c4d934beb2ec3d6b" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.armor(pg_catalog.bytea,pg_catalog.text[],pg_catalog.text[])", owner: "supabase_admin", fingerprint: "a1868784cf56965628d12a07" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.crypt(pg_catalog.text,pg_catalog.text)", owner: "supabase_admin", fingerprint: "3ad0e7c55042dc8390ce8e3c" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.dearmor(pg_catalog.text)", owner: "supabase_admin", fingerprint: "6778a34feed7494e94d69f7f" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.decrypt(pg_catalog.bytea,pg_catalog.bytea,pg_catalog.text)", owner: "supabase_admin", fingerprint: "c9a099ecb07ebbd9a3e728f5" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.decrypt_iv(pg_catalog.bytea,pg_catalog.bytea,pg_catalog.bytea,pg_catalog.text)", owner: "supabase_admin", fingerprint: "b8f6d454827d7947566a09ad" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.digest(pg_catalog.bytea,pg_catalog.text)", owner: "supabase_admin", fingerprint: "3cc7d09d300fdb2df0e7400e" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.digest(pg_catalog.text,pg_catalog.text)", owner: "supabase_admin", fingerprint: "da4be2f0ae4dde2fd2bcb16c" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.encrypt(pg_catalog.bytea,pg_catalog.bytea,pg_catalog.text)", owner: "supabase_admin", fingerprint: "5bb8ab6ff0c772aaed823d48" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.encrypt_iv(pg_catalog.bytea,pg_catalog.bytea,pg_catalog.bytea,pg_catalog.text)", owner: "supabase_admin", fingerprint: "bd1ef9df062c802ea78dd6e3" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.gen_random_bytes(integer)", owner: "supabase_admin", fingerprint: "528872f3046c6e4502d61be7" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.gen_random_uuid()", owner: "supabase_admin", fingerprint: "bbc9e2edeb441e9dd1c7b714" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.gen_salt(pg_catalog.text)", owner: "supabase_admin", fingerprint: "500cbbdda59f21606676d13d" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.gen_salt(pg_catalog.text,integer)", owner: "supabase_admin", fingerprint: "3c7fc9ef61ab3d05b8f97210" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.hmac(pg_catalog.bytea,pg_catalog.bytea,pg_catalog.text)", owner: "supabase_admin", fingerprint: "b77813201d3c17cbaff21917" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.hmac(pg_catalog.text,pg_catalog.text,pg_catalog.text)", owner: "supabase_admin", fingerprint: "837fa80585cc413a1e7fc85c" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_armor_headers(pg_catalog.text)", owner: "supabase_admin", fingerprint: "7177034c2d66eb1dd7618302" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_key_id(pg_catalog.bytea)", owner: "supabase_admin", fingerprint: "2b5c614e516016de66ee145d" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_pub_decrypt(pg_catalog.bytea,pg_catalog.bytea)", owner: "supabase_admin", fingerprint: "1bbda0406bcdcc4fc6b4716e" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_pub_decrypt(pg_catalog.bytea,pg_catalog.bytea,pg_catalog.text)", owner: "supabase_admin", fingerprint: "ac441ea99f2f8ea73925291e" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_pub_decrypt(pg_catalog.bytea,pg_catalog.bytea,pg_catalog.text,pg_catalog.text)", owner: "supabase_admin", fingerprint: "669ab06f64cfa20f3ab0b911" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_pub_decrypt_bytea(pg_catalog.bytea,pg_catalog.bytea)", owner: "supabase_admin", fingerprint: "97ff6b09a1871a6971a928a5" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_pub_decrypt_bytea(pg_catalog.bytea,pg_catalog.bytea,pg_catalog.text)", owner: "supabase_admin", fingerprint: "902d696fb556d1ce208cf6f0" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_pub_decrypt_bytea(pg_catalog.bytea,pg_catalog.bytea,pg_catalog.text,pg_catalog.text)", owner: "supabase_admin", fingerprint: "34b031e3373d6641cf8e5c3e" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_pub_encrypt(pg_catalog.text,pg_catalog.bytea)", owner: "supabase_admin", fingerprint: "b639928becec451399254c9b" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_pub_encrypt(pg_catalog.text,pg_catalog.bytea,pg_catalog.text)", owner: "supabase_admin", fingerprint: "421796a1adad65c0140c612a" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_pub_encrypt_bytea(pg_catalog.bytea,pg_catalog.bytea)", owner: "supabase_admin", fingerprint: "883348f25d36c0ef96cd5bce" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_pub_encrypt_bytea(pg_catalog.bytea,pg_catalog.bytea,pg_catalog.text)", owner: "supabase_admin", fingerprint: "38b89b3c2cec61eecbfcbd33" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_sym_decrypt(pg_catalog.bytea,pg_catalog.text)", owner: "supabase_admin", fingerprint: "b48031d15b4108e428ea2a49" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_sym_decrypt(pg_catalog.bytea,pg_catalog.text,pg_catalog.text)", owner: "supabase_admin", fingerprint: "fffe1fc89a7c10af15ff45a2" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_sym_decrypt_bytea(pg_catalog.bytea,pg_catalog.text)", owner: "supabase_admin", fingerprint: "eb4059a88557bed169931d9f" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_sym_decrypt_bytea(pg_catalog.bytea,pg_catalog.text,pg_catalog.text)", owner: "supabase_admin", fingerprint: "47e6ff4d734749094aef1773" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_sym_encrypt(pg_catalog.text,pg_catalog.text)", owner: "supabase_admin", fingerprint: "0c00bc7f56033afe4032dc11" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_sym_encrypt(pg_catalog.text,pg_catalog.text,pg_catalog.text)", owner: "supabase_admin", fingerprint: "0a8d20a190ed7ce6195e5df6" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_sym_encrypt_bytea(pg_catalog.bytea,pg_catalog.text)", owner: "supabase_admin", fingerprint: "4b12bebfcb10d82c2c2312dd" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_sym_encrypt_bytea(pg_catalog.bytea,pg_catalog.text,pg_catalog.text)", owner: "supabase_admin", fingerprint: "a5556bf65cff9297fd438d9f" },
      { extname: "plpgsql", classCatalog: "pg_language", objectType: "language", schema: "", identity: "plpgsql", owner: "supabase_admin", fingerprint: "5a5e05bbf4855831d2b4f739" },
      { extname: "plpgsql", classCatalog: "pg_proc", objectType: "function", schema: "pg_catalog", identity: "pg_catalog.plpgsql_call_handler()", owner: "supabase_admin", fingerprint: "22623790dd2476442ca3168b" },
      { extname: "plpgsql", classCatalog: "pg_proc", objectType: "function", schema: "pg_catalog", identity: "pg_catalog.plpgsql_inline_handler(pg_catalog.internal)", owner: "supabase_admin", fingerprint: "aad2be5f3189ffc626745aa0" },
      { extname: "plpgsql", classCatalog: "pg_proc", objectType: "function", schema: "pg_catalog", identity: "pg_catalog.plpgsql_validator(pg_catalog.oid)", owner: "supabase_admin", fingerprint: "189dc31643ca9d0da4408dfc" },
      { extname: "supabase_vault", classCatalog: "pg_class", objectType: "table", schema: "vault", identity: "vault.secrets", owner: "supabase_admin", fingerprint: "80c762e2f465ed276bde6589" },
      { extname: "supabase_vault", classCatalog: "pg_class", objectType: "view", schema: "vault", identity: "vault.decrypted_secrets", owner: "supabase_admin", fingerprint: "54d705917ff006fbb1e53425" },
      { extname: "supabase_vault", classCatalog: "pg_proc", objectType: "function", schema: "vault", identity: "vault._crypto_aead_det_decrypt(pg_catalog.bytea,pg_catalog.bytea,bigint,pg_catalog.bytea,pg_catalog.bytea)", owner: "supabase_admin", fingerprint: "d8563793edf70edf467e2a13" },
      { extname: "supabase_vault", classCatalog: "pg_proc", objectType: "function", schema: "vault", identity: "vault._crypto_aead_det_encrypt(pg_catalog.bytea,pg_catalog.bytea,bigint,pg_catalog.bytea,pg_catalog.bytea)", owner: "supabase_admin", fingerprint: "b6f2594da75e4478fe392ec7" },
      { extname: "supabase_vault", classCatalog: "pg_proc", objectType: "function", schema: "vault", identity: "vault._crypto_aead_det_noncegen()", owner: "supabase_admin", fingerprint: "ce74d0b5511e4345447f5171" },
      { extname: "supabase_vault", classCatalog: "pg_proc", objectType: "function", schema: "vault", identity: "vault.create_secret(pg_catalog.text,pg_catalog.text,pg_catalog.text,pg_catalog.uuid)", owner: "supabase_admin", fingerprint: "7117560d7033b47ffb9851c0" },
      { extname: "supabase_vault", classCatalog: "pg_proc", objectType: "function", schema: "vault", identity: "vault.update_secret(pg_catalog.uuid,pg_catalog.text,pg_catalog.text,pg_catalog.text,pg_catalog.uuid)", owner: "supabase_admin", fingerprint: "b72e4a816b8673c5455a7e4a" },
      { extname: "supabase_vault", classCatalog: "pg_type", objectType: "type", schema: "vault", identity: "vault.decrypted_secrets", owner: "supabase_admin", fingerprint: "8dc395958c7f57489bdbb68b" },
      { extname: "supabase_vault", classCatalog: "pg_type", objectType: "type", schema: "vault", identity: "vault.decrypted_secrets[]", owner: "supabase_admin", fingerprint: "1509bcca1a6ad2b3fe0fcbb8" },
      { extname: "supabase_vault", classCatalog: "pg_type", objectType: "type", schema: "vault", identity: "vault.secrets", owner: "supabase_admin", fingerprint: "fa50f57c7578908382961537" },
      { extname: "supabase_vault", classCatalog: "pg_type", objectType: "type", schema: "vault", identity: "vault.secrets[]", owner: "supabase_admin", fingerprint: "1509bcca1a6ad2b3fe0fcbb8" },
      { extname: "uuid-ossp", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.uuid_generate_v1()", owner: "supabase_admin", fingerprint: "89354b63ceb01f80fddd69fd" },
      { extname: "uuid-ossp", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.uuid_generate_v1mc()", owner: "supabase_admin", fingerprint: "10ef58b27cb6f0b873b3feff" },
      { extname: "uuid-ossp", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.uuid_generate_v3(pg_catalog.uuid,pg_catalog.text)", owner: "supabase_admin", fingerprint: "4acf70dfbc9823a8d038c588" },
      { extname: "uuid-ossp", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.uuid_generate_v4()", owner: "supabase_admin", fingerprint: "32f6fb776b38269016885562" },
      { extname: "uuid-ossp", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.uuid_generate_v5(pg_catalog.uuid,pg_catalog.text)", owner: "supabase_admin", fingerprint: "0fcdeb6cdfc707cad45c271a" },
      { extname: "uuid-ossp", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.uuid_nil()", owner: "supabase_admin", fingerprint: "c43d00c04b5a52ee58854bfd" },
      { extname: "uuid-ossp", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.uuid_ns_dns()", owner: "supabase_admin", fingerprint: "3dbe6bdc711f7f2269cb190b" },
      { extname: "uuid-ossp", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.uuid_ns_oid()", owner: "supabase_admin", fingerprint: "b21fc76f3fe8d075861d0763" },
      { extname: "uuid-ossp", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.uuid_ns_url()", owner: "supabase_admin", fingerprint: "6bf80edb1683fff568fbbd16" },
      { extname: "uuid-ossp", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.uuid_ns_x500()", owner: "supabase_admin", fingerprint: "814eac7c6ed289f682a5326d" },
    ]),
  }),
  Object.freeze({
    id: "hosted-platform-stock",
    source: "hosted Supabase validation project (independent read-only capture)",
    capturedAt: "2026-09-05",
    server: "PostgreSQL 17.6 (hosted platform image 17.6.1.141)",
    cli: null,
    extensionCount: 5,
    memberCount: 70,
    byExtension: Object.freeze({"pg_stat_statements":9,"pgcrypto":36,"plpgsql":4,"supabase_vault":11,"uuid-ossp":10}),
    byClass: Object.freeze({"pg_class":4,"pg_language":1,"pg_proc":57,"pg_type":8}),
    digest: "9f402442b1f689592444a3c2cb13a5f4da189d48444b0380e40079429f5f90b8",
    extensions: Object.freeze([
      { extname: "pg_stat_statements", extversion: "1.11", schema: "extensions", owner: "postgres", relocatable: "true", config: "(none)", condition: "(none)" },
      { extname: "pgcrypto", extversion: "1.3", schema: "extensions", owner: "postgres", relocatable: "true", config: "(none)", condition: "(none)" },
      { extname: "plpgsql", extversion: "1.0", schema: "pg_catalog", owner: "supabase_admin", relocatable: "false", config: "(none)", condition: "(none)" },
      { extname: "supabase_vault", extversion: "0.3.1", schema: "vault", owner: "supabase_admin", relocatable: "false", config: "vault.secrets", condition: "" },
      { extname: "uuid-ossp", extversion: "1.1", schema: "extensions", owner: "postgres", relocatable: "true", config: "(none)", condition: "(none)" },
    ]),
    members: Object.freeze([
      { extname: "pg_stat_statements", classCatalog: "pg_class", objectType: "view", schema: "extensions", identity: "extensions.pg_stat_statements", owner: "postgres", fingerprint: "642dab221791752a6c6fffff" },
      { extname: "pg_stat_statements", classCatalog: "pg_class", objectType: "view", schema: "extensions", identity: "extensions.pg_stat_statements_info", owner: "postgres", fingerprint: "7eab3ad246f83e25c4068421" },
      { extname: "pg_stat_statements", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pg_stat_statements(boolean)", owner: "postgres", fingerprint: "ca70bf3452b79a97a14b5f6e" },
      { extname: "pg_stat_statements", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pg_stat_statements_info()", owner: "postgres", fingerprint: "62a38669d8095c16b3622f1d" },
      { extname: "pg_stat_statements", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pg_stat_statements_reset(pg_catalog.oid,pg_catalog.oid,bigint,boolean)", owner: "postgres", fingerprint: "2c51a4d4c7252b0b58d575ce" },
      { extname: "pg_stat_statements", classCatalog: "pg_type", objectType: "type", schema: "extensions", identity: "extensions.pg_stat_statements", owner: "postgres", fingerprint: "b98a39bb50c621d5809eccf6" },
      { extname: "pg_stat_statements", classCatalog: "pg_type", objectType: "type", schema: "extensions", identity: "extensions.pg_stat_statements[]", owner: "postgres", fingerprint: "1509bcca1a6ad2b3fe0fcbb8" },
      { extname: "pg_stat_statements", classCatalog: "pg_type", objectType: "type", schema: "extensions", identity: "extensions.pg_stat_statements_info", owner: "postgres", fingerprint: "c8e9dab25d536707537abcb3" },
      { extname: "pg_stat_statements", classCatalog: "pg_type", objectType: "type", schema: "extensions", identity: "extensions.pg_stat_statements_info[]", owner: "postgres", fingerprint: "1509bcca1a6ad2b3fe0fcbb8" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.armor(pg_catalog.bytea)", owner: "postgres", fingerprint: "c415480d81fab846cc8a41c6" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.armor(pg_catalog.bytea,pg_catalog.text[],pg_catalog.text[])", owner: "postgres", fingerprint: "52f6f78287ac0bf5d5e78c8d" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.crypt(pg_catalog.text,pg_catalog.text)", owner: "postgres", fingerprint: "498f099ebc9cc7d17ef5ac8c" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.dearmor(pg_catalog.text)", owner: "postgres", fingerprint: "aa99cef7573537c2bcd0552d" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.decrypt(pg_catalog.bytea,pg_catalog.bytea,pg_catalog.text)", owner: "postgres", fingerprint: "90c6d65c86816c385cb6c332" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.decrypt_iv(pg_catalog.bytea,pg_catalog.bytea,pg_catalog.bytea,pg_catalog.text)", owner: "postgres", fingerprint: "2cf9e4c029cb3019bb29e26c" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.digest(pg_catalog.bytea,pg_catalog.text)", owner: "postgres", fingerprint: "6844eee24d6003910b862ec3" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.digest(pg_catalog.text,pg_catalog.text)", owner: "postgres", fingerprint: "158b147414a2a06f0efaed8d" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.encrypt(pg_catalog.bytea,pg_catalog.bytea,pg_catalog.text)", owner: "postgres", fingerprint: "5cbe7fc05a75da6fd3d586bd" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.encrypt_iv(pg_catalog.bytea,pg_catalog.bytea,pg_catalog.bytea,pg_catalog.text)", owner: "postgres", fingerprint: "e37428b64efdbada7ffb8b2a" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.gen_random_bytes(integer)", owner: "postgres", fingerprint: "334afb6f688f2f6a20cc0daf" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.gen_random_uuid()", owner: "postgres", fingerprint: "1b26b56b1d0d28e3c124a4cc" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.gen_salt(pg_catalog.text)", owner: "postgres", fingerprint: "fa1fe8ca30df7eb518038e92" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.gen_salt(pg_catalog.text,integer)", owner: "postgres", fingerprint: "f6880390d3729be8e19bf933" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.hmac(pg_catalog.bytea,pg_catalog.bytea,pg_catalog.text)", owner: "postgres", fingerprint: "4e0a2144072e43ddf4c7c673" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.hmac(pg_catalog.text,pg_catalog.text,pg_catalog.text)", owner: "postgres", fingerprint: "9d6117a07791a08a0e57dd10" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_armor_headers(pg_catalog.text)", owner: "postgres", fingerprint: "f2cbe2b90d7ec16183f3605b" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_key_id(pg_catalog.bytea)", owner: "postgres", fingerprint: "e439c7a5904682ec46995d0c" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_pub_decrypt(pg_catalog.bytea,pg_catalog.bytea)", owner: "postgres", fingerprint: "52deb110e9a5aea662f5499e" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_pub_decrypt(pg_catalog.bytea,pg_catalog.bytea,pg_catalog.text)", owner: "postgres", fingerprint: "5ca10cc6459f6b4ba44aa0d1" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_pub_decrypt(pg_catalog.bytea,pg_catalog.bytea,pg_catalog.text,pg_catalog.text)", owner: "postgres", fingerprint: "1d61927230b80ee8a03d1779" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_pub_decrypt_bytea(pg_catalog.bytea,pg_catalog.bytea)", owner: "postgres", fingerprint: "0e91b66438757754ad3670d7" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_pub_decrypt_bytea(pg_catalog.bytea,pg_catalog.bytea,pg_catalog.text)", owner: "postgres", fingerprint: "b97890d9aedfc3a4b865376c" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_pub_decrypt_bytea(pg_catalog.bytea,pg_catalog.bytea,pg_catalog.text,pg_catalog.text)", owner: "postgres", fingerprint: "d8531c03d45768094e2778c1" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_pub_encrypt(pg_catalog.text,pg_catalog.bytea)", owner: "postgres", fingerprint: "cd0f04946f495d99e5c5f546" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_pub_encrypt(pg_catalog.text,pg_catalog.bytea,pg_catalog.text)", owner: "postgres", fingerprint: "0855b818abdf1e7ea087028e" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_pub_encrypt_bytea(pg_catalog.bytea,pg_catalog.bytea)", owner: "postgres", fingerprint: "e9f7deca2d6e78014ea06928" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_pub_encrypt_bytea(pg_catalog.bytea,pg_catalog.bytea,pg_catalog.text)", owner: "postgres", fingerprint: "d05a3a22293dd765f2b6bf7b" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_sym_decrypt(pg_catalog.bytea,pg_catalog.text)", owner: "postgres", fingerprint: "b9606b72776e8a7ed739fd17" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_sym_decrypt(pg_catalog.bytea,pg_catalog.text,pg_catalog.text)", owner: "postgres", fingerprint: "1af541d3b56c239334b827f0" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_sym_decrypt_bytea(pg_catalog.bytea,pg_catalog.text)", owner: "postgres", fingerprint: "b6e6e5b8a351a06686b406da" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_sym_decrypt_bytea(pg_catalog.bytea,pg_catalog.text,pg_catalog.text)", owner: "postgres", fingerprint: "eb8e35124067a70879bfadce" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_sym_encrypt(pg_catalog.text,pg_catalog.text)", owner: "postgres", fingerprint: "18d5f9eaa181fe77cbaf9f96" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_sym_encrypt(pg_catalog.text,pg_catalog.text,pg_catalog.text)", owner: "postgres", fingerprint: "8a914d9093a7892261108aaf" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_sym_encrypt_bytea(pg_catalog.bytea,pg_catalog.text)", owner: "postgres", fingerprint: "7ec088178b894d1454a69edc" },
      { extname: "pgcrypto", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.pgp_sym_encrypt_bytea(pg_catalog.bytea,pg_catalog.text,pg_catalog.text)", owner: "postgres", fingerprint: "784692c2c1547c70deea74fa" },
      { extname: "plpgsql", classCatalog: "pg_language", objectType: "language", schema: "", identity: "plpgsql", owner: "supabase_admin", fingerprint: "5a5e05bbf4855831d2b4f739" },
      { extname: "plpgsql", classCatalog: "pg_proc", objectType: "function", schema: "pg_catalog", identity: "pg_catalog.plpgsql_call_handler()", owner: "supabase_admin", fingerprint: "22623790dd2476442ca3168b" },
      { extname: "plpgsql", classCatalog: "pg_proc", objectType: "function", schema: "pg_catalog", identity: "pg_catalog.plpgsql_inline_handler(pg_catalog.internal)", owner: "supabase_admin", fingerprint: "aad2be5f3189ffc626745aa0" },
      { extname: "plpgsql", classCatalog: "pg_proc", objectType: "function", schema: "pg_catalog", identity: "pg_catalog.plpgsql_validator(pg_catalog.oid)", owner: "supabase_admin", fingerprint: "189dc31643ca9d0da4408dfc" },
      { extname: "supabase_vault", classCatalog: "pg_class", objectType: "table", schema: "vault", identity: "vault.secrets", owner: "supabase_admin", fingerprint: "80c762e2f465ed276bde6589" },
      { extname: "supabase_vault", classCatalog: "pg_class", objectType: "view", schema: "vault", identity: "vault.decrypted_secrets", owner: "supabase_admin", fingerprint: "54d705917ff006fbb1e53425" },
      { extname: "supabase_vault", classCatalog: "pg_proc", objectType: "function", schema: "vault", identity: "vault._crypto_aead_det_decrypt(pg_catalog.bytea,pg_catalog.bytea,bigint,pg_catalog.bytea,pg_catalog.bytea)", owner: "supabase_admin", fingerprint: "d8563793edf70edf467e2a13" },
      { extname: "supabase_vault", classCatalog: "pg_proc", objectType: "function", schema: "vault", identity: "vault._crypto_aead_det_encrypt(pg_catalog.bytea,pg_catalog.bytea,bigint,pg_catalog.bytea,pg_catalog.bytea)", owner: "supabase_admin", fingerprint: "b6f2594da75e4478fe392ec7" },
      { extname: "supabase_vault", classCatalog: "pg_proc", objectType: "function", schema: "vault", identity: "vault._crypto_aead_det_noncegen()", owner: "supabase_admin", fingerprint: "ce74d0b5511e4345447f5171" },
      { extname: "supabase_vault", classCatalog: "pg_proc", objectType: "function", schema: "vault", identity: "vault.create_secret(pg_catalog.text,pg_catalog.text,pg_catalog.text,pg_catalog.uuid)", owner: "supabase_admin", fingerprint: "7117560d7033b47ffb9851c0" },
      { extname: "supabase_vault", classCatalog: "pg_proc", objectType: "function", schema: "vault", identity: "vault.update_secret(pg_catalog.uuid,pg_catalog.text,pg_catalog.text,pg_catalog.text,pg_catalog.uuid)", owner: "supabase_admin", fingerprint: "b72e4a816b8673c5455a7e4a" },
      { extname: "supabase_vault", classCatalog: "pg_type", objectType: "type", schema: "vault", identity: "vault.decrypted_secrets", owner: "supabase_admin", fingerprint: "8dc395958c7f57489bdbb68b" },
      { extname: "supabase_vault", classCatalog: "pg_type", objectType: "type", schema: "vault", identity: "vault.decrypted_secrets[]", owner: "supabase_admin", fingerprint: "1509bcca1a6ad2b3fe0fcbb8" },
      { extname: "supabase_vault", classCatalog: "pg_type", objectType: "type", schema: "vault", identity: "vault.secrets", owner: "supabase_admin", fingerprint: "fa50f57c7578908382961537" },
      { extname: "supabase_vault", classCatalog: "pg_type", objectType: "type", schema: "vault", identity: "vault.secrets[]", owner: "supabase_admin", fingerprint: "1509bcca1a6ad2b3fe0fcbb8" },
      { extname: "uuid-ossp", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.uuid_generate_v1()", owner: "postgres", fingerprint: "4eee3c714ee0c616782024ff" },
      { extname: "uuid-ossp", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.uuid_generate_v1mc()", owner: "postgres", fingerprint: "fde114ed46422ca17d2e6187" },
      { extname: "uuid-ossp", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.uuid_generate_v3(pg_catalog.uuid,pg_catalog.text)", owner: "postgres", fingerprint: "64267fad62f1b749623341ae" },
      { extname: "uuid-ossp", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.uuid_generate_v4()", owner: "postgres", fingerprint: "580e64c3b50e59659eb688b6" },
      { extname: "uuid-ossp", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.uuid_generate_v5(pg_catalog.uuid,pg_catalog.text)", owner: "postgres", fingerprint: "ad52ed919c79adfd549ab6ba" },
      { extname: "uuid-ossp", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.uuid_nil()", owner: "postgres", fingerprint: "9de4e536d96bbe3ef8e1ea4c" },
      { extname: "uuid-ossp", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.uuid_ns_dns()", owner: "postgres", fingerprint: "370ee8319674538d73cc8101" },
      { extname: "uuid-ossp", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.uuid_ns_oid()", owner: "postgres", fingerprint: "fcba2c5bc5ae374c77e0c4de" },
      { extname: "uuid-ossp", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.uuid_ns_url()", owner: "postgres", fingerprint: "4fbbd3d453a06208b6a7a76e" },
      { extname: "uuid-ossp", classCatalog: "pg_proc", objectType: "function", schema: "extensions", identity: "extensions.uuid_ns_x500()", owner: "postgres", fingerprint: "1a03b0502881a93d4063cf54" },
    ]),
  }),
]);

// FAIL CLOSED AT LOAD. A profile is only evidence while it is the evidence that was
// certified, so a hand-edited entry throws before anything can be certified against it.
for (const profile of STOCK_EXTENSION_PROFILES) {
  if (profile.extensions.length !== profile.extensionCount || profile.members.length !== profile.memberCount) {
    throw new Error(`certified extension profile ${profile.id} miscounts its own contents`);
  }
  const lines = [
    ...profile.extensions.map((e) => `EXT|${e.extname}|${e.extversion}|${e.schema}|${e.owner}|${e.relocatable}|${e.config}|${e.condition}`),
    ...profile.members.map((m) => `MEM|${m.extname}|${m.classCatalog}|${m.objectType}|${m.schema}|${m.identity}|${m.owner}|${m.fingerprint}`),
  ];
  if (new Set(lines).size !== lines.length) {
    throw new Error(`certified extension profile ${profile.id} carries a duplicate record`);
  }
  const digest = createHash("sha256").update([...lines].sort().join("\n"), "utf8").digest("hex");
  if (digest !== profile.digest) {
    throw new Error(
      `certified extension profile ${profile.id} does not match its certified digest (computed ${digest}, expected ${profile.digest}). ` +
      "Re-certify it from a known-stock capture; do not adjust the digest to match an edit.",
    );
  }
}
