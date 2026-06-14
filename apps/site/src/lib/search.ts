/*
 * Search index — the single source the ⌘K command palette filters over.
 *
 * Composed from three places so the palette never drifts from the site:
 *   1. Docs pages       → reuse FLAT_PAGES (components/docs/nav.ts). Adding a
 *                         page there automatically gives it a palette row.
 *   2. In-page sections → SECTIONS, keyed by page href. These mirror each
 *                         page's `toc` array so deep headings are findable
 *                         and jump straight to the right anchor. When a page's
 *                         headings change, update its entry here too.
 *   3. Landing sections → LANDING, the same anchors the header nav links to.
 *
 * Everything flattens into SEARCH_ENTRIES, which Search.astro serialises to
 * JSON and filters client-side. No build step, no dependency.
 */
import { FLAT_PAGES } from "../components/docs/nav";

export type SearchKind = "page" | "heading" | "landing";

export type SearchEntry = {
  /** Primary text, shown on the left of the row (and what we highlight). */
  title: string;
  /** Destination — may carry a #hash to land on a specific section. */
  href: string;
  /** Muted context shown on the right: the group, or the parent page. */
  context: string;
  kind: SearchKind;
  /** Extra match terms that never render — synonyms, command names, codes. */
  keywords?: string;
};

/* Headings worth finding on their own, keyed by page href. Mirrors each
   docs page's `toc`; kept here (not auto-extracted) so the palette author
   decides exactly what's individually searchable. */
type Section = { id: string; label: string };

const SECTIONS: Record<string, readonly Section[]> = {
  "/docs": [
    { id: "two-layers", label: "Two layers" },
    { id: "the-rule", label: "The rule" },
    { id: "two-surfaces", label: "Two surfaces, one declaration" },
    { id: "patterns", label: "The five patterns" },
    { id: "status", label: "Status" },
  ],
  "/docs/install": [
    { id: "package", label: "Package" },
    { id: "subpaths", label: "Subpath imports" },
    { id: "wire", label: "Wire it up" },
    { id: "wire-vite", label: "Vite" },
    { id: "wire-astro", label: "Astro" },
    { id: "wire-postcss", label: "PostCSS (standalone)" },
    { id: "wire-tailwind", label: "Tailwind" },
    { id: "next", label: "Next" },
  ],
  "/docs/icons": [
    { id: "promise", label: "One plugin, every icon" },
    { id: "rule", label: "The one rule" },
    { id: "matrix", label: "Compatibility at a glance" },
    { id: "iconify", label: "Iconify" },
    { id: "svg-files", label: "Local SVG files" },
    { id: "own", label: "Your own icon data" },
    { id: "unplugin", label: "unplugin-icons" },
    { id: "components", label: "Icon component libraries" },
    { id: "runtime", label: "Runtime & remote icons" },
    { id: "control", label: "Opt out & control" },
  ],
  "/docs/cli": [
    { id: "commands", label: "Commands" },
    { id: "transform", label: "transform" },
    { id: "info", label: "info" },
    { id: "analyze", label: "analyze" },
    { id: "clear-cache", label: "clear-cache" },
    { id: "flags", label: "Common flags" },
    { id: "exit-codes", label: "Exit codes" },
    { id: "json-output", label: "JSON output" },
  ],
  "/docs/api": [
    { id: "core", label: "Browser-safe core" },
    { id: "node", label: "Node helpers" },
    { id: "end-to-end", label: "End-to-end example" },
    { id: "types", label: "Types" },
  ],
  "/docs/warnings": [
    { id: "codes", label: "Codes" },
    { id: "handling", label: "Handling warnings" },
  ],
  "/docs/patterns/css-class": [
    { id: "how", label: "How to write it" },
    { id: "emitted", label: "What gets emitted" },
    { id: "requirements", label: "Requirements" },
  ],
  "/docs/patterns/tailwind": [
    { id: "setup", label: "Setup" },
    { id: "how", label: "How to write it" },
    { id: "order", label: "Plugin order matters" },
  ],
  "/docs/patterns/jsx-attribute": [
    { id: "how", label: "How to write it" },
    { id: "shape", label: "Accepted shapes" },
    { id: "limits", label: "Limits" },
  ],
  "/docs/patterns/inline-svg": [
    { id: "how", label: "How to write it" },
    { id: "html", label: "Plain HTML works too" },
    { id: "static", label: "The static-subtree rule" },
  ],
  "/docs/patterns/css-mask": [
    { id: "how", label: "How to write it" },
    { id: "resolution", label: "URL resolution" },
    { id: "centering", label: "Centering is the consumer's job" },
  ],
};

/* Per-page synonyms so a query lands on the right page even when the user's
   word isn't in the title (e.g. "lucide" → Any icon library). */
const KEYWORDS: Record<string, string> = {
  "/docs": "overview getting started introduction",
  "/docs/install": "setup npm pnpm yarn package vite astro postcss tailwind next",
  "/docs/icons": "iconify unplugin-icons lucide heroicons svg react component library remote",
  "/docs/cli": "command line binary terminal batch transform analyze cache json ci",
  "/docs/api": "programmatic resolveOffset node engine adapter script types",
  "/docs/warnings": "OC codes strict errors logs diagnostics",
  "/docs/patterns/css-class": "class selector wrapper container",
  "/docs/patterns/tailwind": "utility class plugin component",
  "/docs/patterns/jsx-attribute": "babel react inline directive attribute",
  "/docs/patterns/inline-svg": "babel viewbox compile static",
  "/docs/patterns/css-mask": "mask-image data uri currentColor recolor",
};

/* Landing-page sections — the same anchors the header nav points at. */
const LANDING: readonly SearchEntry[] = [
  { title: "Problem", href: "/#problem", context: "Landing", kind: "landing", keywords: "geometric center misalignment" },
  { title: "Science", href: "/#science", context: "Landing", kind: "landing", keywords: "perception optical illusion centroid" },
  { title: "Research", href: "/#research", context: "Landing", kind: "landing", keywords: "study perceptual validation phases" },
  { title: "Proposal", href: "/#proposal", context: "Landing", kind: "landing", keywords: "approach solution" },
];

/* Flattened, in display order: docs pages, their headings, then landing.
   Empty-query default shows pages + landing (headings only surface once the
   user types) — see Search.astro. */
export const SEARCH_ENTRIES: readonly SearchEntry[] = [
  ...FLAT_PAGES.map(
    (p): SearchEntry => ({
      title: p.label,
      href: p.href,
      context: p.group,
      kind: "page",
      keywords: KEYWORDS[p.href],
    }),
  ),
  ...FLAT_PAGES.flatMap((p) =>
    (SECTIONS[p.href] ?? []).map(
      (s): SearchEntry => ({
        title: s.label,
        href: `${p.href}#${s.id}`,
        context: p.label,
        kind: "heading",
      }),
    ),
  ),
  ...LANDING,
];
