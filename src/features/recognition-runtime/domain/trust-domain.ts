// AOC Recognition Runtime — Trust Domain domain model

export type TrustDomainStatus = "active" | "suspended";

export type TrustDomain = {
  id: string;

  name: string;
  description?: string;

  status: TrustDomainStatus;

  createdAt: string;

  metadata?: Record<string, unknown>;
};
