"use client";

import { useEffect, useRef } from "react";

/**
 * Records the "insights first viewed" interaction event, once, for the
 * current user + workspace. Rendered ONLY by surfaces that are actually
 * showing populated, real insight content — never on an empty screen, so
 * merely opening an empty page can never complete the review step.
 */
export function MarkInsightsViewed() {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    void fetch("/api/workspace-activation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ insightsViewed: true }),
    }).catch(() => {
      // Best-effort UX event; never disrupt the page.
    });
  }, []);

  return null;
}
