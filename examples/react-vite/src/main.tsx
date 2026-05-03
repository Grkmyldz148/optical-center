import { createRoot } from 'react-dom/client';

import { Inline } from './scenarios/inline.js';
import { AssetImport } from './scenarios/asset-import.js';
import { LucideReactDemo } from './scenarios/lucide-react.js';
import { HeroiconsDemo } from './scenarios/heroicons.js';
import { ReactIconsDemo } from './scenarios/react-icons.js';
import { IconifyDemo } from './scenarios/iconify.js';

function App() {
  return (
    <main>
      <h1>optical-center · React + Vite</h1>
      <p className="lede">
        Six integration paths in one app. Left column = geometric
        centering (the default). Right column = optical-center applied.
        Inspect any right-column <code>&lt;svg&gt;</code> in DevTools to
        see the rewritten <code>viewBox</code> and{' '}
        <code>data-optical-center</code> breadcrumb.
      </p>

      <Inline />
      <AssetImport />
      <LucideReactDemo />
      <HeroiconsDemo />
      <ReactIconsDemo />
      <IconifyDemo />
    </main>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
