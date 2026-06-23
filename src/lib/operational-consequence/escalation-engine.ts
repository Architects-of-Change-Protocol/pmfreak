// ─── calculateEscalationProbability ──────────────────────────────────────────
// Returns a 0.0–1.0 probability based on operational context factors.

export function calculateEscalationProbability(input: {
  severity: string;
  dependencyDensity: number;
  openCommitments: number;
  activeViolations: number;
  historicalEscalationRate: number;
}): number {
  const severityBase: Record<string, number> = {
    systemic: 0.40,
    critical: 0.30,
    high:     0.20,
    medium:   0.12,
    low:      0.05,
  };

  const base      = severityBase[input.severity] ?? 0.05;
  const deps      = Math.min(input.dependencyDensity * 0.04, 0.20);
  const commits   = Math.min(input.openCommitments * 0.02, 0.15);
  const vios      = Math.min(input.activeViolations * 0.03, 0.15);
  const history   = input.historicalEscalationRate * 0.10;

  const raw = base + deps + commits + vios + history;
  return Math.max(0, Math.min(1, parseFloat(raw.toFixed(3))));
}
