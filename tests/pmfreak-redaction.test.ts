import test from "node:test";
import assert from "node:assert/strict";

import { redactAocPMFreakConnectorValue } from "../src/features/aoc-integrations/pmfreak-read-only-connector";

function sample() {
  return {
    email: "someone@example.com",
    token: "sk-demo-abcdef",
    secret: "shh-dont-tell",
    authorization: "Bearer demo-token-123",
    connectionString: "postgres://user:pass@localhost:5432/demo",
    sourceUrl: "https://pmfreak.demo.local/projects/demo",
    metadata: { note: "safe demo note" },
    plain: "unaffected value",
  };
}

test("redaction mode none leaves values as-is and does not mutate input", () => {
  const input = sample();
  const snapshotBefore = JSON.stringify(input);

  const result = redactAocPMFreakConnectorValue(input, "none") as ReturnType<typeof sample>;

  assert.equal(result.email, input.email);
  assert.equal(result.token, input.token);
  assert.equal(JSON.stringify(input), snapshotBefore);
});

test("redaction mode safe_demo removes obvious email/token/secret/authorization/connection-string values", () => {
  const input = sample();
  const snapshotBefore = JSON.stringify(input);

  const result = redactAocPMFreakConnectorValue(input, "safe_demo") as ReturnType<typeof sample>;

  assert.equal(result.email, "[redacted-email]");
  assert.equal(result.token, "[redacted-secret]");
  assert.equal(result.secret, "[redacted-secret]");
  assert.equal(result.authorization, "[redacted-secret]");
  assert.equal(result.connectionString, "[redacted-secret]");
  assert.equal(result.plain, "unaffected value");

  // input must be untouched
  assert.equal(JSON.stringify(input), snapshotBefore);
});

test("redaction mode strict removes metadata and redacts sourceUrl in addition to safe_demo behavior", () => {
  const input = sample();
  const snapshotBefore = JSON.stringify(input);

  const result = redactAocPMFreakConnectorValue(input, "strict") as ReturnType<typeof sample>;

  assert.equal(result.email, "[redacted-email]");
  assert.equal(result.token, "[redacted-secret]");
  assert.deepEqual(result.metadata, {});
  assert.equal(result.sourceUrl, "[redacted-url]");

  assert.equal(JSON.stringify(input), snapshotBefore);
});
