# tools/ — model research scripts (not shipped)

Offline analysis for the perceptual model. **Not part of the npm package**
(`files` is `dist`/`src`/`README.md`) and **not run in CI** — these scripts use
absolute paths to a sibling research dir (`/Volumes/harici_ssd/optical-center/…`)
for icon assets and ground truth, so they only run on the author's machine.

## Files

| File | What it does |
| --- | --- |
| `phase3-ground-truth.json` | 20-icon Phase 3 human placements (observed + bias-corrected dx/dy). |
| `v3-per-icon-pse.json` | Per-icon Phase 2 PSE data. |
| `v3-evaluate.mjs` | Eval harness: rasterize → `computeOffsetV2(weights)` → ×scale → RMSE vs GT. Exports `evaluate()`. |
| `v3-fit-blend.mjs` / `-fast.mjs` | Grid search over blend weights (edge/hull/sym) ± a global offset. |
| `v3-fit-blend-results.json` | Saved grid-search output. |
| `v3-loo.mjs` | Leave-one-out cross-validation of the full v3 fit (blend + per-axis scale + global offset). |
| `v3-loo-noglobal.mjs` | LOO with the global offset removed — decomposes where the gain comes from. |
| `v3-catalog-diff.mjs` / `.json` | v2 (production) vs v3 (fit) output diff across the 1000-icon catalog. |

## Conclusion (LOO cross-validation) — **v3 params are NOT adopted**

The v3 re-parameterization (blend reweight + per-axis scale + global offset) cut
the *training* RMSE 2.245 → 1.381, but cross-validation showed that gain does not
generalize honestly:

| Config (out-of-sample LOO) | RMSE | vs baseline 2.245 |
| --- | --- | --- |
| with global offset | 1.907 | +15.0% |
| per-axis scale, no global | 2.592 | **−15.4% (worse)** |
| isotropic scale, no global | 2.185 | +2.7% (marginal) |

The entire LOO gain came from a constant **global horizontal offset** (`globalDx ≈
1.5`) — the horizontal twin of the global *vertical* bias this branch removes on
principled grounds (studies show people center on the true midline). It is almost
certainly a 20-icon sampling artifact: remove it and per-axis scale overfits
(worse than baseline), while blend reweight alone is a wash (+2.7%). Three icons
(`bulldozer`, `bar-chart-line-fill`, `microsoft-outlook-logo`) dominate the error
under every config.

**Verdict:** production V2 defaults stand (edge 0.40 / hull 0.30 / sym 0.30,
isotropic scale 0.745). The audit bug fixes in `src/model/` are independent of
this and are retained. A consistent `symW → 0` across fits hints the symmetry-axis
weight may be a touch high, but the gain is marginal and 20 icons is too few to
justify a change — revisit with more ground truth.
