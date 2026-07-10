// Shared helpers for the Perilla 6 (Stripe webhook / billing lifecycle) test
// files. Not itself a test file, so it's safe to import from any of them
// without being run twice.

/**
 * Minimal in-memory stand-in for the subset of the Supabase query builder
 * used by src/lib/billing.ts and src/lib/billing-webhook-lifecycle.ts:
 * select().eq().maybeSingle(), insert(), update().eq().select().maybeSingle(),
 * and upsert().select().single(). Backed by a plain array of rows per table
 * so tests can assert on real query outcomes (including 23505 unique
 * violations) without a live database.
 */
type FakeRow = Record<string, unknown>;

export function createFakeBillingSupabase(seed: { companySubscriptions?: FakeRow[]; billingWebhookEvents?: FakeRow[] } = {}) {
  const tables: Record<string, FakeRow[]> = {
    company_subscriptions: seed.companySubscriptions ? [...seed.companySubscriptions] : [],
    billing_webhook_events: seed.billingWebhookEvents ? [...seed.billingWebhookEvents] : [],
  };

  const primaryKey: Record<string, string> = {
    company_subscriptions: "company_id",
    billing_webhook_events: "event_id",
  };

  function from(table: string) {
    const rows = tables[table];
    if (!rows) throw new Error(`fake supabase: unknown table "${table}"`);

    return {
      select() {
        const filters: Array<[string, unknown]> = [];
        const builder = {
          eq(column: string, value: unknown) {
            filters.push([column, value]);
            return builder;
          },
          async maybeSingle() {
            const match = rows.find((row) => filters.every(([col, val]) => row[col] === val));
            return { data: match ?? null, error: null };
          },
        };
        return builder;
      },
      insert(row: Record<string, unknown>) {
        return (async () => {
          const pk = primaryKey[table];
          if (rows.some((existing) => existing[pk] === row[pk])) {
            return { data: null, error: { code: "23505", message: `duplicate key value violates unique constraint on ${pk}` } };
          }
          rows.push({ ...row });
          return { data: { ...row }, error: null };
        })();
      },
      update(patch: Record<string, unknown>) {
        const filters: Array<[string, unknown]> = [];
        const findMatch = () => rows.find((row) => filters.every(([col, val]) => row[col] === val));
        const builder = {
          eq(column: string, value: unknown) {
            filters.push([column, value]);
            return builder;
          },
          select() {
            return {
              async maybeSingle() {
                const match = findMatch();
                if (!match) return { data: null, error: null };
                Object.assign(match, patch);
                return { data: { ...match }, error: null };
              },
              async single() {
                const match = findMatch();
                if (!match) return { data: null, error: { message: "no rows" } };
                Object.assign(match, patch);
                return { data: { ...match }, error: null };
              },
            };
          },
          // update() awaited directly with no .select()
          then(resolve: (v: unknown) => unknown, reject: (v: unknown) => unknown) {
            const match = findMatch();
            if (match) Object.assign(match, patch);
            return Promise.resolve({ data: match ? [{ ...match }] : [], error: null }).then(resolve, reject);
          },
        };
        return builder;
      },
      upsert(row: Record<string, unknown>, _opts: { onConflict: string }) {
        return {
          select() {
            return {
              async single() {
                const pk = primaryKey[table];
                const existingIndex = rows.findIndex((existing) => existing[pk] === row[pk]);
                if (existingIndex >= 0) {
                  rows[existingIndex] = { ...rows[existingIndex], ...row };
                  return { data: { ...rows[existingIndex] }, error: null };
                }
                rows.push({ ...row });
                return { data: { ...row }, error: null };
              },
            };
          },
        };
      },
    };
  }

  return { from, tables };
}

export function companyRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    company_id: "company-1",
    plan: "free",
    subscription_status: "inactive",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    current_period_end: null,
    ...overrides,
  };
}
