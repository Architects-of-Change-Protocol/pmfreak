import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isFounderOrInternalUser, toDisplayRole, DEFAULT_SIGNUP_ROLE } from "../src/lib/auth.ts";
import { buildSignupProfile } from "../src/app/signup/build-signup-profile.ts";
import { canManageWorkspace, canInviteMembers, canManageBilling } from "../src/lib/workspace-access.ts";

const signupPageSrc = readFileSync("src/app/signup/page.tsx", "utf8");
const signupActionsSrc = readFileSync("src/app/signup/actions.ts", "utf8");

const formData = (fields) => {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
};

const baseFields = { email: "person@example.com", password: "hunter22", fullName: "Person", companyName: "Acme" };

// ── Signup UI no longer offers a role selector ──────────────────────────────

test("signup page has no role selector", () => {
  assert.doesNotMatch(signupPageSrc, /name="role"/);
  assert.doesNotMatch(signupPageSrc, /<select/);
});

test("signup action source never reads a client-supplied role field", () => {
  assert.doesNotMatch(signupActionsSrc, /formData\.get\("role"\)/);
});

// ── buildSignupProfile: client role input is always ignored ────────────────

test("signup with role=admin in FormData is ignored — user gets the default minimum role", () => {
  const profile = buildSignupProfile(formData({ ...baseFields, role: "admin" }));
  assert.equal(profile.role, DEFAULT_SIGNUP_ROLE);
  assert.notEqual(profile.role, "admin");
});

test("signup with role=owner in FormData is ignored", () => {
  const profile = buildSignupProfile(formData({ ...baseFields, role: "owner" }));
  assert.equal(profile.role, DEFAULT_SIGNUP_ROLE);
  assert.notEqual(profile.role, "owner");
});

test("signup with role=pm in FormData is ignored — pm carries elevated permissions and must not be self-assignable", () => {
  const profile = buildSignupProfile(formData({ ...baseFields, role: "pm" }));
  assert.equal(profile.role, DEFAULT_SIGNUP_ROLE);
});

test("signup normally (no role field at all) still yields correct profile fields — no regression", () => {
  const profile = buildSignupProfile(formData(baseFields));
  assert.equal(profile.email, baseFields.email);
  assert.equal(profile.fullName, baseFields.fullName);
  assert.equal(profile.companyName, baseFields.companyName);
  assert.equal(profile.role, "viewer");
});

// ── toDisplayRole: historical/tampered metadata is degraded, never trusted ──

test("toDisplayRole degrades metadata role=admin to the minimum-privilege role", () => {
  assert.equal(toDisplayRole("admin"), "viewer");
});

test("toDisplayRole degrades metadata role=owner to the minimum-privilege role", () => {
  assert.equal(toDisplayRole("owner"), "viewer");
});

test("toDisplayRole still allows non-privileged display values through", () => {
  assert.equal(toDisplayRole("pm"), "pm");
  assert.equal(toDisplayRole("viewer"), "viewer");
});

test("toDisplayRole defaults unknown/garbage/missing metadata to viewer", () => {
  assert.equal(toDisplayRole(undefined), "viewer");
  assert.equal(toDisplayRole(null), "viewer");
  assert.equal(toDisplayRole(""), "viewer");
  assert.equal(toDisplayRole({ toString: () => "admin" }), "viewer");
});

// ── isFounderOrInternalUser: metadata role can never satisfy the gate ───────

const actor = (overrides) => ({
  id: "u1",
  email: "attacker@gmail.com",
  fullName: "Attacker",
  companyId: "c1",
  companyName: "Attacker Co",
  role: "viewer",
  onboardingCompleted: true,
  ...overrides,
});

test("user_metadata.role=admin is NOT sufficient to pass the founder/internal gate", () => {
  assert.equal(isFounderOrInternalUser(actor({ role: "admin" })), false);
});

test("user_metadata.role=owner is NOT sufficient to pass the founder/internal gate", () => {
  assert.equal(isFounderOrInternalUser(actor({ role: "owner" })), false);
});

test("a normal user cannot access founder actions regardless of display role", () => {
  assert.equal(isFounderOrInternalUser(actor({ role: "viewer" })), false);
  assert.equal(isFounderOrInternalUser(actor({ role: "pm" })), false);
});

test("a real founder (internal email domain) passes the gate even with role=viewer", () => {
  assert.equal(isFounderOrInternalUser(actor({ email: "founder@pmfreak.ai", role: "viewer" })), true);
  assert.equal(isFounderOrInternalUser(actor({ email: "ops@onchainfest.xyz", role: "viewer" })), true);
});

test("FOUNDER_EMAIL_ALLOWLIST env var grants founder access from a trusted server-side source", () => {
  const previous = process.env.FOUNDER_EMAIL_ALLOWLIST;
  process.env.FOUNDER_EMAIL_ALLOWLIST = "trusted-partner@example.com";
  try {
    assert.equal(isFounderOrInternalUser(actor({ email: "trusted-partner@example.com", role: "viewer" })), true);
    assert.equal(isFounderOrInternalUser(actor({ email: "someone-else@example.com", role: "viewer" })), false);
  } finally {
    if (previous === undefined) delete process.env.FOUNDER_EMAIL_ALLOWLIST;
    else process.env.FOUNDER_EMAIL_ALLOWLIST = previous;
  }
});

// ── No regression: workspace-role-based authorization is untouched ─────────

test("workspace membership role (server-side, DB-backed) still governs management capability", () => {
  assert.equal(canManageWorkspace("owner"), true);
  assert.equal(canManageWorkspace("admin"), true);
  assert.equal(canManageWorkspace("pm"), false);
  assert.equal(canManageWorkspace("viewer"), false);
});

test("workspace membership role still governs invite capability", () => {
  assert.equal(canInviteMembers("admin"), true);
  assert.equal(canInviteMembers("viewer"), false);
});

test("only workspace owners can manage billing", () => {
  assert.equal(canManageBilling("owner"), true);
  assert.equal(canManageBilling("admin"), false);
});
