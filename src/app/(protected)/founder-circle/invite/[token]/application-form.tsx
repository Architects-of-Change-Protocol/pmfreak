"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ARCHETYPE_HINT = "Your invitation was issued for a specific practitioner profile — the application asks about your real context, not credentials.";

const EXPERIENCE_OPTIONS = [
  { value: "lt_2", label: "Less than 2 years" },
  { value: "2_5", label: "2–5 years" },
  { value: "5_10", label: "5–10 years" },
  { value: "10_plus", label: "More than 10 years" },
];
const PROJECT_OPTIONS = [
  { value: "1_2", label: "1–2" },
  { value: "3_5", label: "3–5" },
  { value: "6_10", label: "6–10" },
  { value: "10_plus", label: "More than 10" },
];
const AVAILABILITY_OPTIONS = [
  { value: "weekly", label: "Weekly session" },
  { value: "biweekly", label: "Every two weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "async_only", label: "Async feedback only" },
];

const inputClass =
  "w-full rounded-lg border border-slate-600 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none";
const labelClass = "block text-sm font-medium text-slate-800 mb-1";

export function FounderApplicationForm({ token }: { token: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const payload = {
      token,
      fullName: form.get("fullName"),
      roleTitle: form.get("roleTitle"),
      companyStatus: form.get("companyStatus"),
      experienceRange: form.get("experienceRange"),
      painPoint: form.get("painPoint"),
      currentTools: form.get("currentTools") || null,
      activeProjectsRange: form.get("activeProjectsRange"),
      joiningReason: form.get("joiningReason"),
      consentContact: form.get("consentContact") === "on",
      feedbackAvailability: form.get("feedbackAvailability"),
      referralSource: form.get("referralSource") || null,
      linkedinUrl: form.get("linkedinUrl") || null,
      timezone: form.get("timezone") || null,
    };
    try {
      const response = await fetch("/api/founder-program/application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "The application could not be submitted.");
        setSubmitting(false);
        return;
      }
      router.push("/founder-circle");
      router.refresh();
    } catch {
      setError("Network error — please retry.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" aria-label="Founder Circle application">
      <p className="text-sm text-slate-600">{ARCHETYPE_HINT}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="fullName" className={labelClass}>Full name *</label>
          <input id="fullName" name="fullName" required maxLength={120} className={inputClass} />
        </div>
        <div>
          <label htmlFor="roleTitle" className={labelClass}>Role title *</label>
          <input id="roleTitle" name="roleTitle" required maxLength={120} className={inputClass} placeholder="e.g. Program Manager" />
        </div>
        <div>
          <label htmlFor="companyStatus" className={labelClass}>Working context *</label>
          <select id="companyStatus" name="companyStatus" required className={inputClass}>
            <option value="company">At a company</option>
            <option value="independent">Independent</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label htmlFor="experienceRange" className={labelClass}>Years of experience *</label>
          <select id="experienceRange" name="experienceRange" required className={inputClass}>
            {EXPERIENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="activeProjectsRange" className={labelClass}>Active projects right now *</label>
          <select id="activeProjectsRange" name="activeProjectsRange" required className={inputClass}>
            {PROJECT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="feedbackAvailability" className={labelClass}>Feedback availability *</label>
          <select id="feedbackAvailability" name="feedbackAvailability" required className={inputClass}>
            {AVAILABILITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="painPoint" className={labelClass}>Your main project-management pain point *</label>
        <textarea id="painPoint" name="painPoint" required maxLength={1000} rows={3} className={inputClass} />
      </div>
      <div>
        <label htmlFor="joiningReason" className={labelClass}>Why do you want to join? *</label>
        <textarea id="joiningReason" name="joiningReason" required maxLength={1000} rows={3} className={inputClass} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="currentTools" className={labelClass}>Current tools</label>
          <input id="currentTools" name="currentTools" maxLength={500} className={inputClass} placeholder="e.g. Jira, Sheets" />
        </div>
        <div>
          <label htmlFor="referralSource" className={labelClass}>How did you hear about us?</label>
          <input id="referralSource" name="referralSource" maxLength={200} className={inputClass} />
        </div>
        <div>
          <label htmlFor="linkedinUrl" className={labelClass}>LinkedIn (optional)</label>
          <input id="linkedinUrl" name="linkedinUrl" type="url" maxLength={300} className={inputClass} placeholder="https://…" />
        </div>
        <div>
          <label htmlFor="timezone" className={labelClass}>Timezone (optional)</label>
          <input id="timezone" name="timezone" maxLength={60} className={inputClass} placeholder="e.g. Europe/Madrid" />
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm text-slate-800">
        <input type="checkbox" name="consentContact" required className="mt-1" />
        <span>
          I agree to be contacted about my participation and to provide structured feedback during the pilot. *
        </span>
      </label>
      {error ? (
        <p role="alert" className="rounded-lg border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-sm text-rose-800">{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-50 disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Submit application"}
      </button>
      <p className="text-xs text-slate-500">
        Submitting an application does not grant access: every application is reviewed by a human, and capacity is limited.
        You can withdraw at any time.
      </p>
    </form>
  );
}
