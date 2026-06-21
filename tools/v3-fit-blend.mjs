#!/usr/bin/env node
/**
 * v3 fit: blend weights grid search.
 *
 * Searches over (edgeW, hullW, symW) on the simplex (sum = 1),
 * with optional concurrent (globalDx) compensation, and reports the
 * top-K parameter sets by Phase 3 bias-corrected RMSE.
 */
import { evaluate } from './v3-evaluate.mjs';

const STEP = 0.05; // simplex resolution
const TOP_K = 10;
const TARGET = process.argv.includes('--observed') ? 'observed' : 'bias_corrected';

console.log(`Blend grid search — target=${TARGET}, simplex step=${STEP}`);
console.log();

// Phase 1: fixed-scale baseline grid (no globalDx)
console.log('=== Phase 1: blend weights only (no globalDx) ===');
const results1 = [];
for (let e = 0; e <= 1.0 + 1e-9; e += STEP) {
  for (let h = 0; h <= 1.0 - e + 1e-9; h += STEP) {
    const s = 1 - e - h;
    if (s < 0) continue;
    const r = evaluate({ edgeW: e, hullW: h, symW: s, target: TARGET });
    results1.push({ edgeW: +e.toFixed(2), hullW: +h.toFixed(2), symW: +s.toFixed(2), rmse: r.rmse, mae: r.mae });
  }
}
results1.sort((a, b) => a.rmse - b.rmse);
console.log(`Tested ${results1.length} blend combos.`);
console.log(`Best 10:`);
console.log(`  ${'edgeW'.padEnd(7)}  ${'hullW'.padEnd(7)}  ${'symW'.padEnd(7)}  ${'RMSE'.padEnd(7)}  MAE`);
for (const r of results1.slice(0, TOP_K)) {
  console.log(`  ${r.edgeW.toFixed(2).padEnd(7)}  ${r.hullW.toFixed(2).padEnd(7)}  ${r.symW.toFixed(2).padEnd(7)}  ${r.rmse.toFixed(4).padEnd(7)}  ${r.mae.toFixed(4)}`);
}
console.log(`Default (0.40/0.30/0.30):`);
const dflt = results1.find(r => r.edgeW === 0.4 && r.hullW === 0.3);
console.log(`  ${dflt.edgeW.toFixed(2).padEnd(7)}  ${dflt.hullW.toFixed(2).padEnd(7)}  ${dflt.symW.toFixed(2).padEnd(7)}  ${dflt.rmse.toFixed(4).padEnd(7)}  ${dflt.mae.toFixed(4)}`);

const best1 = results1[0];
const improvement1 = (1 - best1.rmse / dflt.rmse) * 100;
console.log(`Improvement: ${improvement1.toFixed(1)}% RMSE`);
console.log();

// Phase 2: blend × globalDx joint
console.log('=== Phase 2: blend + globalDx joint ===');
const results2 = [];
for (let e = 0; e <= 1.0 + 1e-9; e += 0.1) {
  for (let h = 0; h <= 1.0 - e + 1e-9; h += 0.1) {
    const s = 1 - e - h;
    if (s < 0) continue;
    for (let g = 0; g <= 2.6; g += 0.1) {
      const r = evaluate({ edgeW: e, hullW: h, symW: s, globalDx: g, target: TARGET });
      results2.push({ edgeW: +e.toFixed(2), hullW: +h.toFixed(2), symW: +s.toFixed(2), globalDx: +g.toFixed(2), rmse: r.rmse, mae: r.mae });
    }
  }
}
results2.sort((a, b) => a.rmse - b.rmse);
console.log(`Tested ${results2.length} (blend × globalDx) combos.`);
console.log(`Best 10:`);
console.log(`  ${'edgeW'.padEnd(7)}  ${'hullW'.padEnd(7)}  ${'symW'.padEnd(7)}  ${'globalDx'.padEnd(9)}  ${'RMSE'.padEnd(7)}  MAE`);
for (const r of results2.slice(0, TOP_K)) {
  console.log(`  ${r.edgeW.toFixed(2).padEnd(7)}  ${r.hullW.toFixed(2).padEnd(7)}  ${r.symW.toFixed(2).padEnd(7)}  ${r.globalDx.toFixed(2).padEnd(9)}  ${r.rmse.toFixed(4).padEnd(7)}  ${r.mae.toFixed(4)}`);
}
const best2 = results2[0];
const improvement2 = (1 - best2.rmse / dflt.rmse) * 100;
console.log(`Improvement over default: ${improvement2.toFixed(1)}% RMSE`);
console.log();

// Save full results
import('node:fs').then(fs => {
  fs.writeFileSync('/Volumes/harici_ssd/optical-center-model/tools/v3-fit-blend-results.json', JSON.stringify({
    target: TARGET,
    phase1_blend_only: { tested: results1.length, top: results1.slice(0, 30), defaultBaseline: dflt },
    phase2_blend_and_globalDx: { tested: results2.length, top: results2.slice(0, 30), best: best2 },
  }, null, 2));
  console.log('Full results → tools/v3-fit-blend-results.json');
});
