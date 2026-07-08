// AOC Domain Policy Pack Runtime — minimal shared domain seed.
//
// This is deliberately small. It exists only so that jurisdiction packs
// (and any future domain-specific pack, e.g. a "sports_events" pack) can
// declare which policy pack domain they belong to without inventing a
// second, parallel pack concept. It does not encode any domain's rules.

export type PolicyPackDomain = "jurisdiction" | "general";

// Every pack family built on top of this runtime declares its own `kind`
// literal (e.g. "jurisdiction_pack") so downstream code can discriminate
// without relying on domain alone.
export type PolicyPackLifecycleStatus =
  | "draft"
  | "active"
  | "deprecated"
  | "expired"
  | "superseded"
  | "disabled";
