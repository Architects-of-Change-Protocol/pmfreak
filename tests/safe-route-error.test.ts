/**
 * Pilot Gate Sprint 01 — Task 3 (F-07 error-leakage sweep).
 *
 * Behavioral coverage for the shared safe-route-error boundary: raw driver
 * or provider error text must never reach an HTTP response body; access
 * denials must map to honest 401/403 instead of 500.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  safeInternalErrorResponse,
  safeLegacyErrorResponse,
  sdkDatabaseErrorBody,
  GENERIC_INTERNAL_ERROR_MESSAGE,
  GENERIC_DB_UNAVAILABLE_MESSAGE,
} from "../src/lib/security/safe-route-error";
import { AccessDeniedError } from "../src/lib/security/access-guards";

const RAW_PG_ERROR = 'duplicate key value violates unique constraint "workspace_memberships_pkey" on table "workspace_memberships"';

test("safeInternalErrorResponse: raw Postgres error text never reaches the client", async () => {
  const response = safeInternalErrorResponse("/api/test-route", new Error(RAW_PG_ERROR));
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.equal(body.error.code, "INTERNAL_ERROR");
  assert.equal(body.error.message, GENERIC_INTERNAL_ERROR_MESSAGE);
  const serialized = JSON.stringify(body);
  assert.ok(!serialized.includes("workspace_memberships"), "table name leaked to client");
  assert.ok(!serialized.includes("duplicate key"), "driver error text leaked to client");
});

test("safeInternalErrorResponse: non-Error values are also sanitized", async () => {
  const response = safeInternalErrorResponse("/api/test-route", RAW_PG_ERROR);
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.equal(body.error.message, GENERIC_INTERNAL_ERROR_MESSAGE);
});

test("safeInternalErrorResponse: AccessDeniedError maps to honest 403, no internal reason leaked", async () => {
  const denial = new AccessDeniedError("Capability denied by enterprise runtime.", { reason: "workspace_membership_required" });
  const response = safeInternalErrorResponse("/api/test-route", denial);
  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.error.code, "ACCESS_DENIED");
  const serialized = JSON.stringify(body);
  assert.ok(!serialized.includes("workspace_membership_required"), "denial reason leaked to client");
  assert.ok(!serialized.includes("enterprise runtime"), "internal message leaked to client");
});

test("safeInternalErrorResponse: unauthorized maps to 401", async () => {
  const denial = new AccessDeniedError("Unauthorized.", { reason: "unauthorized" });
  const response = safeInternalErrorResponse("/api/test-route", denial);
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.error.code, "UNAUTHORIZED");
});

test("safeLegacyErrorResponse: legacy { error } envelope stays generic", async () => {
  const response = safeLegacyErrorResponse("/api/test-route", new Error(RAW_PG_ERROR), "Unable to load. Please retry.");
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.equal(body.error, "Unable to load. Please retry.");
  assert.ok(!JSON.stringify(body).includes("workspace_memberships"));
});

test("sdkDatabaseErrorBody: returns generic message regardless of driver error", () => {
  const body = sdkDatabaseErrorBody("/api/sdk/test", new Error(RAW_PG_ERROR));
  assert.equal(body.message, GENERIC_DB_UNAVAILABLE_MESSAGE);
});
