# Shared icon fixture pool

A single source of truth that both the **test suite** and every **example
project** consume. Every icon below is a real one from a permissively-
licensed icon family, plus a curated set of edge cases that exercise
known-tricky paths in the algorithm.

> One pool, no duplication. If a case is interesting enough to test, it
> should be visible in an example too — and vice versa.

## Layout

```
fixtures/
├── manifest.json         metadata: family, expected offset, notes
├── icons/
│   ├── lucide/           Lucide (ISC) — stroke 24×24
│   ├── heroicons/        Heroicons (MIT) — solid 24×24
│   ├── feather/          Feather (MIT) — stroke 24×24
│   ├── fontawesome/      FA Free (CC BY 4.0) — solid, mixed viewBoxes
│   ├── phosphor/         Phosphor (MIT) — solid 256×256
│   ├── tabler/           Tabler (MIT) — stroke 24×24
│   └── edge-cases/       known-tricky inputs (see below)
└── README.md             this file
```

## Edge cases

| File | What it stresses |
|------|------------------|
| `tiny.svg` | Single 1-px circle in a 24-grid — most pixels are transparent. |
| `asymmetric-triangle.svg` | Heavy right-bias triangle — large dx expected. |
| `multicolor.svg` | Three nested shapes, multiple fills — alpha compositing. |
| `with-text.svg` | `<text>` element — resvg's font path must work without system fonts. |
| `edge-clipped.svg` | Content flush at the viewBox right edge — should trigger `OPTICAL_CLIP_DETECTED`. |
| `stroke-only.svg` | `fill: none`, stroke only — relies on stroke alpha for the bbox. |
| `non-square.svg` | 48×24 viewBox — aspect-ratio handling. |
| `heavy-padding.svg` | Tiny shape in a big box — most pixels transparent. |
| `negative-viewbox.svg` | `viewBox="-12 -12 24 24"` — math must handle negative origins. |
| `gradient.svg` | `<defs>` + `<linearGradient>` — def-block parsing in serializer. |

## Attribution

| Family | License | Source |
|--------|---------|--------|
| Lucide | [ISC](https://github.com/lucide-icons/lucide/blob/main/LICENSE) | https://lucide.dev |
| Heroicons | [MIT](https://github.com/tailwindlabs/heroicons/blob/master/LICENSE) | https://heroicons.com |
| Feather | [MIT](https://github.com/feathericons/feather/blob/main/LICENSE) | https://feathericons.com |
| FontAwesome Free | [CC BY 4.0](https://fontawesome.com/license/free) | https://fontawesome.com |
| Phosphor | [MIT](https://github.com/phosphor-icons/core/blob/main/LICENSE) | https://phosphoricons.com |
| Tabler | [MIT](https://github.com/tabler/tabler-icons/blob/main/LICENSE) | https://tabler.io/icons |

These projects all explicitly permit redistribution. The bundled SVGs
here are vendored copies for offline reproducibility — for production
work, install the corresponding npm packages.

## Use from tests

```ts
import { loadIcon, listIcons } from '../helpers/fixtures.js';

const svg = loadIcon('lucide/play');           // raw SVG string
const all = listIcons({ family: 'edge-cases' });
```

## Use from Vite examples

```ts
// import a single icon
import play from '../../../fixtures/icons/lucide/play.svg?raw';
import playOpt from '../../../fixtures/icons/lucide/play.svg?optical';

// or bulk-glob the whole pool
const all = import.meta.glob('../../../fixtures/icons/**/*.svg', {
  eager: true,
  query: '?optical',
  import: 'default',
});
```
