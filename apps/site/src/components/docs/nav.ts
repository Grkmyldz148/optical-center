/*
 * Sidebar nav data — single source of truth for the docs sidebar and the
 * prev/next pager. Adding a page means adding one entry here; every other
 * docs component reads from this list and stays in sync automatically.
 *
 * Structure mirrors the mental model: install once; most icon libraries
 * are corrected automatically (Your icons); reach for a container-side
 * pattern when you want explicit control; drop down to lower-level
 * reference material if you need it.
 */

export type DocsPage = {
  label: string;
  href: string;
};

export type DocsGroup = {
  title: string;
  pages: readonly DocsPage[];
};

export const SIDEBAR: readonly DocsGroup[] = [
  {
    title: "Get started",
    pages: [
      { label: "Overview", href: "/docs" },
      { label: "Install", href: "/docs/install" },
    ],
  },
  {
    title: "Your icons",
    pages: [
      { label: "Any icon library", href: "/docs/icons" },
    ],
  },
  {
    title: "Patterns",
    pages: [
      { label: "CSS class", href: "/docs/patterns/css-class" },
      { label: "Tailwind utility", href: "/docs/patterns/tailwind" },
      { label: "JSX attribute", href: "/docs/patterns/jsx-attribute" },
      { label: "Inline SVG", href: "/docs/patterns/inline-svg" },
      { label: "CSS mask-image", href: "/docs/patterns/css-mask" },
    ],
  },
  {
    title: "Reference",
    pages: [
      { label: "CLI", href: "/docs/cli" },
      { label: "Programmatic API", href: "/docs/api" },
      { label: "Warning codes", href: "/docs/warnings" },
    ],
  },
];

/* Flat list — used by the prev/next pager to walk through pages in
   sidebar order. Each entry remembers its enclosing group so the pager
   can show "← Install · Get started" style context. */
export type FlatPage = DocsPage & { group: string };

export const FLAT_PAGES: readonly FlatPage[] = SIDEBAR.flatMap((g) =>
  g.pages.map((p) => ({ ...p, group: g.title })),
);

/* Find the prev/next page relative to a given href. Returns nulls at the
   edges so the pager can render only what exists. */
export function adjacent(href: string): {
  prev: FlatPage | null;
  next: FlatPage | null;
} {
  const i = FLAT_PAGES.findIndex((p) => p.href === href);
  if (i === -1) return { prev: null, next: null };
  return {
    prev: i > 0 ? FLAT_PAGES[i - 1] : null,
    next: i < FLAT_PAGES.length - 1 ? FLAT_PAGES[i + 1] : null,
  };
}

/* Resolve the breadcrumb trail (Docs › Group › Page) for a given href.
   Returns just the trailing crumbs after "Docs" so the layout can prepend
   the root crumb without duplicating it. */
export function breadcrumb(href: string): { group: string; page: string } | null {
  const p = FLAT_PAGES.find((p) => p.href === href);
  if (!p) return null;
  return { group: p.group, page: p.label };
}
