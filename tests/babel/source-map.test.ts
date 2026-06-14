/**
 * Source-map preservation: the Babel plugin must not break source-map
 * generation when it rewrites a JSX subtree. We compile a small file
 * with sourceMaps enabled and verify the resulting map references the
 * original source positions.
 */

import * as babel from '@babel/core';
import { describe, expect, it } from 'vitest';

import opticalCenter from '../../src/babel/index.js';

describe('Babel source map preservation', () => {
  it('emits a source map alongside the transformed code', () => {
    const result = babel.transformSync(
      'const X = () => <svg opticalCenter viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>;',
      {
        filename: 'src/Icon.tsx',
        plugins: [[opticalCenter, { onWarning: null }]],
        parserOpts: { plugins: ['jsx', 'typescript'] },
        babelrc: false,
        configFile: false,
        sourceMaps: true,
      },
    );

    expect(result?.map).toBeTruthy();
    expect(result?.map?.version).toBe(3);
    expect(Array.isArray(result?.map?.sources)).toBe(true);
    expect(result?.map?.sources?.[0]).toContain('Icon.tsx');
    expect(typeof result?.map?.mappings).toBe('string');
    expect(result?.map?.mappings.length ?? 0).toBeGreaterThan(0);
  });

  it('preserves source positions for non-svg nodes that surround a transformed icon', () => {
    const input = [
      'function App() {',
      '  const greeting = "hello";',
      '  return <div>{greeting}<svg opticalCenter viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>;',
      '}',
    ].join('\n');

    const result = babel.transformSync(input, {
      filename: 'src/App.tsx',
      plugins: [[opticalCenter, { onWarning: null }]],
      parserOpts: { plugins: ['jsx', 'typescript'] },
      babelrc: false,
      configFile: false,
      sourceMaps: true,
    });

    expect(result?.map?.sourcesContent?.[0]).toBe(input);
    expect(result?.code).toContain('greeting');
    expect(result?.code).toContain('data-optical-center');
  });
});
