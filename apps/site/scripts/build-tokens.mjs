#!/usr/bin/env node
/*
 * Generates src/styles/tokens.color.css from tokens.config.mjs using helmlab.
 * All colors flow through helmlab — palette/ensureContrast/contrastRatio.
 * Never edit the output file by hand.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Helmlab, VERSION as HELMLAB_VERSION } from "helmlab";

import { BRAND, NEUTRALS, CONTRAST_AA } from "../tokens.config.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, "../src/styles/tokens.color.css");

const hl = new Helmlab();

const accent = BRAND.accent.toLowerCase();
const accentTextLight = hl.ensureContrast(accent, NEUTRALS.light.bg, CONTRAST_AA).toLowerCase();
const accentTextDark = hl.ensureContrast(accent, NEUTRALS.dark.bg, CONTRAST_AA).toLowerCase();

const ratioBlack = hl.contrastRatio(accent, "#000000");
const ratioWhite = hl.contrastRatio(accent, "#ffffff");
const onAccent = ratioBlack >= ratioWhite ? "#000000" : "#ffffff";

const report = [
  `accent = ${accent}`,
  `accent on light bg → text ${accentTextLight}  (ratio ${hl.contrastRatio(accentTextLight, NEUTRALS.light.bg).toFixed(2)})`,
  `accent on dark  bg → text ${accentTextDark}  (ratio ${hl.contrastRatio(accentTextDark, NEUTRALS.dark.bg).toFixed(2)})`,
  `on-accent surface → ${onAccent}  (ratio ${(onAccent === "#000000" ? ratioBlack : ratioWhite).toFixed(2)})`,
];

const css = `/*
 * GENERATED FILE — do not edit by hand.
 * Source: tokens.config.mjs
 * Generator: scripts/build-tokens.mjs (helmlab v${HELMLAB_VERSION})
 *
 * ${report.join("\n * ")}
 */

:root {
  /* Brand */
  --color-accent: ${accent};
  --color-on-accent: ${onAccent};

  /* Accent as foreground text — auto-tuned per mode for WCAG AA (${CONTRAST_AA}:1) */
  --color-accent-text: ${accentTextLight};

  /* Off-neutrals — subtle warm cast, not pure b/w */
  --color-bg: ${NEUTRALS.light.bg.toLowerCase()};
  --color-fg: ${NEUTRALS.light.fg.toLowerCase()};

  color-scheme: light;
}

:root[data-theme="dark"] {
  --color-accent-text: ${accentTextDark};
  --color-bg: ${NEUTRALS.dark.bg.toLowerCase()};
  --color-fg: ${NEUTRALS.dark.fg.toLowerCase()};
  color-scheme: dark;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --color-accent-text: ${accentTextDark};
    --color-bg: ${NEUTRALS.dark.bg.toLowerCase()};
    --color-fg: ${NEUTRALS.dark.fg.toLowerCase()};
    color-scheme: dark;
  }
}
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, css, "utf8");

console.log(`✓ wrote ${outPath}`);
for (const line of report) console.log(`  · ${line}`);
