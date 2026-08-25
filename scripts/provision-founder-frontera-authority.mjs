#!/usr/bin/env node
/**
 * OPERATOR-SIDE Frontera authority provisioning for the P2-14 Founder journey.
 *
 * THIS IS NOT PRODUCT CODE and must never be reachable from `src/**`
 * (enforced by `npm run check:frontera-consumer`). It stands in for an
 * enterprise operator provisioning authority out of band — a deployment
 * bootstrap or an admin CLI — and it runs BEFORE the browser journey begins,
 * never because an application request arrived.
 *
 * That separation is the whole point of P0-PKG-06/07. If PMFreak could
 * provision the authority it then asks about, the answer would be a tautology.
 *
 * Order of operations for a Founder acceptance run:
 *
 *     npm run seed:p2-13-founder          # PMFreak DB state
 *     npm run provision:founder-frontera  # THIS — Frontera authority state
 *     npm run test:e2e:p2-14              # the browser journey
 *
 * Requires the same OPERATIONAL_FLOW_TEST_* environment the seed uses, because
 * the Frontera actor binding needs the REAL authenticated principal ids the
 * seed created. Those ids are not in the manifest and are not guessed here: an
 * unresolvable actor is a hard failure.
 */
import { createClient } from "@supabase/supabase-js";
import { buildP2_14HandoffManifest } from "./p2-13/founder-scenario-manifest.mjs";
import {
  openOperatorStore,
  provisionPmfreakDispatchAuthority,
  PMFREAK_EXTERNAL_SUBJECT_SYSTEM,
  FRONTERA_DISPATCH_ACTION,
  projectScope,
} from "./frontera-authority-provisioning.mjs";

const env = process.env;

function required(name) {
  const value = env[name];
  if (!value) {
    console.error(`[founder-frontera] ${name} is required.`);
    process.exit(1);
  }
  return value;
}

/**
 * The single actor the Founder journey actually dispatches with.
 *
 * Tenant B exists in the journey to prove isolation, and it dispatches
 * nothing — so it is deliberately given NO Frontera authority. Provisioning it
 * "just in case" would weaken exactly the property the two-tenant scenario is
 * there to demonstrate.
 */
const DISPATCHING_ACTOR = { tenantKey: "A", actorKey: "owner" };

async function resolveAuthUserIdByEmail(admin, email) {
  for (let page = 1; page <= 20; page += 1) {
    const listed = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (listed.error) throw new Error(`listUsers failed: ${listed.error.message}`);
    const found = listed.data.users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
    if (found) return found.id;
    if (listed.data.users.length < 200) break;
  }
  return null;
}

async function main() {
  const storePath = required("AOC_ENTERPRISE_KERNEL_AUTHORITY_SQLITE_PATH");
  const supabaseUrl = required("OPERATIONAL_FLOW_TEST_SUPABASE_URL");
  const serviceRoleKey = required("OPERATIONAL_FLOW_TEST_SERVICE_ROLE_KEY");

  const manifest = buildP2_14HandoffManifest();
  const tenant = manifest.tenants.find((t) => t.key === DISPATCHING_ACTOR.tenantKey);
  if (!tenant) throw new Error(`manifest tenant missing: ${DISPATCHING_ACTOR.tenantKey}`);
  const actor = tenant.actors.find((a) => a.reference.endsWith(`:${DISPATCHING_ACTOR.actorKey}`));
  if (!actor) throw new Error(`manifest actor missing: ${DISPATCHING_ACTOR.actorKey}`);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const principalUserId = await resolveAuthUserIdByEmail(admin, actor.email);
  if (!principalUserId) {
    console.error(
      `[founder-frontera] no authenticated principal for ${actor.email}. Run 'npm run seed:p2-13-founder' first; this script never invents an identity.`,
    );
    process.exit(1);
  }

  const store = await openOperatorStore(storePath);
  try {
    const provisioned = await provisionPmfreakDispatchAuthority(store, {
      organizationId: tenant.workspaceId,
      principalUserId,
      projectId: tenant.projectId,
      operatorActorId: "operator-p2-14-bootstrap",
    });

    console.log(`[founder-frontera] store              ${storePath}`);
    console.log(`[founder-frontera] organization       ${tenant.workspaceId}   (PMFreak workspace)`);
    console.log(`[founder-frontera] external subject   ${PMFREAK_EXTERNAL_SUBJECT_SYSTEM}:${principalUserId}`);
    console.log(`[founder-frontera] frontera actor     ${provisioned.actorId}`);
    console.log(`[founder-frontera] trust domain       ${provisioned.trustDomainId}`);
    console.log(`[founder-frontera] action             ${FRONTERA_DISPATCH_ACTION}`);
    console.log(`[founder-frontera] resource scope     ${projectScope(tenant.projectId)}`);
    console.log(`[founder-frontera] tenant B authority NONE (dispatches nothing; isolation is the point)`);
    console.log("[founder-frontera] minimum authority provisioned. No wildcard action, no wildcard scope.");
  } finally {
    await store.close();
  }
}

main().catch((error) => {
  console.error(`[founder-frontera] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
