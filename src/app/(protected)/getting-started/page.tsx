import { redirectToCanonicalOnboardingDestination } from "@/lib/auth/legacy-onboarding-redirect";

export default async function GettingStartedPage() {
  await redirectToCanonicalOnboardingDestination();
}
