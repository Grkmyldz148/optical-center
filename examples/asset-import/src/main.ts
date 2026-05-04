/**
 * Asset import — every SVG in `src/icons/` rendered twice.
 *
 * Vite's `import.meta.glob` lets us pull every .svg under the local
 * icons folder (raw + ?optical variants) without writing one import
 * per file. The `?optical` suffix triggers the Vite plugin's load()
 * hook to rewrite the viewBox at build time. Side-by-side rendering
 * proves the same module path produces two different bundles
 * depending on the suffix.
 */

const rawModules = import.meta.glob<string>('./icons/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const opticalModules = import.meta.glob<string>('./icons/*.svg', {
  query: '?optical',
  import: 'default',
  eager: true,
});

interface Pair {
  readonly id: string;
  readonly raw: string;
  readonly optical: string;
}

function buildPairs(): ReadonlyArray<Pair> {
  const pairs: Pair[] = [];
  for (const path of Object.keys(rawModules)) {
    const id = path.replace(/^\.\/icons\//, '').replace(/\.svg$/, '');
    pairs.push({
      id,
      raw: rawModules[path]!,
      optical: opticalModules[path]!,
    });
  }
  return pairs.sort((a, b) => a.id.localeCompare(b.id));
}

function rowHtml(pair: Pair): string {
  return `
    <div class="row">
      <div class="badge">${pair.raw}</div>
      <div class="badge">${pair.optical}</div>
      <code>${pair.id}</code>
    </div>
  `;
}

const root = document.getElementById('root');
if (root) {
  root.innerHTML = buildPairs().map(rowHtml).join('');
}
