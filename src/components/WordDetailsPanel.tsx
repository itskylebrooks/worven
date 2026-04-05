import { LoaderCircle, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import type {
  NounCaseTable,
  VerbConjugationTable,
  VerbConjugationTense,
  WordTranslationPayload,
} from '../types';

interface WordDetailsPanelProps {
  data: WordTranslationPayload;
  isLoadingVerbConjugation: boolean;
  onGenerateVerbConjugation: () => void;
}

const TENSE_OPTIONS: Array<{ key: VerbConjugationTense; label: string }> = [
  { key: 'past', label: 'Past' },
  { key: 'present', label: 'Present' },
  { key: 'future', label: 'Future' },
];

function LabeledFormTables({
  tables,
  keyPrefix,
}: {
  tables: Array<VerbConjugationTable | NounCaseTable>;
  keyPrefix: string;
}) {
  return (
    <div className="mt-4 space-y-4">
      {tables.map((table) => (
        <div key={`${keyPrefix}-${table.title}`} className="space-y-2">
          <div className="text-base font-normal text-strong">{table.title}</div>
          <div className="overflow-hidden rounded-xl border border-subtle bg-surface-elevated">
            <table className="min-w-full border-collapse text-left">
              <tbody>
                {table.rows.map((row) => (
                  <tr
                    key={`${table.title}-${row.label}-${row.form}`}
                    className="border-t border-subtle first:border-t-0"
                  >
                    <th
                      scope="row"
                      className="w-1/2 px-4 py-3 text-base font-medium leading-7 text-strong"
                    >
                      {row.label}
                    </th>
                    <td className="px-4 py-3 text-base leading-7 text-muted">{row.form}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

export function WordDetailsPanel({
  data,
  isLoadingVerbConjugation,
  onGenerateVerbConjugation,
}: WordDetailsPanelProps) {
  const pronunciation = data.pronunciation.trim();
  const pronunciationMatch = pronunciation.match(/^([^([]+?)(\s*[[()].*)?$/);
  const quotedPronunciation = pronunciationMatch?.[1]?.trim() || pronunciation;
  const pronunciationExplanation = pronunciationMatch?.[2]?.trim() || '';
  const verbConjugation = data.verbConjugation;
  const nounCases = data.nounCases;
  const [activeTense, setActiveTense] = useState<VerbConjugationTense>('past');

  const availableTenses = useMemo(
    () => ({
      present: Boolean(verbConjugation?.present.length),
      past: Boolean(verbConjugation?.past.length),
      future: Boolean(verbConjugation?.future.length),
    }),
    [verbConjugation],
  );
  const firstAvailableTense = useMemo(
    () => TENSE_OPTIONS.find((option) => availableTenses[option.key])?.key ?? 'past',
    [availableTenses],
  );
  const resolvedActiveTense = availableTenses[activeTense] ? activeTense : firstAvailableTense;
  const activeTables = verbConjugation?.[resolvedActiveTense] ?? [];
  const showGenerateButton = verbConjugation?.coverage === 'basic';
  const visibleTenseOptions = TENSE_OPTIONS.filter((option) => availableTenses[option.key]);

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
              <span className="text-muted"> {pronunciationExplanation}</span>
            ) : null}
          </p>
        </section>

        {nounCases ? (
          <section className="panel-shell px-6 py-5">
            <div className="word-section-label">Cases</div>
            <LabeledFormTables tables={nounCases.tables} keyPrefix="cases" />
          </section>
        ) : null}

        {verbConjugation ? (
          <section className="panel-shell px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="word-section-label">Verb conjugation</div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-3">
                {showGenerateButton ? (
                  <button
                    type="button"
                    onClick={onGenerateVerbConjugation}
                    disabled={isLoadingVerbConjugation}
                    className="icon-button"
                    aria-label="Generate full conjugation"
                    title="Generate full conjugation"
                  >
                    {isLoadingVerbConjugation ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </button>
                ) : null}

                {!showGenerateButton ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    {visibleTenseOptions.map((option) => {
                      const isActive = resolvedActiveTense === option.key;

                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => setActiveTense(option.key)}
                          className="conjugation-tab"
                          aria-pressed={isActive}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>

            <LabeledFormTables tables={activeTables} keyPrefix={resolvedActiveTense} />
          </section>
        ) : null}
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
