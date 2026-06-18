// Renders one PNG per animation frame from optical-center-demo.html.
// Drives the page's deterministic window.renderFrame(t) so frames are
// reproducible. Assemble the PNGs into the GIF with ffmpeg (see README.md).
import { createRequire } from 'module';
import { mkdirSync, rmSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';

// Resolve Playwright whether it's a local dep or a global install.
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  const globalRoot = execSync('npm root -g').toString().trim();
  ({ chromium } = require(join(globalRoot, 'playwright')));
}

const here = dirname(fileURLToPath(import.meta.url));
const pageUrl = pathToFileURL(join(here, 'optical-center-demo.html')).href;
const outDir = join(tmpdir(), 'oc-demo', 'frames');

const N = 60; // frames in the loop
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({
  viewport: { width: 920, height: 440 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto(pageUrl, { waitUntil: 'networkidle' });
await page.waitForFunction('window.__ready === true');

for (let i = 0; i < N; i++) {
  await page.evaluate(async (t) => {
    window.renderFrame(t);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, i / N);
  await page.screenshot({ path: join(outDir, `f${String(i).padStart(3, '0')}.png`) });
}

await browser.close();
console.log(`captured ${N} frames → ${outDir}`);
