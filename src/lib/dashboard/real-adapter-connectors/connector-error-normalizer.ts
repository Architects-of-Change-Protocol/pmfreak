function sanitizeRawMessage(rawMessage: string): string {
  return rawMessage
    .replace(/(authorization|api|access|bearer|token|secret|password|key)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .slice(0, 500)
}

export function normalizeConnectorError(error: unknown): { message: string; retryable: boolean; metadata: Record<string, unknown> } {
  const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status: unknown }).status) : undefined
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error ?? 'unknown')
  const rawMessage = sanitizeRawMessage(raw ?? 'unknown')
  const lower = rawMessage.toLowerCase()

  const retryableByMessage = ['timeout', 'rate limit', '429', '503', 'network'].some((t) => lower.includes(t))
  const retryableByStatus = [429, 500, 502, 503, 504].includes(status ?? -1)
  const nonRetryableByStatus = [400, 401, 403, 404].includes(status ?? -1)
  const nonRetryableByMessage = ['unauthorized', 'forbidden', 'invalid'].some((t) => lower.includes(t))

  let retryable = retryableByMessage || retryableByStatus
  if (nonRetryableByStatus || nonRetryableByMessage) retryable = false

  return {
    message: 'Connector execution failed.',
    retryable,
    metadata: {
      rawMessage,
      status,
    },
  }
}
