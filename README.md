# PMFreak AI

PMFreak AI is a Next.js app for uploading scope documents (PDF, DOCX, TXT), extracting text, and generating project analysis outputs for delivery teams.

## Sprint 8 Highlights

- Added SaaS billing foundation with Stripe.
- Added `/pricing` page with Free, Pro, and Enterprise plans.
- Added authenticated `/billing` page with Stripe checkout + customer portal actions.
- Added billing APIs:
  - `POST /api/billing/create-checkout-session`
  - `POST /api/billing/create-portal-session`
  - `POST /api/billing/webhook`
  - `GET /api/billing/state`
- Added company-level subscription persistence (`plan`, `subscriptionStatus`, Stripe IDs, renewal date).
- Added premium feature gates:
  - Free: limited uploads + rule-based analysis
  - Pro: AI analysis + exports
  - Enterprise: portfolio memory + enterprise-only permissions helpers
- Added billing status card in dashboard.

## Environment Setup

Create a `.env.local` file in the project root (or copy `.env.example`):

```bash
OPENAI_API_KEY=your_openai_api_key_here

NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
```

> Keep secret keys server-side only. `NEXT_PUBLIC_*` values are safe for browser exposure.

## Getting Started

Install dependencies and run the app:

```bash
npm install
npm run dev
```

Open:
- [http://localhost:3000/pricing](http://localhost:3000/pricing)
- [http://localhost:3000/billing](http://localhost:3000/billing) (authenticated)


## Database Migrations

State previously persisted in local JSON files now lives in Supabase Postgres with tenant-scoped RLS.

Apply the migration:

```bash
npx supabase db push
```

The migration file is:
- `supabase/migrations/20260428120000_p0_state_tables.sql`

## Scripts

```bash
npm run lint
npm run build
npm run start
```

## Supported Upload Formats

- PDF (`.pdf`)
- Microsoft Word (`.docx`)
- Plain text (`.txt`)

Max file size: 10 MB per file.

## API Routes

- `POST /api/upload` — ingest documents, persist uploads, extract text, and enforce plan upload limits.
- `POST /api/analyze-ai` — analyze extracted text with OpenAI for Pro/Enterprise plans.
- `GET /api/portfolio` — enterprise portfolio-memory listing.
- Billing routes listed above.


## Sprint 9 PMO Copilot Core

- Added protected `/copilot` page with chat interface, methodology selector (default Hybrid), project-context selector, prompt chips, session message history, and loading/empty/error states.
- Added `POST /api/copilot` for tenant-scoped PMO copilot responses.
- Added `GET /api/copilot/context` to load current-tenant project context options.
- Copilot capabilities: next steps, risks, scope clarifications, RACI, meeting minutes, follow-up emails, escalation drafts, change-control recommendations, kickoff/closure checklists, and recovery plans.
- Plan behavior:
  - Free: basic rule-based PMO guidance only (OpenAI deep analysis blocked).
  - Pro: AI-powered copilot enabled.
  - Enterprise: AI-powered copilot + broader portfolio-memory context.
- Data isolation principle: copilot only reads memory for the authenticated user's `companyId` and rejects tenant mismatch in request payloads.

## Supabase Auth Redirect URLs

For password reset to work in all environments, add these URL patterns in **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**:

- `https://YOUR_DOMAIN.vercel.app/**`
- `http://localhost:3000/**`

The forgot-password flow sends users to `${NEXT_PUBLIC_SITE_URL}/auth/reset-password`, so `NEXT_PUBLIC_SITE_URL` must match your deployed origin in production.

## Operational evidence-to-decision loop

The first complete PMFreak cognitive-operational circuit is documented in [`docs/operational-evidence-decision-loop.md`](docs/operational-evidence-decision-loop.md). It covers the deterministic signal detector, PMFreak role-mapping authority checks, immutable evidence-linked decisions, Command Center integration, exact Project Assurance Summary v1 metrics, the idempotent demo seed, and the isolated Supabase DB/RLS verifier.
