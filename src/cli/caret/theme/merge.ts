/**
 * Deep merge utility for theme overrides.
 *
 * Returns a new theme; does not mutate either input. Used to combine the
 * default theme with user-provided PartialTheme overrides at any depth.
 */

import type { Theme, PartialTheme } from './types.js'

export function mergeTheme(base: Theme, override: PartialTheme | undefined): Theme {
  if (!override) return base
  return deepMerge(base, override) as Theme
}

function deepMerge<T>(target: T, source: unknown): T {
  if (source === undefined || source === null) return target
  if (Array.isArray(source)) return source as unknown as T
  if (typeof source !== 'object') return source as T
  if (typeof target !== 'object' || target === null || Array.isArray(target)) {
    return source as T
  }

  const result: Record<string, unknown> = { ...(target as Record<string, unknown>) }
  for (const key of Object.keys(source as Record<string, unknown>)) {
    result[key] = deepMerge(
      (target as Record<string, unknown>)[key],
      (source as Record<string, unknown>)[key],
    )
  }
  return result as T
}
