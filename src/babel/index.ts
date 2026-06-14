/**
 * Babel plugin entry — `optical-center/babel`.
 *
 * Usage (via host's babel.config / vite plugin):
 *
 *   import opticalCenter from 'optical-center/babel';
 *
 *   {
 *     plugins: [
 *       [opticalCenter, { emitMetadata: process.env.NODE_ENV !== 'production' }],
 *     ],
 *   }
 *
 * The plugin must run BEFORE the React JSX transform; in standalone Babel
 * that is automatic (plugins run before presets), and in Vite the
 * `optical-center/vite` plugin sets `enforce: 'pre'` to win the same race
 * against esbuild's own JSX transform.
 */

import type { PluginObj, PluginPass } from '@babel/core';

import { MAX_INPUT_BYTES } from '../core/constants.js';
import type { WarningCode } from '../core/warnings.js';

import { SyncTransformCache } from './sync-cache.js';
import { visitJsxElement, scanIconImports, EMPTY_ICON_IMPORTS } from './visitor.js';
import type { CachedTransform, IconImports, IconPackageResolver } from './visitor.js';

export interface BabelPluginOptions {
  /**
   * Add `data-optical-original-viewbox` and `data-optical-offset`
   * breadcrumb attributes for DevTools inspection. Default `false` —
   * keep production HTML lean. The Vite plugin opts in for `serve` mode.
   */
  readonly emitMetadata?: boolean;
  /**
   * Receive a record for every bail-out / clip detection. Defaults to
   * a console.warn shim; pass `null` to suppress entirely or your own
   * function to integrate with a build logger.
   */
  readonly onWarning?: ((warning: { code: WarningCode; location?: string }) => void) | null;
  /**
   * Hard upper bound on serialized JSX size (bytes). Anything larger
   * skips the pipeline with an `OPTICAL_RASTERIZE_FAILED` warning so a
   * pathological inline SVG can't blow the build. Default
   * `MAX_INPUT_BYTES` from constants.
   */
  readonly maxInputBytes?: number;
  /**
   * If `true`, emit a warning every time the visitor decides not to
   * transform an `<svg opticalCenter>` element (dynamic children, spread
   * props, etc.) instead of silently skipping. Default `true` —
   * surfacing these helps icon-set authors notice why their markup
   * isn't being rewritten.
   */
  readonly warnOnBailOut?: boolean;
  /**
   * Override the on-disk cache directory. By default the plugin shares
   * `node_modules/.cache/optical-center` with the CLI and Vite plugin
   * so a JSX-warmed entry is reusable from `optical-center transform`.
   */
  readonly cacheDir?: string;
  /**
   * Disable the per-plugin sync cache. Useful in tests or when an
   * outer orchestrator already deduplicates inputs. Default `false`.
   */
  readonly disableCache?: boolean;
  /**
   * Map of icon package names to a function that turns a PascalCase
   * import name into a bare SVG specifier resolvable from the project
   * root. Default covers `lucide-react` → `lucide-static/icons/<kebab>.svg`.
   * Used by the container-side directive when the icon is a JSX
   * component (rather than a hand-written `<svg>` subtree).
   */
  readonly iconPackages?: Readonly<Record<string, IconPackageResolver>>;
}

interface OpticalPluginState extends PluginPass {
  opticalIconImports?: IconImports;
}

export type { WarningCode };

export default function opticalCenterBabelPlugin(
  _api: unknown,
  options: BabelPluginOptions = {},
): PluginObj {
  const emitMetadata = options.emitMetadata === true;
  const warnOnBailOut = options.warnOnBailOut !== false;
  const maxInputBytes = options.maxInputBytes ?? MAX_INPUT_BYTES;
  const baseOnWarning =
    options.onWarning === null
      ? undefined
      : options.onWarning ?? defaultWarningHandler;
  const onWarning = baseOnWarning && warnOnBailOut ? baseOnWarning : undefined;
  const cache = options.disableCache === true
    ? undefined
    : new SyncTransformCache<CachedTransform>(
        options.cacheDir !== undefined ? { dir: options.cacheDir } : undefined,
      );

  const iconPackages = options.iconPackages;

  return {
    name: 'optical-center',
    visitor: {
      Program: {
        enter(path, state: OpticalPluginState) {
          // Build the per-file local-name → svg-path map once,
          // before any JSXElement visitor runs. The map is empty if
          // no tracked icon package is imported.
          state.opticalIconImports = iconPackages
            ? scanIconImports(path.node, state.filename, iconPackages)
            : scanIconImports(path.node, state.filename);
        },
      },
      JSXElement(path, state: OpticalPluginState) {
        const iconImports = state.opticalIconImports ?? EMPTY_ICON_IMPORTS;
        const visitorOptions = {
          emitMetadata,
          maxInputBytes,
          iconImports,
          ...(onWarning ? { onWarning } : {}),
          ...(cache ? { cache } : {}),
        };
        visitJsxElement(path, visitorOptions);
      },
    },
  };
}

function defaultWarningHandler(warning: { code: WarningCode; location?: string }): void {
  // eslint-disable-next-line no-console
  console.warn(
    `[optical-center] ${warning.code}${warning.location ? ` (${warning.location})` : ''}`,
  );
}
