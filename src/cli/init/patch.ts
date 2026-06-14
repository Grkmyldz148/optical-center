/**
 * Source-patching helpers for `optical-center init`.
 *
 * Small, conservative string surgery over user config files. Every
 * helper returns null when the source doesn't match the shape it
 * knows how to edit — callers fall back to printing a paste-ready
 * snippet instead of guessing. Never write a patch we aren't sure of:
 * a wrong edit to someone's vite.config is worse than a manual step.
 */

/**
 * Insert an import/require line after the last top-level import (or
 * `const … = require(…)`) line, or at the very top (after a leading
 * comment block) when there are none.
 */
export function insertImport(source: string, importLine: string): string {
  const lines = source.split('\n');
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^\s*import\b/.test(line) || /^\s*const\s+.+=\s*require\(/.test(line)) {
      lastImport = i;
    }
  }
  if (lastImport !== -1) {
    lines.splice(lastImport + 1, 0, importLine);
    return lines.join('\n');
  }
  // No imports — place after a leading block comment if present.
  let insertAt = 0;
  if (/^\s*\/\*/.test(lines[0] ?? '')) {
    while (insertAt < lines.length && !/\*\//.test(lines[insertAt]!)) insertAt++;
    insertAt++;
  }
  lines.splice(insertAt, 0, importLine, '');
  return lines.join('\n');
}

/**
 * Find the index of the bracket that closes the one at `openIndex`.
 * Tracks (), [], {} uniformly and skips string literals and comments.
 * Returns -1 when unbalanced.
 */
export function findMatchingBracket(source: string, openIndex: number): number {
  const open = source[openIndex];
  const close = open === '[' ? ']' : open === '{' ? '}' : open === '(' ? ')' : null;
  if (close === null) return -1;

  let depth = 0;
  let i = openIndex;
  while (i < source.length) {
    const ch = source[i]!;
    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipString(source, i);
      continue;
    }
    if (ch === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      if (end === -1) return -1;
      i = end + 2;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

/**
 * Insert `entry` into the array that follows `anchor` (e.g.
 * /plugins\s*:\s*\[/). Position 'start' prepends after `[`,
 * 'end' appends before the matching `]`. Returns null when the
 * anchor or a balanced close bracket can't be found.
 */
export function insertIntoArray(
  source: string,
  anchor: RegExp,
  entry: string,
  position: 'start' | 'end',
): string | null {
  const match = anchor.exec(source);
  if (match === null) return null;
  const openIndex = match.index + match[0].length - 1;
  if (source[openIndex] !== '[') return null;

  if (position === 'start') {
    const isEmpty = /^\s*\]/.test(source.slice(openIndex + 1));
    const insertion = isEmpty ? entry : `${entry}, `;
    return source.slice(0, openIndex + 1) + insertion + source.slice(openIndex + 1);
  }

  const closeIndex = findMatchingBracket(source, openIndex);
  if (closeIndex === -1) return null;
  const body = source.slice(openIndex + 1, closeIndex);
  const isEmpty = body.trim() === '';
  const endsWithComma = /,\s*$/.test(body);
  const insertion = isEmpty || endsWithComma ? entry : `, ${entry}`;
  return source.slice(0, closeIndex) + insertion + source.slice(closeIndex);
}

function skipString(source: string, start: number): number {
  const quote = source[start]!;
  let i = start + 1;
  while (i < source.length) {
    if (source[i] === '\\') {
      i += 2;
      continue;
    }
    if (source[i] === quote) return i + 1;
    i++;
  }
  return i;
}
