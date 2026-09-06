#!/usr/bin/env node
// MANAGED-OBJECT PROFILE CAPTURE.
//
// Re-certifying a stock profile used to mean hand-copying the gate's structural SQL into
// an ad-hoc query. A copy that drifts by one field produces fingerprints the gate can
// never match, so the capture is driven by the gate's OWN exported builder — there is one
// definition of "the exact structure of this object", and this tool cannot disagree with
// the gate about it.
//
// Evidence only. This authorizes nothing and mutates nothing: it issues a single read-only
// catalog SELECT, or parses output captured by someone else.
//
//   --extension              capture the certified EXTENSION profile instead of the
//                            managed-object profile (its pg_class members are
//                            fingerprinted through the same RELATION_STRUCTURE, so a
//                            serializer change moves them too)
//   --print-query            emit the exact SQL, for independent read-only execution
//   --from-file <path>       build the profile from saved `psql -t -A` output
//   --id <id> --source <s>   profile metadata to stamp on the emitted fixture entries
//
// With neither flag it runs psql itself against $SUPABASE_DB_URL.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { buildManagedInventoryQuery, buildExtensionProfileQuery, isRealtimeDailyPartition } from "./check-fresh-db-migrations.mjs";

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? null : argv[i + 1] ?? null;
};

/** Identical parsing to the gate's, including the base64 lossless-transport decode. */
function parseRows(stdout) {
  const objects = [];
  for (const line of String(stdout ?? "").split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const f = line.split("~|~");
    if (f.length < 5) throw new Error(`unrecognized probe row (${f.length} field(s)): ${line.slice(0, 120)}`);
    const definition = Buffer.from(f.slice(4).join("~|~"), "base64").toString("utf8");
    objects.push({ schema: f[0], kind: f[1], name: f[2], owner: f[3], definition });
  }
  return objects;
}

const wantExtension = argv.includes("--extension");
const query = wantExtension ? buildExtensionProfileQuery() : buildManagedInventoryQuery();
if (argv.includes("--print-query")) {
  process.stdout.write(query.trim() + "\n");
  process.exit(0);
}

let stdout;
const fromFile = flag("--from-file");
if (fromFile) {
  stdout = readFileSync(fromFile, "utf8");
} else {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error("SUPABASE_DB_URL is required (or pass --from-file / --print-query).");
    process.exit(2);
  }
  const r = spawnSync("psql", ["-v", "ON_ERROR_STOP=1", "-t", "-A", dbUrl, "-c", query], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    console.error(`psql failed (status ${r.status}): ${r.stderr ?? ""}`);
    process.exit(1);
  }
  stdout = r.stdout;
}


/** The extension profile's own line form, mirroring extensionStateLines() in the gate. */
function emitExtensionProfile(stdout) {
  const extensions = [];
  const members = [];
  for (const line of String(stdout ?? "").split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const f = line.split("~|~");
    if (f[0] === "EXT") {
      if (f.length !== 8) throw new Error(`unrecognized extension row (${f.length} field(s))`);
      extensions.push({ extname: f[1], extversion: f[2], schema: f[3], owner: f[4], relocatable: f[5], config: f[6], condition: f[7] });
      continue;
    }
    if (f[0] === "MEM") {
      if (f.length < 8) throw new Error(`unrecognized member row (${f.length} field(s))`);
      const structure = Buffer.from(f.slice(7).join("~|~"), "base64").toString("utf8");
      members.push({
        extname: f[1], classCatalog: f[2], objectType: f[3], schema: f[4], identity: f[5], owner: f[6],
        fingerprint: createHash("sha256").update(structure, "utf8").digest("hex").slice(0, 24),
      });
      continue;
    }
    throw new Error(`unrecognized row tag ${(f[0] ?? "").slice(0, 24)}`);
  }
  extensions.sort((a, b) => a.extname.localeCompare(b.extname));
  members.sort((a, b) => (a.extname.localeCompare(b.extname) || a.classCatalog.localeCompare(b.classCatalog) || a.identity.localeCompare(b.identity)));
  const lines = [
    ...extensions.map((e) => `EXT|${e.extname}|${e.extversion}|${e.schema}|${e.owner}|${e.relocatable}|${e.config}|${e.condition}`),
    ...members.map((m) => `MEM|${m.extname}|${m.classCatalog}|${m.objectType}|${m.schema}|${m.identity}|${m.owner}|${m.fingerprint}`),
  ];
  const digest = createHash("sha256").update([...lines].sort().join("\n"), "utf8").digest("hex");
  console.error(`captured ${extensions.length} extension(s) and ${members.length} member(s)`);
  console.log(`// extensionCount: ${extensions.length}`);
  console.log(`// memberCount: ${members.length}`);
  console.log(`// digest: ${digest}`);
  console.log(JSON.stringify({ extensions, members }, null, 2));
}

if (wantExtension) {
  emitExtensionProfile(stdout);
  process.exit(0);
}

const all = parseRows(stdout);
// Dynamic realtime daily partitions belong to NEITHER profile: they are date-derived and
// service-generated, and are matched structurally by realtimePartitionDefinition().
const objects = all.filter((o) => !isRealtimeDailyPartition(o));
const skipped = all.length - objects.length;

const entries = objects
  .map((o) => ({
    schema: o.schema,
    kind: o.kind,
    name: o.name,
    owner: o.owner,
    fingerprint: createHash("sha256").update(o.definition, "utf8").digest("hex").slice(0, 24),
  }))
  .sort((a, b) => (a.schema.localeCompare(b.schema) || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)));

const digest = createHash("sha256")
  .update(entries.map((o) => `${o.schema}|${o.kind}|${o.name}|${o.owner}|${o.fingerprint}`).sort().join("\n"), "utf8")
  .digest("hex");

console.error(`captured ${entries.length} object(s); skipped ${skipped} dynamic realtime partition object(s)`);
console.log(`// objectCount: ${entries.length}`);
console.log(`// digest: ${digest}`);
for (const e of entries) {
  console.log(`      { schema: ${JSON.stringify(e.schema)}, kind: ${JSON.stringify(e.kind)}, name: ${JSON.stringify(e.name)}, owner: ${JSON.stringify(e.owner)}, fingerprint: ${JSON.stringify(e.fingerprint)} },`);
}
