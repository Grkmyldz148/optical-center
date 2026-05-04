import { createRoot } from 'react-dom/client';

import { Inline } from './scenarios/inline.js';
import { AssetImport } from './scenarios/asset-import.js';
import { LibraryIcons } from './scenarios/library-icons.js';

import './styles/icons.css';

function App() {
  return (
    <main>
      <h1>optical-center · React + Vite</h1>
      <p className="lede">
        Three build-time integration paths in one app — every
        correction happens before a byte ships to the browser. Left
        column = geometric centering (the default). Right column =
        optical-center applied. No runtime, no React hook, no JS at
        the icon mount point.
      </p>

      <Inline />
      <AssetImport />
      <LibraryIcons />
    </main>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
