"use client";

import { useState } from "react";
import type { CompanySubscriptionState } from "@/lib/billing";

type Props = {
  subscription: CompanySubscriptionState;
};

export default function BillingClient({ subscription }: Props) {
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [isCreatingPortal, setIsCreatingPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createCheckoutSession = async () => {
    setIsCreatingCheckout(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro" }),
      });

      const payload = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !payload.url) {
        setError(payload.error ?? "Unable to create checkout session.");
        return;
      }

      window.location.href = payload.url;
    } catch {
      setError("Unable to create checkout session.");
    } finally {
      setIsCreatingCheckout(false);
    }
  };

  const createPortalSession = async () => {
    setIsCreatingPortal(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/create-portal-session", {
        method: "POST",
      });

      const payload = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !payload.url) {
        setError(payload.error ?? "Unable to open Stripe billing portal.");
        return;
      }

      window.location.href = payload.url;
    } catch {
      setError("Unable to open Stripe billing portal.");
    } finally {
      setIsCreatingPortal(false);
    }
  };

  const onManageSubscription = async () => {
    if (subscription.stripeCustomerId) {
      await createPortalSession();
      return;
    }

    await createCheckoutSession();
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <h2 className="text-lg font-semibold text-cyan-900">Manage Subscription</h2>
      <p className="mt-2 text-sm text-slate-700">
        Use Stripe checkout and billing portal to upgrade, update payment methods, or cancel.
      </p>

      <div className="mt-4 grid gap-3 text-sm text-slate-800 md:grid-cols-2">
        <p>
          <span className="text-slate-600">Plan:</span> {subscription.plan}
        </p>
        <p>
          <span className="text-slate-600">Status:</span> {subscription.subscriptionStatus}
        </p>
        <p>
          <span className="text-slate-600">Stripe Customer ID:</span> {subscription.stripeCustomerId ?? "Not created"}
        </p>
        <p>
          <span className="text-slate-600">Current Period End:</span>{" "}
          {subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleString() : "N/A"}
        </p>
      </div>

      {error ? <p className="mt-4 text-sm text-rose-800">{error}</p> : null}

      <div className="mt-5 flex flex-wrap gap-3">
        {subscription.plan === "free" ? (
          <button
            type="button"
            onClick={createCheckoutSession}
            disabled={isCreatingCheckout}
            className="inline-flex h-10 items-center justify-center rounded-full bg-cyan-300 px-5 text-sm font-semibold text-slate-100 transition hover:bg-cyan-200 disabled:bg-slate-500"
          >
            {isCreatingCheckout ? "Redirecting..." : "Upgrade to Pro"}
          </button>
        ) : null}

        <button
          type="button"
          onClick={onManageSubscription}
          disabled={isCreatingPortal || isCreatingCheckout}
          className="inline-flex h-10 items-center justify-center rounded-full border border-cyan-300/70 px-5 text-sm font-semibold text-cyan-900 transition hover:bg-cyan-300/10 disabled:border-slate-500 disabled:text-slate-600"
        >
          {isCreatingPortal ? "Opening portal..." : "Manage Subscription"}
        </button>
      </div>
    </section>
  );
}
