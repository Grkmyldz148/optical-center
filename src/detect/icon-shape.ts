/**
 * Structural, package-agnostic recognizer for icon data.
 *
 * This is the replacement for any hard-coded icon-package allowlist: the
 * Vite icon-data interceptor (and, in time, the Babel / PostCSS container
 * scanners) ask *what shape is this value*, never *what package is it
 * from*. A brand-new icon library — or one the user authored this
 * afternoon — is recognised by the same rules as Iconify, because the
 * rules only look at the data.
 *
 * Three positive shapes, layered so that ambiguous input is rejected:
 *
 *   - collection  An Iconify-style set: `{ prefix, icons: { name: {body} } }`.
 *   - single      One Iconify icon object: `{ body, …geometry }`.
 *   - svg         A raw `<svg>` document string.
 *
 * False-positive defenses (a JSON payload that merely *happens* to carry
 * a `body` field — an HTTP response, a CMS record, an email — must NOT be
 * treated as an icon):
 *
 *   1. `body` alone never qualifies: it must contain SVG drawing markup.
 *   2. A standalone single-icon needs a corroborating geometry field
 *      (width/height/left/top/rotate/hFlip/vFlip) — a two-signal minimum.
 *   3. A collection needs the joint `prefix:string` + `icons`-of-bodies
 *      signal — two independent signals.
 *   4. A blocklist of competing-semantics keys (`status`, `url`, …) rejects
 *      payloads that carry a string `body` for unrelated reasons.
 *   5. Anything that doesn't match cleanly returns `'none'` and is left
 *      untouched.
 *
 * Pure module — no I/O, no native bindings, no Vite. Trivially unit-testable.
 */

export type IconDataKind = 'collection' | 'single' | 'none';

/**
 * SVG drawing elements that a real icon body contains. Matching one of
 * these (as an opening tag) is the difference between "a string that is
 * SVG markup" and "a string that merely has angle brackets".
 */
const SVG_INNER =
  /<(path|g|circle|rect|polygon|polyline|line|ellipse|use|defs|mask|clipPath|symbol|stop)[\s>/]/i;

/** A raw `<svg>` document, tolerating a leading XML prolog and comments. */
const SVG_ROOT = /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i;

/**
 * Keys whose presence means "this object has a `body` for some reason
 * other than being an icon" — HTTP responses, fetch payloads, CMS records.
 * Their presence on the same object disqualifies it.
 */
const COMPETING_KEYS: readonly string[] = [
  'method',
  'headers',
  'status',
  'statusCode',
  'statusText',
  'url',
  'ok',
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Does this value look like a single Iconify icon body carrier — an object
 * with a `body` string that contains SVG drawing markup, and none of the
 * competing-semantics keys? Used as the inner test for both the collection
 * and single-icon discriminators.
 */
export function isIconBody(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  const body = value['body'];
  if (typeof body !== 'string') return false;
  if (!SVG_INNER.test(body)) return false;
  for (const key of COMPETING_KEYS) {
    if (key in value) return false;
  }
  return true;
}

/**
 * An Iconify collection: `prefix` is a string, `icons` is a non-empty
 * object of icon records, and every record that carries a `body` carries
 * SVG markup. At least one icon must actually have a body (an aliases-only
 * object isn't a renderable set on its own).
 */
export function isIconifyCollection(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  if (typeof value['prefix'] !== 'string') return false;

  const icons = value['icons'];
  if (!isPlainObject(icons)) return false;

  const records = Object.values(icons);
  if (records.length === 0) return false;

  let sawBody = false;
  for (const record of records) {
    if (!isPlainObject(record)) return false;
    const body = record['body'];
    if (typeof body === 'string') {
      if (!SVG_INNER.test(body)) return false;
      sawBody = true;
    }
  }
  return sawBody;
}

/**
 * A standalone single icon (e.g. an `@iconify/icons-*` default export):
 * an icon body that is NOT part of a collection and carries at least one
 * corroborating geometry field. The corroborator is mandatory — `{ body }`
 * alone is rejected to keep unrelated `{ body: '<p>…' }` payloads out.
 */
export function isSingleIcon(value: unknown): boolean {
  if (!isIconBody(value)) return false;
  const obj = value as Record<string, unknown>;
  if ('prefix' in obj || 'icons' in obj) return false;

  for (const key of ['width', 'height', 'left', 'top', 'rotate'] as const) {
    const n = obj[key];
    if (typeof n === 'number' && Number.isFinite(n)) return true;
  }
  for (const key of ['hFlip', 'vFlip'] as const) {
    if (typeof obj[key] === 'boolean') return true;
  }
  return false;
}

/** Does this string look like a raw `<svg>` document? */
export function looksLikeRawSvg(text: string): boolean {
  return SVG_ROOT.test(text);
}

/**
 * Classify a parsed value into the icon-data shape it matches, or `'none'`.
 * Collection is tested first because a collection object never satisfies the
 * single-icon test (it has no top-level `body`), but being explicit keeps
 * the precedence obvious.
 */
export function classifyIconData(value: unknown): IconDataKind {
  if (isIconifyCollection(value)) return 'collection';
  if (isSingleIcon(value)) return 'single';
  return 'none';
}

/**
 * Cheap pre-parse gate for a `.json` source string: does the head of the
 * file mention any of the keys an icon payload must have? Lets the
 * interceptor skip `JSON.parse` on the overwhelming majority of unrelated
 * JSON (tsconfig, package.json, locale bundles) before paying for a parse.
 */
export function jsonHeadMentionsIcon(source: string, headBytes = 8192): boolean {
  const head = source.length > headBytes ? source.slice(0, headBytes) : source;
  return /"(?:body|icons|prefix)"\s*:/.test(head);
}
