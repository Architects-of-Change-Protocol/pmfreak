export type PMFreakAocGateResultUIEmptyState = {
  kind: "gate_result_empty";
  title: string;
  message: string;
  presentationOnly: true;
};

export function createPMFreakAocGateResultUIEmptyState(): PMFreakAocGateResultUIEmptyState {
  return {
    kind: "gate_result_empty",
    title: "No gate result yet",
    message: "No AOC gate result to display yet.",
    presentationOnly: true,
  };
}
