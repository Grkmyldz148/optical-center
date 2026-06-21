import { readFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { computeOffsetV2 } from '/Volumes/harici_ssd/optical-center-model/dist/model/compute-offset.js';
import { CORRECTION_SCALE } from '/Volumes/harici_ssd/optical-center-model/dist/model/final-model.js';
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

function err(set, e, h, s, sx, sy, gx, gy) {
  let sumSq = 0;
  for (const c of set) {
    const oX = e*c.ec.x + h*c.hc.x + s*c.sc.x + c.symCorr.dx*Math.sign(c.asym.asymX);
    const oY = e*c.ec.y + h*c.hc.y + s*c.sc.y + c.symCorr.dy*Math.sign(c.asym.asymY);
    const dx = (c.width/2 - oX) * sx + gx;
    const dy = (c.height/2 - oY) * sy + gy;
    sumSq += (dx-c.t_dx)**2 + (dy-c.t_dy)**2;
  }
  return Math.sqrt(sumSq / set.length);
}

function fit(set) {
  const SCALES = [0.6, 0.7, 0.745, 0.8, 0.9, 1.0, 1.1];
  const GDX = [-0.5, 0, 0.5, 1.0, 1.3, 1.5, 1.8, 2.0];
  const GDY = [-1, -0.5, 0, 0.5, 1.0];
  let best = { rmse: Infinity };
  for (let e = 0; e <= 1.0 + 1e-9; e += 0.1) {
    for (let h = 0; h <= 1.0 - e + 1e-9; h += 0.1) {
      const s = Math.max(0, 1 - e - h);
      for (const sx of SCALES) for (const sy of SCALES) for (const gx of GDX) for (const gy of GDY) {
        const r = err(set, e, h, s, sx, sy, gx, gy);
        if (r < best.rmse) best = { e, h, s, sx, sy, gx, gy, rmse: r };
      }
    }
  }
  return best;
}

// Full-train baseline
const all = fit(cache);
console.log('Full-train best:  blend=(' + all.e.toFixed(2) + ',' + all.h.toFixed(2) + ',' + all.s.toFixed(2) + ')  scale=(' + all.sx + ',' + all.sy + ')  global=(' + all.gx + ',' + all.gy + ')  trainRMSE=' + all.rmse.toFixed(4));

// LOO
console.log('\nLeave-one-out:');
let testErrors = [];
for (let i = 0; i < cache.length; i++) {
  const trainSet = cache.filter((_, j) => j !== i);
  const heldOut = [cache[i]];
  const best = fit(trainSet);
  const testRMSE = err(heldOut, best.e, best.h, best.s, best.sx, best.sy, best.gx, best.gy);
  testErrors.push(testRMSE);
  console.log(`  held-out: ${cache[i].iid.padEnd(40)}  train_RMSE=${best.rmse.toFixed(3)}  test_RMSE=${testRMSE.toFixed(3)}`);
}
const looRMSE = Math.sqrt(testErrors.reduce((s, e) => s + e*e, 0) / testErrors.length);
console.log(`\nLOO cross-validation RMSE: ${looRMSE.toFixed(4)}`);
console.log(`(vs full-train RMSE: ${all.rmse.toFixed(4)}, vs default baseline 2.245)`);
console.log(`LOO improvement over default: ${((1 - looRMSE/2.245)*100).toFixed(1)}%`);
