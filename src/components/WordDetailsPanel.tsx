import type { WordTranslationPayload } from '../types';

interface WordDetailsPanelProps {
  data: WordTranslationPayload;
}

export function WordDetailsPanel({ data }: WordDetailsPanelProps) {
  return (
    <section className="mt-4 grid gap-4 lg:grid-cols-2">
      <section className="panel-shell px-6 py-5">
        <div className="word-section-label">Usage examples</div>
        <div className="mt-4 divide-y divide-subtle">
          {data.examples.map((example, index) => (
            <article
              key={`${example.source}-${index}`}
              className={index === 0 ? 'pb-4' : 'py-4 last:pb-0'}
            >
              <p className="word-example-source">{example.source}</p>
              <p className="word-example-target">{example.target}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel-shell px-6 py-5">
        <div className="word-section-label">Related words</div>
        <div className="mt-4 space-y-3">
          {data.alternatives.map((item) => (
            <div key={`${item.target}-${item.source}`} className="word-alt-row">
              <div className="word-alt-target">{item.target}</div>
              <div className="word-alt-source">{item.source}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 border-t border-subtle pt-5">
          <div className="word-section-label">Notes</div>
          <p className="mt-3 text-sm leading-6 text-muted">{data.grammar.notes}</p>
          <div className="word-pronunciation mt-4">{data.pronunciation}</div>
        </div>
      </section>
    </section>
  );
}
