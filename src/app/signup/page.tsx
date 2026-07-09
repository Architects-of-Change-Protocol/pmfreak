import Link from "next/link";
import { signupAction } from "./actions";
import { AuthShell } from "@/components/auth/auth-shell";
import AuthSubmitButton from "@/components/auth-submit-button";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthShell
      title="Set up your PMFreak workspace"
      subtitle="Get project visibility and meeting prep support in minutes."
    >
      {params.error && (
        <p className="mb-4 text-sm text-red-600">{params.error}</p>
      )}

      <form action={signupAction} className="space-y-4">
        {params.next ? <input type="hidden" name="next" value={params.next} /> : null}
        <input name="fullName" placeholder="Full name" required className="w-full rounded-xl border-2 border-black px-4 py-3 text-sm" />

        <input name="companyName" placeholder="Company name" required className="w-full rounded-xl border-2 border-black px-4 py-3 text-sm" />

        <input name="email" type="email" placeholder="Email" required className="w-full rounded-xl border-2 border-black px-4 py-3 text-sm" />

        <input name="password" type="password" placeholder="Password" required className="w-full rounded-xl border-2 border-black px-4 py-3 text-sm" />

        <AuthSubmitButton idleLabel="Start Free" pendingLabel="Creating..." />
      </form>

      <p className="mt-6 text-sm">
        Already have an account?{" "}
        <Link href={params.next ? `/login?next=${encodeURIComponent(params.next)}` : "/login"} className="font-bold">
          Continue
        </Link>
      </p>
    </AuthShell>
  );
}
