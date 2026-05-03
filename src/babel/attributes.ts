/**
 * JSX attribute name → SVG attribute name mapping.
 *
 * Three rules, in order:
 *
 *   1. Namespaced attributes (xlinkHref, xmlSpace, …) map to colon-separated
 *      forms (`xlink:href`, `xml:space`).
 *   2. SVG has a small set of attributes whose camelCase form is canonical
 *      (`viewBox`, `preserveAspectRatio`, `gradientUnits`, …) — those are
 *      preserved verbatim.
 *   3. Everything else is converted from camelCase to kebab-case
 *      (`strokeWidth` → `stroke-width`).
 *
 * The preserved-camelCase set is derived from the SVG 1.1 + 2 specs and
 * cross-referenced against `property-information`. Naive camel→kebab on
 * `viewBox` would produce `view-box`, which renderers don't recognize.
 */

const NAMESPACED: Record<string, string> = {
  xmlnsXlink: 'xmlns:xlink',
  xlinkActuate: 'xlink:actuate',
  xlinkArcrole: 'xlink:arcrole',
  xlinkHref: 'xlink:href',
  xlinkRole: 'xlink:role',
  xlinkShow: 'xlink:show',
  xlinkTitle: 'xlink:title',
  xlinkType: 'xlink:type',
  xmlBase: 'xml:base',
  xmlLang: 'xml:lang',
  xmlSpace: 'xml:space',
};

const PRESERVED_CAMEL = new Set<string>([
  'allowReorder',
  'attributeName',
  'attributeType',
  'autoReverse',
  'baseFrequency',
  'baseProfile',
  'calcMode',
  'clipPathUnits',
  'contentScriptType',
  'contentStyleType',
  'diffuseConstant',
  'edgeMode',
  'externalResourcesRequired',
  'filterRes',
  'filterUnits',
  'glyphRef',
  'gradientTransform',
  'gradientUnits',
  'kernelMatrix',
  'kernelUnitLength',
  'keyPoints',
  'keySplines',
  'keyTimes',
  'lengthAdjust',
  'limitingConeAngle',
  'markerHeight',
  'markerUnits',
  'markerWidth',
  'maskContentUnits',
  'maskUnits',
  'numOctaves',
  'pathLength',
  'patternContentUnits',
  'patternTransform',
  'patternUnits',
  'pointsAtX',
  'pointsAtY',
  'pointsAtZ',
  'preserveAlpha',
  'preserveAspectRatio',
  'primitiveUnits',
  'refX',
  'refY',
  'repeatCount',
  'repeatDur',
  'requiredExtensions',
  'requiredFeatures',
  'specularConstant',
  'specularExponent',
  'spreadMethod',
  'startOffset',
  'stdDeviation',
  'stitchTiles',
  'surfaceScale',
  'systemLanguage',
  'tableValues',
  'targetX',
  'targetY',
  'textLength',
  'viewBox',
  'viewTarget',
  'xChannelSelector',
  'yChannelSelector',
  'zoomAndPan',
]);

/** Convert a JSX attribute name (camelCase or namespaced) to its SVG form. */
export function jsxAttrNameToSvg(jsxName: string): string {
  const ns = NAMESPACED[jsxName];
  if (ns !== undefined) return ns;
  if (PRESERVED_CAMEL.has(jsxName)) return jsxName;
  return jsxName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}
