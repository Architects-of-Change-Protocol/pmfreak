// Pure summarizer for the Command Center's PMO portfolio strip.
//
// Split out of page.tsx so the "portfolio failed to load" path is directly
// testable without standing up a Supabase client or rendering a Server
// Component.
//
// The distinction this type encodes is the whole point: an empty portfolio
// ("this workspace has no PMOs yet") and an unavailable one ("we could not
// read this workspace's PMOs") are different facts, and the UI must never
// render the second as the first. Reporting "0 PMOs / 0 projects" after a
// failed query would state something we do not know to be true.

export type PmoProjectSlice = { status: string };

export type PmoPortfolioEntry = {
  name: string;
  projects: readonly PmoProjectSlice[];
};

export type PortfolioSummary =
  | {
      status: "available";
      pmoCount: number;
      projectCount: number;
      activeProjectCount: number;
      // First PMO's name, used for the empty state's
      // "invite your team to {pmoName}" nudge. Null when there are no PMOs.
      firstPmoName: string | null;
    }
  | {
      status: "unavailable";
    };

// `pmos === null` means the portfolio query failed and the caller has no
// data. That is NOT the same as an empty array, which means the query
// succeeded and the workspace genuinely has no PMOs.
export function summarizePortfolio(
  pmos: readonly PmoPortfolioEntry[] | null,
): PortfolioSummary {
  if (pmos === null) {
    return { status: "unavailable" };
  }

  let projectCount = 0;
  let activeProjectCount = 0;

  for (const pmo of pmos) {
    projectCount += pmo.projects.length;

    for (const project of pmo.projects) {
      if (project.status === "active") {
        activeProjectCount += 1;
      }
    }
  }

  return {
    status: "available",
    pmoCount: pmos.length,
    projectCount,
    activeProjectCount,
    firstPmoName: pmos[0]?.name ?? null,
  };
}
