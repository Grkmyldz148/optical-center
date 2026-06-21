#!/usr/bin/env node
/**
 * v3 model evaluation harness.
 *
 * Loads Phase 3 bias-corrected ground truth, rasterizes the 20 Phase 3 icons,
 * runs computeOffsetV2 with any (edgeWeight, hullWeight, symmetryWeight)
 * triple, multiplies by CORRECTION_SCALE, and reports RMSE vs ground truth.
 *
 * Exports:
 *   evaluate({ edgeW, hullW, symW, scale, ... }) → { rmse, perIcon }
 *
 * Used by v3-fit-blend.mjs (grid search) and v3-baseline.mjs (current model).
 */
import { readFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { computeOffsetV2 } from '/Volumes/harici_ssd/optical-center-model/dist/model/compute-offset.js';
import { CORRECTION_SCALE } from '/Volumes/harici_ssd/optical-center-model/dist/model/final-model.js';

const RASTER_SIZE = 120;

// Resolve icon file path from the canonical set
function iconPath(iconId) {
  const [source, name] = iconId.split('/');
  return `/Volumes/harici_ssd/optical-center/icons/sets/raw/${source}/${name}.svg`;
}

// Rasterize once and cache
const _rasterCache = new Map();
function rasterize(iconId) {
  if (_rasterCache.has(iconId)) return _rasterCache.get(iconId);
  const path = iconPath(iconId);
  const svg = readFileSync(path, 'utf-8').replace(/currentColor/g, '#000000');
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: RASTER_SIZE },
    background: 'rgba(0, 0, 0, 0)',
  });
  const rendered = r.render();
  const data = {
    data: new Uint8ClampedArray(rendered.pixels),
    width: rendered.width,
    height: rendered.height,
  };
  _rasterCache.set(iconId, data);
  return data;
}

function loadGT() {
  return JSON.parse(readFileSync('/Volumes/harici_ssd/optical-center-model/tools/phase3-ground-truth.json', 'utf-8'));
}

/**
 * Evaluate a parameter set against Phase 3 bias-corrected ground truth.
 *
 * @param opts.edgeW          Edge centroid weight in blend (default 0.40)
 * @param opts.hullW          Hull centroid weight in blend (default 0.30)
 * @param opts.symW           Symmetry-axis centroid weight in blend (default 0.30)
 * @param opts.scale          Global scale applied AFTER V2 raw (default 0.745)
 * @param opts.scaleX         Per-axis scale for dx (overrides scale)
 * @param opts.scaleY         Per-axis scale for dy (overrides scale)
 * @param opts.target         'bias_corrected' (default) or 'observed' — which GT to compare to
 *
 * @returns { rmse, mae, perIcon: [...] }
 */
export function evaluate(opts = {}) {
  const edgeW  = opts.edgeW ?? 0.40;
  const hullW  = opts.hullW ?? 0.30;
  const symW   = opts.symW  ?? 0.30;
  const scale  = opts.scale ?? CORRECTION_SCALE;
  const scaleX = opts.scaleX ?? scale;
  const scaleY = opts.scaleY ?? scale;
  const target = opts.target ?? 'bias_corrected';
  const globalDx = opts.globalDx ?? 0;
  const globalDy = opts.globalDy ?? 0;

  const gt = loadGT();
  const rows = [];
  let sumSq = 0;
  let sumAbs = 0;
  let n = 0;

  for (const [iconId, info] of Object.entries(gt.icons)) {
    const img = rasterize(iconId);
    const raw = computeOffsetV2(img, { edgeWeight: edgeW, hullWeight: hullW, symmetryWeight: symW });
    const pred_dx = raw.dx * scaleX + globalDx;
    const pred_dy = raw.dy * scaleY + globalDy;
    const truth_dx = target === 'observed' ? info.observed_median_dx : info.bias_corrected_dx;
    const truth_dy = target === 'observed' ? info.observed_median_dy : info.bias_corrected_dy;
    const ex = pred_dx - truth_dx;
    const ey = pred_dy - truth_dy;
    const distSq = ex * ex + ey * ey;
    const dist = Math.sqrt(distSq);
    sumSq += distSq;
    sumAbs += dist;
    n++;
    rows.push({
      iconId,
      pred_dx: +pred_dx.toFixed(3),
      pred_dy: +pred_dy.toFixed(3),
      truth_dx: +truth_dx.toFixed(3),
      truth_dy: +truth_dy.toFixed(3),
      err_x: +ex.toFixed(3),
      err_y: +ey.toFixed(3),
      err_magnitude: +dist.toFixed(3),
    });
  }

  const rmse = Math.sqrt(sumSq / n);
  const mae = sumAbs / n;
  return { rmse: +rmse.toFixed(4), mae: +mae.toFixed(4), n, perIcon: rows };
}

// CLI mode
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = evaluate();
  console.log(`Baseline V2 model (audit-fixed, defaults edgeW=0.4 hullW=0.3 symW=0.3, scale=${CORRECTION_SCALE})`);
  console.log(`Target: bias_corrected Phase 3 (× 1.43)`);
  console.log(`RMSE: ${result.rmse} px,   MAE: ${result.mae} px,   n=${result.n}`);
  console.log();
  console.log(`${'icon'.padEnd(40)}  ${'pred'.padStart(14)}  ${'truth'.padStart(14)}  ${'err_mag'.padStart(8)}`);
  for (const r of result.perIcon.sort((a, b) => b.err_magnitude - a.err_magnitude)) {
    const pred = `(${r.pred_dx.toFixed(2)},${r.pred_dy.toFixed(2)})`;
    const truth = `(${r.truth_dx.toFixed(2)},${r.truth_dy.toFixed(2)})`;
    console.log(`  ${r.iconId.padEnd(40)}  ${pred.padStart(14)}  ${truth.padStart(14)}  ${r.err_magnitude.toFixed(3).padStart(8)}`);
  }
}
