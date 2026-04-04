import type { WordTranslationPayload } from '../types';

interface WordDetailsPanelProps {
  data: WordTranslationPayload;
}

export function WordDetailsPanel({ data }: WordDetailsPanelProps) {
  return (
    <section className="panel-shell mt-4 overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="border-b border-subtle px-6 py-5 lg:border-b-0 lg:border-r">
          <div className="word-section-label">Related words</div>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {data.alternatives.map((item) => (
              <span key={item} className="word-alt-chip">
                {item}
              </span>
            ))}
          </div>

          <div className="mt-8 border-t border-subtle pt-5">
            <div className="word-section-label">Notes</div>
            <p className="mt-3 text-sm leading-6 text-muted">{data.grammar.notes}</p>
            <p className="mt-3 text-sm leading-6 text-strong">{data.pronunciation}</p>
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="word-section-label">Usage examples</div>
          <div className="mt-4 space-y-3">
            {data.examples.map((example, index) => (
              <article key={`${example.source}-${index}`} className="word-example-card">
                <p className="word-example-source">{example.source}</p>
                <p className="word-example-target">{example.target}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
