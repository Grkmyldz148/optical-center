# Demo assets

`optical-center-demo.gif` is the animated banner shown at the top of the root
[`README.md`](../../README.md). It's generated from source so it can be
regenerated whenever the brand or message changes; don't hand-edit the GIF.

## Source

| File | Role |
|---|---|
| `optical-center-demo.html` | The self-contained animation. Exposes a deterministic `window.renderFrame(t)` (`t` in `[0, 1)`) so every frame is reproducible. |
| `capture.mjs` | Playwright script that steps `renderFrame` over the loop and writes one PNG per frame. |

## Regenerate

Requires [Playwright](https://playwright.dev) (with the `chrome` channel
available) and [ffmpeg](https://ffmpeg.org).

```bash
# 1. render frames; the script prints the output dir it used (under the OS temp dir)
FRAMES=$(node docs/assets/capture.mjs | sed -n 's/.*→ //p')

# 2. assemble a high-quality, infinitely-looping GIF
ffmpeg -y -framerate 15 -i "$FRAMES/f%03d.png" \
  -vf "scale=900:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle" \
  -loop 0 docs/assets/optical-center-demo.gif
```

`capture.mjs` points at `optical-center-demo.html` via a `file://` URL; keep
the two files in this folder together.
