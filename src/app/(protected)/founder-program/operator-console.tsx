"use client";

import { useCallback, useEffect, useState } from "react";

type Json = Record<string, unknown>;

const inputClass =
  "rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none";
const buttonClass = "rounded-full border border-cyan-300/50 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-300/10 disabled:opacity-50";
const dangerButtonClass = "rounded-full border border-rose-300/50 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-300/10 disabled:opacity-50";

async function api(path: string, init?: RequestInit): Promise<{ ok: boolean; data: Json }> {
  const response = await fetch(path, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...(init.headers ?? {}) } : init?.headers,
  });
  const data = (await response.json().catch(() => ({}))) as Json;
  return { ok: response.ok, data };
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function unavailableText(m: unknown): string {
  const metric = m as { available?: boolean; value?: unknown; reason?: string };
  if (!metric || metric.available !== true) return `no data yet${metric?.reason ? ` (${metric.reason})` : ""}`;
  return typeof metric.value === "number" ? `${Math.round((metric.value as number) * 10) / 10}h` : JSON.stringify(metric.value);
}

export function FounderProgramOperatorConsole() {
  const [dashboard, setDashboard] = useState<Json | null>(null);
  const [invitations, setInvitations] = useState<Json[]>([]);
  const [participants, setParticipants] = useState<Json[]>([]);
  const [capacity, setCapacity] = useState<Json | null>(null);
  const [feedback, setFeedback] = useState<Json[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [manualLink, setManualLink] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [d, i, p, f] = await Promise.all([
      api("/api/founder-program/operator/dashboard"),
      api("/api/founder-program/operator/invitations"),
      api("/api/founder-program/operator/participants"),
      api("/api/founder-program/operator/feedback"),
    ]);
    if (d.ok) setDashboard((d.data.dashboard as Json) ?? null);
    if (i.ok) setInvitations((i.data.invitations as Json[]) ?? []);
    if (p.ok) {
      setParticipants((p.data.participants as Json[]) ?? []);
      setCapacity((p.data.capacity as Json) ?? null);
    }
    if (f.ok) setFeedback((f.data.feedback as Json[]) ?? []);
  }, []);

  useEffect(() => {
    // Deferred so the initial fetch never sets state synchronously inside
    // the effect (react-hooks cascading-render rule); cancelable on unmount.
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function act(path: string, body: Json, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setMessage(null);
    const { ok, data } = await api(path, { method: "POST", body: JSON.stringify(body) });
    if (!ok) {
      setMessage(typeof data.error === "string" ? `${data.error}${data.code ? ` [${data.code}]` : ""}` : "Action failed.");
    } else {
      if (typeof data.inviteLink === "string") setManualLink(data.inviteLink);
      setMessage("Done.");
      await refresh();
    }
    setBusy(false);
  }

  async function createInvitation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await act("/api/founder-program/operator/invitations", {
      action: "create",
      email: form.get("email"),
      archetype: form.get("archetype"),
      nominationNote: form.get("nominationNote") || null,
      send: form.get("send") === "on",
    });
    (event.target as HTMLFormElement).reset();
  }

  async function participantAction(participantId: string, action: string) {
    const needsReason = ["reject", "waitlist", "pause", "revoke"].includes(action);
    let reason: string | null = null;
    if (needsReason) {
      reason = window.prompt(`Reason for ${action} (required, recorded in the audit trail):`);
      if (!reason) return;
    }
    await act("/api/founder-program/operator/participants/actions", { action, participantId, reason });
  }

  async function recordDecision(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await act("/api/founder-program/operator/decisions", {
      decision: form.get("decision"),
      decidedOn: form.get("decidedOn"),
      evidenceWindowStart: form.get("evidenceWindowStart"),
      evidenceWindowEnd: form.get("evidenceWindowEnd"),
      rationale: form.get("rationale"),
      positiveSignals: form.get("positiveSignals") || null,
      negativeSignals: form.get("negativeSignals") || null,
      requiredRemediation: form.get("requiredRemediation") || null,
      nextReviewOn: form.get("nextReviewOn") || null,
    });
  }

  const funnel = (dashboard?.funnel as Json) ?? {};
  const capacitySummary = (dashboard?.capacity as Json) ?? capacity ?? {};
  const timings = (dashboard?.timings as Json) ?? {};
  const retention = (dashboard?.retention as Json) ?? {};
  const feedbackSummary = (dashboard?.feedback as Json) ?? {};

  return (
    <div className="space-y-8">
      {message ? <p role="status" className="rounded-lg border border-slate-600 bg-slate-800/70 px-3 py-2 text-sm text-slate-200">{message}</p> : null}
      {manualLink ? (
        <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100">
          <p className="font-medium">Invite link (shown once — deliver it manually if email is not configured):</p>
          <code className="break-all text-xs">{manualLink}</code>
          <button className={`${buttonClass} ml-2`} onClick={() => setManualLink(null)}>dismiss</button>
        </div>
      ) : null}

      <section aria-labelledby="fp-overview">
        <h2 id="fp-overview" className="mb-3 text-lg font-medium text-slate-100">Overview</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Program state" value={String(dashboard?.programState ?? "loading…")} />
          <Metric label="Approved capacity" value={`${String((capacitySummary as Json).approvedUsed ?? "–")} / ${String((capacitySummary as Json).approvedLimit ?? "–")}`} />
          <Metric label="Active capacity" value={`${String((capacitySummary as Json).activeUsed ?? "–")} / ${String((capacitySummary as Json).activeLimit ?? "–")}`} />
          <Metric label="Feedback items" value={String((feedbackSummary as Json).total ?? "–")} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {["invited", "viewed", "applied", "approved", "agreementAccepted", "activated"].map((key) => (
            <Metric key={key} label={`Funnel · ${key}`} value={String((funnel as Json)[key] ?? 0)} />
          ))}
          <Metric label="Median invite→apply" value={unavailableText((timings as Json).inviteToApplicationHoursMedian)} />
          <Metric label="Day-7 return" value={unavailableText((retention as Json).day7)} />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          All numbers derive from real program records. &ldquo;no data yet&rdquo; means exactly that — nothing is simulated.
        </p>
      </section>

      <section aria-labelledby="fp-invite">
        <h2 id="fp-invite" className="mb-3 text-lg font-medium text-slate-100">Invite a participant</h2>
        <form onSubmit={createInvitation} className="flex flex-wrap items-end gap-3">
          <input name="email" type="email" required placeholder="email@example.com" className={inputClass} aria-label="Invitee email" />
          <select name="archetype" required className={inputClass} aria-label="Archetype">
            {["independent_pm", "pmo_practitioner", "agile_lead", "program_manager", "consultant", "operations_leader", "founder_operator", "other"].map((a) => (
              <option key={a} value={a}>{a.replaceAll("_", " ")}</option>
            ))}
          </select>
          <input name="nominationNote" placeholder="Internal note (optional)" className={inputClass} aria-label="Internal nomination note" />
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" name="send" defaultChecked /> send email
          </label>
          <button type="submit" disabled={busy} className={buttonClass}>Create invitation</button>
        </form>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr><th className="py-2">Email</th><th>Archetype</th><th>Status</th><th>Participant state</th><th>Expires</th><th>Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {invitations.map((inv) => {
                const participant = inv.participant as Json | null;
                return (
                  <tr key={String(inv.id)}>
                    <td className="py-2">{String(inv.email)}</td>
                    <td>{String(inv.archetype).replaceAll("_", " ")}</td>
                    <td>{String(inv.status)}</td>
                    <td>{participant ? String(participant.lifecycle_state).replaceAll("_", " ") : "—"}</td>
                    <td>{inv.expires_at ? new Date(String(inv.expires_at)).toLocaleDateString() : "—"}</td>
                    <td className="space-x-2 py-1">
                      {["pending", "viewed", "expired"].includes(String(inv.status)) ? (
                        <>
                          <button className={buttonClass} disabled={busy} onClick={() => act("/api/founder-program/operator/invitations", { action: "resend", invitationId: inv.id })}>resend</button>
                          <button
                            className={dangerButtonClass}
                            disabled={busy}
                            onClick={() => {
                              const reason = window.prompt("Reason for revoking (required):");
                              if (reason) void act("/api/founder-program/operator/invitations", { action: "revoke", invitationId: inv.id, reason });
                            }}
                          >
                            revoke
                          </button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {invitations.length === 0 ? (
                <tr><td colSpan={6} className="py-3 text-slate-500">No invitations yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="fp-review">
        <h2 id="fp-review" className="mb-3 text-lg font-medium text-slate-100">Participants &amp; review queue</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr><th className="py-2">Email</th><th>State</th><th>Archetype</th><th>Agreement</th><th>Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {participants.map((p) => {
                const state = String(p.lifecycle_state);
                return (
                  <tr key={String(p.id)}>
                    <td className="py-2">{String(p.email)}</td>
                    <td>{state.replaceAll("_", " ")}</td>
                    <td>{String(p.archetype).replaceAll("_", " ")}</td>
                    <td>{String(p.agreement_version_accepted ?? "—")}</td>
                    <td className="space-x-2 py-1">
                      {["applied"].includes(state) ? (
                        <button className={buttonClass} disabled={busy} onClick={() => participantAction(String(p.id), "start_review")}>start review</button>
                      ) : null}
                      {["applied", "under_review", "waitlisted"].includes(state) ? (
                        <>
                          <button className={buttonClass} disabled={busy} onClick={() => participantAction(String(p.id), "approve")}>approve</button>
                          <button className={buttonClass} disabled={busy} onClick={() => participantAction(String(p.id), "waitlist")}>waitlist</button>
                          <button className={dangerButtonClass} disabled={busy} onClick={() => participantAction(String(p.id), "reject")}>reject</button>
                        </>
                      ) : null}
                      {state === "onboarding_pending" ? (
                        <button className={buttonClass} disabled={busy} onClick={() => participantAction(String(p.id), "activate")}>activate</button>
                      ) : null}
                      {["onboarding_active", "activated", "feedback_active"].includes(state) ? (
                        <>
                          <button className={dangerButtonClass} disabled={busy} onClick={() => participantAction(String(p.id), "pause")}>pause</button>
                          <button className={buttonClass} disabled={busy} onClick={() => participantAction(String(p.id), "complete")}>complete</button>
                        </>
                      ) : null}
                      {state === "paused" ? (
                        <button className={buttonClass} disabled={busy} onClick={() => participantAction(String(p.id), "resume")}>resume</button>
                      ) : null}
                      {!["rejected", "completed", "withdrawn", "revoked", "nominated", "invited", "invite_viewed"].includes(state) ? (
                        <button className={dangerButtonClass} disabled={busy} onClick={() => participantAction(String(p.id), "revoke")}>revoke</button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {participants.length === 0 ? (
                <tr><td colSpan={5} className="py-3 text-slate-500">No participants yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="fp-feedback">
        <h2 id="fp-feedback" className="mb-3 text-lg font-medium text-slate-100">Feedback queue</h2>
        <ul className="space-y-2 text-sm">
          {feedback.map((f) => (
            <li key={String(f.id)} className="rounded-lg border border-slate-700/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>{String(f.feedback_type).replaceAll("_", " ")} · {String(f.severity)} · status {String(f.status)}</span>
                <span className="space-x-2">
                  {["triaged", "planned", "declined", "resolved", "duplicate"].map((s) => (
                    <button key={s} className={buttonClass} disabled={busy} onClick={() => act("/api/founder-program/operator/feedback", { feedbackId: f.id, status: s })}>
                      {s}
                    </button>
                  ))}
                </span>
              </div>
              <p className="mt-1 text-slate-300">{String(f.body)}</p>
            </li>
          ))}
          {feedback.length === 0 ? <li className="text-slate-500">No feedback yet.</li> : null}
        </ul>
      </section>

      <section aria-labelledby="fp-decision">
        <h2 id="fp-decision" className="mb-3 text-lg font-medium text-slate-100">Program decision gate</h2>
        <p className="mb-3 text-sm text-slate-400">
          Recording a decision is a human act: participant and activation counts are computed from real records at
          ratification time. Records are append-only.
        </p>
        <form onSubmit={recordDecision} className="grid gap-3 sm:grid-cols-2">
          <select name="decision" required className={inputClass} aria-label="Decision">
            {["continue", "continue_with_remediation", "pause", "stop", "expand_cohort"].map((d) => (
              <option key={d} value={d}>{d.replaceAll("_", " ")}</option>
            ))}
          </select>
          <input name="decidedOn" type="date" required className={inputClass} aria-label="Decision date" />
          <input name="evidenceWindowStart" type="date" required className={inputClass} aria-label="Evidence window start" />
          <input name="evidenceWindowEnd" type="date" required className={inputClass} aria-label="Evidence window end" />
          <input name="nextReviewOn" type="date" className={inputClass} aria-label="Next review date (optional)" />
          <textarea name="rationale" required maxLength={8000} rows={3} className={`${inputClass} sm:col-span-2`} placeholder="Rationale (required)" aria-label="Rationale" />
          <textarea name="positiveSignals" maxLength={4000} rows={2} className={inputClass} placeholder="Main positive signals" aria-label="Positive signals" />
          <textarea name="negativeSignals" maxLength={4000} rows={2} className={inputClass} placeholder="Main negative signals" aria-label="Negative signals" />
          <textarea name="requiredRemediation" maxLength={4000} rows={2} className={`${inputClass} sm:col-span-2`} placeholder="Required remediation (if any)" aria-label="Required remediation" />
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy} className={buttonClass}>Record decision</button>
          </div>
        </form>
      </section>
    </div>
  );
}
