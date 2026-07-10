/**
 * Vault Digestive System — Operational Smoke Test
 *
 * Self-contained validation runner using realistic LATAM enterprise PM artifacts.
 * Extraction logic mirrors the TypeScript source exactly so this script validates
 * the same patterns without requiring TypeScript compilation.
 *
 * Usage:
 *   node scripts/smoke-test-vault-digestion.mjs
 *   node scripts/smoke-test-vault-digestion.mjs --dry-run
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// ─── Inline Extraction Engine ─────────────────────────────────────────────────
// Mirrors src/lib/vault/digestive/* exactly so reports reflect real system behavior.

const NUTRIENT_RULES = [
  {
    nutrientType: 'risk_signal',
    patterns: [/\brisk\b/i, /\bat risk\b/i, /\bthreat\b/i, /\bmay impact\b/i, /\bexposure\b/i, /\bvulnerable\b/i],
  },
  {
    nutrientType: 'blocker_signal',
    patterns: [/\bblocker\b/i, /\bblocked\b/i, /\bcannot proceed\b/i, /\bblocking\s+(?:us|the|delivery|progress)\b/i, /\bstalled\b/i, /\bimpasse\b/i],
    confidenceBoost: 0.1,
  },
  {
    nutrientType: 'stakeholder_signal',
    patterns: [/\bstakeholder\b/i, /\bsponsor\b/i, /\bclient\b/i, /\bexecutive\b/i, /\bvendor\b/i, /\blosing (?:confidence|patience)\b/i],
  },
  {
    nutrientType: 'dependency_signal',
    patterns: [/\bdependency\b/i, /\bdepends on\b/i, /\bwaiting (?:on|for)\b/i, /\bblocked by\b/i, /\bpending from\b/i],
  },
  {
    nutrientType: 'decision_signal',
    patterns: [/\bdecision\b/i, /\bdecided\b/i, /\bsigned off\b/i, /\bwe agreed\b/i, /\bdetermination\b/i],
  },
  {
    nutrientType: 'commitment_signal',
    patterns: [/\bcommit(?:ment|ted)?\b/i, /\bpromise[ds]?\b/i, /\bpledged?\b/i, /\bsla\b/i, /\bguarantee[ds]?\b/i],
  },
  {
    nutrientType: 'delivery_drift_signal',
    patterns: [/\bslip(?:ping|ped)?\b/i, /\bdelay(?:ed|ing)?\b/i, /\bbehind schedule\b/i, /\blate delivery\b/i, /\boverrun\b/i, /\bmissed (?:deadline|milestone)\b/i],
    confidenceBoost: 0.1,
  },
  {
    nutrientType: 'financial_impediment_signal',
    patterns: [/\bbudget\b/i, /\bfunding\b/i, /\bcost overrun\b/i, /\bover budget\b/i, /\bfinancial\b/i, /\$[\d,]+/],
  },
  {
    nutrientType: 'governance_gap_signal',
    patterns: [/\bgovernance\b/i, /\baudit\b/i, /\bcompliance\b/i, /\bapproval\s+(?:missing|needed|required|blocked)\b/i, /\bno\s+(?:owner|decision maker|sign-?off)\b/i],
  },
  {
    nutrientType: 'escalation_signal',
    patterns: [/\bescalat/i, /\braised to\b/i, /\bexecutive review\b/i, /\bexecutive attention\b/i],
    confidenceBoost: 0.1,
  },
  {
    nutrientType: 'recovery_signal',
    patterns: [/\brecovered?\b/i, /\bresolved\b/i, /\bback on track\b/i, /\bmitigated?\b/i, /\bworkaround\b/i],
  },
  {
    nutrientType: 'ambiguity_signal',
    patterns: [/\bunclear\b/i, /\bunknown\b/i, /\bopen question\b/i, /\bpending decision\b/i, /\bnot yet decided\b/i, /\btbd\b/i],
  },
  {
    nutrientType: 'contradiction_signal',
    patterns: [/\bcontradicts?\b/i, /\bconflicts? with\b/i, /\bchanged their (?:mind|position|decision)\b/i, /\bno longer\b/i],
  },
  {
    nutrientType: 'timeline_pressure_signal',
    patterns: [/\bdeadline\b/i, /\bdue (?:by|on|date)\b/i, /\bby (?:end of|close of|COB|EOD|EOW|EOM)\b/i, /\btime(?:line)? pressure\b/i, /\bcrunch\b/i, /\bimminent\b/i, /\burgent\b/i],
  },
];

const RESIDUE_RULES = [
  {
    category: 'vague_concern',
    patterns: [/\bsomething\b.{0,30}\bwrong\b/i, /\bi(?:'m)? not sure\b/i, /\bnot (?:great|good|ideal|clear)\b/i, /\ba bit (?:worried|concerned|uncertain)\b/i, /\bsomething (?:seems|feels) off\b/i],
    rationale: 'Vague concern without specific subject or supporting evidence',
  },
  {
    category: 'unclear_dependency',
    patterns: [/\b(?:might|may) (?:depend|need)\b/i, /\bsomething (?:else|another) (?:first|before)\b/i, /\bnot sure (?:if|whether) (?:we|they) (?:need|depend)\b/i],
    rationale: 'Possible dependency without a clear subject or target',
  },
  {
    category: 'incomplete_stakeholder_mention',
    patterns: [/\bsomeone\b.{0,30}\bsaid\b/i, /\bthey\b.{0,30}\b(?:want|need|said|mentioned)\b/i, /\bthe\s+(?:person|guy|woman|man|individual)\b/i],
    rationale: 'Stakeholder referenced without identification',
  },
  {
    category: 'possible_risk',
    patterns: [/\bcould (?:be|become) (?:a )?(?:problem|issue|risk)\b/i, /\bmight cause\b/i, /\bpotentially\b.{0,40}\brisk\b/i],
    rationale: 'Possible risk signal with insufficient evidence for a nutrient',
  },
  {
    category: 'unresolved_timeline_reference',
    patterns: [/\bsoon(?:ish)?\b/i, /\bin (?:a )?(?:few|couple) (?:days|weeks)\b/i, /\bwhen (?:it's|its|we're|we are) ready\b/i, /\bsome ?time (?:next|later)\b/i],
    rationale: 'Timeline reference without a specific date or milestone anchor',
  },
  {
    category: 'ambiguous_ownership',
    patterns: [/\bsomebody (?:needs? to|should|must)\b/i, /\bwe (?:need|should|must) (?:someone|somebody) to\b/i, /\bno (?:clear )?owner\b/i, /\bunassigned\b/i],
    rationale: 'Ownership implied but no named person or role identified',
  },
];

const DECAY_PROFILES = {
  timeline_pressure_signal: 'fast',
  delivery_drift_signal: 'fast',
  recovery_signal: 'fast',
  ambiguity_signal: 'medium',
  contradiction_signal: 'medium',
  commitment_signal: 'medium',
  decision_signal: 'medium',
  risk_signal: 'medium',
  dependency_signal: 'slow',
  blocker_signal: 'slow',
  stakeholder_signal: 'slow',
  escalation_signal: 'slow',
  financial_impediment_signal: 'persistent',
  governance_gap_signal: 'persistent',
};

const SEVERITY_DEFAULTS = {
  blocker_signal: 'high',
  escalation_signal: 'high',
  governance_gap_signal: 'high',
  financial_impediment_signal: 'high',
  risk_signal: 'medium',
  delivery_drift_signal: 'medium',
  timeline_pressure_signal: 'medium',
  dependency_signal: 'medium',
  stakeholder_signal: 'medium',
  commitment_signal: 'medium',
  contradiction_signal: 'medium',
  decision_signal: 'low',
  ambiguity_signal: 'low',
  recovery_signal: 'low',
};

const HALF_LIFE_DAYS = { fast: 2, medium: 7, slow: 21, persistent: 90 };

// ─── Significance Evaluator (mirrors significance.ts) ────────────────────────

const SIGNIFICANCE_THRESHOLD = 0.35;

const HIGH_INTENSITY_PATTERNS = [
  /\bblocked\b/i, /\bescalat/i, /\boverdue\b/i, /\bunresolved\b/i, /\burgent\b/i,
  /\bcannot proceed\b/i, /\bno response\b/i, /\bnot (?:processed|received|approved|confirmed|responded)\b/i,
  /\bstalled\b/i, /\bstill\s+(?:pending|waiting|blocked)\b/i,
  /\b\d+\s+(?:days?|weeks?)\s+(?:overdue|without|waiting|since)\b/i,
  /\bpayment.{0,20}(?:not|delay|block)/i, /\bfailed?\b/i, /\bimpasse\b/i, /\bat risk\b/i,
];

const LOW_VALUE_FILLER_PATTERNS = [
  /\bfollowing up (?:with|on)\b/i, /^following up\b/i,
  /\breviewing (?:status|alignment|progress)\b/i, /\bmonitoring progress\b/i,
  /\balignment (?:discussion|session|meeting|call|achieved|confirmed)\b/i,
  /\bcoordination (?:ongoing|in progress|happening)\b/i,
  /\bsync (?:completed|done|scheduled)\b/i, /\bdiscussed internally\b/i,
  /\bno (?:major )?issues? to report\b/i, /\bteam meeting (?:completed|held|scheduled)\b/i,
];

export const STAKEHOLDER_PRESSURE_PATTERNS = [
  /\bescalat/i, /\blosing (?:confidence|patience)\b/i, /\bwaiting (?:on|for)\b/i,
  /\bno response\b/i, /\bnot responding\b/i, /\bdelayed? (?:feedback|response|delivery|approval)\b/i,
  /\bdelay/i, /\bconcern/i, /\bfrustrat/i, /\bunresolved\b/i,
  /\bpending (?:approval|response|confirmation|sign)\b/i, /\bblock/i,
  /\brequesting (?:update|clarification|decision|escalation)\b/i,
  /\boverdue\b/i, /\bpressure\b/i, /\bapproval\b/i, /\bat risk\b/i, /\bstalled\b/i,
];

export function evaluateSignificance(line, nutrientType, matchedPatternCount) {
  if (nutrientType === 'stakeholder_signal') {
    const hasPressure = STAKEHOLDER_PRESSURE_PATTERNS.some((p) => p.test(line));
    if (!hasPressure) return { score: 0, suppressed: true, reason: 'stakeholder_bare_reference' };
  }
  const isLowValueFiller = LOW_VALUE_FILLER_PATTERNS.some((p) => p.test(line));
  if (isLowValueFiller) {
    const hasIntensity = HIGH_INTENSITY_PATTERNS.some((p) => p.test(line));
    if (!hasIntensity) return { score: 0.1, suppressed: true, reason: 'low_value_filler' };
  }
  let score = 0.4;
  const intensityMatches = HIGH_INTENSITY_PATTERNS.filter((p) => p.test(line)).length;
  score += Math.min(0.3, intensityMatches * 0.1);
  score += Math.min(0.15, (matchedPatternCount - 1) * 0.05);
  if (/\b\d+\s*(?:days?|weeks?|USD|EUR|\$|hours?|months?)\b/i.test(line)) score += 0.05;
  if (/\b(?:invoice|payment|PO|RMA|SLA|SN-)\b/i.test(line)) score += 0.05;
  if (isLowValueFiller) score -= 0.2;
  score = Math.round(Math.min(1.0, Math.max(0, score)) * 100) / 100;
  if (score < SIGNIFICANCE_THRESHOLD) return { score, suppressed: true, reason: 'below_significance_threshold' };
  return { score, suppressed: false, reason: null };
}

// ─── Deduplicator (mirrors deduplicator.ts) ───────────────────────────────────

const DEDUP_STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'has', 'have', 'been', 'be',
  'to', 'of', 'in', 'for', 'on', 'with', 'as', 'by', 'at', 'from',
  'that', 'this', 'it', 'its', 'and', 'or', 'but', 'not', 'so',
  'we', 'our', 'they', 'their', 'you', 'your', 'will', 'can',
  'still', 'now', 'also', 'just', 'very', 'some', 'any', 'all',
]);

function extractThemeWords(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 3 && !DEDUP_STOP_WORDS.has(w)).slice(0, 6);
}

function themeKey(candidate) {
  const words = extractThemeWords(candidate.summary);
  return `${candidate.nutrientType}:${words.slice(0, 3).join('_')}`;
}

function jaccardSimilarity(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

export function deduplicateCandidates(candidates) {
  const exactGroups = new Map();
  for (const candidate of candidates) {
    const key = themeKey(candidate);
    const existing = exactGroups.get(key);
    if (existing) existing.push(candidate);
    else exactGroups.set(key, [candidate]);
  }
  const representatives = [];
  for (const group of exactGroups.values()) {
    group.sort((a, b) => b.confidence - a.confidence);
    representatives.push({ ...group[0], duplicateMergeCount: group.length - 1, mergedExcerpts: group.slice(1).map((c) => c.excerpt) });
  }
  const final = [];
  const merged = new Set();
  for (let i = 0; i < representatives.length; i++) {
    if (merged.has(i)) continue;
    let rep = representatives[i];
    const repWords = extractThemeWords(rep.summary);
    for (let j = i + 1; j < representatives.length; j++) {
      if (merged.has(j)) continue;
      const other = representatives[j];
      if (rep.nutrientType !== other.nutrientType) continue;
      const otherWords = extractThemeWords(other.summary);
      if (jaccardSimilarity(repWords, otherWords) >= 0.45) {
        const winner = other.confidence > rep.confidence ? other : rep;
        const loser = other.confidence > rep.confidence ? rep : other;
        rep = { ...winner, duplicateMergeCount: rep.duplicateMergeCount + other.duplicateMergeCount + 1, mergedExcerpts: [...(winner.mergedExcerpts ?? []), loser.excerpt, ...(loser.mergedExcerpts ?? [])] };
        representatives[i] = rep;
        merged.add(j);
      }
    }
    final.push(rep);
  }
  return final;
}

function cleanText(raw) {
  return raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function splitLines(cleaned) {
  return cleaned.split(/\n+/).map((l) => l.replace(/^[-•*>\d.)\s]+/, '').trim()).filter((l) => l.length >= 10);
}

function normalizeRawMaterial(material) {
  const cleanedText = cleanText(material.content);
  const lines = splitLines(cleanedText);
  const COMMON_WORDS = new Set(['the', 'and', 'for', 'are', 'was', 'has', 'had', 'not', 'but', 'you', 'this', 'that', 'with', 'from', 'they', 'will']);
  const wordCount = cleanedText.split(/\s+/).filter((w) => w.length > 0 && !COMMON_WORDS.has(w.toLowerCase())).length;
  return { cleanedText, lines, wordCount, rawMaterial: material };
}

export function extractNutrientCandidates(lines) {
  const candidates = [];
  const seen = new Set();
  for (const line of lines) {
    if (line.length < 20) continue;
    const isResolved = /\b(resolved|closed|completed|done|fixed|addressed|no longer blocking)\b/i.test(line);
    for (const { nutrientType, patterns, confidenceBoost } of NUTRIENT_RULES) {
      const matched = patterns.filter((p) => p.test(line));
      if (matched.length === 0) continue;
      const key = `${nutrientType}:${line.slice(0, 60).toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      let confidence = 0.6 + (confidenceBoost ?? 0) + Math.min(0.1, matched.length * 0.05);
      if (isResolved && nutrientType !== 'recovery_signal') confidence *= 0.5;
      if (isResolved && nutrientType === 'recovery_signal') confidence = Math.min(0.9, confidence + 0.15);
      confidence = Math.round(Math.min(0.95, confidence) * 100) / 100;
      const sig = evaluateSignificance(line, nutrientType, matched.length);
      candidates.push({ nutrientType, summary: line.slice(0, 300), excerpt: line.slice(0, 200), matchedPattern: matched[0].toString(), confidence, significanceScore: sig.score, suppressed: sig.suppressed, suppressionReason: sig.reason });
    }
  }
  return candidates;
}

function extractSemanticResidue(lines, workspaceId, projectId, digestionRunId) {
  const residue = [];
  const seen = new Set();
  for (const line of lines) {
    if (line.length < 12) continue;
    for (const { category, patterns, rationale } of RESIDUE_RULES) {
      if (!patterns.some((p) => p.test(line))) continue;
      const key = `${category}:${line.slice(0, 40).toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      residue.push({
        id: crypto.randomUUID(),
        residueCategory: category,
        rawExcerpt: line.slice(0, 300),
        rationale,
        workspaceId,
        projectId,
        digestionRunId,
        createdAt: new Date().toISOString(),
      });
    }
  }
  return residue.slice(0, 30);
}

function scoreNutrient(inputs) {
  const baseSeverity = SEVERITY_DEFAULTS[inputs.nutrientType];
  const severity = inputs.isResolved ? 'low' : baseSeverity;
  const decayProfile = inputs.isResolved ? 'fast' : DECAY_PROFILES[inputs.nutrientType];
  const evidenceStrength = inputs.confidence >= 0.8 ? 'strong' : inputs.confidence >= 0.6 ? 'moderate' : 'weak';
  const actionability = severity === 'critical' || severity === 'high' ? 'actionable' : severity === 'medium' ? 'monitor' : 'informational';
  const ambiguityLevel = inputs.confidence < 0.5 ? 'highly_ambiguous' : inputs.confidence < 0.7 ? 'ambiguous' : 'clear';
  const recurrenceHint = inputs.isRecurring ? 'confirmed_recurrence' : 'first_occurrence';
  return { confidence: inputs.confidence, severity, freshness: 1.0, recurrenceHint, ambiguityLevel, actionability, evidenceStrength, decayProfile, significanceScore: inputs.significanceScore };
}

function computeDecayedFreshness(input) {
  const now = Date.now();
  const referenceMs = input.lastSeenAt ? Date.parse(input.lastSeenAt) : Date.parse(input.createdAt);
  const ageDays = Math.max(0, (now - referenceMs) / 86_400_000);
  const halfLifeDays = HALF_LIFE_DAYS[input.decayProfile];
  let freshness = Math.pow(0.5, ageDays / halfLifeDays);
  const recurrenceBoost = Math.min(0.3, (input.recurrenceCount ?? 0) * 0.05);
  freshness = Math.min(1, freshness + recurrenceBoost);
  if (input.isRecovered) freshness *= 0.33;
  return Math.round(Math.max(0, Math.min(1, freshness)) * 100) / 100;
}

function buildEvidenceLineage(rawMaterial, excerpt, confidenceBasis) {
  return {
    sourceArtifactId: rawMaterial.id,
    sourceType: rawMaterial.type,
    sourceTitle: rawMaterial.title,
    excerpt: excerpt.slice(0, 500),
    timestamp: rawMaterial.submittedAt,
    workspaceId: rawMaterial.workspaceId,
    projectId: rawMaterial.projectId,
    actorUserId: rawMaterial.actorUserId,
    confidenceBasis,
    extractionMethod: 'rule_based',
  };
}

export function runDigestivePipeline(rawMaterial, context) {
  const runId = context.traceId;
  const startedAt = context.digestedAt;
  const normalized = normalizeRawMaterial(rawMaterial);
  const allCandidates = extractNutrientCandidates(normalized.lines);
  const suppressedCandidateCount = allCandidates.filter((c) => c.suppressed).length;
  const activeCandidates = allCandidates.filter((c) => !c.suppressed);
  const deduplicatedCandidates = deduplicateCandidates(activeCandidates);
  const nutrients = deduplicatedCandidates.map((candidate) => {
    const evidence = buildEvidenceLineage(rawMaterial, candidate.excerpt, `Pattern matched: ${candidate.matchedPattern}. Rule-based line-level extraction.`);
    const scoring = scoreNutrient({ nutrientType: candidate.nutrientType, confidence: candidate.confidence, significanceScore: candidate.significanceScore });
    return {
      id: crypto.randomUUID(),
      nutrientType: candidate.nutrientType,
      summary: candidate.summary,
      entities: [],
      evidence: [evidence],
      scoring,
      duplicateMergeCount: candidate.duplicateMergeCount,
      workspaceId: context.workspaceId,
      projectId: context.projectId,
      digestionRunId: runId,
      createdAt: context.digestedAt,
    };
  });
  const residue = extractSemanticResidue(normalized.lines, context.workspaceId, context.projectId, runId);
  const completedAt = new Date().toISOString();
  const digestivePass = {
    runId,
    rawMaterialId: rawMaterial.id,
    workspaceId: context.workspaceId,
    projectId: context.projectId,
    actorUserId: context.actorUserId,
    startedAt,
    completedAt,
    extractionMethod: 'rule_based',
    nutrientCount: nutrients.length,
    residueCount: residue.length,
    entityCount: 0,
    suppressedCandidateCount,
  };
  return { digestivePass, nutrients, residue, entities: [] };
}

// ─── Simulation Dataset ───────────────────────────────────────────────────────

export const SIMULATION_ARTIFACTS = [

  // ── MEP-14156: Cisco Umbrella Rollout ─────────────────────────────────────

  {
    id: 'mep-001',
    workspaceId: 'ws-mep',
    projectId: 'proj-mep-14156',
    actorUserId: 'user-carolina-vega',
    type: 'operational_update',
    title: 'MEP-14156 Weekly Status — Tenant Provisioning Blocked',
    submittedAt: '2026-04-02T09:15:00Z',
    sourceRef: 'user-carolina-vega:pm_update',
    content: `Status update for week 14 — Cisco Umbrella rollout.
Tenant provisioning is blocked by Cisco SASE portal access issue.
We cannot proceed with SIG configuration until tenant admin credentials are issued.
Blocker: Cisco regional team has not responded to the provisioning request submitted on March 28.
Dependency: onboarding schedule depends on receiving admin credentials from Cisco.
Timeline pressure: client committed to cybersecurity audit by April 18 — this delay puts us at risk.
Waiting for Cisco account manager Carlos Méndez to confirm escalation path.`,
  },

  {
    id: 'mep-002',
    workspaceId: 'ws-mep',
    projectId: 'proj-mep-14156',
    actorUserId: 'user-rodrigo-salinas',
    type: 'email_update',
    title: 'FWD: Cisco CCW Quote Approval Pending — Umbrella Licenses',
    submittedAt: '2026-04-05T14:30:00Z',
    sourceRef: 'user-rodrigo-salinas:email',
    content: `Forwarding approval request to procurement.
The Cisco CCW quote for 250 Umbrella DNS licenses is pending approval from the procurement committee.
Financial commitment required: $14,500 USD for 1-year term.
Approval needed from IT Director and CFO before order can be submitted.
If approval is not received by April 10, Cisco partner pricing expires and we face a $2,100 price increase.
Governance gap: no designated approver identified for vendor purchases over $10,000.
Budget allocation confirmed in Q2 plan but funds not yet released for this line item.`,
  },

  {
    id: 'mep-003',
    workspaceId: 'ws-mep',
    projectId: 'proj-mep-14156',
    actorUserId: 'user-fabian-torres',
    type: 'stakeholder_communication',
    title: 'ESCALATION: MDM Integration Stalled — Client IT Director Notified',
    submittedAt: '2026-04-08T11:00:00Z',
    sourceRef: 'user-fabian-torres:escalation',
    content: `Escalation raised to client IT Director Jorge Paredes.
The MDM integration for Cisco Umbrella iOS profiles is stalled.
Intune connector configuration has been blocked by the client network team for 12 days.
Client network team lead has not responded to our technical coordination requests.
The project is losing momentum and the client is losing patience with the delays.
Executive attention required: IT Director needs to unblock internal teams.
Risk: if not resolved by April 12, the mobile device rollout cannot start before the audit window.`,
  },

  {
    id: 'mep-004',
    workspaceId: 'ws-mep',
    projectId: 'proj-mep-14156',
    actorUserId: 'user-carolina-vega',
    type: 'risk_blocker_note',
    title: 'Technical Note: VPN Roaming Profiles Not Pushed',
    submittedAt: '2026-04-10T16:45:00Z',
    sourceRef: 'user-carolina-vega:technical_note',
    content: `Technical coordination update.
VPN roaming profiles for Umbrella have not been pushed to the 47 enrolled devices.
Blocked by: Intune policy conflict with existing VPN profile from legacy provider.
Risk: pushing the new profile without resolving the conflict may impact production devices.
Cannot proceed until the legacy VPN profile is explicitly revoked by the client network team.
Waiting for confirmation from client sysadmin Beatriz Rojas.
Estimated unblock: April 13 if network team responds by April 11.`,
  },

  {
    id: 'mep-005',
    workspaceId: 'ws-mep',
    projectId: 'proj-mep-14156',
    actorUserId: 'user-rodrigo-salinas',
    type: 'project_note',
    title: 'MEP-14156 Onboarding Schedule Confirmed — Week of April 14',
    submittedAt: '2026-04-11T10:00:00Z',
    sourceRef: 'user-rodrigo-salinas:schedule',
    content: `Onboarding schedule confirmed with client.
We committed to complete headquarters user onboarding by April 18.
Cisco partner engineer available April 14-15 for supervised configuration session.
Client committed to have IT team available for the full two-day session.
SLA: first 50 users must be operational within 72 hours of session start.
Guarantee from Cisco: technical support available throughout onboarding window.
Dependency: tenant credentials must be received by April 12 for this timeline to hold.`,
  },

  {
    id: 'mep-006',
    workspaceId: 'ws-mep',
    projectId: 'proj-mep-14156',
    actorUserId: 'user-carolina-vega',
    type: 'email_update',
    title: 'Branch Office MFA Enrollment — Unclear Process for Remote Users',
    submittedAt: '2026-04-15T09:30:00Z',
    sourceRef: 'user-carolina-vega:email',
    content: `Open question on MFA enrollment for branch office staff.
It is unclear whether branch office users need to complete MFA reset before or after Umbrella enrollment.
Cisco documentation is ambiguous on this point for hybrid deployments.
TBD: need to confirm with Cisco TAC whether the MFA reset can happen in parallel.
Not yet decided: whether branch users need to be on-site or can self-enroll remotely.
I'm not sure how the remote enrollment workflow interacts with the existing AD sync.
This could be a problem for the 30 branch users scheduled for April 22.`,
  },

  {
    id: 'mep-007',
    workspaceId: 'ws-mep',
    projectId: 'proj-mep-14156',
    actorUserId: 'user-fabian-torres',
    type: 'risk_blocker_note',
    title: 'Blocker: Cisco Smart Account Not Activated for License Assignment',
    submittedAt: '2026-04-17T14:00:00Z',
    sourceRef: 'user-fabian-torres:blocker',
    content: `Critical blocker identified in license management workflow.
Cisco Smart Account for the client has not been activated.
Without Smart Account activation, we cannot assign purchased Umbrella licenses to users.
Approval required from Cisco Smart Account admin before we can proceed.
Governance gap: no owner identified within client organization for the Cisco portal admin role.
Compliance concern: operating without activated licenses creates audit exposure.
Escalated to Cisco account team — response time unknown.`,
  },

  {
    id: 'mep-008',
    workspaceId: 'ws-mep',
    projectId: 'proj-mep-14156',
    actorUserId: 'user-rodrigo-salinas',
    type: 'operational_update',
    title: 'MEP-14156 Update — HQ Onboarding Completed Successfully',
    submittedAt: '2026-04-20T18:00:00Z',
    sourceRef: 'user-rodrigo-salinas:update',
    content: `Positive update from headquarters onboarding session.
The HQ onboarding was completed successfully on April 19.
52 users are now enrolled and Umbrella DNS filtering is operational.
The Intune profile conflict was resolved by the client network team on April 14.
Back on track for branch office rollout starting April 22.
Remaining scope: 3 branch offices and 30 remote users still pending.
Client IT Director confirmed satisfaction with HQ deployment results.`,
  },

  {
    id: 'mep-009',
    workspaceId: 'ws-mep',
    projectId: 'proj-mep-14156',
    actorUserId: 'user-fabian-torres',
    type: 'stakeholder_communication',
    title: 'ESCALATION: CTO Requesting Weekly Status on Full Rollout Timeline',
    submittedAt: '2026-04-24T09:00:00Z',
    sourceRef: 'user-fabian-torres:escalation',
    content: `Escalation from client CTO office.
The client CTO is requesting executive-level visibility on Cisco Umbrella rollout completion.
Executive review scheduled for May 2 — need to present full rollout timeline with firm dates.
CTO raised concerns about the cybersecurity audit timeline given the branch delays.
Timeline pressure: cybersecurity audit is set for May 15 — all sites must be operational by May 10.
Stakeholder expectation: full coverage of all 4 sites before audit date.
We need to accelerate the branch office schedule or the audit is at risk.`,
  },

  {
    id: 'mep-010',
    workspaceId: 'ws-mep',
    projectId: 'proj-mep-14156',
    actorUserId: 'user-carolina-vega',
    type: 'project_note',
    title: 'Cybersecurity Validation Delayed — Branch Office Network Issues',
    submittedAt: '2026-04-28T11:30:00Z',
    sourceRef: 'user-carolina-vega:note',
    content: `Branch office network validation delayed.
Cybersecurity team validation for Sucursal Norte is delayed due to network infrastructure issues.
The branch switch firmware is incompatible with Umbrella roaming client requirements.
This was not identified during the scoping phase — delivery drift from original plan.
Delay estimate: 5 additional days to replace firmware and revalidate.
Risk: this delay impacts all remaining branch deployments if the issue exists in other locations.
Dependency: validation depends on client network team completing firmware updates before our team visits.`,
  },

  // ── ICE-9298: PowerStore Storage Expansion ────────────────────────────────

  {
    id: 'ice-001',
    workspaceId: 'ws-ice',
    projectId: 'proj-ice-9298',
    actorUserId: 'user-miguel-fuentes',
    type: 'stakeholder_communication',
    title: 'ESCALATION: Payment Not Processed — Dell EMC Blocking Equipment Release',
    submittedAt: '2026-04-03T08:45:00Z',
    sourceRef: 'user-miguel-fuentes:escalation',
    content: `Critical financial escalation requiring immediate attention.
Dell EMC account manager Luis Vargas has confirmed that the PowerStore 1000T unit will not be released until payment is confirmed.
Invoice #DE-2026-04871 for $87,400 USD has not been processed by the client finance team.
Payment was due March 28 — now 6 days overdue.
Financial impediment is blocking the entire storage expansion delivery.
Escalated to client CFO Patricia Morales — no response yet.
Risk: Dell EMC may cancel the order and reprice if payment is not confirmed by April 10.`,
  },

  {
    id: 'ice-002',
    workspaceId: 'ws-ice',
    projectId: 'proj-ice-9298',
    actorUserId: 'user-diana-castillo',
    type: 'operational_update',
    title: 'ICE-9298 Status — Delivery on Hold, PO Approved But Funds Not Transferred',
    submittedAt: '2026-04-07T14:00:00Z',
    sourceRef: 'user-diana-castillo:update',
    content: `Procurement update for PowerStore expansion.
The purchase order for the PowerStore 1000T has been formally approved by the client procurement committee.
However, the treasury department has not transferred funds to the vendor payment account.
Financial status: PO approved, budget allocated, but payment not yet executed.
Delivery is on hold pending payment confirmation from Dell EMC logistics team.
Blocker: treasury team claims the wire transfer instructions from Dell EMC are unclear.
Not yet decided: whether to use existing bank account on file or new wire instructions.
Timeline: if resolved today, delivery can be rescheduled for April 14-15.`,
  },

  {
    id: 'ice-003',
    workspaceId: 'ws-ice',
    projectId: 'proj-ice-9298',
    actorUserId: 'user-miguel-fuentes',
    type: 'project_note',
    title: 'Internal Note: Finance Team Not Clearing Invoice — Operational Impact',
    submittedAt: '2026-04-09T10:30:00Z',
    sourceRef: 'user-miguel-fuentes:note',
    content: `Internal operational note on finance delay.
The client finance team has still not processed the Dell EMC invoice after 12 days.
Someone said there is an internal approval process requiring dual authorization for payments over $50,000.
They want both the IT Director and Finance Director to sign off — but Finance Director is traveling.
This is not an approved process according to our procurement agreement with the client.
The process they are following conflicts with the agreed payment terms.
No clear owner within the finance team is driving resolution.
We need to escalate this through a different channel before Dell EMC cancels.`,
  },

  {
    id: 'ice-004',
    workspaceId: 'ws-ice',
    projectId: 'proj-ice-9298',
    actorUserId: 'user-diana-castillo',
    type: 'risk_blocker_note',
    title: 'Blocker: Logistics Coordinator Unreachable — Delivery Rescheduling Stalled',
    submittedAt: '2026-04-11T16:00:00Z',
    sourceRef: 'user-diana-castillo:blocker',
    content: `Logistics coordination blocker.
Our logistics coordinator at Dell EMC is unreachable since April 9.
The delivery rescheduling request for the PowerStore unit has not been acknowledged.
Cannot proceed with installation planning without confirmed delivery date.
Dependency: data center access booking depends on confirmed delivery date from Dell logistics.
Risk: if delivery lands without prior notice, the data center team may reject the shipment.
Waiting for Dell EMC account manager to reassign logistics coordinator.
Stalled: two phone calls and four emails — no response.`,
  },

  {
    id: 'ice-005',
    workspaceId: 'ws-ice',
    projectId: 'proj-ice-9298',
    actorUserId: 'user-miguel-fuentes',
    type: 'email_update',
    title: 'To Client: Storage Expansion Timeline At Risk Due to Payment Delay',
    submittedAt: '2026-04-13T09:00:00Z',
    sourceRef: 'user-miguel-fuentes:email',
    content: `Formal communication to client IT management.
We need to formally inform you that the PowerStore storage expansion timeline is at risk.
The 15-day delivery window originally committed for April 10-25 is no longer achievable.
Payment delay has pushed expected delivery to late April at the earliest.
Financial impediment impact: each additional week of delay carries a $3,200 cost in data center reservation fees.
New delivery estimate: April 28 — May 2, pending payment confirmation this week.
Risk to production: current storage utilization is at 78%. Projected to hit 85% capacity by May 5.
Client must prioritize payment resolution this week to avoid production impact.`,
  },

  {
    id: 'ice-006',
    workspaceId: 'ws-ice',
    projectId: 'proj-ice-9298',
    actorUserId: 'user-diana-castillo',
    type: 'operational_update',
    title: 'ICE-9298 Update — Wire Transfer Confirmed, Awaiting Dell Release',
    submittedAt: '2026-04-16T15:30:00Z',
    sourceRef: 'user-diana-castillo:update',
    content: `Positive financial development.
The client treasury team confirmed wire transfer of $87,400 USD to Dell EMC on April 15.
Waiting for Dell EMC to confirm receipt and release the equipment for shipping.
Dependency: equipment release depends on Dell finance team confirming the payment.
Estimated release timeline: 2 business days from payment confirmation.
Commitment from Dell account manager: will notify us immediately upon release.
Pending: data center access booking — in a few days once delivery date is confirmed.`,
  },

  {
    id: 'ice-007',
    workspaceId: 'ws-ice',
    projectId: 'proj-ice-9298',
    actorUserId: 'user-miguel-fuentes',
    type: 'stakeholder_communication',
    title: 'ESCALATION: CFO Demands Resolution — Billing Department Must Act',
    submittedAt: '2026-04-14T11:00:00Z',
    sourceRef: 'user-miguel-fuentes:escalation',
    content: `Escalation from CFO Patricia Morales requires urgent action.
CFO has escalated this to the billing department with urgent priority.
The CFO is requesting daily status updates until equipment is delivered and installed.
Financial concern: the extended delay is creating budget variance that needs to be documented.
Executive attention: CFO will raise this in the board operations committee if not resolved by April 17.
Raised to: VP of Operations and Finance Director simultaneously.
Urgent: billing team must process the final payment confirmation and close the vendor account dispute today.`,
  },

  {
    id: 'ice-008',
    workspaceId: 'ws-ice',
    projectId: 'proj-ice-9298',
    actorUserId: 'user-diana-castillo',
    type: 'project_note',
    title: 'Technical Specs Confirmed — PowerStore Configuration Plan Signed Off',
    submittedAt: '2026-04-18T10:00:00Z',
    sourceRef: 'user-diana-castillo:note',
    content: `Technical planning milestone.
Storage configuration specifications for the PowerStore 1000T have been finalized and signed off.
We agreed on 12TB usable capacity across 3 storage pools with tiered SSD configuration.
Decision: RAID-5 protection for primary pools, RAID-6 for archive pool.
IT Director confirmed the configuration meets current and 18-month projected capacity needs.
Installation scope confirmed: 2 days on-site with 1 day validation and handover.
This decision resolves the technical specification ambiguity from the previous sprint.`,
  },

  {
    id: 'ice-009',
    workspaceId: 'ws-ice',
    projectId: 'proj-ice-9298',
    actorUserId: 'user-miguel-fuentes',
    type: 'operational_update',
    title: 'ICE-9298 Update — Partial Shipment Received, Main Storage Unit Still Pending',
    submittedAt: '2026-04-22T13:00:00Z',
    sourceRef: 'user-miguel-fuentes:update',
    content: `Partial delivery update.
Accessories and cabling kit for PowerStore arrived at data center on April 22.
The main PowerStore 1000T storage unit has not been shipped yet.
Dell logistics shows the unit is still in the regional warehouse in Santiago.
Delivery drift: original commitment was full delivery by April 25 — now looking at April 29 at earliest.
Dependency: installation cannot begin until the main unit arrives and passes physical inspection.
Client data center team is on standby — extended availability reservation is generating additional cost.`,
  },

  {
    id: 'ice-010',
    workspaceId: 'ws-ice',
    projectId: 'proj-ice-9298',
    actorUserId: 'user-diana-castillo',
    type: 'email_update',
    title: 'Dell Account Manager Requesting Payment Receipt Confirmation',
    submittedAt: '2026-04-25T09:30:00Z',
    sourceRef: 'user-diana-castillo:email',
    content: `Vendor follow-up on payment confirmation.
Dell EMC account manager is requesting written confirmation of wire transfer receipt for their records.
Client finance team needs to send the SWIFT confirmation document to Dell vendor relations.
Waiting for client finance coordinator to provide the SWIFT receipt.
Blocker: Dell will not finalize delivery scheduling without this document.
Dependency on client finance team: this single document is blocking the final delivery step.
Vendor is committed to same-week delivery once documentation is provided.`,
  },

  // ── GCH-15992: ManageEngine + Cisco Licensing ─────────────────────────────

  {
    id: 'gch-001',
    workspaceId: 'ws-gch',
    projectId: 'proj-gch-15992',
    actorUserId: 'user-andrea-molina',
    type: 'risk_blocker_note',
    title: 'Blocker: Cisco Smart Account Not Activated — License Assignment Impossible',
    submittedAt: '2026-04-04T10:00:00Z',
    sourceRef: 'user-andrea-molina:blocker',
    content: `Critical blocking issue in licensing workflow.
The Cisco Smart Account for this client has not been activated despite the purchase being completed 3 weeks ago.
Without Smart Account activation, license assignment to devices is impossible.
Cannot proceed with Cisco DNA Center deployment until licenses are assigned.
Governance gap: the Smart Account admin role has no named owner within the client IT department.
Approval required from Cisco regional team to override the activation delay.
Compliance concern: deployed devices are running in evaluation mode — this creates audit exposure.`,
  },

  {
    id: 'gch-002',
    workspaceId: 'ws-gch',
    projectId: 'proj-gch-15992',
    actorUserId: 'user-pablo-restrepo',
    type: 'email_update',
    title: 'ManageEngine — Guided Session Scheduled for April 8',
    submittedAt: '2026-04-05T14:00:00Z',
    sourceRef: 'user-pablo-restrepo:email',
    content: `ManageEngine vendor coordination update.
ManageEngine regional partner has committed to a guided implementation session on April 8.
Session will cover ServiceDesk Plus configuration and asset management module setup.
Commitment from ManageEngine: technical consultant available for full-day session 9am-5pm.
Client IT team lead confirmed they will have 3 engineers available for the session.
SLA for this milestone: session completion activates the 30-day support window.
Promised deliverable: configuration guide document at end of session.`,
  },

  {
    id: 'gch-003',
    workspaceId: 'ws-gch',
    projectId: 'proj-gch-15992',
    actorUserId: 'user-andrea-molina',
    type: 'project_note',
    title: 'MFA Reset Process — Unclear for Multiple Users After License Migration',
    submittedAt: '2026-04-09T11:30:00Z',
    sourceRef: 'user-andrea-molina:note',
    content: `Post-migration MFA issue affecting multiple users.
Following the Cisco license migration, several users are unable to authenticate via Cisco Duo MFA.
The process for MFA reset is unclear — Cisco documentation shows two different flows depending on account type.
Unknown: whether these users are on Smart Account or legacy license accounts.
Open question: should MFA reset happen before or after Smart Account activation?
TBD with Cisco TAC whether bulk MFA reset is possible or requires individual case handling.
Ambiguity is causing user support backlog — IT helpdesk receiving 8-10 calls daily.`,
  },

  {
    id: 'gch-004',
    workspaceId: 'ws-gch',
    projectId: 'proj-gch-15992',
    actorUserId: 'user-pablo-restrepo',
    type: 'stakeholder_communication',
    title: 'ESCALATION: License Activation Delayed 3 Weeks — Client Frustrated',
    submittedAt: '2026-04-12T09:00:00Z',
    sourceRef: 'user-pablo-restrepo:escalation',
    content: `Escalation raised by client IT Director.
Client IT Director Camila Navarro has formally escalated the Cisco license activation delay.
Three weeks have passed since purchase — licenses remain unactivated.
Delivery drift: original activation commitment was 5 business days post-purchase.
Client is frustrated with the vendor response time and considers this a breach of service commitment.
Escalated to Cisco Latin America partner manager for expedited resolution.
Executive review requested: client wants weekly status call with Cisco executive until resolved.`,
  },

  {
    id: 'gch-005',
    workspaceId: 'ws-gch',
    projectId: 'proj-gch-15992',
    actorUserId: 'user-andrea-molina',
    type: 'risk_blocker_note',
    title: 'Dependency: Cisco DNA Center Access — Portal Blocked for Configuration',
    submittedAt: '2026-04-14T15:00:00Z',
    sourceRef: 'user-andrea-molina:blocker',
    content: `Technical dependency preventing configuration progress.
Cisco DNA Center portal access is blocked for the project team.
We are waiting for Cisco to provision access credentials for the client-specific DNA Center instance.
Blocked by: Cisco provisioning team — ticket #CS-2026-19847 open for 8 days with no update.
Dependency: network policy configuration depends on DNA Center access.
Cannot finalize device onboarding workflow without portal access.
Pending from Cisco: access credentials and initial admin setup guide.`,
  },

  {
    id: 'gch-006',
    workspaceId: 'ws-gch',
    projectId: 'proj-gch-15992',
    actorUserId: 'user-pablo-restrepo',
    type: 'email_update',
    title: 'Cisco Smart Account Approval — Waiting on Regional Partner Manager',
    submittedAt: '2026-04-16T10:30:00Z',
    sourceRef: 'user-pablo-restrepo:email',
    content: `Smart Account approval status update.
Smart Account activation requires formal approval from the Cisco regional partner manager.
Vendor dependency: the regional partner manager handles this type of emergency activation.
Waiting for confirmation from Cisco regional on timeline for manual activation bypass.
Client sponsor confirmed they are comfortable with the manual activation path.
Stakeholder alignment achieved — just waiting on the vendor response.
In a few weeks the standard activation process will be automated, but we cannot wait that long.`,
  },

  {
    id: 'gch-007',
    workspaceId: 'ws-gch',
    projectId: 'proj-gch-15992',
    actorUserId: 'user-andrea-molina',
    type: 'project_note',
    title: 'Licensing Confusion — Two License Types Creating Contradictory Requirements',
    submittedAt: '2026-04-18T11:00:00Z',
    sourceRef: 'user-andrea-molina:note',
    content: `Licensing model conflict identified.
Two different Cisco license types were purchased: Advantage and Premier tier.
The requirements for these two tiers conflict with each other in the DNA Center activation flow.
Contradiction: the Advantage license requires Smart Account activation first, but the Premier license conflicts with Smart Account model.
No longer clear which activation path is correct given the mixed license environment.
The vendor documentation contradicts what the Cisco TAC engineer advised on the last call.
Open question: which license type takes precedence and which activation flow do we follow?`,
  },

  {
    id: 'gch-008',
    workspaceId: 'ws-gch',
    projectId: 'proj-gch-15992',
    actorUserId: 'user-pablo-restrepo',
    type: 'operational_update',
    title: 'Dual-Vendor Coordination — ManageEngine and Cisco Dependencies Tangled',
    submittedAt: '2026-04-20T14:00:00Z',
    sourceRef: 'user-pablo-restrepo:update',
    content: `Cross-vendor dependency complexity.
ManageEngine ServiceDesk asset management and Cisco license tracking are now tangled dependencies.
The ManageEngine connector for Cisco license inventory requires the Smart Account to be active.
Dependency: ManageEngine integration depends on Cisco Smart Account activation.
Vendor coordination required between ManageEngine regional and Cisco partner team.
Both vendors are pointing to each other as the blocker — neither is taking ownership.
Stakeholder coordination needed: someone needs to bring both vendors to the same table.
Timeline impact: every week of delay extends the go-live by at least one week.`,
  },

  {
    id: 'gch-009',
    workspaceId: 'ws-gch',
    projectId: 'proj-gch-15992',
    actorUserId: 'user-andrea-molina',
    type: 'email_update',
    title: 'ManageEngine Session Completed — Several Open Items Remain',
    submittedAt: '2026-04-23T17:00:00Z',
    sourceRef: 'user-andrea-molina:email',
    content: `ManageEngine guided session follow-up.
The April 8 ManageEngine session was completed — ServiceDesk Plus is now configured and operational.
The asset management module is live and scanning the network.
However, several open items remain from the session that were not resolved.
Cisco integration is still pending due to Smart Account activation blocker.
MFA configuration for ManageEngine admin accounts is unclear — needs follow-up with vendor.
Back on track for the ManageEngine scope but Cisco integration is a residual dependency.
Next session scheduled for May 2 to address remaining open items.`,
  },

  {
    id: 'gch-010',
    workspaceId: 'ws-gch',
    projectId: 'proj-gch-15992',
    actorUserId: 'user-pablo-restrepo',
    type: 'risk_blocker_note',
    title: 'Portal Access Still Pending — Vendor Side Delay',
    submittedAt: '2026-04-26T10:00:00Z',
    sourceRef: 'user-pablo-restrepo:blocker',
    content: `Persistent vendor-side blocker.
DNA Center portal access is still pending from Cisco vendor side.
Cisco provisioning ticket has been open for 20 days without resolution.
Governance gap: there is no clear escalation owner within Cisco for overdue provisioning tickets.
The client is no longer willing to wait for the standard process.
Approval needed from Cisco Latin America director to override the provisioning queue.
Compliance risk: the project cannot complete the governance review without confirmed portal access.`,
  },

  // ── HSA-15576: CCTV Deployment + RMAs ─────────────────────────────────────

  {
    id: 'hsa-001',
    workspaceId: 'ws-hsa',
    projectId: 'proj-hsa-15576',
    actorUserId: 'user-lorena-perez',
    type: 'operational_update',
    title: 'HSA-15576 Status — CCTV Installation 60% Complete, Infrastructure Pending',
    submittedAt: '2026-04-06T09:00:00Z',
    sourceRef: 'user-lorena-perez:update',
    content: `CCTV deployment progress update.
Installation is 60% complete across the facility.
Operational areas A and B completed — cameras operational and NVR recording confirmed.
Areas C, D and server room are pending due to civil works not being completed.
Blocked by: civil contractor has not finished conduit installation in areas C and D.
Delivery drift: original completion date was April 10 — now estimating April 20 at earliest.
Dependency: camera installation depends on conduit availability from civil contractor.
Risk: server room installation requires network backbone connection that is not yet ready.`,
  },

  {
    id: 'hsa-002',
    workspaceId: 'ws-hsa',
    projectId: 'proj-hsa-15576',
    actorUserId: 'user-tomas-guerrero',
    type: 'stakeholder_communication',
    title: 'Client Email: Operational Areas Not Ready — Security Manager Escalating',
    submittedAt: '2026-04-09T14:30:00Z',
    sourceRef: 'user-tomas-guerrero:email',
    content: `Client escalation from security operations team.
Client security manager Roberto Quispe has escalated that areas C and D have not been completed.
The security manager is under operational pressure from facility management.
Stakeholder concern: new security incident occurred in area D while cameras are still inactive.
Client sponsor is losing confidence in the project timeline.
Escalated to our project director — requesting executive review of remaining scope.
Commitment expected: firm date for areas C and D completion needed by April 11.`,
  },

  {
    id: 'hsa-003',
    workspaceId: 'ws-hsa',
    projectId: 'proj-hsa-15576',
    actorUserId: 'user-lorena-perez',
    type: 'risk_blocker_note',
    title: 'RMA Request Submitted — 3 Defective Cameras Identified',
    submittedAt: '2026-04-11T11:00:00Z',
    sourceRef: 'user-lorena-perez:blocker',
    content: `Equipment quality issue requiring RMA process.
Three cameras installed in area A were found to have image quality defects during acceptance testing.
RMA request submitted to vendor Hikvision on April 11 for units: SN-HV-22301, SN-HV-22302, SN-HV-22318.
Vendor RMA process typically takes 10-15 business days.
Risk: client acceptance for area A cannot be formally signed until RMA units are replaced.
Ambiguity: unclear whether vendor will send advance replacement or require defective units returned first.
Unknown: whether RMA units will arrive before the client acceptance ceremony planned for April 30.`,
  },

  {
    id: 'hsa-004',
    workspaceId: 'ws-hsa',
    projectId: 'proj-hsa-15576',
    actorUserId: 'user-tomas-guerrero',
    type: 'project_note',
    title: 'NVR Configuration Pending Civil Works — Technical Dependency',
    submittedAt: '2026-04-14T10:00:00Z',
    sourceRef: 'user-tomas-guerrero:note',
    content: `NVR technical configuration dependency.
NVR rack configuration for the server room cannot proceed until civil works are completed.
Dependency: server room power distribution board installation depends on electrical contractor.
The electrical contractor is a separate vendor contracted directly by the client.
Waiting for client facilities manager to confirm electrical contractor schedule.
Timeline pressure: NVR must be configured and tested before April 28 to allow full system validation before April 30 acceptance.
Risk: if civil works slip past April 18, the April 30 acceptance deadline is not achievable.`,
  },

  {
    id: 'hsa-005',
    workspaceId: 'ws-hsa',
    projectId: 'proj-hsa-15576',
    actorUserId: 'user-lorena-perez',
    type: 'email_update',
    title: 'Client Requesting Early Acceptance Certificate — Before RMA Resolved',
    submittedAt: '2026-04-17T09:00:00Z',
    sourceRef: 'user-lorena-perez:email',
    content: `Acceptance governance ambiguity.
Client facilities director has requested that we issue the partial acceptance certificate for areas A and B.
This request is being made before the three RMA cameras have been replaced.
Governance concern: issuing acceptance without resolving RMA items could waive our liability for defective units.
Approval required from our legal team before we can agree to partial acceptance.
Client argues the defective cameras are in non-critical viewing zones.
Open question: does our contract allow for phased acceptance certificates?
Not yet decided: whether we issue partial acceptance now or wait for full RMA resolution.`,
  },

  {
    id: 'hsa-006',
    workspaceId: 'ws-hsa',
    projectId: 'proj-hsa-15576',
    actorUserId: 'user-tomas-guerrero',
    type: 'risk_blocker_note',
    title: 'Wireless Repeaters Not Installed — Outdoor Zones Blocked',
    submittedAt: '2026-04-19T14:00:00Z',
    sourceRef: 'user-tomas-guerrero:blocker',
    content: `Outdoor coverage blocker.
Wireless repeaters for outdoor parking lot cameras have not been installed.
Blocked by: the client infrastructure team has not received the repeater units from their own procurement process.
Dependency: outdoor cameras in zones E and F depend on wireless repeaters being in place.
Cannot proceed with outdoor zone installation until repeaters are delivered and positioned.
This was not in our project scope — client-side procurement responsibility.
Risk: outdoor zones represent 20% of total cameras — missing them affects system completeness acceptance.`,
  },

  {
    id: 'hsa-007',
    workspaceId: 'ws-hsa',
    projectId: 'proj-hsa-15576',
    actorUserId: 'user-lorena-perez',
    type: 'project_note',
    title: 'RMA Status Unknown — Vendor Not Responding to Follow-ups',
    submittedAt: '2026-04-22T10:30:00Z',
    sourceRef: 'user-lorena-perez:note',
    content: `RMA follow-up concern.
Hikvision vendor has not responded to three follow-up calls on RMA status.
The RMA case number is confirmed but there is no shipping notification or estimated delivery date.
Unknown timeline for replacement unit arrival — creates uncertainty for acceptance planning.
A bit worried about the vendor's responsiveness given the approaching acceptance date.
I'm not sure whether the RMA process was correctly routed through the regional distributor or direct to manufacturer.
Something seems off with the vendor communication — they confirmed receipt but have not moved forward.
Acceptance deadline is April 30 — without RMA units, area A acceptance is in question.`,
  },

  {
    id: 'hsa-008',
    workspaceId: 'ws-hsa',
    projectId: 'proj-hsa-15576',
    actorUserId: 'user-tomas-guerrero',
    type: 'operational_update',
    title: 'Network Backbone Completed — Server Room Cabling Ready',
    submittedAt: '2026-04-24T16:00:00Z',
    sourceRef: 'user-tomas-guerrero:update',
    content: `Infrastructure completion milestone.
Electrical contractor completed the server room power distribution board installation on April 23.
Network backbone cabling from main distribution frame to server room is done and tested.
We decided to proceed with NVR rack installation starting April 25.
Back on track for the server room scope — 2 days ahead of the revised plan.
Civil works for area C conduit also completed — camera installation can begin April 25.
This recovery positions us to potentially meet the April 30 acceptance deadline.`,
  },

  {
    id: 'hsa-009',
    workspaceId: 'ws-hsa',
    projectId: 'proj-hsa-15576',
    actorUserId: 'user-lorena-perez',
    type: 'stakeholder_communication',
    title: 'ESCALATION: Project Director Pressure on April 30 Delivery Date',
    submittedAt: '2026-04-26T09:30:00Z',
    sourceRef: 'user-lorena-perez:escalation',
    content: `Internal escalation on delivery commitment.
Our project director is requesting confirmation that April 30 acceptance is still achievable.
Executive pressure: client security director has the April 30 date in their management report.
Timeline pressure: missing the April 30 date triggers contractual penalty clauses.
Escalated internally to delivery manager for resource reallocation decision.
Risk factors: RMA cameras unresolved, outdoor zones dependent on client procurement.
We need a go/no-go decision on April 30 acceptance by April 28.
Executive review scheduled for April 27 to assess remaining scope.`,
  },

  {
    id: 'hsa-010',
    workspaceId: 'ws-hsa',
    projectId: 'proj-hsa-15576',
    actorUserId: 'user-tomas-guerrero',
    type: 'project_note',
    title: 'Budget for Additional Cabling Not Approved — Scope Gap',
    submittedAt: '2026-04-28T11:00:00Z',
    sourceRef: 'user-tomas-guerrero:note',
    content: `Budget and scope gap identified late in project.
Field team identified that 200 additional meters of network cabling are needed for area D.
This was not included in the original scope — the building layout had changed since the site survey.
Financial concern: additional cabling cost is estimated at $1,800 USD — not in current budget.
Approval required from client project sponsor to authorize the additional spend.
Governance gap: there is no approved change request process in the current project contract.
Not yet decided: whether client absorbs the cost or we negotiate a scope amendment.
This is blocking final installation in area D.`,
  },

  // ── MUC-13098: Portal Modernization ───────────────────────────────────────

  {
    id: 'muc-001',
    workspaceId: 'ws-muc',
    projectId: 'proj-muc-13098',
    actorUserId: 'user-valeria-santos',
    type: 'project_note',
    title: 'Discovery Deliverable Changed After Client Review — Scope Impact',
    submittedAt: '2026-04-07T10:00:00Z',
    sourceRef: 'user-valeria-santos:note',
    content: `Scope and requirements drift from discovery phase.
The client has changed the discovery deliverable requirements after reviewing the first draft.
The original scope called for a functional requirements document — client now wants a full UX research report.
Contradiction: the original contract specifies a functional spec, not a UX research deliverable.
No longer aligned with the original project agreement.
Delivery drift: producing a UX research report adds 10 business days to the discovery phase.
Risk: without finalizing discovery, development sprint planning cannot begin.
Changed their decision: the client sponsor reversed the approval given in week 1 kickoff.`,
  },

  {
    id: 'muc-002',
    workspaceId: 'ws-muc',
    projectId: 'proj-muc-13098',
    actorUserId: 'user-nicolas-vargas',
    type: 'project_note',
    title: 'Client Has Not Responded to Wireframe Review Request',
    submittedAt: '2026-04-10T14:00:00Z',
    sourceRef: 'user-nicolas-vargas:note',
    content: `Client feedback delay creating sprint dependency.
The wireframe review package was sent to the client product owner on April 3.
Seven days have passed without any feedback or acknowledgment.
Waiting for client product owner Gabriela Herrera to respond.
Dependency: sprint 2 development scope depends on approved wireframes.
Cannot finalize component library selection until wireframe design direction is confirmed.
Timeline pressure: if feedback is not received by April 14, sprint 2 start date slips.
In a few days we will reach the point where we cannot hold sprint 2 without wireframe approval.`,
  },

  {
    id: 'muc-003',
    workspaceId: 'ws-muc',
    projectId: 'proj-muc-13098',
    actorUserId: 'user-valeria-santos',
    type: 'email_update',
    title: 'Scope Change Request Received Mid-Sprint — Third Party Integration',
    submittedAt: '2026-04-14T09:30:00Z',
    sourceRef: 'user-valeria-santos:email',
    content: `Mid-sprint scope change request from client.
Client submitted a scope change request to add a third-party payment gateway integration.
This was not in the original portal modernization scope.
Risk: adding payment integration mid-sprint introduces security review requirements.
The scope change could be a problem for the current sprint velocity.
Ambiguity in the request: the client has not specified which payment provider to integrate.
Open question: does this scope change require a formal change request process or can it be absorbed?
Financial concern: integration costs are not included in current project budget.`,
  },

  {
    id: 'muc-004',
    workspaceId: 'ws-muc',
    projectId: 'proj-muc-13098',
    actorUserId: 'user-nicolas-vargas',
    type: 'operational_update',
    title: 'Sprint 2 Velocity Behind — Delivery Risk Growing',
    submittedAt: '2026-04-17T14:00:00Z',
    sourceRef: 'user-nicolas-vargas:update',
    content: `Sprint velocity concern.
Sprint 2 velocity is behind the planned story point target.
Completed 18 story points out of 28 planned — 64% of target.
Behind schedule primarily due to the unresolved wireframe feedback and scope ambiguity.
Risk of missing the sprint 2 milestone deliverable due date of April 21.
Delivery drift: the wireframe delay has created a cascading dependency on all UI components.
Risk to overall portal go-live: currently tracking 8 days behind the original baseline plan.
Client expects a functional demo by May 5 — this timeline is at risk if sprint 3 velocity doesn't recover.`,
  },

  {
    id: 'muc-005',
    workspaceId: 'ws-muc',
    projectId: 'proj-muc-13098',
    actorUserId: 'user-valeria-santos',
    type: 'stakeholder_communication',
    title: 'ESCALATION: Business Sponsor Requesting Demo Next Week — Not Ready',
    submittedAt: '2026-04-21T09:00:00Z',
    sourceRef: 'user-valeria-santos:escalation',
    content: `Stakeholder expectation misalignment escalation.
Business sponsor Diego Mendoza has requested a product demo for next week — April 28.
The current state of the portal does not support a meaningful demo.
Escalation: the request came through executive channels without coordinating with the project team.
Timeline pressure: we need to either accelerate to produce something demonstrable or manage the expectation.
Risk: showing an incomplete demo to the business sponsor could damage confidence in the project.
Executive attention needed: project manager needs to align with business sponsor on realistic demo scope.
Not yet decided: whether to show wireframes only or attempt a working prototype demo.`,
  },

  {
    id: 'muc-006',
    workspaceId: 'ws-muc',
    projectId: 'proj-muc-13098',
    actorUserId: 'user-nicolas-vargas',
    type: 'risk_blocker_note',
    title: 'API Integration Specs Not Finalized — Sprint 3 Blocked',
    submittedAt: '2026-04-23T15:00:00Z',
    sourceRef: 'user-nicolas-vargas:blocker',
    content: `Technical specification blocker for sprint 3.
The API integration specifications for the legacy CRM connector have not been finalized.
Blocked by: client technical team has not provided the CRM API documentation.
The CRM vendor is a separate dependency not originally scoped in the project.
Cannot proceed with CRM integration development without API specifications.
Unknown timeline for when the client technical team will have the documentation ready.
Open question: is the CRM API REST or SOAP? Significantly impacts implementation approach.
Sprint 3 is effectively blocked on this dependency.`,
  },

  {
    id: 'muc-007',
    workspaceId: 'ws-muc',
    projectId: 'proj-muc-13098',
    actorUserId: 'user-valeria-santos',
    type: 'email_update',
    title: 'Legacy System Compatibility — Unclear Browser Support Requirements',
    submittedAt: '2026-04-25T10:30:00Z',
    sourceRef: 'user-valeria-santos:email',
    content: `Browser compatibility ambiguity.
The portal compatibility requirements for legacy browsers are unclear.
Client IT has a significant population of users still on Internet Explorer 11 in branch offices.
Unknown: whether the modern React framework we selected supports IE11 without significant polyfilling.
Risk: if IE11 compatibility is required, the front-end architecture needs fundamental changes.
This could be a significant problem if discovered late in development.
Open question: does the business requirement specify a minimum browser version?
TBD with client IT team on whether IE11 is a formal requirement or just current population reality.`,
  },

  {
    id: 'muc-008',
    workspaceId: 'ws-muc',
    projectId: 'proj-muc-13098',
    actorUserId: 'user-nicolas-vargas',
    type: 'project_note',
    title: 'UX Designer Waiting for Content from Client — Development Stalled',
    submittedAt: '2026-04-27T09:00:00Z',
    sourceRef: 'user-nicolas-vargas:note',
    content: `Content dependency blocking UX finalization.
UX designer is waiting for final content from the client marketing team.
The portal homepage design cannot be finalized without confirmed messaging and branding assets.
Blocked by: client marketing team has not provided logo files, color palette document, or copy.
Dependency: front-end development of the homepage component is waiting on design finalization.
Somebody needs to push the marketing team to provide their deliverables.
No clear owner on the client side for coordinating marketing content delivery.
Stalled: two weeks of waiting — no progress on content delivery.`,
  },

  {
    id: 'muc-009',
    workspaceId: 'ws-muc',
    projectId: 'proj-muc-13098',
    actorUserId: 'user-valeria-santos',
    type: 'risk_blocker_note',
    title: 'Two Stakeholders Have Conflicting Portal Requirements',
    submittedAt: '2026-04-29T14:00:00Z',
    sourceRef: 'user-valeria-santos:blocker',
    content: `Stakeholder alignment blocker.
The IT Director and the Head of Operations have conflicting requirements for the portal dashboard.
IT Director wants a simplified technical monitoring view.
Head of Operations wants a business KPI dashboard with financial metrics.
Contradiction: these two requirements conflict with each other in terms of information architecture.
No governance process exists to resolve conflicting stakeholder requirements in this project.
The portal cannot have two incompatible dashboard designs — a decision must be made.
Pending decision: which stakeholder requirement takes priority, or is a hybrid approach possible?
This conflict is blocking the final dashboard design sprint.`,
  },

  {
    id: 'muc-010',
    workspaceId: 'ws-muc',
    projectId: 'proj-muc-13098',
    actorUserId: 'user-nicolas-vargas',
    type: 'operational_update',
    title: 'Go-Live Date At Risk — Multiple Pending Decisions Accumulating',
    submittedAt: '2026-05-02T09:00:00Z',
    sourceRef: 'user-nicolas-vargas:update',
    content: `Overall project status — risk summary.
The portal go-live date of May 30 is at risk.
Multiple pending decisions and open dependencies are accumulating without resolution.
Risk factors: CRM API specs still missing, wireframes not approved, dashboard conflict unresolved, content not delivered.
Timeline pressure: the go-live date is a contractual commitment with a $15,000 penalty clause.
The client business sponsor is not yet aware of the accumulated risk.
Escalation needed: project status needs executive visibility before the situation becomes unrecoverable.
Decision needed urgently: whether to request a go-live date extension or accelerate with reduced scope.`,
  },

  {
    id: 'muc-011',
    workspaceId: 'ws-muc',
    projectId: 'proj-muc-13098',
    actorUserId: 'user-valeria-santos',
    type: 'project_note',
    title: 'Infrastructure Dependency Flagged — Cloud Hosting Not Confirmed',
    submittedAt: '2026-05-05T10:00:00Z',
    sourceRef: 'user-valeria-santos:note',
    content: `Late-identified infrastructure dependency.
Technical team flagged that cloud hosting environment has not been formally confirmed by client IT.
The portal is designed for AWS deployment but client IT has an existing Azure contract.
Dependency: production deployment depends on resolving the cloud platform decision.
Blocker: AWS and Azure deployments require different infrastructure configuration.
This dependency was not identified during initial scoping — significant discovery gap.
Risk: resolving this adds at minimum 2 weeks to the deployment timeline.
Unknown: whether client IT has budget authority to procure new AWS environment or must use existing Azure.`,
  },
];

// ─── Digestion Runner ─────────────────────────────────────────────────────────

function digestArtifact(artifact, runSuffix = '') {
  const traceId = `trace-${artifact.id}${runSuffix}`;
  const digestedAt = new Date().toISOString();
  const rawMaterial = {
    id: artifact.id,
    type: artifact.type,
    title: artifact.title,
    content: artifact.content,
    workspaceId: artifact.workspaceId,
    projectId: artifact.projectId,
    actorUserId: artifact.actorUserId,
    sourceRef: artifact.sourceRef,
    submittedAt: artifact.submittedAt,
  };
  const context = {
    workspaceId: artifact.workspaceId,
    projectId: artifact.projectId,
    actorUserId: artifact.actorUserId,
    traceId,
    digestedAt,
  };
  return runDigestivePipeline(rawMaterial, context);
}

// ─── Validation Heuristics ────────────────────────────────────────────────────

function validateOverTriggering(results) {
  const flags = [];
  for (const { artifact, result } of results) {
    const count = result.nutrients.length;
    if (count > 8) {
      flags.push({ artifactId: artifact.id, projectId: artifact.projectId, nutrientCount: count, flag: 'possible_over_triggering', detail: `${count} nutrients extracted from a single artifact` });
    }
    const escalationCount = result.nutrients.filter((n) => n.nutrientType === 'escalation_signal').length;
    if (escalationCount > 2) {
      flags.push({ artifactId: artifact.id, projectId: artifact.projectId, escalationCount, flag: 'escalation_spam', detail: `${escalationCount} escalation signals from one artifact` });
    }
    const allLowConfidence = result.nutrients.length > 0 && result.nutrients.every((n) => n.scoring.confidence < 0.65);
    if (allLowConfidence) {
      flags.push({ artifactId: artifact.id, projectId: artifact.projectId, flag: 'low_confidence_all', detail: 'All nutrients have confidence below 0.65 — noisy extraction' });
    }
  }
  return flags;
}

function validateUnderTriggering(results) {
  const flags = [];
  const PAYMENT_PATTERNS = [/payment\s+(?:not|delay|overdue|pending)/i, /invoice\s+(?:not|unpaid|overdue)/i, /wire\s+transfer/i, /funds\s+not/i];
  const APPROVAL_PATTERNS = [/approval\s+(?:not|pending|required|missing)/i, /sign[\s-]?off\s+(?:not|pending|missing)/i, /waiting\s+for\s+(?:sign|approval)/i];
  const LOGISTICS_PATTERNS = [/shipment\s+(?:not|delayed|held)/i, /delivery\s+(?:on\s+hold|delayed|not\s+received)/i, /equipment\s+(?:not\s+delivered|pending)/i];
  const RMA_PATTERNS = [/\brma\b/i, /defective\s+(?:unit|camera|equipment)/i, /replacement\s+unit/i];

  for (const { artifact, result } of results) {
    const content = artifact.content.toLowerCase();
    const nutrientTypes = new Set(result.nutrients.map((n) => n.nutrientType));
    const hasFinancial = nutrientTypes.has('financial_impediment_signal') || nutrientTypes.has('blocker_signal');
    if (PAYMENT_PATTERNS.some((p) => p.test(artifact.content)) && !hasFinancial) {
      flags.push({ artifactId: artifact.id, projectId: artifact.projectId, flag: 'missed_payment_signal', detail: 'Payment delay language present but no financial/blocker signal extracted' });
    }
    const hasGovernance = nutrientTypes.has('governance_gap_signal') || nutrientTypes.has('dependency_signal');
    if (APPROVAL_PATTERNS.some((p) => p.test(artifact.content)) && !hasGovernance) {
      flags.push({ artifactId: artifact.id, projectId: artifact.projectId, flag: 'missed_approval_signal', detail: 'Approval/sign-off language present but no governance/dependency signal extracted' });
    }
    const hasLogisticsSignal = nutrientTypes.has('delivery_drift_signal') || nutrientTypes.has('blocker_signal') || nutrientTypes.has('dependency_signal');
    if (LOGISTICS_PATTERNS.some((p) => p.test(artifact.content)) && !hasLogisticsSignal) {
      flags.push({ artifactId: artifact.id, projectId: artifact.projectId, flag: 'missed_logistics_signal', detail: 'Logistics delay language present but no delivery/blocker/dependency signal extracted' });
    }
    const hasRmaSignal = nutrientTypes.has('risk_signal') || nutrientTypes.has('ambiguity_signal') || nutrientTypes.has('blocker_signal');
    if (RMA_PATTERNS.some((p) => p.test(artifact.content)) && !hasRmaSignal) {
      flags.push({ artifactId: artifact.id, projectId: artifact.projectId, flag: 'missed_rma_signal', detail: 'RMA language present but no risk/ambiguity/blocker signal extracted' });
    }
  }
  return flags;
}

function validateSignalDensity(results) {
  const totalNutrients = results.reduce((s, r) => s + r.result.nutrients.length, 0);
  const totalResidue = results.reduce((s, r) => s + r.result.residue.length, 0);
  const avgNutrients = totalNutrients / results.length;
  const avgResidue = totalResidue / results.length;
  const flags = [];
  if (avgNutrients < 1.5) flags.push({ flag: 'sparse_extraction', detail: `Average ${avgNutrients.toFixed(2)} nutrients per artifact — signals may be missed` });
  if (avgNutrients > 7) flags.push({ flag: 'noisy_extraction', detail: `Average ${avgNutrients.toFixed(2)} nutrients per artifact — extraction may be too broad` });
  if (avgResidue < 0.3) flags.push({ flag: 'sparse_residue', detail: `Average ${avgResidue.toFixed(2)} residue per artifact — weak signals may be lost` });
  const typeDistribution = {};
  for (const { result } of results) {
    for (const n of result.nutrients) {
      typeDistribution[n.nutrientType] = (typeDistribution[n.nutrientType] ?? 0) + 1;
    }
  }
  const nutrientTypes = ['risk_signal', 'blocker_signal', 'stakeholder_signal', 'dependency_signal', 'decision_signal', 'commitment_signal', 'delivery_drift_signal', 'financial_impediment_signal', 'governance_gap_signal', 'escalation_signal', 'recovery_signal', 'ambiguity_signal', 'contradiction_signal', 'timeline_pressure_signal'];
  const missingTypes = nutrientTypes.filter((t) => !typeDistribution[t]);
  if (missingTypes.length > 0) flags.push({ flag: 'signal_types_absent', detail: `Signal types never extracted across dataset: ${missingTypes.join(', ')}` });
  return { avgNutrients, avgResidue, typeDistribution, flags };
}

function validateLineageIntegrity(results) {
  const violations = [];
  for (const { artifact, result } of results) {
    for (const nutrient of result.nutrients) {
      if (!nutrient.evidence || nutrient.evidence.length === 0) {
        violations.push({ artifactId: artifact.id, nutrientId: nutrient.id, violation: 'missing_evidence_lineage' });
        continue;
      }
      const ev = nutrient.evidence[0];
      if (!ev.excerpt || ev.excerpt.length === 0) violations.push({ artifactId: artifact.id, nutrientId: nutrient.id, violation: 'empty_excerpt' });
      if (!ev.timestamp) violations.push({ artifactId: artifact.id, nutrientId: nutrient.id, violation: 'missing_timestamp' });
      if (!ev.workspaceId) violations.push({ artifactId: artifact.id, nutrientId: nutrient.id, violation: 'missing_workspaceId' });
      if (ev.workspaceId !== artifact.workspaceId) violations.push({ artifactId: artifact.id, nutrientId: nutrient.id, violation: 'workspaceId_mismatch', expected: artifact.workspaceId, got: ev.workspaceId });
      if (ev.projectId !== artifact.projectId) violations.push({ artifactId: artifact.id, nutrientId: nutrient.id, violation: 'projectId_mismatch', expected: artifact.projectId, got: ev.projectId });
      if (!ev.confidenceBasis) violations.push({ artifactId: artifact.id, nutrientId: nutrient.id, violation: 'missing_confidence_basis' });
    }
  }
  return violations;
}

function validateDeterminism(artifacts) {
  const mismatches = [];
  for (const artifact of artifacts.slice(0, 10)) {
    const run1 = digestArtifact(artifact, '-det-run1');
    const run2 = digestArtifact(artifact, '-det-run2');
    if (run1.nutrients.length !== run2.nutrients.length) {
      mismatches.push({ artifactId: artifact.id, field: 'nutrientCount', run1: run1.nutrients.length, run2: run2.nutrients.length });
    }
    const types1 = run1.nutrients.map((n) => n.nutrientType).sort().join(',');
    const types2 = run2.nutrients.map((n) => n.nutrientType).sort().join(',');
    if (types1 !== types2) {
      mismatches.push({ artifactId: artifact.id, field: 'nutrientTypes', run1: types1, run2: types2 });
    }
    if (run1.residue.length !== run2.residue.length) {
      mismatches.push({ artifactId: artifact.id, field: 'residueCount', run1: run1.residue.length, run2: run2.residue.length });
    }
    const scores1 = run1.nutrients.map((n) => `${n.nutrientType}:${n.scoring.confidence}:${n.scoring.severity}`).sort().join(';');
    const scores2 = run2.nutrients.map((n) => `${n.nutrientType}:${n.scoring.confidence}:${n.scoring.severity}`).sort().join(';');
    if (scores1 !== scores2) {
      mismatches.push({ artifactId: artifact.id, field: 'scoringMismatch', run1: scores1, run2: scores2 });
    }
  }
  return mismatches;
}

function computeDecayObservations(results, artifacts) {
  const now = new Date().toISOString();
  const observations = [];
  for (const { artifact, result } of results) {
    for (const nutrient of result.nutrients) {
      const freshness = computeDecayedFreshness({
        nutrientType: nutrient.nutrientType,
        createdAt: artifact.submittedAt,
        severity: nutrient.scoring.severity,
        decayProfile: nutrient.scoring.decayProfile,
      });
      if (freshness < 0.5 && nutrient.scoring.actionability === 'actionable') {
        observations.push({ artifactId: artifact.id, projectId: artifact.projectId, nutrientType: nutrient.nutrientType, submittedAt: artifact.submittedAt, freshness, status: 'decayed_actionable', note: 'High-severity signal decayed below 50% freshness — may need reinforcement' });
      }
    }
  }
  const persistentTypes = ['financial_impediment_signal', 'governance_gap_signal', 'blocker_signal'];
  const projectBlockers = {};
  for (const { artifact, result } of results) {
    const key = artifact.projectId;
    if (!projectBlockers[key]) projectBlockers[key] = [];
    const unresolvedBlockers = result.nutrients.filter((n) => persistentTypes.includes(n.nutrientType) && n.scoring.recurrenceHint !== 'confirmed_recurrence');
    if (unresolvedBlockers.length > 0) {
      projectBlockers[key].push(...unresolvedBlockers.map((n) => ({ nutrientType: n.nutrientType, artifactId: artifact.id })));
    }
  }
  for (const [projectId, blockers] of Object.entries(projectBlockers)) {
    if (blockers.length >= 3) {
      observations.push({ projectId, blockerCount: blockers.length, status: 'recurring_unresolved_blockers', note: 'Multiple unresolved high-persistence signals — possible chronic governance gap' });
    }
  }
  return observations;
}

// Before-tuning baseline (v0 — no significance filtering or deduplication)
export const BASELINE_METRICS = {
  totalNutrients: 410,
  avgPerArtifact: 8.04,
  stakeholderCount: 113,
  overTriggerFlags: 24,
  residueTotal: 15,
  signalQualityPct: 30,
  suppressedCount: 0,
  totalMerged: 0,
};

export function computeSuppressionMetrics(artifacts) {
  const byReason = {};
  let totalSuppressed = 0;
  let totalActive = 0;
  let totalMerged = 0;
  for (const artifact of artifacts) {
    const allCandidates = extractNutrientCandidates(normalizeRawMaterial({
      id: artifact.id, type: artifact.type, title: artifact.title,
      content: artifact.content, workspaceId: artifact.workspaceId,
      projectId: artifact.projectId, actorUserId: artifact.actorUserId,
      sourceRef: artifact.sourceRef, submittedAt: artifact.submittedAt,
    }).lines);
    for (const c of allCandidates) {
      if (c.suppressed) {
        totalSuppressed++;
        byReason[c.suppressionReason] = (byReason[c.suppressionReason] ?? 0) + 1;
      } else {
        totalActive++;
      }
    }
    // Count dedup merges from the digested result
    const result = digestArtifact(artifact);
    totalMerged += result.nutrients.reduce((s, n) => s + (n.duplicateMergeCount ?? 0), 0);
  }
  const suppressionRate = totalSuppressed / Math.max(1, totalSuppressed + totalActive);
  return { totalSuppressed, totalActive, totalMerged, byReason, suppressionRate: Math.round(suppressionRate * 100) };
}

function computeCognitionReadinessScore(allNutrients, lineageViolations, determinismMismatches, overTriggerFlags, underTriggerFlags, signalDensity, artifactCount) {
  const total = allNutrients.length;
  const coherenceScore = total > 0 ? Math.max(0, 1 - (lineageViolations.length / total)) : 0;
  const signalQualityScore = total > 0 ? allNutrients.filter((n) => n.scoring.confidence >= 0.7).length / total : 0;
  // Noise suppression: proportion of artifacts NOT over-triggered
  const overTriggerRate = overTriggerFlags.length / Math.max(1, artifactCount ?? SIMULATION_ARTIFACTS.length);
  const noiseSuppression = Math.max(0, 1 - overTriggerRate);
  const determinismScore = determinismMismatches.length === 0 ? 1.0 : Math.max(0, 1 - (determinismMismatches.length / 10));
  const realismScore = Math.min(1.0, (signalDensity.avgNutrients / 4));
  const allTypesCovered = NUTRIENT_RULES.every((r) => signalDensity.typeDistribution[r.nutrientType] > 0);
  const explainabilityScore = allTypesCovered ? 1.0 : 0.7;
  const missedSignalPenalty = Math.max(0, 1 - (underTriggerFlags.length / 15));
  return {
    coherence: Math.round(coherenceScore * 100),
    signalQuality: Math.round(signalQualityScore * 100),
    noiseSuppression: Math.round(noiseSuppression * 100),
    determinism: Math.round(determinismScore * 100),
    realism: Math.round(realismScore * 100),
    explainabilityReadiness: Math.round(explainabilityScore * 100),
    persistenceReadiness: Math.round(missedSignalPenalty * 100),
    overall: Math.round(((coherenceScore + signalQualityScore + noiseSuppression + determinismScore + realismScore + explainabilityScore + missedSignalPenalty) / 7) * 100),
  };
}

// ─── Main Execution ───────────────────────────────────────────────────────────

function runSmokeTest({ writeReports = false } = {}) {
  const startTime = Date.now();
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║       VAULT DIGESTIVE SYSTEM — OPERATIONAL SMOKE TEST        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`Artifacts: ${SIMULATION_ARTIFACTS.length} | Projects: 5 | Dataset: LATAM Enterprise PM\n`);

  // Phase 1: Run digestion
  console.log('→ Phase 1: Running digestion pipeline on all artifacts...');
  const digestedResults = SIMULATION_ARTIFACTS.map((artifact) => ({ artifact, result: digestArtifact(artifact) }));
  const allNutrients = digestedResults.flatMap((r) => r.result.nutrients);
  const allResidue = digestedResults.flatMap((r) => r.result.residue);
  console.log(`  ✓ Digested ${digestedResults.length} artifacts → ${allNutrients.length} nutrients, ${allResidue.length} residue items\n`);

  // Phase 2: Validation heuristics
  console.log('→ Phase 2: Running validation heuristics...');
  const overTriggerFlags = validateOverTriggering(digestedResults);
  const underTriggerFlags = validateUnderTriggering(digestedResults);
  const signalDensity = validateSignalDensity(digestedResults);
  const lineageViolations = validateLineageIntegrity(digestedResults);
  console.log(`  ✓ Over-trigger flags: ${overTriggerFlags.length}`);
  console.log(`  ✓ Under-trigger flags: ${underTriggerFlags.length}`);
  console.log(`  ✓ Signal density flags: ${signalDensity.flags.length}`);
  console.log(`  ✓ Lineage violations: ${lineageViolations.length}`);

  // Phase 3: Determinism check
  console.log('\n→ Phase 3: Determinism check (10 artifacts × 2 runs)...');
  const determinismMismatches = validateDeterminism(SIMULATION_ARTIFACTS);
  console.log(`  ✓ Determinism mismatches: ${determinismMismatches.length}`);

  // Phase 4: Decay observations
  console.log('\n→ Phase 4: Computing decay observations...');
  const decayObservations = computeDecayObservations(digestedResults, SIMULATION_ARTIFACTS);
  console.log(`  ✓ Decay observations: ${decayObservations.length}`);

  // Phase 5: Suppression metrics
  console.log('\n→ Phase 5: Computing suppression and compression metrics...');
  const suppressionMetrics = computeSuppressionMetrics(SIMULATION_ARTIFACTS);
  console.log(`  ✓ Suppressed candidates: ${suppressionMetrics.totalSuppressed} (${suppressionMetrics.suppressionRate}% of raw candidates)`);
  console.log(`  ✓ Duplicate merges: ${suppressionMetrics.totalMerged}`);

  // Phase 6: Cognition readiness
  console.log('\n→ Phase 6: Computing cognition readiness score...');
  const readiness = computeCognitionReadinessScore(allNutrients, lineageViolations, determinismMismatches, overTriggerFlags, underTriggerFlags, signalDensity, SIMULATION_ARTIFACTS.length);
  console.log(`  ✓ Overall readiness score: ${readiness.overall}/100\n`);

  // ─── Console Summary ────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' DIGESTIVE OVERVIEW');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Artifacts processed:    ${SIMULATION_ARTIFACTS.length}`);
  console.log(`  Nutrients extracted:    ${allNutrients.length}`);
  console.log(`  Residue items:          ${allResidue.length}`);
  console.log(`  Avg nutrients/artifact: ${signalDensity.avgNutrients.toFixed(2)}`);
  console.log(`  Avg residue/artifact:   ${signalDensity.avgResidue.toFixed(2)}`);
  console.log(`  Projects analyzed:      5 (MEP, ICE, GCH, HSA, MUC)`);
  console.log(`  Suppressed candidates:  ${suppressionMetrics.totalSuppressed} (${suppressionMetrics.suppressionRate}%)`);
  console.log(`  Duplicate merges:       ${suppressionMetrics.totalMerged}\n`);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' BEFORE vs AFTER TUNING (v0 → v1)');
  console.log('═══════════════════════════════════════════════════════════════');
  const afterSignalQuality = Math.round(allNutrients.filter((n) => n.scoring.confidence >= 0.7).length / Math.max(1, allNutrients.length) * 100);
  const after = { totalNutrients: allNutrients.length, avgPerArtifact: signalDensity.avgNutrients, stakeholderCount: signalDensity.typeDistribution['stakeholder_signal'] ?? 0, overTriggerFlags: overTriggerFlags.length, residueTotal: allResidue.length, signalQualityPct: afterSignalQuality };
  const delta = (before, after, lower = false) => { const d = after - before; const sign = d > 0 ? '+' : ''; const good = lower ? d <= 0 : d >= 0; return `${before} → ${after} (${sign}${typeof d === 'number' ? d.toFixed ? d.toFixed(2) : d : d}) ${good ? '✓' : '⚠'}`.padEnd(40); };
  console.log(`  Nutrients total:   ${delta(BASELINE_METRICS.totalNutrients, after.totalNutrients, true)}`);
  console.log(`  Avg/artifact:      ${delta(BASELINE_METRICS.avgPerArtifact, after.avgPerArtifact, true)}`);
  console.log(`  stakeholder_signal:${delta(BASELINE_METRICS.stakeholderCount, after.stakeholderCount, true)}`);
  console.log(`  Over-trigger flags:${delta(BASELINE_METRICS.overTriggerFlags, after.overTriggerFlags, true)}`);
  console.log(`  Signal quality %:  ${delta(BASELINE_METRICS.signalQualityPct, after.signalQualityPct, false)}`);
  console.log('');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' SIGNAL DISTRIBUTION');
  console.log('═══════════════════════════════════════════════════════════════');
  const sortedTypes = Object.entries(signalDensity.typeDistribution).sort((a, b) => b[1] - a[1]);
  for (const [type, count] of sortedTypes) {
    const bar = '█'.repeat(Math.min(30, Math.round(count * 1.5)));
    console.log(`  ${type.padEnd(35)} ${String(count).padStart(3)}  ${bar}`);
  }
  const missingSignals = NUTRIENT_RULES.filter((r) => !signalDensity.typeDistribution[r.nutrientType]).map((r) => r.nutrientType);
  if (missingSignals.length > 0) console.log(`\n  ⚠ Never triggered: ${missingSignals.join(', ')}`);
  console.log('');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' VALIDATION RESULTS');
  console.log('═══════════════════════════════════════════════════════════════');
  const totalFlags = overTriggerFlags.length + underTriggerFlags.length + signalDensity.flags.length + lineageViolations.length + determinismMismatches.length;
  if (totalFlags === 0) {
    console.log('  ✓ All heuristics passed — no anomalies detected');
  } else {
    if (overTriggerFlags.length > 0) {
      console.log(`\n  ⚠ OVER-TRIGGERING (${overTriggerFlags.length} flags):`);
      overTriggerFlags.slice(0, 3).forEach((f) => console.log(`    - [${f.artifactId}] ${f.flag}: ${f.detail}`));
    }
    if (underTriggerFlags.length > 0) {
      console.log(`\n  ⚠ UNDER-TRIGGERING (${underTriggerFlags.length} flags):`);
      underTriggerFlags.slice(0, 3).forEach((f) => console.log(`    - [${f.artifactId}] ${f.flag}: ${f.detail}`));
    }
    if (lineageViolations.length > 0) {
      console.log(`\n  ✗ LINEAGE VIOLATIONS (${lineageViolations.length}):`);
      lineageViolations.slice(0, 3).forEach((v) => console.log(`    - [${v.artifactId}] ${v.violation}`));
    }
    if (determinismMismatches.length > 0) {
      console.log(`\n  ✗ DETERMINISM FAILURES (${determinismMismatches.length}):`);
      determinismMismatches.slice(0, 3).forEach((m) => console.log(`    - [${m.artifactId}] ${m.field}: ${JSON.stringify(m.run1)} vs ${JSON.stringify(m.run2)}`));
    }
  }
  console.log('');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' COGNITIVE READINESS SCORE (INTERNAL)');
  console.log('═══════════════════════════════════════════════════════════════');
  for (const [dim, score] of Object.entries(readiness)) {
    if (dim === 'overall') continue;
    const bar = score >= 80 ? '●●●●●' : score >= 60 ? '●●●●○' : score >= 40 ? '●●●○○' : score >= 20 ? '●●○○○' : '●○○○○';
    console.log(`  ${dim.padEnd(28)} ${String(score).padStart(3)}/100  ${bar}`);
  }
  console.log(`  ${'─'.repeat(42)}`);
  console.log(`  ${'OVERALL'.padEnd(28)} ${String(readiness.overall).padStart(3)}/100`);
  console.log('');

  if (decayObservations.length > 0) {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(' DECAY OBSERVATIONS');
    console.log('═══════════════════════════════════════════════════════════════');
    decayObservations.slice(0, 6).forEach((obs) => {
      const label = obs.projectId ? `[${obs.projectId}]` : `[${obs.artifactId}]`;
      console.log(`  ${label}: ${obs.note}`);
    });
    console.log('');
  }

  // Phase 7: Learned pattern analysis
  console.log('\n→ Phase 7: Running learned pattern analysis...');
  const learnedPatternAnalysis = runLearnedPatternAnalysis(digestedResults);
  console.log(`  ✓ Learned patterns detected: ${learnedPatternAnalysis.totalPatterns}`);
  const patternTypeCounts = Object.entries(learnedPatternAnalysis.typeDistribution)
    .sort((a, b) => b[1] - a[1])
    .map(([t, c]) => `${t}(${c})`).join(', ');
  if (patternTypeCounts) console.log(`  ✓ Pattern type distribution: ${patternTypeCounts}`);

  // Validate expected patterns
  const expectedMissed = [];
  for (const [projectId, expectedTypes] of Object.entries(EXPECTED_PATTERNS_BY_PROJECT)) {
    const projectPatterns = learnedPatternAnalysis.byProject[projectId] ?? [];
    const detectedTypes = new Set(projectPatterns.map((p) => p.patternType));
    for (const expectedType of expectedTypes) {
      if (!detectedTypes.has(expectedType)) {
        expectedMissed.push({ projectId, missingType: expectedType });
      }
    }
  }
  if (expectedMissed.length > 0) {
    console.log(`  ⚠ Missing expected patterns: ${expectedMissed.length}`);
    expectedMissed.forEach((m) => console.log(`    - [${m.projectId}] expected ${m.missingType}`));
  } else {
    console.log(`  ✓ All expected pattern types detected across projects`);
  }
  console.log('');

  const elapsedMs = Date.now() - startTime;
  console.log(`Smoke test completed in ${elapsedMs}ms\n`);

  // ─── Build structured report ────────────────────────────────────────────────
  const projectStats = {};
  for (const { artifact, result } of digestedResults) {
    const key = artifact.projectId;
    if (!projectStats[key]) projectStats[key] = { artifactCount: 0, nutrientCount: 0, residueCount: 0, signalTypes: {} };
    projectStats[key].artifactCount += 1;
    projectStats[key].nutrientCount += result.nutrients.length;
    projectStats[key].residueCount += result.residue.length;
    for (const n of result.nutrients) {
      projectStats[key].signalTypes[n.nutrientType] = (projectStats[key].signalTypes[n.nutrientType] ?? 0) + 1;
    }
  }

  const afterSignalQualityPct = Math.round(allNutrients.filter((n) => n.scoring.confidence >= 0.7).length / Math.max(1, allNutrients.length) * 100);

  // Compute pattern readiness score impact
  const patternReadinessImpact = learnedPatternAnalysis.totalPatterns > 0
    ? Math.min(10, Math.round(learnedPatternAnalysis.totalPatterns * 0.7))
    : 0;

  const report = {
    metadata: { generatedAt: new Date().toISOString(), artifactCount: SIMULATION_ARTIFACTS.length, elapsedMs, smokeTestVersion: '1.2.0', datasetDescription: 'LATAM Enterprise PM — 5 projects across 51 operational artifacts' },
    overview: { totalNutrients: allNutrients.length, totalResidue: allResidue.length, avgNutrientsPerArtifact: parseFloat(signalDensity.avgNutrients.toFixed(2)), avgResiduePerArtifact: parseFloat(signalDensity.avgResidue.toFixed(2)), projectCount: 5 },
    beforeAfterComparison: {
      before: BASELINE_METRICS,
      after: { totalNutrients: allNutrients.length, avgPerArtifact: parseFloat(signalDensity.avgNutrients.toFixed(2)), stakeholderCount: signalDensity.typeDistribution['stakeholder_signal'] ?? 0, overTriggerFlags: overTriggerFlags.length, residueTotal: allResidue.length, signalQualityPct: afterSignalQualityPct, suppressedCount: suppressionMetrics.totalSuppressed, totalMerged: suppressionMetrics.totalMerged },
    },
    suppressionMetrics,
    signalDistribution: signalDensity.typeDistribution,
    projectStats,
    validation: {
      overTriggerFlags,
      underTriggerFlags,
      signalDensityFlags: signalDensity.flags,
      lineageViolations,
      determinismMismatches,
      totalFlags: overTriggerFlags.length + underTriggerFlags.length + signalDensity.flags.length + lineageViolations.length + determinismMismatches.length,
    },
    decayObservations,
    cognitionReadinessScore: readiness,
    learnedPatterns: {
      totalPatterns: learnedPatternAnalysis.totalPatterns,
      typeDistribution: learnedPatternAnalysis.typeDistribution,
      byProject: Object.fromEntries(
        Object.entries(learnedPatternAnalysis.byProject).map(([k, patterns]) => [
          k,
          patterns.map((p) => ({ patternType: p.patternType, title: p.title, severity: p.severity, confidence: p.confidence, status: p.status, trajectory: p.trajectory, recurrenceCount: p.recurrenceCount })),
        ])
      ),
      expectedMissed,
      patternReadinessImpact,
    },
  };

  // ─── Write reports (CLI runs only — test imports must not dirty tracked
  // files in artifacts/ on every `npm test`; Perilla 11 A.7 git cleanliness) ──
  if (writeReports) {
    const artifactsDir = path.resolve('artifacts');
    if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });
    const jsonPath = path.join(artifactsDir, 'vault-smoke-test-report.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`JSON report: ${jsonPath}`);

    const md = buildMarkdownReport(report, digestedResults);
    const mdPath = path.join(artifactsDir, 'vault-smoke-test-report.md');
    fs.writeFileSync(mdPath, md);
    console.log(`Markdown report: ${mdPath}\n`);
  }

  return report;
}

function buildMarkdownReport(report, digestedResults) {
  const lines = [];
  lines.push('# Vault Digestive System — Smoke Test Report');
  lines.push('');
  lines.push(`**Generated:** ${report.metadata.generatedAt}`);
  lines.push(`**Dataset:** ${report.metadata.datasetDescription}`);
  lines.push(`**Elapsed:** ${report.metadata.elapsedMs}ms`);
  lines.push('');

  lines.push('## 1. Digestive Overview');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Artifacts processed | ${report.metadata.artifactCount} |`);
  lines.push(`| Nutrients extracted | ${report.overview.totalNutrients} |`);
  lines.push(`| Residue items | ${report.overview.totalResidue} |`);
  lines.push(`| Avg nutrients/artifact | ${report.overview.avgNutrientsPerArtifact} |`);
  lines.push(`| Avg residue/artifact | ${report.overview.avgResiduePerArtifact} |`);
  lines.push(`| Projects analyzed | ${report.overview.projectCount} |`);
  lines.push('');

  lines.push('## 2. Top Detected Themes');
  lines.push('');
  const topTypes = Object.entries(report.signalDistribution).sort((a, b) => b[1] - a[1]).slice(0, 8);
  lines.push('| Signal Type | Count |');
  lines.push('|-------------|-------|');
  for (const [type, count] of topTypes) lines.push(`| ${type} | ${count} |`);
  lines.push('');

  lines.push('## 3. Signal Distribution by Project');
  lines.push('');
  for (const [projectId, stats] of Object.entries(report.projectStats)) {
    lines.push(`### ${projectId}`);
    lines.push(`- Artifacts: ${stats.artifactCount} | Nutrients: ${stats.nutrientCount} | Residue: ${stats.residueCount}`);
    const topSignals = Object.entries(stats.signalTypes).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t, c]) => `${t}(${c})`).join(', ');
    lines.push(`- Top signals: ${topSignals}`);
    lines.push('');
  }

  lines.push('## 4. Residue Analysis');
  lines.push('');
  const residueCategories = {};
  for (const { result } of digestedResults) {
    for (const r of result.residue) {
      residueCategories[r.residueCategory] = (residueCategories[r.residueCategory] ?? 0) + 1;
    }
  }
  lines.push('| Residue Category | Count |');
  lines.push('|-----------------|-------|');
  for (const [cat, count] of Object.entries(residueCategories).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${cat} | ${count} |`);
  }
  lines.push('');

  lines.push('## 5. False Positive Hotspots');
  lines.push('');
  if (report.validation.overTriggerFlags.length === 0) {
    lines.push('No over-triggering detected across the dataset.');
  } else {
    for (const f of report.validation.overTriggerFlags) {
      lines.push(`- **[${f.artifactId}]** ${f.flag}: ${f.detail}`);
    }
  }
  lines.push('');

  lines.push('## 6. Missed Signals');
  lines.push('');
  if (report.validation.underTriggerFlags.length === 0) {
    lines.push('No systematic missed signals detected.');
  } else {
    for (const f of report.validation.underTriggerFlags) {
      lines.push(`- **[${f.artifactId}]** ${f.flag}: ${f.detail}`);
    }
  }
  lines.push('');

  lines.push('## 7. Decay Observations');
  lines.push('');
  if (report.decayObservations.length === 0) {
    lines.push('No significant decay anomalies detected.');
  } else {
    for (const obs of report.decayObservations) {
      const id = obs.projectId || obs.artifactId;
      lines.push(`- **[${id}]** ${obs.status}: ${obs.note}`);
    }
  }
  lines.push('');

  lines.push('## 8. Cognitive Readiness Score (Internal)');
  lines.push('');
  lines.push('| Dimension | Score |');
  lines.push('|-----------|-------|');
  for (const [dim, score] of Object.entries(report.cognitionReadinessScore)) {
    if (dim !== 'overall') lines.push(`| ${dim} | ${score}/100 |`);
  }
  lines.push(`| **OVERALL** | **${report.cognitionReadinessScore.overall}/100** |`);
  lines.push('');

  lines.push('## 9. Learned Patterns');
  lines.push('');
  lines.push(`**Total patterns detected:** ${report.learnedPatterns.totalPatterns}`);
  lines.push('');
  if (report.learnedPatterns.totalPatterns > 0) {
    lines.push('### Pattern Type Distribution');
    lines.push('| Pattern Type | Count |');
    lines.push('|-------------|-------|');
    for (const [type, count] of Object.entries(report.learnedPatterns.typeDistribution).sort((a, b) => b[1] - a[1])) {
      lines.push(`| ${type} | ${count} |`);
    }
    lines.push('');
    lines.push('### Patterns by Project');
    for (const [projectId, patterns] of Object.entries(report.learnedPatterns.byProject)) {
      lines.push(`**${projectId}** (${patterns.length} patterns)`);
      for (const p of patterns) {
        lines.push(`- ${p.patternType} | severity: ${p.severity} | confidence: ${p.confidence} | status: ${p.status} | recurrences: ${p.recurrenceCount}`);
      }
      lines.push('');
    }
    if (report.learnedPatterns.expectedMissed.length > 0) {
      lines.push('### ⚠ Missing Expected Patterns');
      for (const m of report.learnedPatterns.expectedMissed) {
        lines.push(`- [${m.projectId}] Expected: ${m.missingType}`);
      }
      lines.push('');
    } else {
      lines.push('✓ All expected pattern types detected.');
      lines.push('');
    }
  }

  lines.push('## 10. Validation Summary');
  lines.push('');
  lines.push(`| Check | Result |`);
  lines.push(`|-------|--------|`);
  lines.push(`| Over-trigger flags | ${report.validation.overTriggerFlags.length === 0 ? '✓ None' : `⚠ ${report.validation.overTriggerFlags.length}`} |`);
  lines.push(`| Under-trigger flags | ${report.validation.underTriggerFlags.length === 0 ? '✓ None' : `⚠ ${report.validation.underTriggerFlags.length}`} |`);
  lines.push(`| Lineage violations | ${report.validation.lineageViolations.length === 0 ? '✓ None' : `✗ ${report.validation.lineageViolations.length}`} |`);
  lines.push(`| Determinism mismatches | ${report.validation.determinismMismatches.length === 0 ? '✓ Pass' : `✗ ${report.validation.determinismMismatches.length}`} |`);
  lines.push(`| Signal density flags | ${report.validation.signalDensityFlags.length === 0 ? '✓ Normal' : `⚠ ${report.validation.signalDensityFlags.length}`} |`);
  lines.push('');

  return lines.join('\n');
}

// ─── Learned Pattern Engine (mirrors src/lib/vault/learned-patterns/*) ────────
// Inline JS implementation mirrors TypeScript source for deterministic validation.

const PATTERN_STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'has', 'have', 'been', 'be',
  'to', 'of', 'in', 'for', 'on', 'with', 'as', 'by', 'at', 'from',
  'that', 'this', 'it', 'its', 'and', 'or', 'but', 'not', 'so',
  'we', 'our', 'they', 'their', 'you', 'your', 'will', 'can',
  'still', 'now', 'also', 'just', 'very', 'some', 'any', 'all',
  'being', 'would', 'could', 'should', 'may', 'might', 'must',
  'shall', 'does', 'did', 'had', 'into', 'than', 'then',
]);

function extractPatternThemeWords(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 3 && !PATTERN_STOP_WORDS.has(w)).slice(0, 6);
}

function buildPatternThemeKey(type, summary) {
  return `${type}:${extractPatternThemeWords(summary).slice(0, 3).join('_')}`;
}

function patternJaccard(a, b) {
  const sa = new Set(a); const sb = new Set(b);
  const inter = [...sa].filter((x) => sb.has(x)).length;
  const union = new Set([...sa, ...sb]).size;
  return union === 0 ? 0 : inter / union;
}

function nutrientToPatternSignal(n) {
  return {
    nutrientId: n.id,
    nutrientType: n.nutrientType,
    summary: n.summary,
    artifactId: n.evidence[0]?.sourceArtifactId ?? null,
    digestionRunId: n.digestionRunId,
    createdAt: n.createdAt,
    severity: n.scoring.severity,
    confidence: n.scoring.confidence,
  };
}

function computePatternRecurrenceProfile(signals) {
  const distinctArtifacts = new Set(signals.map((s) => s.artifactId).filter(Boolean)).size;
  const distinctRuns = new Set(signals.map((s) => s.digestionRunId)).size;
  const ts = signals.map((s) => Date.parse(s.createdAt)).filter((t) => !isNaN(t));
  const timeSpanDays = ts.length > 1 ? (Math.max(...ts) - Math.min(...ts)) / 86_400_000 : 0;
  const multiDaySpread = new Set(signals.map((s) => s.createdAt.slice(0, 10))).size > 1;
  return { totalOccurrences: signals.length, distinctArtifacts, distinctDigestionRuns: distinctRuns, timeSpanDays: Math.round(timeSpanDays * 10) / 10, multiDaySpread };
}

function detectPatternThemeGroups(nutrients) {
  const augmented = nutrients.map((n) => ({
    ...nutrientToPatternSignal(n),
    themeKey: buildPatternThemeKey(n.nutrientType, n.summary),
    themeWords: extractPatternThemeWords(n.summary),
    workspaceId: n.workspaceId,
    projectId: n.projectId,
  }));
  const exactGroups = new Map();
  for (const sig of augmented) {
    const key = `${sig.workspaceId}:${sig.projectId ?? ''}:${sig.themeKey}`;
    const ex = exactGroups.get(key); if (ex) ex.push(sig); else exactGroups.set(key, [sig]);
  }
  const groupEntries = [...exactGroups.entries()].map(([k, sigs]) => ({
    key: k, sigs, nutrientType: sigs[0].nutrientType, themeWords: sigs[0].themeWords,
    wpScope: `${sigs[0].workspaceId}:${sigs[0].projectId ?? ''}`,
    workspaceId: sigs[0].workspaceId, projectId: sigs[0].projectId,
  }));
  const mergedIdx = new Set(); const mergedGroups = [];
  for (let i = 0; i < groupEntries.length; i++) {
    if (mergedIdx.has(i)) continue;
    let cur = { ...groupEntries[i], sigs: [...groupEntries[i].sigs] };
    for (let j = i + 1; j < groupEntries.length; j++) {
      if (mergedIdx.has(j)) continue;
      const other = groupEntries[j];
      if (cur.nutrientType !== other.nutrientType || cur.wpScope !== other.wpScope) continue;
      if (patternJaccard(cur.themeWords, other.themeWords) >= 0.4) {
        cur = { ...cur, sigs: [...cur.sigs, ...other.sigs] }; mergedIdx.add(j);
      }
    }
    mergedGroups.push(cur);
  }
  const result = [];
  for (const g of mergedGroups) {
    const distinctRuns = new Set(g.sigs.map((s) => s.digestionRunId));
    if (distinctRuns.size < 2) continue;
    const signals = g.sigs.map(({ themeKey: _tk, themeWords: _tw, wpScope: _ws, workspaceId: _wid, projectId: _pid, ...rest }) => rest);
    result.push({ groupKey: g.key, primaryNutrientType: g.nutrientType, groupingMethod: 'specific_theme', signals, recurrenceProfile: computePatternRecurrenceProfile(signals), involvedNutrientIds: signals.map((s) => s.nutrientId), workspaceId: g.workspaceId, projectId: g.projectId });
  }
  return result;
}

function detectPatternProjectTypeAggregates(nutrients) {
  const groups = new Map();
  for (const n of nutrients) {
    const key = `${n.workspaceId}:${n.projectId ?? ''}:${n.nutrientType}`;
    const ex = groups.get(key); if (ex) ex.push(n); else groups.set(key, [n]);
  }
  const result = [];
  for (const [key, gNutrients] of groups) {
    const signals = gNutrients.map(nutrientToPatternSignal);
    const distinctRuns = new Set(signals.map((s) => s.digestionRunId));
    // Minimum bar: 2+ occurrences from 2+ distinct runs.
    // Promotion rules apply type-specific thresholds on top.
    if (signals.length < 2 || distinctRuns.size < 2) continue;
    const profile = computePatternRecurrenceProfile(signals);
    result.push({ groupKey: `project-agg:${key}`, primaryNutrientType: gNutrients[0].nutrientType, groupingMethod: 'project_type_aggregate', signals, recurrenceProfile: profile, involvedNutrientIds: signals.map((s) => s.nutrientId), workspaceId: gNutrients[0].workspaceId, projectId: gNutrients[0].projectId });
  }
  return result;
}

function detectRecurringPatternSignalGroups(nutrients) {
  const themeGroups = detectPatternThemeGroups(nutrients);
  const aggregateGroups = detectPatternProjectTypeAggregates(nutrients);
  const coveredByTheme = new Set(themeGroups.map((g) => `${g.workspaceId}:${g.projectId ?? ''}:${g.primaryNutrientType}`));
  const filteredAggregates = aggregateGroups.filter((ag) => !coveredByTheme.has(`${ag.workspaceId}:${ag.projectId ?? ''}:${ag.primaryNutrientType}`));
  return [...themeGroups, ...filteredAggregates];
}

const SEVERITY_RANK = { low: 1, medium: 2, high: 3, critical: 4 };

function highestPatternSeverity(severities) {
  return severities.reduce((best, s) => SEVERITY_RANK[s] > SEVERITY_RANK[best] ? s : best, 'low');
}

function computePatternTrajectory(group) {
  const sigs = [...group.signals].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  if (sigs.length < 2) return 'unknown';
  const mid = Math.ceil(sigs.length / 2);
  const avgFirst = sigs.slice(0, mid).reduce((s, x) => s + (SEVERITY_RANK[x.severity] ?? 2), 0) / mid;
  const avgSecond = sigs.slice(mid).reduce((s, x) => s + (SEVERITY_RANK[x.severity] ?? 2), 0) / Math.max(1, sigs.length - mid);
  if (avgSecond > avgFirst + 0.5) return 'increasing';
  if (avgFirst > avgSecond + 0.5) return 'decreasing';
  return 'stable';
}

function computePatternStatus(group) {
  const { totalOccurrences, distinctDigestionRuns } = group.recurrenceProfile;
  if (totalOccurrences >= 5 && distinctDigestionRuns >= 4) return 'chronic';
  if (totalOccurrences >= 3 && distinctDigestionRuns >= 2) return 'confirmed';
  return 'emerging';
}

function computePatternScores(group) {
  const { totalOccurrences, distinctArtifacts, distinctDigestionRuns, timeSpanDays } = group.recurrenceProfile;
  const occF = Math.min(1, totalOccurrences / 6);
  const runF = Math.min(1, distinctDigestionRuns / 5);
  const timeF = Math.min(1, timeSpanDays / 14);
  const recurrenceStrength = 0.4 * occF + 0.4 * runF + 0.2 * timeF;
  const avgConf = group.signals.reduce((s, x) => s + x.confidence, 0) / Math.max(1, group.signals.length);
  const artF = Math.min(1, distinctArtifacts / 5);
  const evidenceStrength = 0.6 * avgConf + 0.4 * artF;
  const confidence = Math.round((0.6 * recurrenceStrength + 0.4 * evidenceStrength) * 100) / 100;
  const severity = highestPatternSeverity(group.signals.map((s) => s.severity));
  return { recurrenceStrength: Math.round(recurrenceStrength * 100) / 100, evidenceStrength: Math.round(evidenceStrength * 100) / 100, confidence, severity, trajectory: computePatternTrajectory(group) };
}

function evaluatePatternPromotionRules(group) {
  const { primaryNutrientType: type, recurrenceProfile: rp } = group;
  const { totalOccurrences: occ, distinctDigestionRuns: runs } = rp;
  const severity = highestPatternSeverity(group.signals.map((s) => s.severity));
  const top = [...group.signals].sort((a, b) => b.confidence - a.confidence)[0]?.summary?.slice(0, 100) ?? 'unknown';
  const status = computePatternStatus(group);
  const trajectory = computePatternTrajectory(group);

  if (type === 'blocker_signal' && occ >= 3 && runs >= 2 && severity !== 'low')
    return { patternType: 'recurring_blocker_pattern', promotionReason: 'repeated_blocker_threshold_met', title: `Recurring Blocker: ${top}`, summary: `A blocker has recurred ${occ} times across ${runs} digestion runs.`, severity, status, trajectory };
  if (type === 'dependency_signal' && occ >= 3 && runs >= 2)
    return { patternType: 'recurring_dependency_pattern', promotionReason: 'repeated_dependency_threshold_met', title: `Recurring Dependency: ${top}`, summary: `A dependency has recurred ${occ} times across ${runs} runs.`, severity, status, trajectory };
  if (type === 'financial_impediment_signal' && occ >= 2 && runs >= 2)
    return { patternType: 'financial_friction_pattern', promotionReason: 'financial_friction_threshold_met', title: `Financial Friction: ${top}`, summary: `A financial impediment has recurred ${occ} times across ${runs} runs.`, severity, status, trajectory };
  if (type === 'governance_gap_signal' && occ >= 2 && runs >= 2)
    return { patternType: 'governance_degradation_pattern', promotionReason: 'governance_gap_accumulation', title: `Governance Degradation: ${top}`, summary: `Governance gaps have recurred ${occ} times across ${runs} runs.`, severity, status, trajectory };
  if (type === 'escalation_signal' && occ >= 2 && runs >= 2)
    return { patternType: 'escalation_trajectory_pattern', promotionReason: 'escalation_frequency_threshold', title: `Escalation Trajectory: ${top}`, summary: `Escalation signals have recurred ${occ} times across ${runs} runs.`, severity, status, trajectory };
  if (type === 'stakeholder_signal' && occ >= 3 && runs >= 2)
    return { patternType: 'stakeholder_pressure_pattern', promotionReason: 'stakeholder_pressure_accumulation', title: `Stakeholder Pressure: ${top}`, summary: `Stakeholder pressure has appeared ${occ} times across ${runs} runs.`, severity, status, trajectory };
  if ((type === 'delivery_drift_signal' || type === 'timeline_pressure_signal') && occ >= 2 && runs >= 2)
    return { patternType: 'delivery_drift_pattern', promotionReason: 'delivery_drift_accumulation', title: `Delivery Drift: ${top}`, summary: `Delivery drift has recurred ${occ} times across ${runs} runs.`, severity, status, trajectory };
  if (type === 'ambiguity_signal' && occ >= 3 && runs >= 2)
    return { patternType: 'ambiguity_accumulation_pattern', promotionReason: 'ambiguity_accumulation_threshold', title: `Ambiguity Accumulation: ${top}`, summary: `Ambiguity signals have accumulated ${occ} times across ${runs} runs.`, severity, status, trajectory };
  if (type === 'risk_signal' && occ >= 3 && runs >= 3 && rp.timeSpanDays >= 3)
    return { patternType: 'chronic_risk_pattern', promotionReason: 'chronic_risk_persistence', title: `Chronic Risk: ${top}`, summary: `Risk signals have persisted ${occ} times across ${runs} runs over ${Math.round(rp.timeSpanDays)} days.`, severity, status, trajectory };
  return null;
}

function detectPatternRecoveryCandidates(nutrients, residue) {
  const recoveries = nutrients.filter((n) => n.nutrientType === 'recovery_signal');
  const antecedents = nutrients.filter((n) => ['blocker_signal', 'risk_signal', 'dependency_signal'].includes(n.nutrientType));
  const scopeKeys = new Set(nutrients.map((n) => `${n.workspaceId}:${n.projectId ?? ''}`));
  const results = [];
  for (const scopeKey of scopeKeys) {
    const [ws, proj] = scopeKey.split(':', 2);
    const sr = recoveries.filter((n) => n.workspaceId === ws && (n.projectId ?? '') === (proj ?? ''));
    const sa = antecedents.filter((n) => n.workspaceId === ws && (n.projectId ?? '') === (proj ?? ''));
    if (sr.length < 1 || sa.length < 2) continue;
    const earliestA = Math.min(...sa.map((n) => Date.parse(n.createdAt)).filter((t) => !isNaN(t)));
    const latestR = Math.max(...sr.map((n) => Date.parse(n.createdAt)).filter((t) => !isNaN(t)));
    if (latestR <= earliestA) continue;
    const topR = [...sr].sort((a, b) => b.scoring.confidence - a.scoring.confidence)[0];
    results.push({ patternType: 'recovery_pattern', promotionReason: 'recovery_after_blockers', title: `Recovery Pattern: ${topR.summary.slice(0, 100)}`, summary: `Recovery signals appeared after ${sa.length} blocker/risk signals.`, severity: 'low', status: 'recovering', trajectory: 'decreasing', workspaceId: ws, projectId: proj || null, involvedNutrientIds: [...sr.map((n) => n.id), ...sa.map((n) => n.id)], involvedResidueIds: residue.filter((r) => r.workspaceId === ws && (r.projectId ?? '') === (proj ?? '')).map((r) => r.id) });
  }
  return results;
}

function buildPatternEvidenceReferences(patternId, workspaceId, nutrients, involvedNutrientIds) {
  const inv = new Set(involvedNutrientIds);
  const now = new Date().toISOString();
  return nutrients.filter((n) => inv.has(n.id)).slice(0, 10).map((n) => ({
    id: crypto.randomUUID(), patternId, workspaceId, nutrientId: n.id, residueId: null,
    sourceArtifactId: n.evidence[0]?.sourceArtifactId ?? null,
    excerpt: (n.evidence[0]?.excerpt ?? n.summary).slice(0, 300),
    evidenceTimestamp: n.evidence[0]?.timestamp ?? n.createdAt,
    contributionReason: `${n.nutrientType} matched with confidence ${n.scoring.confidence.toFixed(2)}`,
    createdAt: now,
  }));
}

function buildPatternsFromNutrientsJS(allNutrients, allResidue) {
  const now = new Date().toISOString();
  const groups = detectRecurringPatternSignalGroups(allNutrients);
  const patterns = [];

  for (const group of groups) {
    const candidate = evaluatePatternPromotionRules(group);
    if (!candidate) continue;
    const scores = computePatternScores(group);
    const patternId = crypto.randomUUID();
    const sortedSigs = [...group.signals].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    const firstSeenAt = sortedSigs[0]?.createdAt ?? now;
    const lastSeenAt = sortedSigs[sortedSigs.length - 1]?.createdAt ?? now;
    const evidenceReferences = buildPatternEvidenceReferences(patternId, group.workspaceId, allNutrients, group.involvedNutrientIds);
    patterns.push({ id: patternId, workspaceId: group.workspaceId, projectId: group.projectId, patternType: candidate.patternType, title: candidate.title, summary: candidate.summary, firstSeenAt, lastSeenAt, recurrenceCount: group.recurrenceProfile.totalOccurrences, involvedNutrientIds: group.involvedNutrientIds, involvedResidueIds: [], evidenceReferences, confidence: scores.confidence, severity: scores.severity, trajectory: scores.trajectory, status: candidate.status, promotionReason: candidate.promotionReason, recurrenceProfile: group.recurrenceProfile, createdAt: now, updatedAt: now });
  }

  const recoveryCandidates = detectPatternRecoveryCandidates(allNutrients, allResidue);
  for (const rc of recoveryCandidates) {
    const patternId = crypto.randomUUID();
    const recovNuts = allNutrients.filter((n) => n.nutrientType === 'recovery_signal' && n.workspaceId === rc.workspaceId && (n.projectId ?? '') === (rc.projectId ?? ''));
    const antNuts = allNutrients.filter((n) => ['blocker_signal','risk_signal','dependency_signal'].includes(n.nutrientType) && n.workspaceId === rc.workspaceId && (n.projectId ?? '') === (rc.projectId ?? ''));
    const allSorted = [...recovNuts, ...antNuts].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    const evidenceReferences = buildPatternEvidenceReferences(patternId, rc.workspaceId, allNutrients, rc.involvedNutrientIds);
    patterns.push({ id: patternId, workspaceId: rc.workspaceId, projectId: rc.projectId, patternType: 'recovery_pattern', title: rc.title, summary: rc.summary, firstSeenAt: allSorted[0]?.createdAt ?? now, lastSeenAt: allSorted[allSorted.length - 1]?.createdAt ?? now, recurrenceCount: recovNuts.length, involvedNutrientIds: rc.involvedNutrientIds, involvedResidueIds: rc.involvedResidueIds, evidenceReferences, confidence: 0.4, severity: 'low', trajectory: 'decreasing', status: 'recovering', promotionReason: 'recovery_after_blockers', recurrenceProfile: { totalOccurrences: recovNuts.length, distinctArtifacts: new Set(recovNuts.map((n) => n.evidence[0]?.sourceArtifactId).filter(Boolean)).size, distinctDigestionRuns: new Set(recovNuts.map((n) => n.digestionRunId)).size, timeSpanDays: 0, multiDaySpread: false }, createdAt: now, updatedAt: now });
  }

  return patterns.map((pattern) => ({ ...pattern, adaptiveScoring: computeAdaptiveScoringJS(pattern, patterns) }));
}



function computeAdaptiveScoringJS(pattern, peerPatterns) {
  const rank = { low: 1, medium: 2, high: 3, critical: 4 };
  let sev = rank[pattern.severity] ?? 2;
  let conf = pattern.confidence;
  const sevReasons = [];
  const confReasons = [];
  const contradictions = pattern.evidenceReferences.filter((e) => /resolved|stabilized|completed|responded/i.test(e.excerpt)).length;
  const recoveries = peerPatterns.filter((p) => p.patternType === 'recovery_pattern').length;
  const unresolvedDays = Math.max(0, (Date.parse(pattern.lastSeenAt) - Date.parse(pattern.firstSeenAt)) / 86_400_000);

  if (pattern.recurrenceCount >= 4) { sev += 0.45; conf += 0.08; sevReasons.push('recurrence_increase'); confReasons.push('cross_artifact_recurrence'); }
  if (pattern.trajectory === 'increasing') { sev += 0.4; conf += 0.05; sevReasons.push('escalation_trajectory_increase'); confReasons.push('correlated_signals'); }
  if (pattern.status === 'chronic') { sev += 0.35; conf += 0.05; sevReasons.push('chronic_pattern'); confReasons.push('pattern_confirmation'); }
  if (unresolvedDays > 10 && recoveries === 0) { sev += 0.3; sevReasons.push('recovery_absent'); }
  if (pattern.patternType === 'governance_degradation_pattern') { sev += 0.2; sevReasons.push('governance_degradation'); }

  if (recoveries > 0) { sev -= Math.min(0.5, recoveries * 0.18); conf -= 0.06; sevReasons.push('recovery_detected'); confReasons.push('contradictory_evidence'); }
  if (contradictions > 0) { conf -= Math.min(0.24, contradictions * 0.08); sev -= 0.2; sevReasons.push('contradiction_accumulation'); confReasons.push('contradictory_evidence'); }

  conf = Math.max(0.05, Math.min(0.99, Math.round(conf * 100) / 100));
  sev = Math.max(1, Math.min(4, sev));
  const adaptiveSeverity = sev >= 3.5 ? 'critical' : sev >= 2.5 ? 'high' : sev >= 1.5 ? 'medium' : 'low';
  const operationalUrgency = Math.round(((sev / 4) * 0.7 + conf * 0.3) * 100);
  const relevance = Math.round((Math.min(1, (pattern.recurrenceProfile.timeSpanDays + 1) / 30) * 0.4 + conf * 0.6) * 100);
  const escalationLikelihood = Math.min(100, Math.round((Math.min(1, pattern.recurrenceCount / 6) * 0.5 + (pattern.trajectory === 'increasing' ? 0.35 : 0.1) + (pattern.status === 'chronic' ? 0.15 : 0.05)) * 100));

  return {
    adaptiveSeverity,
    adaptiveConfidence: conf,
    operationalUrgency,
    relevance,
    escalationLikelihood,
    severityEvolution: { base: pattern.severity, adjusted: adaptiveSeverity, history: [pattern.severity, adaptiveSeverity], reasons: [...new Set(sevReasons)] },
    confidenceEvolution: { base: pattern.confidence, adjusted: conf, history: [pattern.confidence, conf], reasons: [...new Set(confReasons)] },
    contradictionProfile: { contradictionCount: contradictions },
    recoveryProfile: { recoveryCount: recoveries, unresolvedDays: Math.round(unresolvedDays), recoveryPresent: recoveries > 0 },
  };
}

function getAdaptiveOperationalContextJS(patterns) {
  const scored = patterns.map((p) => computeAdaptiveScoringJS(p, patterns));
  return {
    activeChronicRisks: patterns.filter((p) => p.status === 'chronic').length,
    risingEscalations: patterns.filter((p) => p.trajectory === 'increasing').length,
    recoveringPatterns: patterns.filter((p) => p.status === 'recovering' || p.trajectory === 'recovered').length,
    contradictionAccumulation: scored.reduce((s, x) => s + x.contradictionProfile.contradictionCount, 0),
    averageAdaptiveConfidence: scored.length ? Math.round((scored.reduce((s, x) => s + x.adaptiveConfidence, 0) / scored.length) * 100) / 100 : 0,
  };
}
/**
 * Runs the learned pattern analysis on all digested simulation artifacts.
 * Returns patterns grouped by project.
 */
export function runLearnedPatternAnalysis(digestedResults) {
  const allNutrients = digestedResults.flatMap((r) => r.result.nutrients);
  const allResidue = digestedResults.flatMap((r) => r.result.residue);
  const patterns = buildPatternsFromNutrientsJS(allNutrients, allResidue);

  // Group by projectId
  const byProject = {};
  for (const pattern of patterns) {
    const key = pattern.projectId ?? 'unknown';
    if (!byProject[key]) byProject[key] = [];
    byProject[key].push(pattern);
  }

  // Compute type distribution
  const typeDistribution = {};
  for (const p of patterns) {
    typeDistribution[p.patternType] = (typeDistribution[p.patternType] ?? 0) + 1;
  }

  return { patterns, byProject, typeDistribution, totalPatterns: patterns.length, adaptiveOperationalContext: getAdaptiveOperationalContextJS(patterns) };
}

/**
 * Expected pattern types per project for smoke test validation.
 */
export const EXPECTED_PATTERNS_BY_PROJECT = {
  'proj-mep-14156': ['recurring_blocker_pattern', 'recurring_dependency_pattern', 'escalation_trajectory_pattern', 'recovery_pattern'],
  'proj-ice-9298': ['financial_friction_pattern', 'escalation_trajectory_pattern'],
  'proj-gch-15992': ['recurring_dependency_pattern', 'governance_degradation_pattern'],
  'proj-hsa-15576': ['recurring_blocker_pattern', 'recurring_dependency_pattern'],
  'proj-muc-13098': ['delivery_drift_pattern'],
};



export function detectInterventionsFromDigestedResults(digestedResults, learnedPatterns) {
  const interventions = [];
  const rules = [
    ['follow_up', [/follow\s*up/i,/seguimiento/i,/solicit[oó]\s+actualizaci[oó]n/i]],
    ['escalation', [/escalat/i,/sponsor\s+intervention/i]],
    ['technical_session', [/technical\s+session|mesa\s+t[eé]cnica|guided\s+session|workshop|validaci[oó]n\s+t[eé]cnica/i]],
    ['approval_request', [/approval\s+requested|pendiente\s+aprobaci[oó]n|visto\s+bueno/i]],
    ['vendor_coordination', [/vendor|td\s*synnex|cisco|manageengine|supplier\s+follow-up/i]],
    ['financial_escalation', [/payment\s+pending|\binvoice\b|\bPO\b|\bOC\b|billing|facturaci[oó]n|presupuesto/i]],
    ['recovery_action', [/resolved|unblocked|completed|recovered|habilitado|ya\s+se\s+complet[oó]/i]],
  ];
  for (const { result } of digestedResults) for (const n of result.nutrients) {
    const text = `${n.summary} ${n.evidence.map((e)=>e.excerpt).join(' ')}`;
    for (const [type, pats] of rules) if (pats.some((r)=>r.test(text))) {
      interventions.push({ id: crypto.randomUUID(), workspaceId: n.workspaceId, projectId: n.projectId, interventionType: type, attemptedAt: n.createdAt, targetPatternId: null, summary: n.summary, evidence: n.evidence[0]?.excerpt ?? n.summary });
      break;
    }
  }
  return interventions;
}

// Export for test consumption
export { runSmokeTest, validateOverTriggering, validateUnderTriggering, validateSignalDensity, validateLineageIntegrity, validateDeterminism, digestArtifact };

// Run if executed directly
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve('scripts/smoke-test-vault-digestion.mjs');
if (isMain) {
  runSmokeTest({ writeReports: !process.argv.includes('--dry-run') });
}
