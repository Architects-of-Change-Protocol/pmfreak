// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Digest — Anonymization Engine
// Removes PII and normalizes sensitive entities into categorical labels.
// ─────────────────────────────────────────────────────────────────────────────

import type { AnonymizationResult } from "./types";

// ─── PII patterns ─────────────────────────────────────────────────────────────

const EMAIL_RE = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g;
const PHONE_RE = /(?:\+?\d[\d\s\-().]{7,}\d)/g;
const URL_RE = /https?:\/\/[^\s"'<>]+/g;
const PROJECT_ID_RE = /\b[A-Z]{2,8}-\d{4,7}\b/g;
const EXACT_AMOUNT_RE = /\$[\d,]+(?:\.\d{1,2})?|\b\d[\d,.]*\s*(?:USD|EUR|MXN|GBP|dollars?|euros?)\b/gi;
const ADDRESS_RE = /\b\d{1,5}\s+[A-Z][a-z]+([\s,][A-Z][a-z]+){1,4}(?:\s+(?:St|Ave|Blvd|Rd|Dr|Ln|Way|Pl|Suite|Ste)\b)?/g;

// ─── Industry normalization map ───────────────────────────────────────────────
// Maps known domain keywords → canonical industry label.

const INDUSTRY_KEYWORDS: Array<[RegExp, string]> = [
  [/\bbanco\b|\bbank\b|\bfinanci(?:al|era)\b|\bcredit\b|\bpayment\b/i, "banking_organization"],
  [/\bsalud\b|\bhospital\b|\bcl[íi]nica\b|\bpharmac\b|\bhealth\b/i, "healthcare_organization"],
  [/\bseguro[s]?\b|\binsurance\b|\baseguradora\b/i, "insurance_organization"],
  [/\bteleco(?:m|municaci[oó]n)\b|\boperadora\b|\bcarrier\b/i, "telecom_organization"],
  [/\benerg[íi]a\b|\belectr[íi]c\b|\bpetrol\b|\bgas\b|\butil\b/i, "energy_organization"],
  [/\bgobierno\b|\bgoverment\b|\bgovernment\b|\bministerio\b|\bagencia\b/i, "government_organization"],
  [/\bretail\b|\btienda\b|\bcommerce\b|\bsupermarket\b/i, "retail_organization"],
  [/\bmanufact\b|\bfabrica\b|\bindustri\b/i, "manufacturing_organization"],
  [/\btecnolog[íi]a\b|\bsoftware\b|\btech\b|\bIT\b/i, "technology_organization"],
  [/\bconsultor[íia]\b|\bconsulting\b/i, "consulting_organization"],
  [/\bproveedor\b|\bvendor\b|\bsupplier\b|\bcontractor\b/i, "third_party_vendor"],
];

// ─── Budget normalization ─────────────────────────────────────────────────────

function normalizeBudget(text: string): { result: string; normalizations: Array<{ original: string; normalized: string }> } {
  const normalizations: Array<{ original: string; normalized: string }> = [];
  const result = text.replace(EXACT_AMOUNT_RE, (match) => {
    const normalized = classifyBudgetBand(match);
    normalizations.push({ original: match, normalized });
    return normalized;
  });
  return { result, normalizations };
}

function classifyBudgetBand(amountStr: string): string {
  const digits = amountStr.replace(/[^0-9.]/g, "");
  const amount = parseFloat(digits) || 0;
  if (amount < 10_000) return "budget_band_small";
  if (amount < 100_000) return "budget_band_medium";
  if (amount < 1_000_000) return "budget_band_large";
  return "budget_band_enterprise";
}

// ─── Organization normalization ───────────────────────────────────────────────

function normalizeOrganizations(text: string): { result: string; normalizations: Array<{ original: string; normalized: string }> } {
  const normalizations: Array<{ original: string; normalized: string }> = [];
  let result = text;

  for (const [pattern, label] of INDUSTRY_KEYWORDS) {
    // Match stand-alone capitalized tokens that align with the industry keyword
    const wordRe = new RegExp(
      `\\b([A-Z][A-Za-zÀ-ÿ'&.\\s]{2,40})\\b(?=[^.]*\\b(?:${pattern.source})\\b)`,
      "g",
    );
    result = result.replace(wordRe, (match) => {
      // Only replace if starts with uppercase (proper noun heuristic)
      if (/^[A-Z]/.test(match.trim())) {
        normalizations.push({ original: match.trim(), normalized: label });
        return label;
      }
      return match;
    });
  }
  return { result, normalizations };
}

// ─── Main anonymization function ──────────────────────────────────────────────

export function anonymizeText(text: string): AnonymizationResult {
  const removedEntities: string[] = [];
  const normalizations: Array<{ original: string; normalized: string }> = [];
  let anonymized = text;

  // Remove emails
  anonymized = anonymized.replace(EMAIL_RE, (match) => {
    removedEntities.push(match);
    return "[email_removed]";
  });

  // Remove phones
  anonymized = anonymized.replace(PHONE_RE, (match) => {
    removedEntities.push(match.trim());
    return "[phone_removed]";
  });

  // Remove URLs
  anonymized = anonymized.replace(URL_RE, (match) => {
    removedEntities.push(match);
    return "[url_removed]";
  });

  // Remove project IDs (e.g. BPD-16483)
  anonymized = anonymized.replace(PROJECT_ID_RE, (match) => {
    removedEntities.push(match);
    return "[project_id_removed]";
  });

  // Remove addresses
  anonymized = anonymized.replace(ADDRESS_RE, (match) => {
    removedEntities.push(match.trim());
    return "[address_removed]";
  });

  // Normalize budget amounts before organizations to avoid partial matches
  const budgetResult = normalizeBudget(anonymized);
  anonymized = budgetResult.result;
  normalizations.push(...budgetResult.normalizations);

  // Normalize organizations
  const orgResult = normalizeOrganizations(anonymized);
  anonymized = orgResult.result;
  normalizations.push(...orgResult.normalizations);

  return {
    anonymizedText: anonymized.trim(),
    removedEntities,
    normalizations,
  };
}

// ─── Validate absence of PII ──────────────────────────────────────────────────

export function containsPii(text: string): boolean {
  // Reset lastIndex before each test — module-level regexes with `g` flag
  // retain state across calls, causing false negatives on repeated invocations.
  EMAIL_RE.lastIndex = 0;
  PROJECT_ID_RE.lastIndex = 0;
  URL_RE.lastIndex = 0;
  return (
    EMAIL_RE.test(text) ||
    PROJECT_ID_RE.test(text) ||
    URL_RE.test(text)
  );
}

export { classifyBudgetBand };
