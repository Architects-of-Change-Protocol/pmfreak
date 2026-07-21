import type {
  WorkspaceActivationPhase,
  WorkspaceActivationStage,
  WorkspaceActivationStepId,
} from "@/lib/workspace-activation/types";

/**
 * All user-facing copy for the guided workspace onboarding panel lives here,
 * in the frontend (the activation domain returns ids/status only).
 */

export const ONBOARDING_PANEL_COPY = {
  title: "Set up your workspace",
  description:
    "Complete the essential steps to start managing real project execution in PMFreak.",
  readyTitle: "Your workspace is ready",
  readyDescription: "You can now manage project execution with real workspace data.",
  reopenLabel: "Workspace setup",
  collapseLabel: "Collapse setup guide",
  expandLabel: "Expand setup guide",
  dismissLabel: "Hide guide",
  reopenAction: "Reopen guide",
} as const;

export const ONBOARDING_PHASE_COPY: Record<
  WorkspaceActivationPhase,
  { title: string; order: number }
> = {
  foundation: { title: "Foundation", order: 1 },
  execution: { title: "Start Execution", order: 2 },
  operational_value: { title: "Operational Value", order: 3 },
};

export type OnboardingStepCopy = {
  title: string;
  description: string;
  ctaLabel: string | null;
  /** Shown when the step exists but the member's role cannot perform it. */
  restrictedNote: string | null;
  /** Shown while the step is blocked by a dependency. */
  blockedNote: string | null;
};

export const ONBOARDING_STEP_COPY: Record<WorkspaceActivationStepId, OnboardingStepCopy> = {
  workspace_created: {
    title: "Workspace created",
    description: "Your workspace exists and your membership is active.",
    ctaLabel: null,
    restrictedNote: null,
    blockedNote: null,
  },
  pmo_created: {
    title: "Create your command center",
    description: "A PMO groups projects under one governance and reporting structure.",
    ctaLabel: "Create command center",
    restrictedNote: "A workspace admin or project manager sets up the command center.",
    blockedNote: null,
  },
  member_invited: {
    title: "Invite a team member",
    description: "Bring the people who own or follow this work into the workspace.",
    ctaLabel: "Invite member",
    restrictedNote: "A workspace owner or admin can send invitations.",
    blockedNote: null,
  },
  project_created: {
    title: "Create your first project",
    description:
      "Projects organize the work, milestones, risks and decisions PMFreak will help you manage.",
    ctaLabel: "Create project",
    restrictedNote: "A workspace admin or project manager must create the first project.",
    blockedNote: null,
  },
  task_created: {
    title: "Add your first task",
    description: "Execution insights begin with real work assigned to a project.",
    ctaLabel: "Add task",
    restrictedNote: "A workspace admin or project manager adds execution work.",
    blockedNote: "Create a project before adding execution work.",
  },
  milestone_created: {
    title: "Define a milestone",
    description: "Milestones anchor schedule tracking for a project.",
    ctaLabel: "Add milestone",
    restrictedNote: "A workspace admin or project manager defines milestones.",
    blockedNote: "Create a project before defining milestones.",
  },
  raid_registered: {
    title: "Register a risk, issue or dependency",
    description: "RAID items let PMFreak track what could affect delivery.",
    ctaLabel: "Open execution board",
    restrictedNote: "A workspace admin or project manager registers RAID items.",
    blockedNote: "Create a project before registering RAID items.",
  },
  conversation_started: {
    title: "Start your first conversation",
    description: "Use the workspace conversation to capture context, questions and decisions.",
    ctaLabel: "Open chat",
    restrictedNote: null,
    blockedNote: null,
  },
  execution_signal_generated: {
    title: "Generate your first execution signal",
    description:
      "Continue adding real execution activity. PMFreak will generate signals when there is enough evidence.",
    ctaLabel: "Capture context",
    restrictedNote: "A workspace admin or project manager captures execution context.",
    blockedNote: "Create a project first — signals derive from real project activity.",
  },
  insights_reviewed: {
    title: "Review executive insights",
    description: "Open the executive lens once real recommendations exist for this workspace.",
    ctaLabel: "Review insights",
    restrictedNote: null,
    blockedNote: "Insights appear after your workspace generates its first execution signal.",
  },
};

export const ACTIVATION_STAGE_COPY: Record<WorkspaceActivationStage, string> = {
  workspace_created: "Workspace created",
  project_created: "First project created",
  execution_started: "Execution tracking is active",
  signals_available: "Operational signals are active",
  insights_available: "Operational intelligence is active",
};

export const INVITE_PENDING_NOTE = "Invitation sent — pending acceptance.";
