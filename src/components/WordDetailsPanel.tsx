import type { WordTranslationPayload } from '../types';

interface WordDetailsPanelProps {
  data: WordTranslationPayload;
}

export function WordDetailsPanel({ data }: WordDetailsPanelProps) {
  const pronunciation = data.pronunciation.trim();
  const pronunciationMatch = pronunciation.match(/^([^([]+?)(\s*[[()].*)?$/);
  const quotedPronunciation = pronunciationMatch?.[1]?.trim() || pronunciation;
  const pronunciationExplanation = pronunciationMatch?.[2]?.trim() || '';

  return (
    <section className="mt-4 grid gap-4 lg:grid-cols-2">
      <div className="grid self-start gap-4">
        <section className="panel-shell self-start px-6 py-5">
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
          <div className="word-section-label">Pronunciation</div>
          <p className="mt-3 text-base leading-7 text-strong">
            <span>{quotedPronunciation}</span>
            {pronunciationExplanation ? (
              <span className="text-muted">
                {' '}
                {pronunciationExplanation}
              </span>
            ) : null}
          </p>
        </section>
      </div>

      <div className="grid self-start gap-4">
        <section className="panel-shell px-6 py-5">
          <div className="word-section-label">Related words</div>
          <div className="mt-4">
            {data.alternatives.map((item) => (
              <article
                key={`${item.term}-${item.gloss}`}
                className="border-t border-subtle py-4 first:border-t-0 first:pt-0 last:pb-0"
              >
                <div className="word-alt-target">{item.term}</div>
                <div className="word-alt-source">{item.gloss}</div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel-shell px-6 py-5">
          <div className="word-section-label">Notes</div>
          <p className="mt-3 text-base leading-7 text-muted">{data.grammar.notes}</p>
        </section>
      </div>
    </section>
  );
}
