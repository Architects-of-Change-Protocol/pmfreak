import { ModuleShell } from "@/components/pmfreak/module-shell";
import { ModuleIntelligenceClient } from "@/components/pmfreak/intelligence/module-intelligence-client";

export default function MeetingsPage() {
  return <ModuleShell title="Meeting Transcript Analyzer" subtitle="Extract decisions, owners, blockers, and follow-ups from leadership and delivery syncs." metrics={[]}><ModuleIntelligenceClient endpoint="/api/ai/meetings" /></ModuleShell>;
}
