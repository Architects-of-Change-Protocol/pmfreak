/**
 * Founder Circle Program — email templates.
 *
 * Only the invitation email is machine-sent (with a manual-link fallback
 * when the provider is unconfigured — early-access precedent). Every other
 * builder here backs the DOCUMENTED MANUAL communication workflow in
 * docs/founder-program/10-operations-runbook.md §12: the operator renders
 * the text and sends it from their own mail client. No delivery is ever
 * claimed without provider evidence.
 *
 * Copy standards (Pilot Gate Sprint 01, honest UX): no false urgency, no
 * fake scarcity, no "cofounder"/equity implications, early-pilot limitations
 * stated plainly.
 */

const HONEST_PROGRAM_SUMMARY =
  "This is a small, closed pilot program. The product is early: some surfaces are still evolving, functionality may change, and we ask participants for structured feedback in return for early access.";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function supportLine(supportContact?: string | null): string {
  return supportContact ? `Questions? Contact ${supportContact}.` : "";
}

export function buildFounderInvitationEmail(input: {
  recipientEmail: string;
  programName: string;
  inviteLink: string;
  expiresAt: string;
  supportContact?: string | null;
}) {
  const expiresDate = new Date(input.expiresAt).toLocaleDateString();
  const programName = escapeHtml(input.programName);
  const subject = `Your ${input.programName} invitation`;

  const html = `
  <div style="font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial; background: #020617; color: #e2e8f0; padding: 24px;">
    <div style="max-width: 640px; margin: 0 auto; border: 1px solid rgba(148,163,184,0.3); border-radius: 16px; background: rgba(15, 23, 42, 0.9); padding: 24px;">
      <p style="margin: 0 0 12px; color: #bae6fd; font-size: 12px; letter-spacing: .08em; text-transform: uppercase;">${programName}</p>
      <p style="margin: 0 0 16px;">Hi ${escapeHtml(input.recipientEmail)},</p>
      <p style="margin: 0 0 16px;">You've been invited to apply to the ${programName} — a closed group of practitioners helping shape PMFreak while it is still early.</p>
      <p style="margin: 0 0 16px;">${escapeHtml(HONEST_PROGRAM_SUMMARY)}</p>
      <p style="margin: 0 0 16px;">Joining is a short application followed by a human review — the invitation itself does not grant access.</p>
      <p style="margin: 0 0 20px;">This invitation link expires on <strong>${expiresDate}</strong>.</p>
      <p style="margin: 0 0 20px;"><a href="${input.inviteLink}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#67e8f9;color:#082f49;text-decoration:none;font-weight:700;">View the invitation</a></p>
      <p style="margin: 0; color: #94a3b8; font-size: 12px;">If the button doesn't work, use this link: ${input.inviteLink}</p>
      ${input.supportContact ? `<p style="margin: 12px 0 0; color: #94a3b8; font-size: 12px;">${escapeHtml(supportLine(input.supportContact))}</p>` : ""}
    </div>
  </div>`;

  const text = `Hi ${input.recipientEmail},\n\nYou've been invited to apply to the ${input.programName} — a closed group of practitioners helping shape PMFreak while it is still early.\n\n${HONEST_PROGRAM_SUMMARY}\n\nJoining is a short application followed by a human review — the invitation itself does not grant access.\n\nView the invitation: ${input.inviteLink}\nThis link expires on ${expiresDate}.\n${supportLine(input.supportContact)}`;

  return { subject, html, text };
}

/**
 * Manual-send builders (plain text): rendered in the operator console /
 * runbook, sent by a human. Kept as one map so the runbook and the operator
 * UI list stays in sync with the template inventory.
 */
export const FOUNDER_MANUAL_EMAIL_TEMPLATES = {
  invitation_reminder: (p: { programName: string }) =>
    `Subject: Reminder — your ${p.programName} invitation\n\nA quick reminder that your invitation to apply to the ${p.programName} is still open. ${HONEST_PROGRAM_SUMMARY} If the link has expired, reply and we'll send a fresh one.`,
  application_received: (p: { programName: string }) =>
    `Subject: We received your ${p.programName} application\n\nThanks for applying to the ${p.programName}. Applications are reviewed by a human; we'll get back to you either way. No action is needed right now.`,
  approved: (p: { programName: string }) =>
    `Subject: Your ${p.programName} application was approved\n\nGood news — your application was approved. The next step is reviewing and accepting the pilot agreement inside the product; after that we'll activate your access. Approval alone does not grant access yet.`,
  waitlisted: (p: { programName: string }) =>
    `Subject: Your ${p.programName} application — waitlist\n\nThanks for applying. The current cohort is at capacity, so we've placed your application on the waitlist. We'll reach out if a seat opens; you may withdraw at any time.`,
  rejected: (p: { programName: string }) =>
    `Subject: Your ${p.programName} application\n\nThank you for the time you put into applying. We're not able to include you in this cohort. This is a capacity- and fit-constrained closed pilot, not a judgement of your work — we'd be glad to stay in touch for later programs.`,
  agreement_required: (p: { programName: string }) =>
    `Subject: ${p.programName} — pilot agreement step\n\nYour participation needs one more step: reviewing and accepting the current pilot agreement inside the product. Your access is activated after that.`,
  activation_ready: (p: { programName: string }) =>
    `Subject: ${p.programName} — your access is active\n\nYour ${p.programName} access is now active. The product is an early pilot: some surfaces are still evolving. Your workspace and its data remain yours; feedback entry points are inside the product.`,
  feedback_request: (p: { programName: string }) =>
    `Subject: ${p.programName} — quick structured feedback\n\nAs part of the ${p.programName}, we'd value a short piece of structured feedback on what worked and what didn't this week. The in-product feedback form takes about two minutes.`,
  followup_request: (p: { programName: string }) =>
    `Subject: ${p.programName} — follow-up session\n\nWe'd like to schedule a short follow-up session to watch how you use PMFreak and capture friction honestly. Participation is voluntary and can be declined without affecting your access.`,
  program_paused: (p: { programName: string }) =>
    `Subject: ${p.programName} — participation paused\n\nYour ${p.programName} participation is paused. While paused, program access is disabled. We'll contact you about next steps; reply to this email with any questions.`,
  access_revoked: (p: { programName: string }) =>
    `Subject: ${p.programName} — access ended\n\nYour ${p.programName} access has ended. Your data-return options are described in the pilot agreement; reply to this email to arrange an export.`,
  review_outcome: (p: { programName: string }) =>
    `Subject: ${p.programName} — program review outcome\n\nWe completed the scheduled review of the ${p.programName} and want to share the outcome and what it means for you as a participant. Details follow below (operator: fill in the ratified decision from the decision gate).`,
} as const;

export type FounderManualEmailTemplateKey = keyof typeof FOUNDER_MANUAL_EMAIL_TEMPLATES;
