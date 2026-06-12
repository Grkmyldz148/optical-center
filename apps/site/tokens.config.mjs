/*
 * Single source of truth for brand color inputs.
 * All CSS color tokens are derived from these via helmlab — never hand-edit
 * `src/styles/tokens.color.css`. Re-run `npm run tokens:build` to regenerate.
 */

export const BRAND = {
  accent: "#E8734A",
};

/*
 * Off-neutrals — subtle warm cast that harmonizes with the orange accent
 * without going beige. We deliberately step away from pure #FFF/#000 so
 * hairlines and surfaces don't read like CAD blueprints.
 */
export const NEUTRALS = {
  light: { bg: "#F8F7F4", fg: "#16130F" },
  dark: { bg: "#0E0C0A", fg: "#EAE8E3" },
};

/** Minimum WCAG contrast ratio when accent is used as foreground text. */
export const CONTRAST_AA = 4.5;
