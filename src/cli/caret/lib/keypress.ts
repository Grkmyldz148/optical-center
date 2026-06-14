/**
 * Caret raw-mode key reader.
 *
 * Puts stdin into raw mode, decodes the byte stream into named keys
 * (arrows, return, escape, backspace, printable chars) and hands each
 * one to a callback. The callback returns 'done' to stop reading;
 * cleanup (raw mode off, listeners removed, stdin paused) is guaranteed
 * even when the callback throws.
 *
 * Interactive components (select, input) build on this so none of them
 * re-implements the escape-sequence dance.
 */

export type Key =
  | { name: 'up' | 'down' | 'left' | 'right' | 'home' | 'end' }
  | { name: 'return' }
  | { name: 'escape' }
  | { name: 'backspace' }
  | { name: 'tab' }
  | { name: 'ctrl-c' }
  | { name: 'char'; ch: string }

/** Decode a raw stdin chunk into zero or more keys. Exported for tests. */
export function decodeKeys(chunk: string): Key[] {
  const keys: Key[] = []
  let i = 0
  while (i < chunk.length) {
    const ch = chunk[i]!

    if (ch === '\x03') {
      keys.push({ name: 'ctrl-c' })
      i++
      continue
    }
    if (ch === '\r' || ch === '\n') {
      keys.push({ name: 'return' })
      i++
      continue
    }
    if (ch === '\x7f' || ch === '\b') {
      keys.push({ name: 'backspace' })
      i++
      continue
    }
    if (ch === '\t') {
      keys.push({ name: 'tab' })
      i++
      continue
    }

    if (ch === '\x1b') {
      // CSI / SS3 escape sequences — arrows and home/end
      const intro = chunk[i + 1]
      if (intro === '[' || intro === 'O') {
        const final = chunk[i + 2]
        const named: Record<string, Key> = {
          A: { name: 'up' },
          B: { name: 'down' },
          C: { name: 'right' },
          D: { name: 'left' },
          H: { name: 'home' },
          F: { name: 'end' },
        }
        if (final !== undefined && named[final] !== undefined) {
          keys.push(named[final]!)
          i += 3
          continue
        }
        // Unrecognised sequence — swallow it whole (up to a final byte)
        let j = i + 2
        while (j < chunk.length && !/[a-zA-Z~]/.test(chunk[j]!)) j++
        i = j + 1
        continue
      }
      keys.push({ name: 'escape' })
      i++
      continue
    }

    // Drop remaining C0 control chars; pass printable text through
    if (ch >= ' ') {
      keys.push({ name: 'char', ch })
    }
    i++
  }
  return keys
}

/**
 * Read keys until the callback returns 'done'. Resolves after cleanup.
 * Requires a TTY stdin — callers gate on capability().isStdinTTY.
 */
export function readKeys(onKey: (key: Key) => 'continue' | 'done'): Promise<void> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin
    const wasRaw = stdin.isRaw === true

    const cleanup = (): void => {
      stdin.removeListener('data', onData)
      if (stdin.isTTY === true && !wasRaw) stdin.setRawMode(false)
      stdin.pause()
    }

    const onData = (chunk: Buffer): void => {
      try {
        for (const key of decodeKeys(chunk.toString('utf8'))) {
          if (onKey(key) === 'done') {
            cleanup()
            resolve()
            return
          }
        }
      } catch (err) {
        cleanup()
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }

    if (stdin.isTTY === true) stdin.setRawMode(true)
    stdin.resume()
    stdin.on('data', onData)
  })
}
