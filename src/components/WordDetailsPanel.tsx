import type { WordTranslationPayload } from '../types';

interface WordDetailsPanelProps {
  data: WordTranslationPayload;
}

export function WordDetailsPanel({ data }: WordDetailsPanelProps) {
  return (
    <section className="mt-4 grid gap-4 lg:grid-cols-2">
      <section className="panel-shell px-6 py-5">
        <div className="word-section-label">Usage examples</div>
        <div className="mt-4">
          {data.examples.map((example, index) => (
            <article
              key={`${example.source}-${index}`}
              className="border-t border-subtle py-4 first:border-t-0 first:pt-0 last:pb-0"
            >
              <p className="word-example-source">{example.source}</p>
              <p className="word-example-target">{example.target}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel-shell px-6 py-5">
        <div className="word-section-label">Related words</div>
        <div className="mt-4">
          {data.alternatives.map((item) => (
            <article
              key={`${item.term}-${item.gloss}`}
              className="border-t border-subtle py-3 first:border-t-0 first:pt-0 last:pb-0"
            >
              <div className="word-alt-target">{item.term}</div>
              <div className="word-alt-source">{item.gloss}</div>
            </article>
          ))}
        </div>

        <div className="mt-8 border-t border-subtle pt-5">
          <div className="word-section-label">Notes</div>
          <p className="mt-3 text-sm leading-6 text-muted">{data.grammar.notes}</p>
          <p className="mt-4">
            <span className="word-pronunciation">{data.pronunciation}</span>
          </p>
        </div>
      </section>
    </section>
  );
}
