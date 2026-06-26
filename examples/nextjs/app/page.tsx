'use client';

import { addCollection, Icon } from '@iconify/react';
import { ChevronLeft } from 'lucide-react';

// The optical-center loader rewrites this collection's icon bodies at build
// time (scoped via `iconData.include: ['demo-icons']` in next.config.ts), so
// the registered `demo:play` already carries the optical translate.
import demoIcons from './demo-icons.json';

addCollection(demoIcons as Parameters<typeof addCollection>[0]);

export default function Home() {
  return (
    <main>
      <h1>optical-center · Next.js adapter</h1>
      <p className="lede">
        The crosshair marks each box&rsquo;s true geometric center. A play
        triangle dropped at the geometric midpoint looks pulled left; the
        corrected one sits with its visual mass over the crosshair.
      </p>

      <section>
        <h2>1 · Inline &lt;svg optical-center&gt; (the headline path)</h2>
        <div className="pair">
          <div className="cell">
            {/* Raw — geometric center, no directive. */}
            <div className="box">
              <svg id="raw-svg" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
            </div>
            <small>raw · viewBox 0 0 24 24</small>
          </div>

          <div className="cell">
            {/* Marked — the loader rewrites this viewBox at build time. */}
            <div className="box">
              <svg id="optical-svg" optical-center="auto" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
            </div>
            <small>optical-center · viewBox rewritten</small>
          </div>
        </div>
      </section>

      <section>
        <h2>2 · Imported icon data (Iconify collection, auto-corrected)</h2>
        <div className="pair">
          <div className="cell">
            {/* Raw inline copy of the same glyph for comparison. */}
            <div className="box">
              <svg id="raw-icon" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
            </div>
            <small>raw inline copy</small>
          </div>

          <div className="cell">
            <div className="box">
              <Icon id="optical-icon" icon="demo:play" width={56} height={56} />
            </div>
            <small>demo:play · body-wrapped at build</small>
          </div>
        </div>
      </section>

      <section>
        <h2>3 · lucide-react component (container directive)</h2>
        <div className="pair">
          <div className="cell">
            {/* Raw lucide component — no directive. */}
            <div className="box">
              <ChevronLeft id="raw-chevron" />
            </div>
            <small>&lt;ChevronLeft /&gt;</small>
          </div>

          <div className="cell">
            {/* The Babel plugin resolves <ChevronLeft /> to its lucide-static
                source SVG, computes the offset, and injects a translate. */}
            <div className="box" optical-center="auto">
              <ChevronLeft id="optical-chevron" />
            </div>
            <small>&lt;div optical-center&gt;&lt;ChevronLeft /&gt;</small>
          </div>
        </div>
      </section>
    </main>
  );
}
