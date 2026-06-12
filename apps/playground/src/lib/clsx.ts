/**
 * Tiny conditional-className helper. We don't import the npm one
 * because the playground deliberately keeps its dependency surface
 * small — every transitive dep is one more thing to keep building.
 */
export function clsx(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(' ');
}
