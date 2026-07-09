const REDACTED_PLACEHOLDER = "[redacted]";

const EMAIL_PATTERN = /[^\s"'()<>]+@[^\s"'()<>]+\.[^\s"'()<>]+/g;
const BEARER_TOKEN_PATTERN = /\bBearer\s+\S+/gi;
const CONNECTION_STRING_WITH_CREDENTIALS_PATTERN = /\b[a-z][a-z0-9+.-]*:\/\/[^\s"'()<>]*@[^\s"'()<>]+/gi;
const SECRET_LIKE_TOKEN_PATTERN = /\b[A-Za-z0-9_-]{24,}\b/g;

const SENSITIVE_KEY_PATTERN = /(secret|token|password|credential|api[_-]?key|email|authorization|bearer)/i;

function redactString(value: string): string {
  return value
    .replace(BEARER_TOKEN_PATTERN, `Bearer ${REDACTED_PLACEHOLDER}`)
    .replace(CONNECTION_STRING_WITH_CREDENTIALS_PATTERN, REDACTED_PLACEHOLDER)
    .replace(EMAIL_PATTERN, REDACTED_PLACEHOLDER)
    .replace(SECRET_LIKE_TOKEN_PATTERN, REDACTED_PLACEHOLDER);
}

// Deterministic, offline, deep redaction of a single outbound/inbound
// transport payload value (headers, config, request/response bodies).
// `none` returns a deep clone of the input untouched; `safe_demo` and
// `strict` both scrub email/token/secret/bearer-token/connection-string-like
// strings and any value whose object key looks sensitive (email, token,
// secret, password, credential, apiKey, authorization, bearer). `strict`
// additionally clears free-form `metadata` bags entirely, since their shape
// is caller-defined and cannot be safely scrubbed field-by-field.
export function redactPMFreakAocRemoteGovernanceTransportValue(
  value: unknown,
  mode: "none" | "safe_demo" | "strict",
): unknown {
  if (mode === "none") {
    return value === undefined ? value : JSON.parse(JSON.stringify(value));
  }

  const walk = (input: unknown, parentKey?: string): unknown => {
    if (typeof input === "string") {
      if (parentKey && SENSITIVE_KEY_PATTERN.test(parentKey)) {
        return REDACTED_PLACEHOLDER;
      }
      return redactString(input);
    }
    if (Array.isArray(input)) {
      return input.map((entry) => walk(entry, parentKey));
    }
    if (input && typeof input === "object") {
      if (mode === "strict" && parentKey === "metadata") {
        return {};
      }
      const result: Record<string, unknown> = {};
      for (const [key, entryValue] of Object.entries(input as Record<string, unknown>)) {
        result[key] = walk(entryValue, key);
      }
      return result;
    }
    return input;
  };

  return walk(value);
}
