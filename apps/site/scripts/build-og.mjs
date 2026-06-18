/*
 * build-og.mjs — generate the static social/share assets from brand SVG.
 *
 * Renders, with @resvg/resvg-js (already a workspace dependency, so no extra
 * install): the 1200×630 Open Graph / Twitter card (well under social
 * platforms' size caps — ~125 kB), the apple-touch-icon, and the PWA manifest
 * icons. Output lands in public/ and is committed, so the build itself never
 * rasterizes — run this only when the brand art or copy changes:
 *
 *   node scripts/build-og.mjs   (or: npm run og:build)
 *
 * Deliberately NOT wired into prebuild: text rendering depends on system fonts
 * (Geist / Helvetica Neue), which Cloudflare Pages' Linux build image lacks —
 * regenerating there would ship an OG card with tofu/blank text. Run it on a
 * machine with the brand fonts and commit the PNGs.
 *
 * The composition mirrors the hero: a measured canvas where the play glyph's
 * optical center (the accent dot) lands on the geometric crosshair, next to the
 * one-line claim and the drop-in declaration.
 */
import { Resvg } from "@resvg/resvg-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = resolve(ROOT, "public");

// ── Brand palette (mirrors tokens.config.mjs, dark surface) ────────────────
const BG = "#0E0C0A";
const FG = "#EAE8E3";
const MUTED = "#9C978D";
const ACCENT = "#E8734A";
const LINE = "rgba(234,232,227,0.12)";

const SANS = "'Geist','Helvetica Neue','Inter',Arial,sans-serif";
const MONO = "'Geist Mono','SF Mono','JetBrains Mono',ui-monospace,monospace";

// ── The play mark, optically centered (matches favicon.svg) ────────────────
// Geometry from the shipped model: the glyph's optical center sits at
// (11.66, 11.38) in the 24-unit icon box, marked by the accent dot.
const ICON_PATH = "M8 5v14l11-7z";
const ICON_OC = { x: 11.66, y: 11.38 };

function playMark({ cx, cy, scale, withDot = true, fg = FG, dot = ACCENT }) {
  // Place the group so the glyph's optical center lands on (cx, cy).
  const tx = cx - ICON_OC.x * scale;
  const ty = cy - ICON_OC.y * scale;
  return `
    <g transform="translate(${tx} ${ty}) scale(${scale})">
      <path d="${ICON_PATH}" fill="${fg}"/>
      ${withDot ? `<circle cx="${ICON_OC.x}" cy="${ICON_OC.y}" r="1.4" fill="${dot}"/>` : ""}
    </g>`;
}

// ── 1200×630 Open Graph / Twitter card ─────────────────────────────────────
// Deliberately minimal — at thumbnail size only one idea can land, so it's the
// glyph (with the accent dot marking its optical center) + the one-line hook +
// the wordmark. No chips, no code, no measure grid.
function ogSvg() {
  const W = 1200;
  const H = 630;
  const cx = W / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="none" stroke="${LINE}"/>

  <!-- The mark: play glyph, accent dot on its optical center -->
  ${playMark({ cx, cy: 212, scale: 11 })}

  <!-- The hook -->
  <text x="${cx}" y="372" text-anchor="middle" font-family="${SANS}" font-size="60" font-weight="500" fill="${MUTED}" letter-spacing="-1.8">Math centers your icon.</text>
  <text x="${cx}" y="444" text-anchor="middle" font-family="${SANS}" font-size="60" font-weight="600" fill="${FG}" letter-spacing="-1.8">Your eye <tspan fill="${ACCENT}">disagrees.</tspan></text>

  <!-- Wordmark + url -->
  <text x="${cx}" y="552" text-anchor="middle" font-family="${MONO}" font-size="22" letter-spacing="0.5" fill="${MUTED}">Optical Center<tspan fill="${LINE}">  ·  </tspan>opticalcenter.dev</text>
</svg>`;
}

// ── Square brand icon (apple-touch + PWA) ──────────────────────────────────
function iconSvg(size, { rounded = false } = {}) {
  // 24-unit icon box with breathing room; glyph optically centered.
  const r = rounded ? size * 0.22 : 0;
  const scale = size / 24;
  const cx = 12 * scale;
  const cy = 12 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="${BG}"/>
  ${playMark({ cx, cy, scale: scale * 0.62, fg: FG, dot: ACCENT })}
</svg>`;
}

function render(svg, width) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { loadSystemFonts: true, defaultFontFamily: "Helvetica Neue" },
    background: "rgba(0,0,0,0)",
  });
  return resvg.render().asPng();
}

function write(name, buf) {
  const out = resolve(PUBLIC, name);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buf);
  console.log(`  ✓ ${name}  (${(buf.length / 1024).toFixed(1)} kB)`);
}

console.log("Building share assets →");
write("og.png", render(ogSvg(), 1200));
write("apple-touch-icon.png", render(iconSvg(180, { rounded: false }), 180));
write("icon-192.png", render(iconSvg(192, { rounded: true }), 192));
write("icon-512.png", render(iconSvg(512, { rounded: true }), 512));
console.log("Done.");
