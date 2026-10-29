import { useEffect } from "react";
import { AgentDock } from "@plingjs/react";
import { copyFor, plingLocale, resolveDemoLocale, type DemoLocale } from "./copy";

export interface AppProps {
  locale?: DemoLocale;
}

export function App({ locale = resolveDemoLocale() }: AppProps) {
  const copy = copyFor(locale);

  useEffect(() => {
    document.title = copy.documentTitle;
    document.documentElement.lang = plingLocale(locale);
  }, [copy.documentTitle, locale]);

  return (
    <main className="page" data-locale={locale}>
      <section className="setup">
        <header className="setup__header">
          <div>
            <p className="setup__eyebrow">{copy.eyebrow}</p>
            <h1>{copy.heading}</h1>
          </div>
          <span className="setup__count">{copy.actionCount}</span>
        </header>

        <p className="setup__lead">{copy.lead}</p>

        <ol className="checks">
          {copy.checks.map((label, index) => (
            <li key={label} className={index < 3 ? undefined : "is-pending"}>
              <span className="checks__mark" aria-hidden="true">{index < 3 ? "✓" : "→"}</span>
              <span>{label}</span>
            </li>
          ))}
        </ol>

        <aside className="next">
          <strong>{copy.nextLabel}</strong> {copy.nextText}
        </aside>
      </section>

      <AgentDock title={copy.dockTitle} quick={copy.quick} />
    </main>
  );
}
