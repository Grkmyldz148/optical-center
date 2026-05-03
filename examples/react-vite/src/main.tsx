import { createRoot } from 'react-dom/client';

interface IconProps {
  readonly name: string;
  readonly path: string;
}

function Pair({ name, path }: IconProps) {
  return (
    <div className="pair">
      <div className="badge">
        <svg viewBox="0 0 24 24">
          <path d={path} />
        </svg>
        <span className="label">geometric</span>
      </div>
      <div className="badge">
        <svg opticalCenter viewBox="0 0 24 24">
          <path d={path} />
        </svg>
        <span className="label">optical</span>
      </div>
      <span className="name">{name}</span>
    </div>
  );
}

function App() {
  return (
    <main>
      <h1>optical-center · React + Vite</h1>
      <p>
        Each row shows the same icon twice — left is geometric centering,
        right has <code>opticalCenter</code> and is rewritten at build
        time. Inspect the second <code>&lt;svg&gt;</code> in DevTools:
        the <code>viewBox</code> is shifted and{' '}
        <code>data-optical-center</code> is set.
      </p>

      <div className="grid">
        <Pair name="play" path="M8 5v14l11-7z" />
        <Pair
          name="arrow-right"
          path="M5 11h11.17l-4.88-4.88a1 1 0 1 1 1.42-1.41l6.59 6.59a1 1 0 0 1 0 1.41l-6.59 6.59a1 1 0 1 1-1.42-1.41L16.17 13H5a1 1 0 0 1 0-2z"
        />
        <Pair name="triangle" path="M4 20 L20 20 L20 4 Z" />
      </div>
    </main>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
