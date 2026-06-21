#!/usr/bin/env node
/**
 * v3 fit (FAST): blend weights + globalDx joint grid search.
 *
 * Optimization: precompute V2's 3 centroids + asymmetry + symCorr once per icon,
 * then the grid search reduces to pure arithmetic — 1000× faster.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { computeOffsetV2 } from '/Volumes/harici_ssd/optical-center-model/dist/model/compute-offset.js';
import { CORRECTION_SCALE } from '/Volumes/harici_ssd/optical-center-model/dist/model/final-model.js';

const RASTER_SIZE = 120;
const SCALE = CORRECTION_SCALE; // 0.745

const TARGET = process.argv.includes('--observed') ? 'observed' : 'bias_corrected';

function iconPath(iconId) {
  const [source, name] = iconId.split('/');
  return `/Volumes/harici_ssd/optical-center/icons/sets/raw/${source}/${name}.svg`;
}

const gt = JSON.parse(readFileSync('/Volumes/harici_ssd/optical-center-model/tools/phase3-ground-truth.json', 'utf-8'));

// Precompute V2 internals for each Phase 3 icon
console.log('Precomputing V2 centroids for 20 Phase 3 icons...');
const cache = [];
for (const [iconId, info] of Object.entries(gt.icons)) {
  const svg = readFileSync(iconPath(iconId), 'utf-8').replace(/currentColor/g, '#000000');
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: RASTER_SIZE },
    background: 'rgba(0, 0, 0, 0)',
  });
  const rendered = r.render();
  const img = { data: new Uint8ClampedArray(rendered.pixels), width: rendered.width, height: rendered.height };
  // Run V2 once with default weights — we only care about the centroids and asymmetry,
  // which are weight-invariant.
  const out = computeOffsetV2(img);
  const { width, height } = img;
  // The blend is: optical = w_e*edgeC + w_h*hullC + w_s*symC, then + symCorr*sign(asym).
  // We need symCorr — but it depends only on the symmetry RESULT, not on the blend.
  // The current computeOffsetV2 doesn't return symCorr directly. Recompute via the same formula:
  //   asymFactorX = 1 - bilateralX, asymFactorY = 1 - bilateralY
  //   radial damp = symmetry.radial
  //   scaleFactor = 0.03
  //   symCorr.dx = asymFactorX * (1 - radial) * width * scaleFactor
  //   symCorr.dy = asymFactorY * (1 - radial) * height * scaleFactor
  // Since we don't have direct access to symmetry result, recompute from debug.
  // ALTERNATIVE: we can derive symCorr by subtraction —
  //   blend = 0.4*edge + 0.3*hull + 0.3*sym
  //   actual_optical = blend + symCorr * sign(asym)
  //   so symCorr * sign(asym) = actual_optical - blend
  // But sign() is fine here — we extract the magnitude and the sign separately.
  const dbg = out.debug;
  const blend_default = {
    x: 0.4 * dbg.edgeCentroid.x + 0.3 * dbg.hullCentroid.x + 0.3 * dbg.symmetryAxisCenter.x,
    y: 0.4 * dbg.edgeCentroid.y + 0.3 * dbg.hullCentroid.y + 0.3 * dbg.symmetryAxisCenter.y,
  };
  const symCorrApplied = {
    dx: dbg.opticalCenter.x - blend_default.x,
    dy: dbg.opticalCenter.y - blend_default.y,
  };
  // Now symCorr.dx * sign(asymX) = symCorrApplied.dx
  // To get symCorr.dx (magnitude): |symCorrApplied.dx| (sign comes from asymX)
  const symCorr = {
    dx: Math.abs(symCorrApplied.dx),
    dy: Math.abs(symCorrApplied.dy),
  };
  cache.push({
    iconId,
    width, height,
    edgeC: dbg.edgeCentroid,
    hullC: dbg.hullCentroid,
    symC:  dbg.symmetryAxisCenter,
    asym:  dbg.asymmetry,
    symCorr,
    truth_dx: TARGET === 'observed' ? info.observed_median_dx : info.bias_corrected_dx,
    truth_dy: TARGET === 'observed' ? info.observed_median_dy : info.bias_corrected_dy,
  });
}
console.log(`Cache built for ${cache.length} icons.`);
console.log();

// Pure arithmetic evaluation
function evaluate(edgeW, hullW, symW, scaleX, scaleY, globalDx, globalDy) {
  let sumSq = 0;
  for (const c of cache) {
    const optX = edgeW * c.edgeC.x + hullW * c.hullC.x + symW * c.symC.x + c.symCorr.dx * Math.sign(c.asym.asymX);
    const optY = edgeW * c.edgeC.y + hullW * c.hullC.y + symW * c.symC.y + c.symCorr.dy * Math.sign(c.asym.asymY);
    const dx = (c.width / 2 - optX) * scaleX + globalDx;
    const dy = (c.height / 2 - optY) * scaleY + globalDy;
    const ex = dx - c.truth_dx;
    const ey = dy - c.truth_dy;
    sumSq += ex * ex + ey * ey;
  }
  return Math.sqrt(sumSq / cache.length);
}

// Phase 1: blend grid (no offset, default 0.745 scale)
console.log('=== Phase 1: blend weights only ===');
const STEP_BLEND = 0.05;
let bestPhase1 = { rmse: Infinity };
const results1 = [];
for (let e = 0; e <= 1.0 + 1e-9; e += STEP_BLEND) {
  for (let h = 0; h <= 1.0 - e + 1e-9; h += STEP_BLEND) {
    const s = 1 - e - h;
    if (s < -1e-9) continue;
    const rmse = evaluate(e, h, Math.max(0, s), SCALE, SCALE, 0, 0);
    results1.push({ edgeW: +e.toFixed(2), hullW: +h.toFixed(2), symW: +Math.max(0, s).toFixed(2), rmse });
    if (rmse < bestPhase1.rmse) bestPhase1 = { edgeW: e, hullW: h, symW: Math.max(0, s), rmse };
  }
}
results1.sort((a, b) => a.rmse - b.rmse);
console.log(`Tested ${results1.length} blends.`);
const dflt = results1.find(r => Math.abs(r.edgeW - 0.4) < 0.01 && Math.abs(r.hullW - 0.3) < 0.01);
console.log(`Default (0.40/0.30/0.30):  RMSE = ${dflt.rmse.toFixed(4)}`);
console.log(`Top 10:`);
console.log(`  edgeW   hullW   symW    RMSE`);
for (const r of results1.slice(0, 10)) {
  console.log(`  ${r.edgeW.toFixed(2).padEnd(7)}${r.hullW.toFixed(2).padEnd(8)}${r.symW.toFixed(2).padEnd(8)}${r.rmse.toFixed(4)}`);
}
console.log();

// Phase 2: full joint optimization (blend + per-axis scale + globalDx/Dy)
console.log('=== Phase 2: blend × (scaleX, scaleY) × (globalDx, globalDy) ===');
const STEP_BLEND2 = 0.1;
const SCALES = [0.6, 0.7, 0.745, 0.8, 0.9, 1.0, 1.1];
const GLOBAL_DX = [-0.5, 0, 0.5, 1.0, 1.3, 1.4, 1.5, 1.8, 2.0];
const GLOBAL_DY = [-1, -0.5, 0, 0.5, 1.0];

let bestPhase2 = { rmse: Infinity };
const allResults = [];
let count = 0;
for (let e = 0; e <= 1.0 + 1e-9; e += STEP_BLEND2) {
  for (let h = 0; h <= 1.0 - e + 1e-9; h += STEP_BLEND2) {
    const s = 1 - e - h;
    if (s < -1e-9) continue;
    for (const sx of SCALES) {
      for (const sy of SCALES) {
        for (const gx of GLOBAL_DX) {
          for (const gy of GLOBAL_DY) {
            const rmse = evaluate(e, h, Math.max(0, s), sx, sy, gx, gy);
            count++;
            if (rmse < bestPhase2.rmse) {
              bestPhase2 = { edgeW: e, hullW: h, symW: Math.max(0, s), scaleX: sx, scaleY: sy, globalDx: gx, globalDy: gy, rmse };
            }
            if (rmse < dflt.rmse * 0.65) { // only save big improvements
              allResults.push({ edgeW: +e.toFixed(2), hullW: +h.toFixed(2), symW: +Math.max(0, s).toFixed(2), scaleX: sx, scaleY: sy, globalDx: gx, globalDy: gy, rmse });
            }
          }
        }
      }
    }
  }
}
allResults.sort((a, b) => a.rmse - b.rmse);
console.log(`Tested ${count} joint combos.`);
console.log(`Best:`);
console.log(`  edgeW=${bestPhase2.edgeW.toFixed(2)}  hullW=${bestPhase2.hullW.toFixed(2)}  symW=${bestPhase2.symW.toFixed(2)}`);
console.log(`  scaleX=${bestPhase2.scaleX}  scaleY=${bestPhase2.scaleY}`);
console.log(`  globalDx=${bestPhase2.globalDx}  globalDy=${bestPhase2.globalDy}`);
console.log(`  RMSE = ${bestPhase2.rmse.toFixed(4)}  (vs default ${dflt.rmse.toFixed(4)}, ${((1 - bestPhase2.rmse/dflt.rmse)*100).toFixed(1)}% better)`);
console.log();
console.log(`Top 10 unique joint params:`);
const seenKeys = new Set();
let shown = 0;
for (const r of allResults) {
  if (shown >= 10) break;
  const k = `${r.edgeW}/${r.hullW}/${r.symW}`;
  if (seenKeys.has(k)) continue;
  seenKeys.add(k);
  console.log(`  blend=(${r.edgeW.toFixed(2)},${r.hullW.toFixed(2)},${r.symW.toFixed(2)})  scale=(${r.scaleX},${r.scaleY})  global=(${r.globalDx},${r.globalDy})  RMSE=${r.rmse.toFixed(4)}`);
  shown++;
}

writeFileSync('/Volumes/harici_ssd/optical-center-model/tools/v3-fit-blend-results.json', JSON.stringify({
  target: TARGET,
  cache_size: cache.length,
  phase1: { default_baseline: dflt, best: bestPhase1, top: results1.slice(0, 30) },
  phase2: { tested: count, best: bestPhase2, top_improvements: allResults.slice(0, 50) },
}, null, 2));
console.log();
console.log('Saved → tools/v3-fit-blend-results.json');
