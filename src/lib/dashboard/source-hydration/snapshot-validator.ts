import { DASHBOARD_SOURCE_KINDS, type DashboardSourceKind, type DashboardSourceSnapshot } from './types'

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isValidDateString(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

export function validateDashboardSnapshot(input: unknown): {
  valid: boolean
  snapshot?: DashboardSourceSnapshot
  errors: string[]
} {
  const errors: string[] = []

  if (!isObject(input)) {
    return { valid: false, errors: ['Snapshot must be an object.'] }
  }

  if (typeof input.id !== 'string' || input.id.length === 0) errors.push('id must be a non-empty string.')
  if (typeof input.tenantId !== 'string' || input.tenantId.length === 0) {
    errors.push('tenantId must be a non-empty string.')
  }
  if (!DASHBOARD_SOURCE_KINDS.includes(input.sourceKind as string as DashboardSourceKind)) {
    errors.push('sourceKind is invalid.')
  }
  if (!('payload' in input)) errors.push('payload is required.')
  if (!isValidDateString(input.generatedAt)) errors.push('generatedAt must be a valid date string.')
  if (typeof input.schemaVersion !== 'string' || input.schemaVersion.length === 0) {
    errors.push('schemaVersion must be a non-empty string.')
  }
  if (typeof input.runtimeVersion !== 'string' || input.runtimeVersion.length === 0) {
    errors.push('runtimeVersion must be a non-empty string.')
  }
  if (input.workspaceId !== undefined && typeof input.workspaceId !== 'string') {
    errors.push('workspaceId must be a string when provided.')
  }
  if (input.portfolioId !== undefined && typeof input.portfolioId !== 'string') {
    errors.push('portfolioId must be a string when provided.')
  }
  if (input.expiresAt !== undefined && !isValidDateString(input.expiresAt)) {
    errors.push('expiresAt must be a valid date string when provided.')
  }

  if (errors.length > 0) return { valid: false, errors }

  return { valid: true, snapshot: input as unknown as DashboardSourceSnapshot, errors: [] }
}

export function validateDashboardSnapshots(inputs: unknown[]): {
  validSnapshots: DashboardSourceSnapshot[]
  invalidCount: number
  errors: string[]
} {
  const validSnapshots: DashboardSourceSnapshot[] = []
  const errors: string[] = []
  let invalidCount = 0

  inputs.forEach((input, index) => {
    const result = validateDashboardSnapshot(input)
    if (result.valid && result.snapshot) {
      validSnapshots.push(result.snapshot)
      return
    }

    invalidCount += 1
    result.errors.forEach((error) => errors.push(`[snapshot:${index}] ${error}`))
  })

  return { validSnapshots, invalidCount, errors }
}
