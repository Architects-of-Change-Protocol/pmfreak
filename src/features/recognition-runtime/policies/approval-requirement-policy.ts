import { fail, pass, type RecognitionPolicy } from "./policy-context";

const POLICY_NAME = "approval_requirement";

// Recognition Runtime MVP has no way to satisfy this policy on its own — an
// action matching a rule with requiresHumanApproval always comes back
// require_human_approval. A future Approval Runtime sprint plugs in here by
// resolving an approval proof before this policy runs.
export const approvalRequirementPolicy: RecognitionPolicy = (ctx) => {
  const rule = ctx.requirementRule;
  if (!rule || !rule.requiresHumanApproval) {
    return pass(POLICY_NAME, "NO_APPROVAL_REQUIRED", "No human approval requirement applies to this action");
  }

  return fail(
    POLICY_NAME,
    "require_human_approval",
    "HUMAN_APPROVAL_REQUIRED",
    `Action "${ctx.actionRequest.action}" requires human approval before it can be recognized`
  );
};
