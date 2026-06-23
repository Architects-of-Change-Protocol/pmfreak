import type { ProjectOSAttentionItemRow } from "@/lib/db/database-contract";
import type { OperationalFocusType, GeneratedFocusItem } from "./types";
import { calculateFocusScore } from "./focus-scoring-engine";
import { calculateOperationalPriority } from "./priority-engine";
import { generateFocusRationale } from "./rationale-engine";
import { mapFocusToIntervention } from "./intervention-mapping-engine";
import { recommendFocusOwner } from "./owner-recommendation-engine";
import { calculateFocusDueDate } from "./due-date-engine";

// ─── Focus Detection Engine ────────────────────────────────────────────────────
//
// Transforms Project OS Attention Items into Operational Focus Items.
// This is the core translation layer: attention → operational focus.

const ATTENTION_TYPE_TO_FOCUS_TYPE: Record<string, OperationalFocusType> = {
  authority_gap:           "authority",
  ratification_stall:     "ratification",
  governance_violation:   "governance",
  critical_signal:        "governance",
  overdue_commitment:     "commitment",
  execution_drift:        "execution",
  projection_variance:    "projection",
  ignored_recommendation: "recommendation",
  low_health_score:       "health",
};

type GenerateFocusItemsInput = {
  attentionItems: ProjectOSAttentionItemRow[];
  operatingHealthScore: number;
};

export function generateFocusItemsFromAttention(
  input: GenerateFocusItemsInput
): GeneratedFocusItem[] {
  const { attentionItems, operatingHealthScore } = input;

  return attentionItems.map((item) => {
    const focusScore = calculateFocusScore({
      attentionSeverity: item.attention_severity,
      attentionType: item.attention_type,
      operatingHealthScore,
    });

    const priority = calculateOperationalPriority(focusScore);
    const focusType = ATTENTION_TYPE_TO_FOCUS_TYPE[item.attention_type] ?? "risk";
    const rationale = generateFocusRationale(item.attention_type, priority);
    const recommendedActionType = mapFocusToIntervention(item.attention_type);
    const recommendedOwnerType = recommendFocusOwner(item.attention_type);
    const recommendedDueDate = calculateFocusDueDate(priority);

    return {
      attentionItemId: item.id,
      focusType,
      priority,
      focusScore,
      title: item.title,
      description: item.description,
      rationale,
      recommendedActionType,
      recommendedOwnerType,
      recommendedDueDate,
    };
  });
}
