// PMFreak port: privileged (service-role) database access.
// OWNERSHIP: PMFreak. Not Soberania Protocol, not Frontera.
// No upstream persistence port exists at all. Deliberately minimal so the
// governance domain carries no dependency on a specific database library; the
// PMFreak adapter returns a Supabase client structurally compatible with
// PrivilegedDbClient. Every use is gated by an explicit, audited context.

export type PrivilegedDbContext = {
  routeId: string;
  operation: string;
  reason: string;
  workspaceId?: string | null;
  actorUserId?: string | null;
  systemActor?: string;
};

// Minimal builder interface compatible with Supabase's query builder.
// Only .from() access is required; callers use any for chaining.
export interface PrivilegedDbClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

export interface PrivilegedDbPort {
  createClient(context: PrivilegedDbContext): PrivilegedDbClient;
}
