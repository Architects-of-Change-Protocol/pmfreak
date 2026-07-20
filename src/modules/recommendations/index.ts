// Screens are NOT re-exported here — a Route is the only consumer of a
// Screen, and importing it from a concrete path (not this barrel) keeps
// this module's server-only Screen code (permission checks -> next/headers)
// out of the client bundle graph of any other module's "use client" Feature
// that imports this barrel for RecommendationList reuse.
export { RecommendationList } from "./features/RecommendationList";
export { RecommendationCard } from "./presentation/RecommendationCard";
export { useRecommendations, decideRecommendation } from "./contracts/recommendations.contract";
export type { RecommendationSummary, RecommendationStatus } from "./contracts/recommendations.contract";
