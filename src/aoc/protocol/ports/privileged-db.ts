// AOC Protocol: PrivilegedDbPort
// Future extraction boundary: replaces direct use of createPrivilegedSupabaseClient from PMFreak.
// AOC uses a minimal database client interface so the protocol layer carries no dependency on
// any specific database library. The host application (PMFreak) returns a Supabase client
// that is structurally compatible with AocDbClient.
// Do NOT import from host application modules in this file.

export type AocPrivilegedDbContext = {
  routeId: string;
  operation: string;
  reason: string;
  workspaceId?: string | null;
  actorUserId?: string | null;
  systemActor?: string;
};

// Minimal builder interface compatible with Supabase's query builder.
// AOC only requires .from() access; callers use any for chaining.
export interface AocDbClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

export interface PrivilegedDbPort {
  createClient(context: AocPrivilegedDbContext): AocDbClient;
}
