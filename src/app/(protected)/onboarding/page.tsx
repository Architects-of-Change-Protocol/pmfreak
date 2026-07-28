import { redirectToCanonicalOnboardingDestination } from "@/lib/auth/legacy-onboarding-redirect";

export default async function OnboardingPage() {
  await redirectToCanonicalOnboardingDestination();
}
