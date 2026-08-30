/**
 * Supported operator boundary: admit ONE participant to a closed-free-beta tenant.
 *
 *   npm run beta:invite-participant -- --workspace <uuid> --email <address> --role <pm|admin|viewer> --inviter <email|uuid>
 *
 * It creates a real, inspectable `workspace_invitations` row through the
 * product's own invitation domain (`createWorkspaceInvitationRecord`), so the
 * duplicate refusal, role gate, token hashing, expiry and audit event are the
 * SAME ones the in-app path uses. It writes no SQL and repairs nothing.
 *
 * Authority: the inviter must already hold an owner/admin membership in the
 * target workspace, checked by the product's own `requireWorkspaceInviteActor`.
 * The request-path governance-pipeline and seat checks resolve an authenticated
 * HTTP user and cannot run here; that difference is documented, not implied.
 *
 * The accept path contains the ONLY copy of the plaintext token and is printed
 * only with --emit-accept-path, for out-of-band delivery to the participant.
 */
import { createClient } from "@supabase/supabase-js";
import { requireWorkspaceInviteActor } from "../src/lib/workspace-access.ts";
import { createWorkspaceInvitationRecord } from "../src/lib/workspace-team.ts";
import { assertIsolatedTarget, GUARD_MODES, LOCAL_ISOLATED } from "./p2-13/isolation-guard.mjs";

const arg = (name) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const fail = (failureClass, message) => {
  process.stderr.write(`${JSON.stringify({ ok: false, failureClass, message })}\n`);
  process.exitCode = 1;
};

const workspaceId = arg("workspace");
const email = arg("email");
const role = arg("role");
const inviter = arg("inviter");
const emitAcceptPath = process.argv.includes("--emit-accept-path");

if (!workspaceId || !email || !role || !inviter) {
  fail("invalid_operator_request", "Required: --workspace <uuid> --email <address> --role <pm|admin|viewer> --inviter <email|uuid>");
} else {
  // Never a hosted or production target. The repository's own guard, before any
  // privileged access — an operator admission script must not be usable to write
  // into a real tenant by mistake.
  const isolation = assertIsolatedTarget(process.env, { mode: GUARD_MODES.SEED });
  if (isolation.classification !== LOCAL_ISOLATED) {
    fail("non_isolated_target", `Refusing to admit a participant against a non-local target: ${JSON.stringify(isolation.target ?? null)}`);
  } else {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let inviterUser = null;
    if (/^[0-9a-f-]{36}$/i.test(inviter)) {
      const { data } = await supabase.auth.admin.getUserById(inviter);
      inviterUser = data?.user ?? null;
    } else {
      const wanted = inviter.trim().toLowerCase();
      for (let page = 1; page <= 20 && !inviterUser; page += 1) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
        if (error) break;
        inviterUser = data.users.find((user) => (user.email ?? "").toLowerCase() === wanted) ?? null;
        if (data.users.length < 200) break;
      }
    }

    if (!inviterUser) {
      fail("inviter_not_found", "The inviting operator identity does not exist. This script never invents an identity.");
    } else {
      const getClient = async () => supabase;
      try {
        // The product's OWN actor gate: owner/admin membership in this workspace.
        const actor = await requireWorkspaceInviteActor({ userId: inviterUser.id, workspaceId }, getClient);
        // company_id belongs to the inviting user (feature-gates.getCompanyIdByUserId).
        const metadataCompany = (inviterUser.user_metadata ?? {}).company_id;
        const companyId = typeof metadataCompany === "string" ? metadataCompany : inviterUser.id;

        const created = await createWorkspaceInvitationRecord(
          { workspaceId, companyId, inviterUserId: inviterUser.id, actorRole: actor.role, email, role },
          getClient,
        );

        const { data: inspectable } = await supabase
          .from("workspace_invitations")
          .select("id, workspace_id, email, role, status, expires_at")
          .eq("workspace_id", workspaceId)
          .eq("email", email.trim().toLowerCase())
          .eq("status", "pending")
          .maybeSingle();

        process.stdout.write(
          `${JSON.stringify({
            ok: true,
            boundary: "beta:invite-participant",
            invitation: inspectable ?? null,
            expiresAt: created.expiresAt,
            // The plaintext token exists exactly once, here. Withheld unless asked for.
            acceptPath: emitAcceptPath ? created.acceptPath : "(withheld — pass --emit-accept-path to print)",
          })}\n`,
        );
      } catch (error) {
        fail("invitation_refused", error?.message ?? String(error));
      }
    }
  }
}
