import type { ReactNode } from 'react';

interface ScenarioSectionProps {
  /** Short title shown as the section heading. */
  readonly title: string;
  /** Prose under the heading — explains the mechanism the scenario demonstrates. */
  readonly description: ReactNode;
  /** Verbatim code snippet a consumer would write to enable this scenario. */
  readonly recipe: string;
  /** The geometric/optical badge comparison row (and anything else). */
  readonly children: ReactNode;
}

/**
 * One `<section>` per scenario in the demo: heading, description,
 * code recipe, column headers, and whatever rows the caller supplies
 * as children. Keeps every scenario file focused on the bit that
 * actually differs — the JSX wrapping the icon and the CSS (if any)
 * that backs it — without re-hand-rolling the page-chrome boilerplate.
 */
export function ScenarioSection({
  title,
  description,
  recipe,
  children,
}: ScenarioSectionProps) {
  return (
    <section>
      <header>
        <h2>{title}</h2>
      </header>
      <p>{description}</p>

      <pre className="recipe">{recipe}</pre>

      <div className="col-head">
        <span>geometric</span>
        <span>optical-center: auto</span>
        <span>markup</span>
      </div>

      <div className="scenario-grid">{children}</div>
    </section>
  );
}
