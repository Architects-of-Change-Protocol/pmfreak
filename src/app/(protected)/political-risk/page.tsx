import { ModuleShell } from "@/components/pmfreak/module-shell";
import { ModuleIntelligenceClient } from "@/components/pmfreak/intelligence/module-intelligence-client";

export default function PoliticalRiskPage() {
  return <ModuleShell title="Political Risk Alerts" subtitle="Detect organizational friction patterns that may derail execution and sponsorship." metrics={[]}><ModuleIntelligenceClient endpoint="/api/ai/political-risk" /></ModuleShell>;
}
