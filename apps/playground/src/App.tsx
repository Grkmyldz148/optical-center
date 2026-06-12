import { useState } from 'react';

import { TopBar } from './components/TopBar.js';
import type { ViewKey } from './components/TopBar.js';
import { PlaygroundView } from './views/PlaygroundView.js';
import { StressView } from './views/StressView.js';

/**
 * App shell. Top bar owns the active view switch; each view renders
 * its own sidebar + canvas pair so we don't try to do route-level
 * state sharing for two unrelated screens.
 */
export function App() {
  const [view, setView] = useState<ViewKey>('playground');
  return (
    <div className="app">
      <TopBar active={view} onChange={setView} />
      {view === 'playground' ? <PlaygroundView /> : <StressView />}
    </div>
  );
}
