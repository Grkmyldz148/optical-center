import { describe, expect, it } from 'vitest';

import {
  classifyIconData,
  isIconBody,
  isIconifyCollection,
  isSingleIcon,
  jsonHeadMentionsIcon,
  looksLikeRawSvg,
} from '../../src/detect/icon-shape.js';

const PATH = '<path d="M8 5v14l11-7z"/>';

describe('classifyIconData — positive shapes', () => {
  it('recognises an Iconify collection', () => {
    const set = {
      prefix: 'mdi',
      width: 24,
      height: 24,
      icons: { home: { body: PATH }, play: { body: PATH } },
    };
    expect(classifyIconData(set)).toBe('collection');
    expect(isIconifyCollection(set)).toBe(true);
  });

  it('recognises a single-icon module with a geometry corroborator', () => {
    const icon = { body: PATH, width: 24, height: 24 };
    expect(classifyIconData(icon)).toBe('single');
    expect(isSingleIcon(icon)).toBe(true);
  });

  it('accepts an hFlip boolean as the corroborator', () => {
    expect(isSingleIcon({ body: PATH, hFlip: true })).toBe(true);
  });

  it('treats a raw <svg> document string via looksLikeRawSvg', () => {
    expect(looksLikeRawSvg(`<svg viewBox="0 0 24 24">${PATH}</svg>`)).toBe(true);
    expect(looksLikeRawSvg('<?xml version="1.0"?>\n<svg><path/></svg>')).toBe(true);
    expect(looksLikeRawSvg('{"not":"svg"}')).toBe(false);
  });
});

describe('classifyIconData — false-positive defenses', () => {
  it('rejects a bare {body} with no SVG markup and no geometry', () => {
    expect(classifyIconData({ body: 'just text' })).toBe('none');
    expect(isIconBody({ body: 'just text' })).toBe(false);
  });

  it('rejects {body} that is SVG-ish but has no geometry corroborator', () => {
    // Looks like an icon body, but a standalone single icon needs a
    // second signal — otherwise a CMS/HTML payload would qualify.
    expect(classifyIconData({ body: PATH })).toBe('none');
  });

  it('rejects an HTTP/fetch payload that happens to carry a body', () => {
    expect(classifyIconData({ body: PATH, status: 200, url: '/x' })).toBe('none');
    expect(isIconBody({ body: PATH, statusText: 'OK' })).toBe(false);
  });

  it('rejects the Iconify collections.json index (no prefix/icons-of-bodies)', () => {
    const index = { mdi: { name: 'Material Design Icons', total: 7000 } };
    expect(classifyIconData(index)).toBe('none');
  });

  it('rejects a tsconfig-shaped object', () => {
    expect(classifyIconData({ compilerOptions: { strict: true } })).toBe('none');
  });

  it('rejects a collection whose icon bodies are not SVG markup', () => {
    const fake = { prefix: 'x', icons: { a: { body: 'nope' } } };
    expect(isIconifyCollection(fake)).toBe(false);
  });

  it('rejects an aliases-only object with no real bodies', () => {
    const aliasesOnly = { prefix: 'x', icons: {} };
    expect(isIconifyCollection(aliasesOnly)).toBe(false);
  });

  it('rejects arrays and primitives', () => {
    expect(classifyIconData([{ body: PATH, width: 24 }])).toBe('none');
    expect(classifyIconData('string')).toBe('none');
    expect(classifyIconData(null)).toBe('none');
  });
});

describe('jsonHeadMentionsIcon', () => {
  it('passes JSON that mentions an icon key in its head', () => {
    expect(jsonHeadMentionsIcon('{"prefix":"mdi","icons":{}}')).toBe(true);
    expect(jsonHeadMentionsIcon('{ "body": "<path/>" }')).toBe(true);
  });

  it('rejects unrelated JSON before a parse is paid for', () => {
    expect(jsonHeadMentionsIcon('{"compilerOptions":{"strict":true}}')).toBe(false);
    expect(jsonHeadMentionsIcon('{"name":"pkg","version":"1.0.0"}')).toBe(false);
  });
});
