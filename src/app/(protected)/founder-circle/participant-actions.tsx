"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputClass =
  "w-full rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none";

const FEEDBACK_TYPES = [
  { value: "onboarding_friction", label: "Onboarding friction" },
  { value: "defect", label: "Defect / bug" },
  { value: "usability", label: "Usability" },
  { value: "feature_request", label: "Feature request" },
  { value: "missing_integration", label: "Missing integration" },
  { value: "pricing_value", label: "Pricing / value perception" },
  { value: "workflow_outcome", label: "Workflow outcome" },
  { value: "general", label: "General" },
];

export function FounderFeedbackForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/founder-program/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedbackType: form.get("feedbackType"),
          severity: form.get("severity"),
          productArea: form.get("productArea") || null,
          body: form.get("body"),
          allowContact: form.get("allowContact") === "on",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ tone: "error", text: typeof data.error === "string" ? data.error : "Feedback could not be submitted." });
      } else {
        setMessage({ tone: "ok", text: "Thanks — your feedback was recorded." });
        (event.target as HTMLFormElement).reset();
        router.refresh();
      }
    } catch {
      setMessage({ tone: "error", text: "Network error — please retry." });
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" aria-label="Submit structured feedback">
      <div className="grid gap-3 sm:grid-cols-3">
        <select name="feedbackType" required className={inputClass} aria-label="Feedback type">
          {FEEDBACK_TYPES.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select name="severity" className={inputClass} aria-label="Severity" defaultValue="medium">
          <option value="low">Low impact</option>
          <option value="medium">Medium impact</option>
          <option value="high">High impact</option>
          <option value="critical">Critical</option>
        </select>
        <input name="productArea" maxLength={120} className={inputClass} placeholder="Product area (optional)" aria-label="Product area" />
      </div>
      <textarea name="body" required maxLength={4000} rows={3} className={inputClass} placeholder="What happened, and what did you expect?" aria-label="Feedback" />
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" name="allowContact" defaultChecked /> You may contact me about this feedback.
      </label>
      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "text-sm text-rose-300" : "text-sm text-emerald-300"}>
          {message.text}
        </p>
      ) : null}
      <button type="submit" disabled={submitting} className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">
        {submitting ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}

export function FounderWithdrawButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withdraw() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/founder-program/application/withdraw", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "Withdrawal failed.");
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error — please retry.");
    }
    setSubmitting(false);
  }

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="text-sm text-slate-400 underline underline-offset-4">
        Withdraw from the program
      </button>
    );
  }
  return (
    <div className="space-y-2 rounded-xl border border-rose-400/40 bg-rose-400/5 p-3">
      <p className="text-sm text-rose-200">Withdrawing ends your participation. This cannot be undone from the product.</p>
      {error ? <p role="alert" className="text-sm text-rose-300">{error}</p> : null}
      <div className="flex gap-2">
        <button onClick={withdraw} disabled={submitting} className="rounded-full bg-rose-400 px-4 py-1.5 text-sm font-semibold text-slate-950 disabled:opacity-60">
          {submitting ? "Withdrawing…" : "Confirm withdrawal"}
        </button>
        <button onClick={() => setConfirming(false)} className="rounded-full border border-slate-600 px-4 py-1.5 text-sm text-slate-300">
          Keep participating
        </button>
      </div>
    </div>
  );
}
