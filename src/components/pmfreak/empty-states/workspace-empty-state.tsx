import Link from "next/link";
import { CreateProjectCta } from "./create-project-cta";
import { AddTaskCta } from "./add-task-cta";

/** Shared visual language for workspace zero states: a calm, enterprise-grade
 *  invitation to begin. An empty workspace is a valid state, never an error —
 *  these components render no numbers, no sample content, no severity styling. */
export function WorkspaceEmptyState({
  eyebrow,
  title,
  description,
  secondary,
  cta,
  ctaSlot,
  testId,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  secondary?: string;
  cta?: { label: string; href: string };
  /** A pre-rendered CTA (e.g. a client component opening a modal) — takes
   *  precedence over `cta` when both are supplied. Lets a server-rendered
   *  empty state offer a modal-based action without becoming client itself. */
  ctaSlot?: React.ReactNode;
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
        {(ctaSlot || cta) && (
          <div className="pt-2">
            {ctaSlot ?? (
              <Link
                href={cta!.href}
                className="inline-flex rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_-12px_rgba(15,23,42,0.6)] transition hover:bg-slate-800"
              >
                {cta!.label}
              </Link>
            )}
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
      ctaSlot={canCreate ? <CreateProjectCta label="Create your first project" /> : undefined}
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
      ctaSlot={canCreate ? <CreateProjectCta label="Create your first project" /> : undefined}
      testId="empty-projects"
    />
  );
}

export function EmptyExecution({
  hasProject,
  canCreate = true,
  projectId,
}: {
  /** When known, drives the contextual onboarding CTA: with a project the
   *  next real action is adding a task; without one it is creating the
   *  project first. Omitted → neutral empty state (no CTA). */
  hasProject?: boolean;
  canCreate?: boolean;
  /** Preselects the project in the Add Task modal when this empty state is
   *  already scoped to one project. */
  projectId?: string;
}) {
  const secondary =
    hasProject === undefined || !canCreate
      ? canCreate
        ? undefined
        : RESTRICTED_CREATE_PROJECT_NOTE
      : hasProject
        ? "Add your first task to begin tracking project execution."
        : "Create a project before adding execution work.";

  const ctaSlot =
    hasProject === undefined || !canCreate
      ? undefined
      : hasProject
        ? <AddTaskCta label="Add task" projectId={projectId} />
        : <CreateProjectCta label="Create project" />;

  return (
    <WorkspaceEmptyState
      eyebrow="Execution"
      title="No execution data yet"
      description="Execution metrics will appear once work begins."
      secondary={secondary}
      ctaSlot={ctaSlot}
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
      ctaSlot={canCreate ? <CreateProjectCta label="Create your first project" /> : undefined}
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
