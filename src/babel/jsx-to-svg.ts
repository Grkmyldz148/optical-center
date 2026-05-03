/**
 * Serialize a (statically-validated) JSXElement to an SVG string.
 *
 * The serializer is deliberately strict: it expects the validator pass to
 * have already rejected dynamic children, spread attributes, member-name
 * tags, and non-literal attribute values. If anything unexpected slips
 * through it throws — the caller (visitor) catches and bails out.
 *
 * Why hand-rolled instead of @babel/generator?
 *   `generator` emits JS / JSX syntax (`<svg viewBox={"0 0 24 24"}>`).
 *   We need wire-format SVG XML (`<svg viewBox="0 0 24 24">`). The two
 *   are different enough that wrapping generator costs more than rolling
 *   ~80 lines of recursive XML.
 */

import * as t from '@babel/types';

import { jsxAttrNameToSvg } from './attributes.js';

export function jsxElementToSvgString(node: t.JSXElement): string {
  const tag = readTagName(node.openingElement.name);
  const attrs = node.openingElement.attributes
    .map(serializeAttribute)
    .filter((s): s is string => s !== null);

  const opening = attrs.length === 0 ? `<${tag}>` : `<${tag} ${attrs.join(' ')}>`;
  const openingSelf = attrs.length === 0 ? `<${tag}/>` : `<${tag} ${attrs.join(' ')}/>`;

  if (node.openingElement.selfClosing) return openingSelf;

  const children = node.children
    .map(serializeChild)
    .filter((s): s is string => s !== null)
    .join('');

  return `${opening}${children}</${tag}>`;
}

function readTagName(name: t.JSXOpeningElement['name']): string {
  if (t.isJSXIdentifier(name)) return name.name;
  if (t.isJSXNamespacedName(name)) {
    return `${name.namespace.name}:${name.name.name}`;
  }
  throw new Error('JSXMemberExpression tag names are not statically serializable.');
}

function serializeAttribute(
  attr: t.JSXOpeningElement['attributes'][number],
): string | null {
  if (t.isJSXSpreadAttribute(attr)) {
    throw new Error('JSXSpreadAttribute is not statically serializable.');
  }

  const rawName = readAttrName(attr.name);
  if (rawName === 'opticalCenter') return null;

  const svgName = t.isJSXNamespacedName(attr.name)
    ? rawName
    : jsxAttrNameToSvg(rawName);

  if (attr.value === null) {
    // Boolean attribute (`<svg foo>`) — emit as `foo=""` so XML parsers don't
    // reject the output.
    return `${svgName}=""`;
  }

  if (t.isStringLiteral(attr.value)) {
    return `${svgName}="${escapeAttr(attr.value.value)}"`;
  }

  if (t.isJSXExpressionContainer(attr.value)) {
    const expr = attr.value.expression;
    if (t.isStringLiteral(expr)) {
      return `${svgName}="${escapeAttr(expr.value)}"`;
    }
    if (t.isNumericLiteral(expr)) {
      return `${svgName}="${expr.value}"`;
    }
    if (t.isBooleanLiteral(expr)) {
      return expr.value ? `${svgName}=""` : null;
    }
    throw new Error(`Non-literal attribute value for "${rawName}".`);
  }

  throw new Error(`Unsupported attribute value type for "${rawName}".`);
}

function readAttrName(
  name: t.JSXAttribute['name'],
): string {
  if (t.isJSXIdentifier(name)) return name.name;
  return `${name.namespace.name}:${name.name.name}`;
}

function serializeChild(child: t.JSXElement['children'][number]): string | null {
  if (t.isJSXElement(child)) return jsxElementToSvgString(child);
  if (t.isJSXText(child)) {
    if (child.value.trim() === '') return null;
    return escapeText(child.value);
  }
  if (t.isJSXExpressionContainer(child)) {
    throw new Error('JSXExpressionContainer in children — should have bailed out.');
  }
  if (t.isJSXFragment(child)) {
    throw new Error('JSXFragment children are not statically serializable.');
  }
  if (t.isJSXSpreadChild(child)) {
    throw new Error('JSXSpreadChild is not statically serializable.');
  }
  return null;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
