import { createRoot } from 'react-dom/client';

function App() {
  return (
    <main>
      <h1>optical-center · React</h1>
      <p>
        The two badges below are identical except the right one carries{' '}
        <code>opticalCenter</code>. Watch the play triangle settle into the
        center.
      </p>

      <div className="row">
        <div className="badge">
          <svg viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <span>Geometric center (looks pulled left)</span>
      </div>

      <div className="row">
        <div className="badge">
          <svg opticalCenter viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <span>Optical center</span>
      </div>
    </main>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
