# PMFreak Integrated Audit Program — Sprint 0

Status taxonomy: VERIFIED / PARTIALLY VERIFIED / UNVERIFIED / NOT PRESENT / NOT APPLICABLE. Evidence files live in `docs/audit/pmfreak-integrated-audit/evidence/`.

## Environment and services

Inventory source: `evidence/environment-variables.txt`; values were not copied.

| Variable class | Required | Environment | Service | Sensitivity | Evidence | Available |
|---|---:|---|---|---|---|---:|
| `NEXT_PUBLIC_*` Supabase/public app variables | likely for app runtime | browser/server | Supabase / app | public | env refs | UNVERIFIED |
| Supabase URL/keys/service role references | likely for server/data/auth | server/CI/local | Supabase | secret for service role | env refs/auth summary | UNVERIFIED |
| AI/model provider variables | depends on AI feature | server | LLM provider | secret | AI/env search | UNVERIFIED |
| Stripe variables | billing/webhooks | server | Stripe | secret | package/code refs | UNVERIFIED |
| Vercel/CI secrets | CI/deploy | CI | Vercel/GitHub | secret | workflows | UNVERIFIED |
| AOC config variables | feature/runtime dependent | local/CI/server | AOC | mixed | package/scripts/search | UNVERIFIED |

No live service availability or credential validity was tested. Absence of printed secrets is intentional.
