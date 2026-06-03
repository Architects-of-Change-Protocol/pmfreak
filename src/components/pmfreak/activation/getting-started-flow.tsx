"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AIActivationTransition } from "@/components/pmfreak/onboarding/AIActivationTransition";
import { ActivationProgress } from "@/components/pmfreak/onboarding/ActivationProgress";

type DomainTemplate = {
  domain: string;
  title: string;
  text: string;
  why: string;
  critical: string;
};

type StorageStrategy = "cloud" | "local" | "self_hosted";
type StepId = 0 | 1 | 2 | 3 | 4 | 5;

type StorageOption = {
  id: StorageStrategy;
  title: string;
  description: string;
  note?: string;
  badge?: string;
};

type OnboardingForm = {
  companyName: string;
  pmoMaturity: string;
  industry: string;
  deliveryModel: string;
  teamSize: string;
  activeProjects: string;
  projectName: string;
  sponsor: string;
  pm: string;
  timeline: string;
  deliveryConfidence: string;
  projectType: string;
  storageStrategy: StorageStrategy;
};

const storageOptions: StorageOption[] = [
  {
    id: "cloud",
    title: "PMFreak Managed Cloud",
    description: "Fastest setup with fully managed infrastructure, governance, and encrypted storage.",
    note: "Recommended for most teams.",
    badge: "Recommended",
  },
  {
    id: "local",
    title: "Local Encrypted Storage",
    description: "Keep project memory stored locally on company-controlled infrastructure and devices.",
  },
  {
    id: "self_hosted",
    title: "Enterprise Deployment",
    description: "Deploy PMFreak within your own infrastructure, governance environment, and compliance architecture.",
    note: "Contact sales for deployment configuration.",
    badge: "Enterprise",
  },
];

const templates: DomainTemplate[] = [
  {
    domain: "stakeholder_intelligence",
    title: "Stakeholder map",
    text: "Sponsor: CFO | Decision power: high | Support level: neutral | Escalation behavior: direct to steering committee",
    why: "Stakeholder signals drive escalation probability.",
    critical: "Escalation owner",
  },
  {
    domain: "delivery_intelligence",
    title: "Delivery baseline",
    text: "Current status: amber | Milestones: UAT, Go-live | Blockers: vendor API delay | Delivery confidence: 62",
    why: "Delivery confidence anchors intervention urgency.",
    critical: "Critical path risks",
  },
  {
    domain: "pmo_governance",
    title: "Governance cadence",
    text: "Reporting cadence: weekly | Escalation rules: PM -> Sponsor in 24h | Quality gates: UAT sign-off",
    why: "Governance coherence prevents late surprises.",
    critical: "Escalation rules",
  },
  {
    domain: "team_health",
    title: "PM load",
    text: "PM name: Alex | Workload level: high | Meeting pressure: elevated | Fatigue risk: medium-high",
    why: "PM fatigue often predicts delivery degradation.",
    critical: "Support needed",
  },
  {
    domain: "risk_intelligence",
    title: "Top risk",
    text: "Risk name: Data migration overrun | Severity: high | Probability: medium | Owner: Delivery lead",
    why: "Untreated risks silently compound governance gaps.",
    critical: "Mitigation owner",
  },
  {
    domain: "executive_context",
    title: "Executive framing",
    text: "Sponsor: COO | Strategic importance: high | Decision deadlines: quarter close | Budget sensitivity: medium",
    why: "Executive context tunes escalation sensitivity.",
    critical: "Decision deadline",
  },
];

const WORKSPACE_FIELDS: Array<{
  key: keyof OnboardingForm;
  label: string;
  placeholder: string;
  hint?: string;
}> = [
  { key: "companyName", label: "Workspace / company name", placeholder: "Acme Corp", hint: "Used to scope your operational context" },
  { key: "pmoMaturity", label: "Operational focus", placeholder: "Program delivery, PMO governance, portfolio health..." },
  { key: "industry", label: "Industry", placeholder: "Technology, Financial Services, Healthcare..." },
  { key: "deliveryModel", label: "Delivery model", placeholder: "Hybrid, Agile, Waterfall, SAFe..." },
  { key: "teamSize", label: "Team size", placeholder: "e.g. 25" },
  { key: "activeProjects", label: "Portfolio scale (active initiatives)", placeholder: "e.g. 8" },
];

const INITIATIVE_FIELDS: Array<{
  key: keyof OnboardingForm;
  label: string;
  placeholder: string;
  hint: string;
}> = [
  { key: "projectName", label: "Initiative name", placeholder: "Q3 Enterprise Platform Rollout", hint: "The initiative PMFreak will begin monitoring" },
  { key: "sponsor", label: "Customer / sponsor", placeholder: "VP Operations", hint: "Executive accountable for delivery success" },
  { key: "pm", label: "Delivery lead / PM", placeholder: "Alex Chen", hint: "Who is managing day-to-day execution" },
  { key: "timeline", label: "Timeline pressure", placeholder: "High — board update in 3 weeks", hint: "PMFreak calibrates urgency from this signal" },
  { key: "deliveryConfidence", label: "Delivery confidence (0–100)", placeholder: "68", hint: "Your current gut-feel on delivery probability" },
  { key: "projectType", label: "Initiative type", placeholder: "Transformation, Migration, Platform, Product launch...", hint: "Shapes the risk and governance lens" },
];

function FieldInput({
  label,
  placeholder,
  hint,
  value,
  onChange,
  span2 = false,
}: {
  label: string;
  placeholder: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  span2?: boolean;
}) {
  return (
    <label className={`block space-y-1.5 ${span2 ? "md:col-span-2" : ""}`}>
      <span className="text-xs font-medium text-slate-300">{label}</span>
      {hint && <span className="block text-[11px] text-slate-500">{hint}</span>}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none transition-colors focus:border-indigo-400/50 focus:bg-indigo-400/[0.05]"
      />
    </label>
  );
}

function StorageCard({
  option,
  selected,
  onSelect,
}: {
  option: StorageOption;
  selected: boolean;
  onSelect: (id: StorageStrategy) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(option.id)}
      className={`group relative w-full overflow-hidden rounded-2xl border p-5 text-left transition-all duration-300 ${
        selected
          ? "border-indigo-400/60 bg-indigo-400/10 shadow-[0_12px_36px_-16px_rgba(99,102,241,0.5)]"
          : "border-white/10 bg-white/[0.03] hover:border-indigo-400/30 hover:bg-indigo-400/[0.05]"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_0%,rgba(99,102,241,0.1),transparent_55%)]" />
      <div className="relative space-y-2">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-slate-100">{option.title}</p>
          {option.badge && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                option.badge === "Recommended"
                  ? "border-indigo-400/60 bg-indigo-400/15 text-indigo-200"
                  : "border-violet-400/50 bg-violet-400/12 text-violet-200"
              }`}
            >
              {option.badge}
            </span>
          )}
        </div>
        <p className="text-xs leading-relaxed text-slate-400">{option.description}</p>
        {option.note && <p className="text-xs font-medium text-slate-300">{option.note}</p>}
        <p className="pt-1 text-[11px] text-slate-500">
          {selected ? "Selected for activation" : "Select storage strategy"}
        </p>
      </div>
    </button>
  );
}

export function GettingStartedFlow() {
  const router = useRouter();
  const [step, setStep] = useState<StepId>(0);
  const [submitting, setSubmitting] = useState(false);
  const [activating, setActivating] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState<OnboardingForm>({
    companyName: "",
    pmoMaturity: "Developing",
    industry: "Technology",
    deliveryModel: "Hybrid",
    teamSize: "25",
    activeProjects: "8",
    projectName: "",
    sponsor: "",
    pm: "",
    timeline: "",
    deliveryConfidence: "68",
    projectType: "Transformation",
    storageStrategy: "cloud",
  });
  const [rows, setRows] = useState<DomainTemplate[]>(templates);
  const completedRef = useRef(false);
  const stepRef = useRef<StepId>(0);
  const createdProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    void fetch("/api/telemetry/first-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType: "onboarding_started", metadata: { surface: "getting_started" } }),
    });
    return () => {
      if (completedRef.current) return;
      void fetch("/api/telemetry/first-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType: "onboarding_abandoned", metadata: { lastStep: stepRef.current } }),
      });
    };
  }, []);

  const completion = useMemo(
    () =>
      rows.map((row) => {
        const len = row.text.trim().length;
        const completionScore = Math.min(100, Math.max(38, Math.round(len / 2.4)));
        const confidence = Math.max(45, completionScore - 9);
        return {
          ...row,
          completionScore,
          confidence,
          missing: `Missing ${row.critical} may reduce ${row.domain.replaceAll("_", " ")} confidence.`,
        };
      }),
    [rows],
  );

  const readiness = useMemo(() => {
    const contextFields = [form.companyName, form.projectName, form.sponsor, form.pm, form.timeline].filter(
      (v) => v.trim().length > 0,
    ).length;
    const contextCoverage = Math.round((contextFields / 5) * 100);
    const templateCoverage = Math.round(
      completion.reduce((acc, item) => acc + item.completionScore, 0) / completion.length,
    );
    const storageBonus = form.storageStrategy === "self_hosted" ? 20 : form.storageStrategy === "local" ? 15 : 10;
    const governanceCompleteness = Math.min(
      100,
      Math.round(contextCoverage * 0.45 + templateCoverage * 0.35 + storageBonus),
    );
    const operationalCoherence = Math.min(
      100,
      Math.round(templateCoverage * 0.55 + Number(form.deliveryConfidence) * 0.25 + contextCoverage * 0.2),
    );
    const readinessScore = Math.round((governanceCompleteness + operationalCoherence + templateCoverage) / 3);
    return { readinessScore, operationalCoherence, governanceCompleteness, templateCoverage };
  }, [completion, form]);

  const updateField = (key: keyof OnboardingForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async (demo = false) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch("/api/getting-started", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form, templates: rows, loadDemo: demo }),
      });
      if (response.ok) {
        const body = await response.json().catch(() => ({})) as { ok?: boolean; projectId?: string };
        createdProjectIdRef.current = body.projectId ?? null;
        completedRef.current = true;
        void fetch("/api/telemetry/first-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventType: "onboarding_completed", metadata: { readinessScore: readiness.readinessScore } }),
        });
        setActivating(true);
      } else {
        const body = await response.json().catch(() => ({})) as { error?: string };
        setSubmitError(body.error ?? `Activation failed (${response.status}). Please retry.`);
      }
    } catch {
      setSubmitError("Network error — please check your connection and retry.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransitionComplete = useCallback(() => {
    const pid = createdProjectIdRef.current;
    const dest = pid
      ? `/command-center?projectId=${encodeURIComponent(pid)}&from=onboarding`
      : "/command-center?from=onboarding";
    router.push(dest);
  }, [router]);

  // Step 0: Welcome / Activation Entry
  if (step === 0) {
    return (
      <>
        {activating && <AIActivationTransition onComplete={handleTransitionComplete} />}
        <main className="relative flex min-h-[calc(100vh-6rem)] flex-col items-center justify-center px-4 py-16">
          {/* Ambient background glow */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/8 blur-3xl" />
            <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/6 blur-2xl" />
          </div>

          <div className="relative w-full max-w-2xl space-y-10 text-center">
            {/* Signal badge */}
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-400/10 px-4 py-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-indigo-400" />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-indigo-300">
                  PMFreak Activation
                </span>
              </span>
            </div>

            {/* Primary heading */}
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold leading-tight tracking-tight text-slate-100 sm:text-5xl">
                Activate your first
                <br />
                <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-cyan-300 bg-clip-text text-transparent">
                  operational context
                </span>
              </h1>
              <p className="mx-auto max-w-lg text-base leading-relaxed text-slate-400">
                PMFreak needs one real initiative to begin sensing execution risk, stakeholder dynamics,
                meeting debt, and follow-up pressure.
              </p>
            </div>

            {/* AI hint */}
            <div className="mx-auto max-w-sm rounded-xl border border-indigo-400/15 bg-indigo-400/[0.06] px-4 py-3">
              <div className="flex items-start gap-2">
                <span className="mt-px shrink-0 text-[9px] font-bold uppercase tracking-widest text-indigo-400">AI</span>
                <p className="text-[11px] leading-relaxed text-indigo-200/80">
                  Operational risk telemetry becomes more accurate as context is ingested. This takes
                  under 3 minutes.
                </p>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="group relative overflow-hidden rounded-2xl border border-indigo-400/50 bg-indigo-500/20 px-8 py-3.5 text-sm font-semibold text-slate-100 shadow-[0_0_40px_-12px_rgba(99,102,241,0.5)] transition-all hover:bg-indigo-500/30 hover:shadow-[0_0_50px_-10px_rgba(99,102,241,0.6)]"
              >
                <span className="relative">Begin Activation</span>
              </button>
              <button
                type="button"
                onClick={() => submit(true)}
                disabled={submitting}
                className="rounded-2xl border border-white/10 px-6 py-3.5 text-sm text-slate-400 transition hover:border-white/20 hover:text-slate-300 disabled:opacity-40"
              >
                {submitting ? "Loading..." : "Explore PMFreak demo"}
              </button>
            </div>

            {submitError && (
              <p className="rounded-xl border border-rose-400/25 bg-rose-400/[0.06] px-4 py-2.5 text-xs text-rose-300">
                {submitError}
              </p>
            )}

            {/* What activates */}
            <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
              {[
                "Execution risk sensing",
                "Stakeholder dynamics",
                "Meeting debt tracking",
                "Follow-up pressure",
              ].map((item) => (
                <div key={item} className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5 text-center">
                  <p className="text-[11px] text-slate-500">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      {activating && <AIActivationTransition onComplete={handleTransitionComplete} />}
      <main className="space-y-6 pb-16">
        {/* Header */}
        <header className="relative overflow-hidden rounded-3xl border border-white/8 bg-gradient-to-r from-white/[0.04] to-indigo-400/[0.04] p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.08),transparent_60%)]" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-indigo-400">
                Operational Intelligence Activation
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-100">
                {step === 1 && "Workspace context"}
                {step === 2 && "Operational initiative"}
                {step === 3 && "Governance layer"}
                {step === 4 && "Intelligence templates"}
                {step === 5 && "Activation review"}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {step === 1 && "PMFreak is learning your operational environment"}
                {step === 2 && "Describe the initiative PMFreak should begin monitoring"}
                {step === 3 && "Configure how your project intelligence is governed"}
                {step === 4 && "Seed the intelligence templates that guide risk sensing"}
                {step === 5 && "Review your activation parameters before launch"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep(0)}
              className="shrink-0 rounded-xl border border-white/10 px-3 py-1.5 text-xs text-slate-500 transition hover:text-slate-300"
            >
              ← Back to start
            </button>
          </div>
        </header>

        {/* Progress */}
        <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5">
          <ActivationProgress currentStep={step} onStepClick={(s) => setStep(s as StepId)} />
        </div>

        {/* Step content */}
        <section className="rounded-3xl border border-white/8 bg-white/[0.03] p-6">
          {step === 1 && (
            <div className="space-y-6">
              <div className="rounded-xl border border-indigo-400/15 bg-indigo-400/[0.05] px-4 py-3">
                <div className="flex gap-2">
                  <span className="mt-px shrink-0 text-[9px] font-bold uppercase tracking-widest text-indigo-400">AI</span>
                  <p className="text-[11px] leading-relaxed text-indigo-200/80">
                    PMFreak will use this context to calibrate escalation sensitivity, team health baselines, and
                    portfolio risk weighting across your workspace.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {WORKSPACE_FIELDS.map((field) => (
                  <FieldInput
                    key={field.key}
                    label={field.label}
                    placeholder={field.placeholder}
                    hint={field.hint}
                    value={form[field.key]}
                    onChange={(v) => updateField(field.key, v)}
                  />
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="rounded-xl border border-indigo-400/15 bg-indigo-400/[0.05] px-4 py-3">
                <div className="flex gap-2">
                  <span className="mt-px shrink-0 text-[9px] font-bold uppercase tracking-widest text-indigo-400">AI</span>
                  <p className="text-[11px] leading-relaxed text-indigo-200/80">
                    PMFreak will begin sensing stakeholder confidence drift once this initiative context is
                    active. The more you share, the more precise the risk signal.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {INITIATIVE_FIELDS.map((field) => (
                  <FieldInput
                    key={field.key}
                    label={field.label}
                    placeholder={field.placeholder}
                    hint={field.hint}
                    value={form[field.key]}
                    onChange={(v) => updateField(field.key, v)}
                  />
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-7">
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-indigo-300">
                  Project governance layer
                </p>
                <h2 className="text-xl font-semibold text-slate-100">
                  Where does your project intelligence live?
                </h2>
                <p className="text-sm leading-relaxed text-slate-400">
                  PMFreak was designed so organizations retain full ownership of their operational memory.
                  Project context, stakeholder dynamics, decisions, and institutional knowledge stay
                  under your control.
                </p>
              </div>

              <blockquote className="rounded-xl border-l-4 border-indigo-400/60 bg-indigo-400/[0.06] px-5 py-4 text-sm italic text-slate-300">
                &quot;Your project memory should stay with your team — not scattered across disconnected tools.&quot;
              </blockquote>

              <div className="grid gap-4 lg:grid-cols-3">
                {storageOptions.map((option) => (
                  <StorageCard
                    key={option.id}
                    option={option}
                    selected={form.storageStrategy === option.id}
                    onSelect={(id) => setForm((prev) => ({ ...prev, storageStrategy: id }))}
                  />
                ))}
              </div>

              <p className="text-[11px] text-slate-600">Powered by AOC Protocol — auditable, encrypted, governance-native.</p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-indigo-300">
                  Intelligence templates
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  These templates seed PMFreak&apos;s intelligence domains. Edit them to match your initiative&apos;s reality.
                  Each template is a live signal source once activated.
                </p>
              </div>
              <div className="rounded-xl border border-indigo-400/15 bg-indigo-400/[0.05] px-4 py-3">
                <div className="flex gap-2">
                  <span className="mt-px shrink-0 text-[9px] font-bold uppercase tracking-widest text-indigo-400">AI</span>
                  <p className="text-[11px] leading-relaxed text-indigo-200/80">
                    Template completeness directly influences detection accuracy. Even partial context
                    improves PMFreak&apos;s ability to sense emerging risk.
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {rows.map((row, index) => (
                  <div
                    key={row.domain}
                    className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 transition hover:border-white/15"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <input
                        value={row.title}
                        onChange={(e) => {
                          setRows((prev) => {
                            const next = [...prev];
                            next[index] = { ...row, title: e.target.value };
                            return next;
                          });
                        }}
                        className="bg-transparent text-sm font-semibold text-slate-200 outline-none placeholder-slate-600"
                      />
                      <span className="shrink-0 rounded-full border border-indigo-400/20 bg-indigo-400/[0.08] px-2 py-0.5 text-[9px] uppercase tracking-widest text-indigo-400">
                        {row.domain.split("_")[0]}
                      </span>
                    </div>
                    <textarea
                      value={row.text}
                      onChange={(e) => {
                        setRows((prev) => {
                          const next = [...prev];
                          next[index] = { ...row, text: e.target.value };
                          return next;
                        });
                      }}
                      rows={2}
                      className="mt-3 w-full rounded-lg border border-white/8 bg-slate-900/60 p-3 text-xs text-slate-300 outline-none transition focus:border-indigo-400/30 focus:bg-indigo-400/[0.03]"
                    />
                    <p className="mt-2 text-[11px] text-slate-600">{row.why}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-indigo-300">
                  Pre-activation review
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  PMFreak will begin monitoring this initiative immediately after activation.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {/* Context summary */}
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Activation parameters</p>
                  <div className="space-y-2 text-sm">
                    {[
                      ["Workspace", form.companyName || "—"],
                      ["Initiative", form.projectName || "—"],
                      ["Sponsor", form.sponsor || "—"],
                      ["Delivery lead", form.pm || "—"],
                      ["Timeline pressure", form.timeline || "—"],
                      ["Storage", storageOptions.find((s) => s.id === form.storageStrategy)?.title ?? "—"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-start justify-between gap-4">
                        <span className="text-slate-500">{k}</span>
                        <span className="text-right font-medium text-slate-200">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Readiness metrics */}
                <div className="rounded-2xl border border-indigo-400/20 bg-indigo-400/[0.05] p-5 space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">Activation readiness</p>
                  <div className="space-y-3">
                    {[
                      { label: "Overall readiness", value: readiness.readinessScore },
                      { label: "Operational coherence", value: readiness.operationalCoherence },
                      { label: "Governance completeness", value: readiness.governanceCompleteness },
                      { label: "Intelligence coverage", value: readiness.templateCoverage },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs text-slate-400">{label}</span>
                          <span className="text-xs font-semibold text-indigo-300">{value}%</span>
                        </div>
                        <div className="h-1 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-700"
                            style={{ width: `${value}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Intelligence signals */}
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Intelligence domains
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {completion.map((item) => (
                    <div key={item.domain} className="rounded-lg border border-white/8 p-3">
                      <p className="text-xs font-medium text-slate-300">{item.title}</p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {item.completionScore}% complete · {item.confidence}% confidence
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Activation CTAs */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => submit(false)}
                  disabled={submitting}
                  className="rounded-2xl border border-indigo-400/50 bg-indigo-500/20 px-7 py-3 text-sm font-semibold text-slate-100 shadow-[0_0_30px_-10px_rgba(99,102,241,0.5)] transition hover:bg-indigo-500/30 disabled:opacity-50"
                >
                  {submitting ? "Preparing activation..." : "Activate PMFreak"}
                </button>
                <button
                  type="button"
                  onClick={() => submit(true)}
                  disabled={submitting}
                  className="rounded-2xl border border-white/15 px-5 py-3 text-sm text-slate-400 transition hover:border-white/25 hover:text-slate-300 disabled:opacity-40"
                >
                  Load demo project
                </button>
              </div>
              {submitError && (
                <p className="rounded-xl border border-rose-400/25 bg-rose-400/[0.06] px-4 py-2.5 text-xs text-rose-300">
                  {submitError}
                </p>
              )}
            </div>
          )}

          {/* Navigation */}
          {step > 0 && step < 5 && (
            <div className="mt-7 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep((prev) => Math.max(1, prev - 1) as StepId)}
                disabled={step === 1}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-400 transition hover:border-white/20 hover:text-slate-300 disabled:opacity-30"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep((prev) => Math.min(5, prev + 1) as StepId)}
                className="rounded-xl border border-indigo-400/40 bg-indigo-400/10 px-5 py-2 text-sm font-medium text-slate-200 transition hover:bg-indigo-400/15"
              >
                Continue →
              </button>
              <span className="text-xs text-slate-600">Step {step} of 5</span>
            </div>
          )}
          {step === 5 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-500 transition hover:text-slate-300"
              >
                ← Back
              </button>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
