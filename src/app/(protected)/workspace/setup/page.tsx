import { redirectToCanonicalOnboardingDestination } from "@/lib/auth/legacy-onboarding-redirect";

/**
 * Retired: this route used to host the legacy fabricated-readiness wizard
 * (GettingStartedFlow). It is no longer a reachable onboarding surface — see
 * docs/audits/remediation/pmf-001-002-canonical-onboarding-honest-activation.md.
 * A bookmarked URL redirects to the real, derived canonical destination.
 */
export default async function WorkspaceSetupPage() {
  await redirectToCanonicalOnboardingDestination();
}
