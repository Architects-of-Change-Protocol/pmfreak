import { ModuleShell } from "@/components/pmfreak/module-shell";
import { ModuleIntelligenceClient } from "@/components/pmfreak/intelligence/module-intelligence-client";

export default function MessageNudgesPage() {
  return <ModuleShell title="Smart Message Nudges" subtitle="Generate persona-aware communication options for executives, clients, and delivery teams." metrics={[]}><ModuleIntelligenceClient endpoint="/api/ai/message-nudges" /></ModuleShell>;
}
