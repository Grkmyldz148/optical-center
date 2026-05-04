import { createRoot } from 'react-dom/client';

import { LibraryIcons } from './scenarios/library-icons.js';
import { Inline } from './scenarios/inline.js';
import { AssetImport } from './scenarios/asset-import.js';

import './styles/icons.css';

function App() {
  return (
    <main>
      <h1>optical-center · React + Vite</h1>
      <p className="lede">
        Three build-time integration paths in one app — every
        correction happens before a byte ships to the browser. Left
        column = geometric centering (the default). Right column =
        optical-center applied. Each badge has a 1-pixel crosshair so
        you can see exactly where the icon's mass sits.
      </p>

      <LibraryIcons />
      <Inline />
      <AssetImport />
    </main>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
