import { getCompanySubscription } from "@/lib/billing";
import { requireAuthUser } from "@/lib/auth";
import BillingClient from "./billing-client";

export default async function BillingPage() {
  const user = await requireAuthUser();
  const subscription = await getCompanySubscription(user.companyId);

  return (
    <main className="rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl backdrop-blur-xl md:p-10">
      <p className="text-xs uppercase tracking-[0.28em] text-cyan-700">Billing</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Subscription & Usage</h1>
      <p className="mt-2 text-sm text-slate-700">Manage your Stripe subscription for {user.companyName}.</p>

      <div className="mt-8">
        <BillingClient subscription={subscription} />
      </div>
    </main>
  );
}
