/**
 * Pilot Gate Sprint 01 — Task 9 (pilot agreement technical readiness).
 *
 * TECHNICAL SUPPORT ONLY. This module carries no legal text and must not
 * be treated as a contract. It provides the plumbing a signed pilot
 * agreement needs once legal counsel supplies the content:
 *   - a single versioned source of truth for the agreement version,
 *   - placeholder section structure counsel will fill in,
 *   - the acceptance-record contract (who accepted which version, when),
 *   - an explicit list of the legal dependencies that remain open.
 *
 * Stage calibration (ERR-10): a closed FREE pilot may run on a direct,
 * signed offline agreement per design partner; published ToS/Privacy are
 * required before any PAID pilot (S2). See
 * docs/release/pilot-agreement-readiness.md.
 */

/** Bump on every content revision once legal text lands. Format: MAJOR.MINOR. */
export const PILOT_AGREEMENT_VERSION = "0.1-draft";

/** True until legal counsel has reviewed and approved the agreement text. */
export const PILOT_AGREEMENT_IS_PLACEHOLDER = true;

export type PilotAgreementSection = {
  id: string;
  title: string;
  /** Placeholder guidance for counsel — NOT legal text. */
  placeholder: string;
};

export const PILOT_AGREEMENT_SECTIONS: readonly PilotAgreementSection[] = [
  { id: "parties", title: "Parties & Scope", placeholder: "[LEGAL REVIEW REQUIRED] Identify PMFreak operator entity and the design-partner entity; scope: closed free pilot, non-production commitment." },
  { id: "data-handling", title: "Data Handling & Confidentiality", placeholder: "[LEGAL REVIEW REQUIRED] What workspace data is stored (Supabase-hosted Postgres), subprocessors (Supabase, Vercel, Stripe, OpenAI for copilot requests), confidentiality obligations both ways." },
  { id: "ai-disclosure", title: "AI Usage Disclosure", placeholder: "[LEGAL REVIEW REQUIRED] Copilot requests are processed by a third-party LLM provider; deterministic surfaces are labeled as such in-product." },
  { id: "availability", title: "Service Availability & Support", placeholder: "[LEGAL REVIEW REQUIRED] Pilot-grade availability: no SLA, founder-led support, known-limitations doc referenced." },
  { id: "data-return", title: "Data Return & Deletion", placeholder: "[LEGAL REVIEW REQUIRED] Operator-run export on request (RR-EXPORT commitment); deletion on pilot exit; timelines." },
  { id: "termination", title: "Term & Termination", placeholder: "[LEGAL REVIEW REQUIRED] Pilot duration, either-party exit, effect on data." },
  { id: "liability", title: "Liability & Warranty Disclaimer", placeholder: "[LEGAL REVIEW REQUIRED] Pilot software provided as-is; liability caps." },
] as const;

/** Open legal dependencies blocking later stages (tracked, not resolved here). */
export const PILOT_LEGAL_DEPENDENCIES: readonly string[] = [
  "Legal counsel drafts/approves the pilot agreement text (blocks: signing the first design partner).",
  "Published Terms of Service + Privacy Policy (blocks: closed PAID pilot / S2 — landing footer links stay disabled until then).",
  "Subprocessor list confirmation (Supabase, Vercel, Stripe, OpenAI) inside the privacy documentation.",
  "DPA template (blocks: first B2B contract that requests it, not the free pilot).",
] as const;

export type PilotAgreementAcceptance = {
  userId: string;
  workspaceId: string;
  agreementVersion: string;
  acceptedAt: string;
  /** How the acceptance was captured: in-product click-through or offline signature recorded by the founder. */
  method: "in_product" | "offline_signed";
};

export function isAcceptanceCurrent(acceptance: Pick<PilotAgreementAcceptance, "agreementVersion">): boolean {
  return acceptance.agreementVersion === PILOT_AGREEMENT_VERSION;
}
