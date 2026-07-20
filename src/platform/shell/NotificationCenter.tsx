/**
 * Minimal Notification Center presence — no Notification Management module
 * is built in this slice (out of scope, Fase "Fuera de alcance"). Renders a
 * real empty state rather than fabricated notifications (documented stub,
 * ADR-PMF-075).
 */
export function NotificationCenter() {
  return (
    <button
      type="button"
      aria-label="Notifications — you're all caught up"
      className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-slate-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
    >
      <span aria-hidden="true">🔔</span>
    </button>
  );
}
