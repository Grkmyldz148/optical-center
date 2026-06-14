/**
 * Build-time JSX scanner that powers the container-side
 * `optical-center: auto` directive for runtime icon component
 * libraries.
 *
 * The user-facing API the scanner enables:
 *
 *   // anywhere in the source tree
 *   <div className="badge">
 *     <Play />
 *   </div>
 *
 *   // any CSS file
 *   .badge { optical-center: auto; }      ← container, not icon
 *
 * No file path lives in the CSS. The scanner walks every `.jsx`/`.tsx`
 * under the project root, finds JSX elements whose tag name was
 * imported from a known icon package, then records every ancestor
 * JSX element's `className` token as a container that wraps that
 * icon. The icon's own `className` (if any) is recorded too — so
 * a user who tags the icon directly with the directive class still
 * gets a hit, but the canonical usage is container-side.
 *
 * The PostCSS plugin queries the resulting map by selector class
 * tokens. A match means: "this rule's element wraps an icon that
 * needs optical centering." The plugin then emits a centering block
 * on the rule and a generated `${selector} > *` sibling rule with
 * the icon's `translate`.
 *
 * Out of scope for now (handled as "skip silently"):
 *   - dynamic className (`{cn('a', 'b')}`)
 *   - re-exported icon components (`my-ds/icons` that wraps lucide)
 *   - aliased default imports (only named imports are tracked)
 *
 * Caching: each project root is scanned at most once per Node process.
 * Concurrent CSS files share the same in-flight promise.
 */

import { parse } from '@babel/parser';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import type {
  File,
  JSXAttribute,
  JSXOpeningElement,
  Node,
} from '@babel/types';

/**
 * A JSXElement node, narrowed inline so we avoid pulling another
 * named import just to read `openingElement` / `children`.
 */
type JsxElementNode = Node & {
  type: 'JSXElement';
  openingElement: JSXOpeningElement;
  children: Node[];
};

type JsxFragmentNode = Node & {
  type: 'JSXFragment';
  children: Node[];
};

/**
 * Map a kebab-case-friendly icon-component name (`BowArrow`) to a bare
 * specifier resolvable via Node's module resolution. The result is then
 * resolved to an absolute path against the project root.
 */
export type PackageResolver = (componentName: string) => string;

const DEFAULT_PACKAGES: Readonly<Record<string, PackageResolver>> = {
  'lucide-react': (name) => `lucide-static/icons/${pascalToKebab(name)}.svg`,
};

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  '.next',
  '.git',
  '.vite',
  'coverage',
]);

const JSX_FILE = /\.[jt]sx$/;

export interface ScanResult {
  /** Class token → absolute SVG file path. First-wins on collision. */
  readonly classToSvg: ReadonlyMap<string, string>;
}

const cache = new Map<string, Promise<ScanResult>>();

export function scanProject(
  projectRoot: string,
  packages: Readonly<Record<string, PackageResolver>> = DEFAULT_PACKAGES,
): Promise<ScanResult> {
  // Cache keyed by root + resolver identity so callers can override
  // the package map without colliding with the default scan.
  const cacheKey = `${projectRoot}\0${Object.keys(packages).sort().join(',')}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;
  const promise = doScan(projectRoot, packages);
  cache.set(cacheKey, promise);
  return promise;
}

/** Test seam: drop everything we have memoized. */
export function clearScanCache(): void {
  cache.clear();
}

async function doScan(
  projectRoot: string,
  packages: Readonly<Record<string, PackageResolver>>,
): Promise<ScanResult> {
  const classToSvg = new Map<string, string>();
  const req = createRequire(join(projectRoot, '_optical_center_resolver'));
  const resolveSvg = (specifier: string): string | null => {
    try {
      return req.resolve(specifier);
    } catch {
      return null;
    }
  };

  for await (const file of walkFiles(projectRoot)) {
    if (!JSX_FILE.test(file)) continue;
    let code: string;
    try {
      code = await readFile(file, 'utf8');
    } catch {
      continue;
    }
    if (!code.includes('lucide-react') && !hasAnyPackage(code, packages)) {
      // Fast-path skip: parsing every JSX file is wasteful when the
      // overwhelming majority don't reference any tracked package.
      continue;
    }
    let ast: File;
    try {
      ast = parse(code, {
        sourceType: 'module',
        errorRecovery: true,
        plugins: file.endsWith('.tsx') ? ['jsx', 'typescript'] : ['jsx'],
      });
    } catch {
      continue;
    }

    const localToSvgPath = new Map<string, string>();
    for (const stmt of ast.program.body) {
      if (stmt.type !== 'ImportDeclaration') continue;
      const resolver = packages[stmt.source.value];
      if (!resolver) continue;
      for (const spec of stmt.specifiers) {
        if (spec.type !== 'ImportSpecifier') continue;
        const importedName =
          spec.imported.type === 'Identifier'
            ? spec.imported.name
            : spec.imported.value;
        if (!isPascalCase(importedName)) continue;
        const svgSpecifier = resolver(importedName);
        const absolute = resolveSvg(svgSpecifier);
        if (!absolute) continue;
        localToSvgPath.set(spec.local.name, absolute);
      }
    }

    if (localToSvgPath.size === 0) continue;

    walkJsxWithAncestors(ast.program, [], (opening, ancestorClasses) => {
      if (opening.name.type !== 'JSXIdentifier') return;
      const localName = opening.name.name;
      const svgPath = localToSvgPath.get(localName);
      if (!svgPath) return;

      // Container-side only: every JSX ancestor that has a className
      // is a valid target for `.container { optical-center: auto }`.
      // The icon's own className is intentionally NOT recorded —
      // the directive belongs on the wrapper, mirroring how
      // `justify-content: center` belongs on the flex container, not
      // on the centered child.
      for (const cls of ancestorClasses) {
        if (!classToSvg.has(cls)) classToSvg.set(cls, svgPath);
      }
    });
  }

  return { classToSvg };
}

async function* walkFiles(dir: string): AsyncIterable<string> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.') continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

/**
 * Walk the AST and call `visit` on every JSXOpeningElement with the
 * list of JSX className tokens collected from its JSX ancestors.
 *
 * "Ancestor" here means JSX ancestor, not AST ancestor — only
 * JSXElement nodes contribute their className. Non-JSX nodes (the
 * surrounding function bodies, expressions, etc.) are traversed
 * transparently without resetting or extending the ancestor list.
 */
function walkJsxWithAncestors(
  start: Node,
  initialAncestors: ReadonlyArray<string>,
  visit: (opening: JSXOpeningElement, ancestorClasses: ReadonlyArray<string>) => void,
): void {
  const walk = (node: Node, ancestors: ReadonlyArray<string>): void => {
    if (isJsxElement(node)) {
      visit(node.openingElement, ancestors);

      // Recurse into attribute values too — a JSX expression like
      // `<Row optical={<div><Play /></div>} />` puts a complete JSX
      // subtree on a prop. The classes inside that subtree are real
      // ancestors of the icon at runtime, but only WITHIN that
      // subtree. We do not extend the outer chain into it, because
      // we can't know how the receiving component places the prop.
      for (const attr of node.openingElement.attributes) {
        if (attr.type === 'JSXAttribute' && attr.value) {
          walk(attr.value, []);
        } else if (attr.type === 'JSXSpreadAttribute') {
          walk(attr.argument, []);
        }
      }

      const own = readClassNames(node.openingElement);
      const childAncestors = own.length > 0 ? [...ancestors, ...own] : ancestors;
      for (const child of node.children) walk(child, childAncestors);
      return;
    }
    if (isJsxFragment(node)) {
      for (const child of node.children) walk(child, ancestors);
      return;
    }
    // Non-JSX node: traverse children generically, keeping ancestors as-is.
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'range' || key === 'leadingComments')
        continue;
      const child = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          if (isNode(item)) walk(item, ancestors);
        }
      } else if (isNode(child)) {
        walk(child, ancestors);
      }
    }
  };

  walk(start, initialAncestors);
}

function isJsxElement(node: Node): node is JsxElementNode {
  return node.type === 'JSXElement';
}

function isJsxFragment(node: Node): node is JsxFragmentNode {
  return node.type === 'JSXFragment';
}

/** Read the static className tokens from a JSXOpeningElement. */
function readClassNames(opening: JSXOpeningElement): ReadonlyArray<string> {
  const out: string[] = [];
  for (const attr of opening.attributes) {
    if (attr.type !== 'JSXAttribute') continue;
    if (attr.name.type !== 'JSXIdentifier') continue;
    if (attr.name.name !== 'className') continue;
    const value = attr.value;
    if (!value) continue;
    const literal = readStringAttribute(value);
    if (literal === null) continue;
    for (const cls of literal.split(/\s+/)) {
      if (cls) out.push(cls);
    }
  }
  return out;
}

function isNode(value: unknown): value is Node {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

/**
 * Return the literal string for a JSX className value if and only if
 * it's statically resolvable. `className="x y"` returns `"x y"`;
 * `className={'x'}` returns `"x"`; anything dynamic returns null.
 */
function readStringAttribute(
  value: NonNullable<JSXAttribute['value']>,
): string | null {
  if (value.type === 'StringLiteral') return value.value;
  if (value.type === 'JSXExpressionContainer') {
    const expr = value.expression;
    if (expr.type === 'StringLiteral') return expr.value;
    if (
      expr.type === 'TemplateLiteral' &&
      expr.expressions.length === 0 &&
      expr.quasis.length === 1
    ) {
      return expr.quasis[0]!.value.cooked ?? null;
    }
  }
  return null;
}

function pascalToKebab(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

function isPascalCase(name: string): boolean {
  return /^[A-Z]/.test(name);
}

function hasAnyPackage(
  code: string,
  packages: Readonly<Record<string, PackageResolver>>,
): boolean {
  for (const pkg of Object.keys(packages)) {
    if (code.includes(pkg)) return true;
  }
  return false;
}
