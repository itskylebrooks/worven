import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WordDetailsPanel } from './WordDetailsPanel';

describe('WordDetailsPanel', () => {
  it('keeps usage examples at the top left and shows a basic present-tense card by default', () => {
    const handleGenerate = vi.fn();
    const { container } = render(
      <WordDetailsPanel
        data={{
          primary: 'gehen',
          alternatives: [
            { term: 'laufen', gloss: 'to walk' },
            { term: 'fahren', gloss: 'to go by vehicle' },
            { term: 'reisen', gloss: 'to travel' },
          ],
          antonyms: [
            { term: 'bleiben', gloss: 'to stay' },
            { term: 'anhalten', gloss: 'to stop' },
          ],
          etymology:
            'From Old High German "gangan", later leveled into the modern verb "gehen".',
          pronunciation: 'GAY-en',
          verbConjugation: {
            coverage: 'basic',
            present: [
              {
                title: 'Present indicative',
                rows: [
                  { label: 'ich', form: 'gehe' },
                  { label: 'du', form: 'gehst' },
                  { label: 'er/sie/es', form: 'geht' },
                ],
              },
            ],
            past: [],
            future: [],
          },
          nounCases: null,
          examples: [
            { source: 'I go home.', target: 'Ich gehe nach Hause.' },
            { source: 'We go now.', target: 'Wir gehen jetzt.' },
            { source: 'Are you going too?', target: 'Gehst du auch?' },
          ],
        }}
        isLoadingVerbConjugation={false}
        onGenerateVerbConjugation={handleGenerate}
      />,
    );

    const leftColumn = container.querySelectorAll('.grid.self-start.gap-4')[0] as HTMLElement;
    const sectionLabels = Array.from(leftColumn.querySelectorAll('.word-section-label')).map(
      (node) => node.textContent?.trim(),
    );

    expect(sectionLabels).toEqual(['Usage examples', 'Pronunciation', 'Verb conjugation']);
    expect(screen.getByText('Etymology')).toBeVisible();
    expect(screen.getByText('Antonyms')).toBeVisible();
    expect(screen.getByText('bleiben')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Generate full conjugation' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Present' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Past' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Future' })).not.toBeInTheDocument();
    expect(screen.getByText('Present indicative')).toBeVisible();
    expect(screen.getByText('gehe')).toBeVisible();
  });

  it('switches between tense tabs and shows all tables for the selected tense', async () => {
    const user = userEvent.setup();

    render(
      <WordDetailsPanel
        data={{
          primary: 'aller',
          alternatives: [
            { term: 'marcher', gloss: 'to walk' },
            { term: 'partir', gloss: 'to leave' },
            { term: 'voyager', gloss: 'to travel' },
          ],
          antonyms: [{ term: 'rester', gloss: 'to stay' }],
          etymology: 'From Latin "ambulare" via Vulgar Latin forms that evolved into French.',
          pronunciation: 'ah-LAY',
          verbConjugation: {
            coverage: 'full',
            present: [
              {
                title: 'Present indicative',
                rows: [
                  { label: 'je', form: 'vais' },
                  { label: 'tu', form: 'vas' },
                ],
              },
            ],
            past: [
              {
                title: 'Passé composé',
                rows: [
                  { label: 'je', form: 'suis allé(e)' },
                  { label: 'tu', form: 'es allé(e)' },
                ],
              },
              {
                title: 'Imparfait',
                rows: [
                  { label: 'je', form: 'allais' },
                  { label: 'tu', form: 'allais' },
                ],
              },
            ],
            future: [
              {
                title: 'Futur simple',
                rows: [
                  { label: 'je', form: 'irai' },
                  { label: 'tu', form: 'iras' },
                ],
              },
            ],
          },
          nounCases: null,
          examples: [
            { source: 'I am going.', target: 'Je vais.' },
            { source: 'We went out.', target: 'Nous sommes allés.' },
            { source: 'She will go tomorrow.', target: 'Elle ira demain.' },
          ],
        }}
        isLoadingVerbConjugation={false}
        onGenerateVerbConjugation={vi.fn()}
      />,
    );

    const tenseButtons = screen.getAllByRole('button', { name: /Past|Present|Future/ });
    expect(tenseButtons.map((button) => button.textContent)).toEqual(['Past', 'Present', 'Future']);

    expect(screen.getByRole('button', { name: 'Past' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Passé composé')).toBeVisible();
    expect(screen.getByText('Imparfait')).toBeVisible();
    expect(screen.queryByText('Futur simple')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Future' }));

    expect(screen.getByRole('button', { name: 'Future' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Futur simple')).toBeVisible();
    expect(screen.queryByText('Passé composé')).not.toBeInTheDocument();
  });

  it('omits the verb conjugation card for non-verbs', () => {
    render(
      <WordDetailsPanel
        data={{
          primary: 'das Haus',
          alternatives: [
            { term: 'die Wohnung', gloss: 'apartment' },
            { term: 'das Gebäude', gloss: 'building' },
            { term: 'das Heim', gloss: 'home' },
          ],
          antonyms: [],
          etymology: 'From Old High German "hus", inherited from Proto-Germanic "*husan".',
          pronunciation: 'hows',
          verbConjugation: null,
          nounCases: {
            tables: [
              {
                title: 'Singular',
                rows: [
                  { label: 'Nominative', form: 'das Haus' },
                  { label: 'Genitive', form: 'des Hauses' },
                  { label: 'Dative', form: 'dem Haus' },
                  { label: 'Accusative', form: 'das Haus' },
                ],
              },
            ],
          },
          examples: [
            { source: 'The house is large.', target: 'Das Haus ist groß.' },
            { source: 'This is my house.', target: 'Das ist mein Haus.' },
            { source: 'We bought a house.', target: 'Wir haben ein Haus gekauft.' },
          ],
        }}
        isLoadingVerbConjugation={false}
        onGenerateVerbConjugation={vi.fn()}
      />,
    );

    expect(screen.queryByText('Verb conjugation')).not.toBeInTheDocument();
    expect(screen.getByText('Cases')).toBeVisible();
    expect(screen.getByText('des Hauses')).toBeVisible();
    expect(screen.getByText('No common antonyms listed.')).toBeVisible();
  });

  it('omits the cases card for non-nouns', () => {
    render(
      <WordDetailsPanel
        data={{
          primary: 'быстро',
          alternatives: [
            { term: 'скоро', gloss: 'soon' },
            { term: 'оперативно', gloss: 'rapidly' },
            { term: 'поспешно', gloss: 'hastily' },
          ],
          antonyms: [{ term: 'медленно', gloss: 'slowly' }],
          etymology:
            'Built from the adjective "быстрый" with an adverb-forming suffix used in Russian.',
          pronunciation: 'BYS-tra',
          verbConjugation: null,
          nounCases: null,
          examples: [
            { source: 'He ran quickly.', target: 'Он быстро побежал.' },
            { source: 'Speak quickly.', target: 'Говори быстро.' },
            { source: 'It ended quickly.', target: 'Это быстро закончилось.' },
          ],
        }}
        isLoadingVerbConjugation={false}
        onGenerateVerbConjugation={vi.fn()}
      />,
    );

    expect(screen.queryByText('Cases')).not.toBeInTheDocument();
  });
});
