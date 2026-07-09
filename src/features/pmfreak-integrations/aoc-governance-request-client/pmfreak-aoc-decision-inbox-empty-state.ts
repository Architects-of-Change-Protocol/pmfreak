export type PMFreakAocDecisionInboxEmptyState = {
  kind: "empty";
  title: string;
  message: string;
  displayOnly: true;
};

export function createPMFreakAocDecisionInboxEmptyState(): PMFreakAocDecisionInboxEmptyState {
  return {
    kind: "empty",
    title: "No decisions yet",
    message: "No AOC governance decisions to display yet.",
    displayOnly: true,
  };
}
