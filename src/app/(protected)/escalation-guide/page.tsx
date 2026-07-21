import { ModuleShell } from "@/components/pmfreak/module-shell";
import { ModuleIntelligenceClient } from "@/components/pmfreak/intelligence/module-intelligence-client";

export default function EscalationGuidePage() {
  return <ModuleShell title="Escalation Guidance Engine" subtitle="Recommend escalation targets, timing, and communication scripts by risk profile." metrics={[]}><ModuleIntelligenceClient endpoint="/api/ai/escalation-guide" /></ModuleShell>;
}
