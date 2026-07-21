import Link from "next/link";

/** Shared visual language for workspace zero states: a calm, enterprise-grade
 *  invitation to begin. An empty workspace is a valid state, never an error —
 *  these components render no numbers, no sample content, no severity styling. */
export function WorkspaceEmptyState({
  eyebrow,
  title,
  description,
  secondary,
  cta,
  testId,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  secondary?: string;
  cta?: { label: string; href: string };
  testId?: string;
}) {
  return (
    <section
      data-testid={testId}
      className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-[0_20px_60px_-50px_rgba(15,23,42,0.35)]"
    >
      <div className="mx-auto max-w-md space-y-3">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{eyebrow}</p>
        )}
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
        <p className="text-sm leading-relaxed text-slate-500">{description}</p>
        {secondary && <p className="text-xs leading-relaxed text-slate-400">{secondary}</p>}
        {cta && (
          <div className="pt-2">
            <Link
              href={cta.href}
              className="inline-flex rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_-12px_rgba(15,23,42,0.6)] transition hover:bg-slate-800"
            >
              {cta.label}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

/** Copy shown instead of a creation CTA when the member's real workspace
 *  role cannot create projects (e.g. viewer). Lack of permission is never
 *  presented as a data problem. */
const RESTRICTED_CREATE_PROJECT_NOTE =
  "A workspace administrator or project manager must create the first project.";

export function EmptyDashboard({ canCreate = true }: { canCreate?: boolean }) {
  return (
    <WorkspaceEmptyState
      eyebrow="Summary"
      title="No project data available yet."
      description="Your workspace dashboard will populate automatically as projects and operational activity are added."
      secondary={canCreate ? undefined : RESTRICTED_CREATE_PROJECT_NOTE}
      cta={canCreate ? { label: "Create your first project", href: "/command-center" } : undefined}
      testId="empty-dashboard"
    />
  );
}

export function EmptyExecutiveDashboard() {
  return (
    <WorkspaceEmptyState
      eyebrow="Executive"
      title="No executive insights yet"
      description="Executive metrics will appear automatically once your workspace contains projects and operational activity."
      testId="empty-executive-dashboard"
    />
  );
}

export function EmptyProjects({ canCreate = true }: { canCreate?: boolean }) {
  return (
    <WorkspaceEmptyState
      eyebrow="Projects"
      title="No projects yet"
      description="Create your first project to begin organizing delivery."
      secondary={canCreate ? undefined : RESTRICTED_CREATE_PROJECT_NOTE}
      cta={canCreate ? { label: "Create your first project", href: "/command-center" } : undefined}
      testId="empty-projects"
    />
  );
}

export function EmptyExecution({
  hasProject,
  canCreate = true,
}: {
  /** When known, drives the contextual onboarding CTA: with a project the
   *  next real action is adding a task; without one it is creating the
   *  project first. Omitted → neutral empty state (no CTA). */
  hasProject?: boolean;
  canCreate?: boolean;
}) {
  const contextual =
    hasProject === undefined || !canCreate
      ? { secondary: canCreate ? undefined : RESTRICTED_CREATE_PROJECT_NOTE, cta: undefined }
      : hasProject
        ? {
            secondary: "Add your first task to begin tracking project execution.",
            cta: { label: "Add task", href: "/command-center" },
          }
        : {
            secondary: "Create a project before adding execution work.",
            cta: { label: "Create project", href: "/projects/new" },
          };

  return (
    <WorkspaceEmptyState
      eyebrow="Execution"
      title="No execution data yet"
      description="Execution metrics will appear once work begins."
      secondary={contextual.secondary}
      cta={contextual.cta}
      testId="empty-execution"
    />
  );
}

export function EmptyPortfolio({ canCreate = true }: { canCreate?: boolean }) {
  return (
    <WorkspaceEmptyState
      eyebrow="Portfolio"
      title="No projects yet"
      description="Create your first project to begin tracking portfolio health."
      secondary={canCreate ? undefined : RESTRICTED_CREATE_PROJECT_NOTE}
      cta={canCreate ? { label: "Create your first project", href: "/command-center" } : undefined}
      testId="empty-portfolio"
    />
  );
}

export function EmptyOperationalCenter() {
  return (
    <WorkspaceEmptyState
      eyebrow="Operational Action Center"
      title="No operational actions yet."
      description="Operational recommendations will appear automatically as projects begin generating real execution data."
      testId="empty-operational-center"
    />
  );
}

export function EmptyChat() {
  return (
    <WorkspaceEmptyState
      eyebrow="Chat"
      title="Start your first conversation."
      description="Ask about status, risks, decisions, or anything happening across this workspace."
      testId="empty-chat"
    />
  );
}

export function EmptyPMO() {
  return (
    <WorkspaceEmptyState
      eyebrow="PMOs"
      title="No PMOs yet"
      description="Create your first PMO to organize projects under a shared governance structure."
      testId="empty-pmo"
    />
  );
}

/** Generic per-lens empty state; copy is supplied by the lens that renders it. */
export function EmptyLens({
  lens,
  title,
  description,
}: {
  lens: string;
  title: string;
  description: string;
}) {
  return <WorkspaceEmptyState eyebrow={lens} title={title} description={description} testId={`empty-lens-${lens.toLowerCase()}`} />;
}
