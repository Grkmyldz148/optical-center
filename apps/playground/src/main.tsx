import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.js';
import { applyTheme } from './lib/theme.js';

import './styles/reset.css';
import './styles/tokens.css';
import './styles/app.css';
import './styles/controls.css';
import './styles/stage.css';
import './styles/stress.css';

// Push every HelmLab-generated colour token onto `<html>` BEFORE
// React mounts. The CSS files only declare typography/spacing/motion
// — colour comes entirely from here.
applyTheme();

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
