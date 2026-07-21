import { ModuleShell } from "@/components/pmfreak/module-shell";
import { ProjectMemoryClient } from "@/components/pmfreak/intelligence/project-memory-client";

export default function ProjectMemoryPage() {
  return <ModuleShell title="Project Memory" subtitle="Persistent timeline of decisions, risks, escalations, and commitments for rapid context recall." metrics={[]}><ProjectMemoryClient endpoint="/api/ai/project-memory" /></ModuleShell>;
}
