// AOC Recognition Runtime — Actor domain model

export type ActorType = "human" | "agent" | "organization" | "system";

export type ActorStatus = "active" | "suspended" | "revoked";

export type Actor = {
  id: string;

  trustDomainId: string;

  type: ActorType;
  displayName: string;

  status: ActorStatus;

  roleIds?: string[];

  createdAt: string;

  metadata?: Record<string, unknown>;
};
