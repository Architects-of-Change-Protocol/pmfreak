import type { DelegationRecord } from "@/lib/aoc/protocol/types";

export function mapLegacyDelegationRecord(delegation: DelegationRecord): DelegationRecord {
  return {
    ...delegation,
    metadata: delegation.metadata ?? {},
  };
}
