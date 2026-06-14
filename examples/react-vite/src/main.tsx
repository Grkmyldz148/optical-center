import { createRoot } from 'react-dom/client';

import { CssClass } from './scenarios/css-class.js';
import { CssMask } from './scenarios/css-mask.js';
import { InlineSvg } from './scenarios/inline-svg.js';
import { JsxAttribute } from './scenarios/jsx-attribute.js';
import { TailwindUtility } from './scenarios/tailwind-utility.js';

import './styles/app.css';
import './styles/badge.css';
import './styles/icons.css';

/**
 * Five scenarios, one directive. Each row is a side-by-side
 * comparison of an icon centered the usual way (geometric centre)
 * and the same icon centered optically. The point of the demo is
 * to show how few places the directive has to live: a CSS class,
 * a Tailwind utility, a JSX attribute — pick one, never the icon
 * itself, always the wrapper.
 */
function App() {
  return (
    <main>
      <h1>optical-center</h1>
      <p className="lede">
        One opt-in, five flavours. Put{' '}
        <code>optical-center: auto</code> on a container's CSS rule,{' '}
        on the <code>optical-center</code> Tailwind utility, or as a
        JSX <code>optical-center="auto"</code> attribute on the
        wrapper — the directive always lives on the container, never
        on the icon. Left badge: geometric. Right badge: optical.
        Each has a crosshair so the shift is eyeballable.
      </p>

      <CssClass />
      <TailwindUtility />
      <JsxAttribute />
      <InlineSvg />
      <CssMask />
    </main>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
