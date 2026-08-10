import { CANONICAL_OBJECT_KINDS } from "./contracts";
import { CONSUMER_CLASSIFICATIONS, OPERATIONAL_SPINE_CONSUMER_MAP, validateConsumerMap, type ConsumerMapEntry } from "./consumer-map";

export type ConsumerSafetyIssue = Readonly<{ identity: string; code: "invalid_metadata" | "missing_path" | "missing_symbol" | "unsupported_classification" | "unsafe_unresolved" | "missing_canonical_coverage"; detail: string }>;
export type ConsumerSourceReader = Readonly<{ exists(path: string): boolean; read(path: string): string }>;

/** Executable gate with injected I/O so drift and degraded reads are behaviorally testable. */
export function runConsumerSafetyGate(reader: ConsumerSourceReader, entries: readonly ConsumerMapEntry[] = OPERATIONAL_SPINE_CONSUMER_MAP) {
  const issues: ConsumerSafetyIssue[] = validateConsumerMap(entries).map((issue) => ({ identity: `entry:${issue.index}`, code: "invalid_metadata", detail: `${issue.field}: ${issue.message}` }));
  const covered = new Set(entries.flatMap((entry) => entry.objects));
  for (const kind of CANONICAL_OBJECT_KINDS) if (!covered.has(kind)) issues.push({ identity: kind, code: "missing_canonical_coverage", detail: `${kind} has no material consumer` });
  for (const entry of entries) {
    const identity = `${entry.path}#${entry.symbol}:${entry.operation}`;
    if (!(CONSUMER_CLASSIFICATIONS as readonly string[]).includes(entry.classification)) issues.push({ identity, code: "unsupported_classification", detail: entry.classification });
    if (entry.classification === "UNKNOWN_REQUIRES_DECISION") issues.push({ identity, code: "unsafe_unresolved", detail: "Material consumer requires a classification decision" });
    if (!reader.exists(entry.path)) { issues.push({ identity, code: "missing_path", detail: entry.path }); continue; }
    if (!reader.read(entry.path).includes(entry.symbol)) issues.push({ identity, code: "missing_symbol", detail: entry.symbol });
  }
  return { ok: issues.length === 0, inspected: entries.length, issues } as const;
}
