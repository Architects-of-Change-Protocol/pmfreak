"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function normalizeFailureReason(message: string, code?: string): string {
  if (code) return code;
  const text = message.toLowerCase();
  if (text.includes("expired")) return "expired_token";
  if (text.includes("revoked")) return "revoked_token";
  if (text.includes("already") || text.includes("used")) return "reused_token";
  if (text.includes("invalid")) return "invalid_token";
  if (text.includes("runtime initialization")) return "runtime_init_failure";
  return "unknown_error";
}

async function track(eventType: string, metadata?: Record<string, unknown>) {
  await fetch("/api/telemetry/first-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, metadata }),
  });
}

export default function AcceptEarlyAccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const inviteOpenedLogged = useRef(false);
  const [workspaceName, setWorkspaceName] = useState("PMFreak Early Access Workspace");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token || inviteOpenedLogged.current) return;
    inviteOpenedLogged.current = true;
    void track("invite_link_opened", { tokenPresent: true });
  }, [token]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setStatus("error");
      setMessage("Invite token is missing from this link.");
      return;
    }

    setStatus("saving");
    const response = await fetch("/api/early-access/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteToken: token, workspaceName }),
    });
    const payload = await response.json();

    if (!response.ok) {
      const failureMessage = typeof payload?.error === "string" ? payload.error : "Unable to activate invite right now.";
      const failureCode = typeof payload?.code === "string" ? payload.code : undefined;
      setStatus("error");
      setMessage(failureMessage);
      await track("invite_activation_failed", {
        reason: normalizeFailureReason(failureMessage, failureCode),
        rawReason: failureMessage,
      });
      return;
    }

    setStatus("done");
    setMessage("Early access activated. Redirecting you to your dashboard...");
    setTimeout(() => router.push("/dashboard"), 900);
  }

  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-900 md:p-8">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-600">Founder Invite Activation</p>
      <h1 className="mt-2 text-2xl font-semibold">Activate your PMFreak early access</h1>
      <p className="mt-2 text-slate-700">Confirm your workspace name and we’ll activate your 90-day early access trial.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block space-y-2">
          <span className="text-xs uppercase tracking-[0.12em] text-slate-700">Workspace name</span>
          <input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900" required minLength={3} maxLength={80} />
        </label>
        <button disabled={status === "saving"} className="rounded-full bg-cyan-300 px-5 py-2 font-semibold text-slate-50 disabled:opacity-60">
          {status === "saving" ? "Activating..." : "Activate early access"}
        </button>
      </form>

      {message ? <p className={`mt-4 text-sm ${status === "error" ? "text-rose-700" : "text-emerald-700"}`}>{message}</p> : null}
    </div>
  );
}
