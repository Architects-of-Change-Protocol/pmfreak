import type { ProjectionParticipant } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Participant Engine
//
// Derives suggested participants from action template base configuration.
// Participant references are role-based (not user IDs) — projections never
// name specific individuals, only role types.
// ─────────────────────────────────────────────────────────────────────────────

type ParticipantInput = {
  baseParticipants: Array<{ participantType: string; responsibility: string }>;
};

export function calculateProjectionParticipants(input: ParticipantInput): ProjectionParticipant[] {
  return input.baseParticipants.map((p) => ({
    participantType:      p.participantType,
    participantReference: p.participantType,
    responsibility:       p.responsibility,
  }));
}
