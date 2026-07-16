/**
 * Founder Circle Program — security regression guards.
 *
 * 1. Fail-closed gates: with no flags set, the program resolves disabled and
 *    every gate answers with a controlled response before any auth/DB work.
 * 2. Token hygiene: no founder-program source ever passes token material to
 *    a logger/console call or into analytics; operator list selections never
 *    include token_hash.
 * 3. No client-supplied authority: founder-program routes never read
 *    role/founder/admin fields from request bodies.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  founderProgramDisabledResponse,
  founderProgramFeatureDisabledResponse,
  requireFounderProgramEnabled,
} from "../src/lib/founder-program/authz";

const ROOT = process.cwd();

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(full)) files.push(full);
  }
  return files;
}

const FOUNDER_SOURCES = [
  ...walk(path.join(ROOT, "src/lib/founder-program")),
  ...walk(path.join(ROOT, "src/app/api/founder-program")),
  ...walk(path.join(ROOT, "src/app/(protected)/founder-circle")),
  ...walk(path.join(ROOT, "src/app/(protected)/founder-program")),
];

test("the founder-program surface is present for scanning", () => {
  assert.ok(FOUNDER_SOURCES.length >= 15, `expected the full surface, found ${FOUNDER_SOURCES.length} files`);
});

test("fail-closed: with a clean environment every gate resolves disabled with a controlled response", async () => {
  const preserved: Record<string, string | undefined> = {};
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("PMFREAK_FOUNDER_PROGRAM_")) {
      preserved[key] = process.env[key];
      delete process.env[key];
    }
  }
  try {
    const gate = await requireFounderProgramEnabled();
    assert.equal(gate.ok, false);
    if (!gate.ok) {
      assert.equal(gate.response.status, 404, "disabled program must be indistinguishable from a missing route");
      const body = await gate.response.json();
      assert.deepEqual(body, { error: "Not found." });
    }
  } finally {
    for (const [key, value] of Object.entries(preserved)) {
      if (value !== undefined) process.env[key] = value;
    }
  }
});

test("controlled responses carry no stack traces or internals", async () => {
  const disabled = founderProgramDisabledResponse();
  assert.equal(disabled.status, 404);
  const feature = founderProgramFeatureDisabledResponse("applicationsEnabled");
  assert.equal(feature.status, 503);
  const body = await feature.json();
  assert.equal(body.code, "founder_program_feature_disabled");
  assert.ok(!JSON.stringify(body).match(/at\s+\w+\s+\(|postgres|supabase/i));
});

test("no founder-program source logs token material", () => {
  // Any logger/console call whose argument list mentions a token-ish
  // identifier is a leak candidate. inviteLink carries the plaintext token,
  // so it is banned from logs as well.
  const logCall = /(logger\.(debug|info|warn|error)|console\.(log|info|warn|error))\s*\(([^)]*)\)/g;
  for (const file of FOUNDER_SOURCES) {
    const src = readFileSync(file, "utf8");
    let match: RegExpExecArray | null;
    while ((match = logCall.exec(src)) !== null) {
      // String literals (e.g. the "/invitation/[token]" route id) are not
      // data flows — only identifiers/expressions can leak a token value.
      const args = match[4].replace(/"[^"]*"|'[^']*'|`[^`]*`/g, '""');
      assert.ok(
        !/token|invite_?link/i.test(args),
        `${path.relative(ROOT, file)} passes token-like material to a log call: ${match[0].slice(0, 120)}`,
      );
    }
  }
});

test("token_hash is never selected by operator/participant list routes and never returned to clients", () => {
  for (const file of FOUNDER_SOURCES) {
    if (!file.includes("/route.ts") && !file.includes("page.tsx")) continue;
    const src = readFileSync(file, "utf8");
    for (const match of src.matchAll(/\.select\(\s*"([^"]+)"\s*\)/g)) {
      assert.ok(
        !match[1].includes("token_hash"),
        `${path.relative(ROOT, file)} selects token_hash in a route/page — hashes are service-layer-internal only`,
      );
    }
  }
});

test("analytics module cannot transport tokens or emails even if a caller tries", () => {
  const src = readFileSync(path.join(ROOT, "src/lib/founder-program/analytics.ts"), "utf8");
  assert.ok(src.includes("FOUNDER_EVENT_ALLOWED_PROPERTY_KEYS"), "property allowlist must exist");
  for (const banned of ["token", "email", "invite_link", "body", "note"]) {
    assert.ok(
      !new RegExp(`"${banned}"`).test(src.split("FOUNDER_EVENT_ALLOWED_PROPERTY_KEYS")[1]?.split("] as const")[0] ?? ""),
      `allowlist must never contain "${banned}"`,
    );
  }
});

test("no founder-program route reads authority from the request body", () => {
  const forbidden = [/body\.(actorRole|isAdmin|isFounder|isOwner|role)\b/, /user_metadata\.role/];
  for (const file of FOUNDER_SOURCES) {
    const src = readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      assert.ok(!pattern.test(src), `${path.relative(ROOT, file)} must not read authority from the request body (${pattern})`);
    }
  }
});

test("every founder-program mutation route enforces an abuse limit", () => {
  const mutationRoutes = FOUNDER_SOURCES.filter((f) => f.endsWith("route.ts")).filter((f) => {
    const src = readFileSync(f, "utf8");
    return src.includes("export async function POST");
  });
  assert.ok(mutationRoutes.length >= 6);
  for (const file of mutationRoutes) {
    const src = readFileSync(file, "utf8");
    assert.ok(src.includes("enforceAbuseLimit"), `${path.relative(ROOT, file)} must rate-limit its POST handler`);
  }
});

test("operator routes authorize before parsing the request body", () => {
  const operatorRoutes = FOUNDER_SOURCES.filter((f) => f.includes("/operator/") && f.endsWith("route.ts"));
  assert.ok(operatorRoutes.length >= 6);
  for (const file of operatorRoutes) {
    const src = readFileSync(file, "utf8");
    const gateIdx = src.indexOf("requireFounderProgramOperator");
    const bodyIdx = src.indexOf("request.json()");
    assert.ok(gateIdx >= 0, `${path.relative(ROOT, file)} must call requireFounderProgramOperator`);
    if (bodyIdx >= 0) {
      assert.ok(gateIdx < bodyIdx, `${path.relative(ROOT, file)} must authorize before request.json()`);
    }
  }
});
