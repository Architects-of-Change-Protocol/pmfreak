# 09 — Product Packaging

Conceptual plan architecture, not final pricing. Reflects both what exists today (`free`/`pro`/`pmo` in `src/lib/feature-gates.ts`) and the target packaging structure the brief asks for.

## A. Target plan architecture

| Plan | Buyer | Unit of purchase | Limits (illustrative, not final) | Features | AOC consumption included |
|---|---|---|---|---|---|
| **B2C — Free** | Individual | Per account | 1 seat, small upload cap, no AI | Core project CRUD, milestones, RAID | None |
| **B2C — Individual** | Individual | Per seat | 1 seat, moderate limits | + AI analysis, exports | None |
| **B2C — Pro** | Individual | Per seat | 1 seat, higher limits | + advanced AI actions, reporting | None (AOC not yet sold as a capability) |
| **B2C — Consultant** | Individual consultant | Per seat + multi-client workspace access | Multiple client workspaces, scoped access | + client-workspace switching, consultant-scoped role (gap noted in `05-multitenancy-and-auth.md`) | None |
| **B2B — Team** | Small team | Per seat | Existing `pro`-tier shape, multi-seat | Team invites, shared workspace | None |
| **B2B — PMO** | PM office | Per seat + workspace count | Maps to existing `pmo` tier | PMO Command Center, governance/compliance modules (once un-orphaned, F-21), executive reporting | None |
| **B2B — Business** | Growing company | Per seat, tiered | Higher seat/project/storage ceilings | + admin/support console access (once built, F-16), SSO-optional add-on | Optional, once AOC capabilities are sold |
| **B2B — Agency / Consulting Firm** | Agency managing multiple clients | Per client workspace | Multi-tenant-of-tenants shape — **not currently modeled**, needs its own design pass | Cross-client reporting, consultant role | None initially |
| **Enterprise — Custom** | Enterprise | Negotiated | Custom | SSO, SCIM, advanced audit, retention policy, assurance tier, SLA, dedicated support | AOC Enterprise/Assurance consumption as a first-class, billed capability |

## B. Existence by launch stage

| Plan | Private beta | Public B2C | Public B2B | Enterprise later |
|---|---|---|---|---|
| Free | Should exist | Should exist | — | — |
| Individual / Pro | Should exist (already does, real Stripe integration) | Should exist | — | — |
| Consultant | Nice-to-have, defer | Should exist | Should exist | — |
| Team | Nice-to-have, defer | — | Should exist | — |
| PMO | Should exist (already does, real Stripe integration) — but the differentiated capability is orphaned from nav (F-21), fix before demoing | — | Should exist | — |
| Business | — | — | Should exist | — |
| Agency / Consulting Firm | — | — | Design + build later | — |
| Enterprise Custom | — | — | — | Build in Scenario C (`11-roadmap.md`) |

## C. Packaging notes tied to real findings

- The `pmo` tier already includes PMO Command Center and governance/compliance capability *conceptually*, but that capability is currently unreachable from navigation (F-21) — fix before selling or demoing the PMO tier to a prospect, since a buyer would not be able to find what they're paying for.
- Do not sell or describe any tier as including "AI agents that take real-world action" until F-11 (in-memory-only tool execution) is resolved — today's agent capability is advisory/draft-only regardless of plan tier.
- Do not describe any tier as "AOC-verified" or as including externally-assured trust/identity until F-02 is resolved — today PMFreak self-implements what that language would imply is externally provided.
- The Consultant and Agency/Consulting-Firm tiers both require a workspace-scoped external-access role that does not exist yet (`05-multitenancy-and-auth.md` §C) — treat as a dependency before selling either tier, not a packaging afterthought.
- Plan catalog is currently hardcoded (F-14) — fine for the two-to-four tiers above, but revisit before Enterprise Custom requires per-account negotiated terms.
