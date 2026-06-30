# Vault Digestive System — Smoke Test Report

**Generated:** 2026-06-30T22:06:03.044Z
**Dataset:** LATAM Enterprise PM — 5 projects across 51 operational artifacts
**Elapsed:** 43ms

## 1. Digestive Overview

| Metric | Value |
|--------|-------|
| Artifacts processed | 51 |
| Nutrients extracted | 330 |
| Residue items | 15 |
| Avg nutrients/artifact | 6.47 |
| Avg residue/artifact | 0.29 |
| Projects analyzed | 5 |

## 2. Top Detected Themes

| Signal Type | Count |
|-------------|-------|
| dependency_signal | 47 |
| blocker_signal | 35 |
| stakeholder_signal | 35 |
| risk_signal | 29 |
| escalation_signal | 28 |
| ambiguity_signal | 28 |
| governance_gap_signal | 23 |
| commitment_signal | 19 |

## 3. Signal Distribution by Project

### proj-mep-14156
- Artifacts: 10 | Nutrients: 71 | Residue: 3
- Top signals: governance_gap_signal(11), blocker_signal(8), dependency_signal(8), risk_signal(6), stakeholder_signal(6)

### proj-ice-9298
- Artifacts: 10 | Nutrients: 59 | Residue: 4
- Top signals: financial_impediment_signal(9), escalation_signal(7), blocker_signal(7), dependency_signal(7), decision_signal(5)

### proj-gch-15992
- Artifacts: 10 | Nutrients: 58 | Residue: 1
- Top signals: dependency_signal(11), blocker_signal(6), governance_gap_signal(6), commitment_signal(6), ambiguity_signal(6)

### proj-hsa-15576
- Artifacts: 10 | Nutrients: 60 | Residue: 3
- Top signals: stakeholder_signal(10), dependency_signal(7), escalation_signal(6), ambiguity_signal(6), blocker_signal(5)

### proj-muc-13098
- Artifacts: 11 | Nutrients: 82 | Residue: 4
- Top signals: dependency_signal(14), risk_signal(12), stakeholder_signal(11), ambiguity_signal(10), blocker_signal(9)

## 4. Residue Analysis

| Residue Category | Count |
|-----------------|-------|
| vague_concern | 4 |
| ambiguous_ownership | 4 |
| unresolved_timeline_reference | 3 |
| possible_risk | 2 |
| incomplete_stakeholder_mention | 2 |

## 5. False Positive Hotspots

- **[mep-001]** possible_over_triggering: 13 nutrients extracted from a single artifact
- **[mep-003]** possible_over_triggering: 11 nutrients extracted from a single artifact
- **[mep-009]** possible_over_triggering: 9 nutrients extracted from a single artifact
- **[ice-007]** possible_over_triggering: 10 nutrients extracted from a single artifact
- **[ice-007]** escalation_spam: 4 escalation signals from one artifact
- **[gch-004]** possible_over_triggering: 11 nutrients extracted from a single artifact
- **[gch-004]** escalation_spam: 4 escalation signals from one artifact
- **[gch-010]** possible_over_triggering: 9 nutrients extracted from a single artifact
- **[hsa-002]** possible_over_triggering: 9 nutrients extracted from a single artifact
- **[hsa-002]** escalation_spam: 3 escalation signals from one artifact
- **[hsa-004]** possible_over_triggering: 9 nutrients extracted from a single artifact
- **[hsa-009]** possible_over_triggering: 10 nutrients extracted from a single artifact
- **[hsa-009]** escalation_spam: 3 escalation signals from one artifact
- **[muc-005]** possible_over_triggering: 9 nutrients extracted from a single artifact
- **[muc-005]** escalation_spam: 3 escalation signals from one artifact
- **[muc-006]** possible_over_triggering: 10 nutrients extracted from a single artifact
- **[muc-009]** possible_over_triggering: 9 nutrients extracted from a single artifact
- **[muc-010]** possible_over_triggering: 10 nutrients extracted from a single artifact

## 6. Missed Signals

No systematic missed signals detected.

## 7. Decay Observations

- **[proj-mep-14156]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-mep-14156]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-mep-14156]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-mep-14156]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-mep-14156]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-mep-14156]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-mep-14156]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-mep-14156]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-mep-14156]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-mep-14156]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-mep-14156]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-mep-14156]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-mep-14156]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-mep-14156]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-ice-9298]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-ice-9298]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-ice-9298]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-ice-9298]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-ice-9298]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-ice-9298]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-ice-9298]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-ice-9298]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-ice-9298]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-ice-9298]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-ice-9298]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-ice-9298]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-ice-9298]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-ice-9298]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-gch-15992]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-gch-15992]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-gch-15992]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-gch-15992]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-gch-15992]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-gch-15992]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-gch-15992]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-gch-15992]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-gch-15992]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-gch-15992]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-gch-15992]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-hsa-15576]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-hsa-15576]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-hsa-15576]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-hsa-15576]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-hsa-15576]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-hsa-15576]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-hsa-15576]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-hsa-15576]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-hsa-15576]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-hsa-15576]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-hsa-15576]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-muc-13098]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-muc-13098]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-muc-13098]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-muc-13098]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-muc-13098]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-muc-13098]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-muc-13098]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-muc-13098]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-muc-13098]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-muc-13098]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-muc-13098]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-muc-13098]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-muc-13098]** decayed_actionable: High-severity signal decayed below 50% freshness — may need reinforcement
- **[proj-mep-14156]** recurring_unresolved_blockers: Multiple unresolved high-persistence signals — possible chronic governance gap
- **[proj-ice-9298]** recurring_unresolved_blockers: Multiple unresolved high-persistence signals — possible chronic governance gap
- **[proj-gch-15992]** recurring_unresolved_blockers: Multiple unresolved high-persistence signals — possible chronic governance gap
- **[proj-hsa-15576]** recurring_unresolved_blockers: Multiple unresolved high-persistence signals — possible chronic governance gap
- **[proj-muc-13098]** recurring_unresolved_blockers: Multiple unresolved high-persistence signals — possible chronic governance gap

## 8. Cognitive Readiness Score (Internal)

| Dimension | Score |
|-----------|-------|
| coherence | 100/100 |
| signalQuality | 35/100 |
| noiseSuppression | 65/100 |
| determinism | 100/100 |
| realism | 100/100 |
| explainabilityReadiness | 100/100 |
| persistenceReadiness | 100/100 |
| **OVERALL** | **86/100** |

## 9. Learned Patterns

**Total patterns detected:** 37

### Pattern Type Distribution
| Pattern Type | Count |
|-------------|-------|
| delivery_drift_pattern | 7 |
| escalation_trajectory_pattern | 5 |
| recurring_blocker_pattern | 4 |
| recurring_dependency_pattern | 4 |
| stakeholder_pressure_pattern | 4 |
| ambiguity_accumulation_pattern | 4 |
| recovery_pattern | 4 |
| governance_degradation_pattern | 3 |
| financial_friction_pattern | 2 |

### Patterns by Project
**proj-mep-14156** (9 patterns)
- governance_degradation_pattern | severity: high | confidence: 0.4 | status: emerging | recurrences: 2
- delivery_drift_pattern | severity: medium | confidence: 0.4 | status: emerging | recurrences: 2
- recurring_blocker_pattern | severity: high | confidence: 0.74 | status: chronic | recurrences: 8
- recurring_dependency_pattern | severity: medium | confidence: 0.8 | status: chronic | recurrences: 8
- stakeholder_pressure_pattern | severity: medium | confidence: 0.72 | status: chronic | recurrences: 6
- delivery_drift_pattern | severity: medium | confidence: 0.54 | status: confirmed | recurrences: 5
- escalation_trajectory_pattern | severity: high | confidence: 0.74 | status: chronic | recurrences: 6
- ambiguity_accumulation_pattern | severity: low | confidence: 0.48 | status: confirmed | recurrences: 4
- recovery_pattern | severity: low | confidence: 0.4 | status: recovering | recurrences: 3

**proj-muc-13098** (5 patterns)
- escalation_trajectory_pattern | severity: high | confidence: 0.42 | status: emerging | recurrences: 2
- delivery_drift_pattern | severity: medium | confidence: 0.46 | status: confirmed | recurrences: 3
- delivery_drift_pattern | severity: medium | confidence: 0.64 | status: confirmed | recurrences: 4
- ambiguity_accumulation_pattern | severity: low | confidence: 0.8 | status: chronic | recurrences: 10
- financial_friction_pattern | severity: high | confidence: 0.64 | status: confirmed | recurrences: 4

**proj-ice-9298** (7 patterns)
- financial_friction_pattern | severity: high | confidence: 0.8 | status: chronic | recurrences: 9
- escalation_trajectory_pattern | severity: high | confidence: 0.65 | status: confirmed | recurrences: 7
- recurring_blocker_pattern | severity: high | confidence: 0.74 | status: chronic | recurrences: 7
- stakeholder_pressure_pattern | severity: medium | confidence: 0.44 | status: confirmed | recurrences: 3
- delivery_drift_pattern | severity: medium | confidence: 0.58 | status: confirmed | recurrences: 4
- recurring_dependency_pattern | severity: medium | confidence: 0.72 | status: chronic | recurrences: 7
- recovery_pattern | severity: low | confidence: 0.4 | status: recovering | recurrences: 2

**proj-gch-15992** (8 patterns)
- recurring_blocker_pattern | severity: high | confidence: 0.82 | status: chronic | recurrences: 6
- governance_degradation_pattern | severity: high | confidence: 0.56 | status: confirmed | recurrences: 6
- delivery_drift_pattern | severity: medium | confidence: 0.54 | status: confirmed | recurrences: 3
- ambiguity_accumulation_pattern | severity: low | confidence: 0.64 | status: confirmed | recurrences: 6
- stakeholder_pressure_pattern | severity: medium | confidence: 0.6 | status: confirmed | recurrences: 5
- escalation_trajectory_pattern | severity: high | confidence: 0.52 | status: confirmed | recurrences: 5
- recurring_dependency_pattern | severity: medium | confidence: 0.8 | status: chronic | recurrences: 11
- recovery_pattern | severity: low | confidence: 0.4 | status: recovering | recurrences: 3

**proj-hsa-15576** (8 patterns)
- recurring_blocker_pattern | severity: high | confidence: 0.6 | status: confirmed | recurrences: 5
- recurring_dependency_pattern | severity: medium | confidence: 0.64 | status: confirmed | recurrences: 7
- stakeholder_pressure_pattern | severity: medium | confidence: 0.79 | status: chronic | recurrences: 10
- escalation_trajectory_pattern | severity: high | confidence: 0.57 | status: confirmed | recurrences: 6
- ambiguity_accumulation_pattern | severity: low | confidence: 0.72 | status: chronic | recurrences: 6
- delivery_drift_pattern | severity: medium | confidence: 0.68 | status: chronic | recurrences: 5
- governance_degradation_pattern | severity: high | confidence: 0.52 | status: confirmed | recurrences: 5
- recovery_pattern | severity: low | confidence: 0.4 | status: recovering | recurrences: 1

✓ All expected pattern types detected.

## 10. Validation Summary

| Check | Result |
|-------|--------|
| Over-trigger flags | ⚠ 18 |
| Under-trigger flags | ✓ None |
| Lineage violations | ✓ None |
| Determinism mismatches | ✓ Pass |
| Signal density flags | ⚠ 1 |
