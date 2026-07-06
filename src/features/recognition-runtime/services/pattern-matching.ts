// Shared action/resourceScope pattern matching: exact string match, or a
// trailing "*" for a prefix match (e.g. "project:*" matches "project:HMP-14665").

export const matchesPattern = (pattern: string, value: string): boolean => {
  if (pattern === "*") return true;
  if (pattern.endsWith("*")) return value.startsWith(pattern.slice(0, -1));
  return pattern === value;
};
