"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { resolvePostAuthRedirectPath } from "@/lib/auth-redirect";
import { buildAbuseKey, enforceAbuseLimit, getClientIpFromHeaders } from "@/lib/security/abuse-protection";

export const loginAction = async (formData: FormData): Promise<void> => {
  if (!hasSupabaseEnv) {
    redirect("/login?error=Configure+Supabase+environment+variables");
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!email || !password) {
    redirect("/login?error=Email+and+password+are+required");
  }

  // Defense-in-depth on top of Supabase Auth's own throttling — see
  // docs/security/abuse-protection-boundary.md ("auth.login_attempt"). A
  // generic error keeps the response identical whether the email exists or
  // not, so this does not become a new enumeration vector.
  const headersList = await headers();
  const clientIp = getClientIpFromHeaders(headersList);
  const abuseDecision = await enforceAbuseLimit({
    scope: "auth.login_attempt",
    identifier: buildAbuseKey([clientIp, email]),
    limit: 10,
    windowSeconds: 900,
  });
  if (!abuseDecision.allowed) {
    redirect("/login?error=Too+many+login+attempts.+Please+try+again+later.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const isUnverified = error.message.toLowerCase().includes("email not confirmed");
    const message = isUnverified ? "Please verify your email before logging in." : error.message;
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }

  const redirectPath = await resolvePostAuthRedirectPath(supabase);
  redirect(redirectPath);
};
