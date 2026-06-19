import type { AmendmentChangeRecord, ConstitutionDiff, ConstitutionDiffEntry } from "./amendment-types";

export function generateConstitutionDiff(input: {
  constitutionId: string;
  amendmentId: string;
  changes: AmendmentChangeRecord[];
}): ConstitutionDiff {
  const entries: ConstitutionDiffEntry[] = input.changes.map((change) => ({
    field: change.field_name,
    previousValue: change.old_value,
    newValue: change.new_value,
    changeType: change.change_type,
  }));

  return {
    constitutionId: input.constitutionId,
    amendmentId: input.amendmentId,
    changes: entries,
  };
}
