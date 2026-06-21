#!/usr/bin/env node
/**
 * Compare v2 (current production) vs v3 (audit-fit) model outputs over the 1000-icon catalog.
 * Outputs: distribution of magnitude diffs, top icons where v3 differs most.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { computeOffsetV2 } from '/Volumes/harici_ssd/optical-center-model/dist/model/compute-offset.js';
import { CORRECTION_SCALE } from '/Volumes/harici_ssd/optical-center-model/dist/model/final-model.js';

const RASTER = 120;
const V3 = JSON.parse(readFileSync('/Volumes/harici_ssd/optical-center/analysis/v3-params.json', 'utf-8')).params;
const v3 = {
  edgeW: V3.blend.edgeWeight,
  hullW: V3.blend.hullWeight,
  symW:  V3.blend.symmetryWeight,
  scaleX: V3.scale.scaleX,
  scaleY: V3.scale.scaleY,
  globalDx: V3.globalOffset.globalDx,
  globalDy: V3.globalOffset.globalDy,
};

const SETS = '/Volumes/harici_ssd/optical-center/icons/sets/raw';
const sources = readdirSync(SETS).filter(d => !d.startsWith('.') && !d.startsWith('_'));
const results = [];

for (const src of sources) {
  const dir = join(SETS, src);
  const files = readdirSync(dir).filter(f => f.endsWith('.svg'));
  for (const f of files) {
    const iconId = `${src}/${f.replace('.svg','')}`;
    try {
      const svg = readFileSync(join(dir, f), 'utf-8').replace(/currentColor/g, '#000000');
      const r = new Resvg(svg, { fitTo: { mode: 'width', value: RASTER }, background: 'rgba(0,0,0,0)' });
      const rendered = r.render();
      const img = { data: new Uint8ClampedArray(rendered.pixels), width: rendered.width, height: rendered.height };
      // v2 (current production): defaults + CORRECTION_SCALE
      const v2raw = computeOffsetV2(img);
      const v2_dx = v2raw.dx * CORRECTION_SCALE;
      const v2_dy = v2raw.dy * CORRECTION_SCALE;
      // v3: refit blend + per-axis scale + global offset
      const v3raw = computeOffsetV2(img, { edgeWeight: v3.edgeW, hullWeight: v3.hullW, symmetryWeight: v3.symW });
      const v3_dx = v3raw.dx * v3.scaleX + v3.globalDx;
      const v3_dy = v3raw.dy * v3.scaleY + v3.globalDy;
      const diff = Math.hypot(v3_dx - v2_dx, v3_dy - v2_dy);
      results.push({ iconId, v2: { dx: v2_dx, dy: v2_dy, mag: Math.hypot(v2_dx, v2_dy) }, v3: { dx: v3_dx, dy: v3_dy, mag: Math.hypot(v3_dx, v3_dy) }, diff });
    } catch {}
  }
}

console.log(`Compared ${results.length} icons.`);
console.log();

// Magnitude distribution
const v2mags = results.map(r => r.v2.mag);
const v3mags = results.map(r => r.v3.mag);
const diffs = results.map(r => r.diff);
const mean = arr => arr.reduce((a,b) => a+b, 0) / arr.length;
const std = arr => { const m = mean(arr); return Math.sqrt(arr.reduce((s,v) => s + (v-m)**2, 0) / arr.length); };
console.log(`v2 magnitude:  mean=${mean(v2mags).toFixed(2)}  max=${Math.max(...v2mags).toFixed(2)}`);
console.log(`v3 magnitude:  mean=${mean(v3mags).toFixed(2)}  max=${Math.max(...v3mags).toFixed(2)}`);
console.log(`pairwise diff: mean=${mean(diffs).toFixed(2)}  max=${Math.max(...diffs).toFixed(2)}`);
console.log();

// Distribution of differences
const buckets = [0, 0.5, 1, 2, 3, 5, 8, 12];
console.log('Pairwise v3-vs-v2 distance distribution:');
for (let i = 0; i < buckets.length; i++) {
  const lo = buckets[i], hi = i+1 < buckets.length ? buckets[i+1] : Infinity;
  const count = diffs.filter(d => d >= lo && d < hi).length;
  const pct = (count / diffs.length * 100).toFixed(1);
  console.log(`  [${lo.toString().padEnd(2)}, ${hi === Infinity ? '∞' : hi.toString().padEnd(2)}): ${count.toString().padStart(4)} (${pct}%)`);
}
console.log();

// Top 15 most-shifted (v3 vs v2)
results.sort((a, b) => b.diff - a.diff);
console.log('Top 15 most-shifted (v3 changes the offset by this much):');
console.log(`  ${'icon'.padEnd(45)}  ${'v2 (dx,dy)'.padStart(16)}  ${'v3 (dx,dy)'.padStart(16)}  ${'shift'.padStart(7)}`);
for (const r of results.slice(0, 15)) {
  const v2s = `(${r.v2.dx.toFixed(1)},${r.v2.dy.toFixed(1)})`;
  const v3s = `(${r.v3.dx.toFixed(1)},${r.v3.dy.toFixed(1)})`;
  console.log(`  ${r.iconId.padEnd(45)}  ${v2s.padStart(16)}  ${v3s.padStart(16)}  ${r.diff.toFixed(2).padStart(7)}`);
}

// What about the 'trivially centered' ones (mathematically perfect): v2 says ~0, v3 should also say ~0 if pseudoneglect compensation is small enough
const trivial_test_ids = ['bootstrap-icons/arrows-fullscreen', 'bootstrap-icons/border-all', 'heroicons-outline/bars-3', 'feather/divide', 'feather/globe', 'feather/x', 'bootstrap-icons/0-circle-fill', 'lucide/cross'];
console.log();
console.log('Trivially-centered icons (v2 was ~0; v3 effect?):');
for (const id of trivial_test_ids) {
  const r = results.find(r => r.iconId === id);
  if (r) {
    console.log(`  ${id.padEnd(40)}  v2=(${r.v2.dx.toFixed(2)},${r.v2.dy.toFixed(2)})  v3=(${r.v3.dx.toFixed(2)},${r.v3.dy.toFixed(2)})`);
  }
}

writeFileSync('/Volumes/harici_ssd/optical-center-model/tools/v3-catalog-diff.json', JSON.stringify({
  n_icons: results.length,
  v3_params: v3,
  stats: {
    v2_mean: +mean(v2mags).toFixed(3), v2_max: +Math.max(...v2mags).toFixed(3),
    v3_mean: +mean(v3mags).toFixed(3), v3_max: +Math.max(...v3mags).toFixed(3),
    diff_mean: +mean(diffs).toFixed(3), diff_max: +Math.max(...diffs).toFixed(3),
  },
  icons: results,
}, null, 2));
console.log();
console.log('Full diff saved → tools/v3-catalog-diff.json');
