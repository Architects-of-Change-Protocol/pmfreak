import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type UserRole = "owner" | "admin" | "pm" | "viewer";

export type AuthUserContext = {
  id: string;
  email: string;
  fullName: string;
  companyId: string;
  companyName: string;
  role: UserRole;
  onboardingCompleted: boolean;
};

const toRole = (role: unknown): UserRole => {
  if (role === "owner" || role === "admin" || role === "pm" || role === "viewer") {
    return role;
  }

  return "viewer";
};

export const getAuthUser = cache(async (): Promise<AuthUserContext | null> => {
  if (!hasSupabaseEnv) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return null;
  }

  const metadata = user.user_metadata ?? {};

  return {
    id: user.id,
    email: user.email,
    fullName: typeof metadata.full_name === "string" ? metadata.full_name : user.email,
    companyId: typeof metadata.company_id === "string" ? metadata.company_id : user.id,
    companyName: typeof metadata.company_name === "string" ? metadata.company_name : "Independent",
    role: toRole(metadata.role),
    onboardingCompleted: metadata.onboarding_completed === true,
  };
});

export const requireAuthUser = async () => {
  const user = await getAuthUser();
  if (!user) {
    const headersList = await headers();
    const currentPath = headersList.get("x-pathname") ?? "/command-center";
    const nextParam = encodeURIComponent(currentPath || "/command-center");
    redirect(`/login?next=${nextParam}`);
  }
  return user;
};

export const isFounderOrInternalUser = (user: AuthUserContext) => {
  const email = user.email.toLowerCase();

  const internalDomain =
    email.endsWith("@pmfreak.ai") ||
    email.endsWith("@onchainfest.xyz");

  return user.role === "owner" || user.role === "admin" || internalDomain;
};
