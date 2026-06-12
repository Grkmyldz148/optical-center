import { describe, expect, it } from 'vitest';

import { decodeKeys } from '../../src/cli/caret/lib/keypress.js';

describe('decodeKeys', () => {
  it('decodes printable characters', () => {
    expect(decodeKeys('ab')).toEqual([
      { name: 'char', ch: 'a' },
      { name: 'char', ch: 'b' },
    ]);
  });

  it('decodes CSI arrow sequences', () => {
    expect(decodeKeys('\x1b[A')).toEqual([{ name: 'up' }]);
    expect(decodeKeys('\x1b[B')).toEqual([{ name: 'down' }]);
    expect(decodeKeys('\x1b[C')).toEqual([{ name: 'right' }]);
    expect(decodeKeys('\x1b[D')).toEqual([{ name: 'left' }]);
  });

  it('decodes SS3 arrow variants (application cursor mode)', () => {
    expect(decodeKeys('\x1bOA')).toEqual([{ name: 'up' }]);
    expect(decodeKeys('\x1bOB')).toEqual([{ name: 'down' }]);
  });

  it('decodes editing and control keys', () => {
    expect(decodeKeys('\r')).toEqual([{ name: 'return' }]);
    expect(decodeKeys('\n')).toEqual([{ name: 'return' }]);
    expect(decodeKeys('\x7f')).toEqual([{ name: 'backspace' }]);
    expect(decodeKeys('\t')).toEqual([{ name: 'tab' }]);
    expect(decodeKeys('\x03')).toEqual([{ name: 'ctrl-c' }]);
  });

  it('decodes a lone escape as escape', () => {
    expect(decodeKeys('\x1b')).toEqual([{ name: 'escape' }]);
  });

  it('splits a chunk holding several keys (fast typing / paste)', () => {
    expect(decodeKeys('\x1b[B\x1b[Bok\r')).toEqual([
      { name: 'down' },
      { name: 'down' },
      { name: 'char', ch: 'o' },
      { name: 'char', ch: 'k' },
      { name: 'return' },
    ]);
  });

  it('swallows unrecognised CSI sequences without leaking chars', () => {
    // e.g. a mouse event or an exotic function key
    expect(decodeKeys('\x1b[1;5Cx')).toEqual([{ name: 'char', ch: 'x' }]);
  });

  it('drops stray C0 control characters', () => {
    expect(decodeKeys('\x01a\x02')).toEqual([{ name: 'char', ch: 'a' }]);
  });
});
