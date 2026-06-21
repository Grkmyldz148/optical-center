// LOO variant: blend + per-axis scale ONLY (global offset forced to 0).
// Decomposes how much of the with-global LOO gain (1.907 vs 2.245) survives
// when the theoretically-suspect global offset term is removed.
import { readFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { computeOffsetV2 } from '/Volumes/harici_ssd/optical-center-model/dist/model/compute-offset.js';
const RASTER = 120;
const gt = JSON.parse(readFileSync('/Volumes/harici_ssd/optical-center-model/tools/phase3-ground-truth.json', 'utf-8'));
const cache = [];
for (const [iid, info] of Object.entries(gt.icons)) {
  const [src, name] = iid.split('/');
  const svg = readFileSync(`/Volumes/harici_ssd/optical-center/icons/sets/raw/${src}/${name}.svg`, 'utf-8').replace(/currentColor/g, '#000000');
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: RASTER }, background: 'rgba(0,0,0,0)' });
  const rendered = r.render();
  const out = computeOffsetV2({ data: new Uint8ClampedArray(rendered.pixels), width: rendered.width, height: rendered.height });
  const d = out.debug;
  const blend = { x: 0.4*d.edgeCentroid.x + 0.3*d.hullCentroid.x + 0.3*d.symmetryAxisCenter.x, y: 0.4*d.edgeCentroid.y + 0.3*d.hullCentroid.y + 0.3*d.symmetryAxisCenter.y };
  const sca = { dx: d.opticalCenter.x - blend.x, dy: d.opticalCenter.y - blend.y };
  cache.push({ iid, width: rendered.width, height: rendered.height, ec: d.edgeCentroid, hc: d.hullCentroid, sc: d.symmetryAxisCenter, asym: d.asymmetry, symCorr: { dx: Math.abs(sca.dx), dy: Math.abs(sca.dy) }, t_dx: info.bias_corrected_dx, t_dy: info.bias_corrected_dy });
}

function err(set, e, h, s, sx, sy) {
  let sumSq = 0;
  for (const c of set) {
    const oX = e*c.ec.x + h*c.hc.x + s*c.sc.x + c.symCorr.dx*Math.sign(c.asym.asymX);
    const oY = e*c.ec.y + h*c.hc.y + s*c.sc.y + c.symCorr.dy*Math.sign(c.asym.asymY);
    const dx = (c.width/2 - oX) * sx;   // global offset removed
    const dy = (c.height/2 - oY) * sy;
    sumSq += (dx-c.t_dx)**2 + (dy-c.t_dy)**2;
  }
  return Math.sqrt(sumSq / set.length);
}

function fit(set, { perAxis = true } = {}) {
  const SCALES = [0.5, 0.6, 0.7, 0.745, 0.8, 0.9, 1.0, 1.1, 1.2];
  let best = { rmse: Infinity };
  for (let e = 0; e <= 1.0 + 1e-9; e += 0.1) {
    for (let h = 0; h <= 1.0 - e + 1e-9; h += 0.1) {
      const s = Math.max(0, 1 - e - h);
      for (const sx of SCALES) {
        for (const sy of (perAxis ? SCALES : [sx])) {
          const r = err(set, e, h, s, sx, sy);
          if (r < best.rmse) best = { e, h, s, sx, sy, rmse: r };
        }
      }
    }
  }
  return best;
}

function loo(opts) {
  const all = fit(cache, opts);
  const testErrors = [];
  const perIcon = [];
  for (let i = 0; i < cache.length; i++) {
    const trainSet = cache.filter((_, j) => j !== i);
    const best = fit(trainSet, opts);
    const testRMSE = err([cache[i]], best.e, best.h, best.s, best.sx, best.sy);
    testErrors.push(testRMSE);
    perIcon.push({ iid: cache[i].iid, test: testRMSE });
  }
  const looRMSE = Math.sqrt(testErrors.reduce((s, e) => s + e*e, 0) / testErrors.length);
  return { all, looRMSE, perIcon };
}

const BASE = 2.245;

console.log('=== A) blend + PER-AXIS scale, NO global offset ===');
const A = loo({ perAxis: true });
console.log(`Full-train best: blend=(${A.all.e.toFixed(2)},${A.all.h.toFixed(2)},${A.all.s.toFixed(2)})  scale=(${A.all.sx},${A.all.sy})  trainRMSE=${A.all.rmse.toFixed(4)}`);
console.log(`LOO RMSE: ${A.looRMSE.toFixed(4)}  (vs default ${BASE} → ${((1-A.looRMSE/BASE)*100).toFixed(1)}% improvement)`);

console.log('\n=== B) blend + SINGLE isotropic scale, NO global offset ===');
const B = loo({ perAxis: false });
console.log(`Full-train best: blend=(${B.all.e.toFixed(2)},${B.all.h.toFixed(2)},${B.all.s.toFixed(2)})  scale=${B.all.sx}  trainRMSE=${B.all.rmse.toFixed(4)}`);
console.log(`LOO RMSE: ${B.looRMSE.toFixed(4)}  (vs default ${BASE} → ${((1-B.looRMSE/BASE)*100).toFixed(1)}% improvement)`);

console.log('\n=== per-icon test RMSE (config A, worst first) ===');
for (const r of A.perIcon.sort((a,b)=>b.test-a.test)) {
  console.log(`  ${r.iid.padEnd(42)} ${r.test.toFixed(3)}`);
}

console.log('\n=== summary ===');
console.log(`default V2 baseline:                 ${BASE.toFixed(3)}`);
console.log(`with global offset (prev LOO):       1.907   (15.0%)`);
console.log(`per-axis scale, no global (A):       ${A.looRMSE.toFixed(3)}   (${((1-A.looRMSE/BASE)*100).toFixed(1)}%)`);
console.log(`isotropic scale, no global (B):      ${B.looRMSE.toFixed(3)}   (${((1-B.looRMSE/BASE)*100).toFixed(1)}%)`);
