import { ModuleShell } from "@/components/pmfreak/module-shell";
import { ModuleIntelligenceClient } from "@/components/pmfreak/intelligence/module-intelligence-client";

export default function StakeholderIntelPage() {
  return <ModuleShell title="Stakeholder Intelligence" subtitle="Relationship heatmap for key project actors with influence and volatility indicators." metrics={[]}><ModuleIntelligenceClient endpoint="/api/ai/stakeholder-intel" /></ModuleShell>;
}
