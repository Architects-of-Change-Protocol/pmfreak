import { TrialDashboard } from "@/components/pmfreak/trials/trial-dashboard";
import { PMResponseCapture } from "@/components/pmfreak/trials/pm-response-capture";
import { TrialComparisonWorkspace } from "@/components/pmfreak/trials/trial-comparison-workspace";
import { getTrialScenarios } from "@/lib/trials/scenario-registry";

export default function TrialsPage() {
  const scenario = getTrialScenarios()[0];
  return (
    <main className="space-y-4 p-6">
      <h1 className="text-xl font-semibold text-slate-900">Controlled Operational Trials</h1>
      <PMResponseCapture scenario={scenario} onSubmit={() => undefined} />
      <TrialComparisonWorkspace pmResponse="Submit your response to compare." execution={{ scenario, pmfreakResponse: "Response hidden until PM submission.", runtimeConfidence: "building", traceSummary: [], normalizedConcepts: [], language: scenario.language, imprintContext: "delivery", contradiction: "clear" }} evaluation={{}} onScoreChange={() => undefined} />
      <TrialDashboard metrics={{ totalTrials: 0, averageUsefulness: 0, averageTrust: 0, averageEscalationAccuracy: 0, averagePrioritization: 0, averageFraming: 0 }} strongestCategories={[]} weakestCategories={[]} englishAverage={0} spanishAverage={0} confidenceTrend={[]} />
    </main>
  );
}
