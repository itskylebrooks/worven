import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WordDetailsPanel } from './WordDetailsPanel';

describe('WordDetailsPanel', () => {
  it('renders a verb conjugation table when verb data is available', () => {
    render(
      <WordDetailsPanel
        data={{
          primary: 'gehen',
          alternatives: [
            { term: 'laufen', gloss: 'to walk' },
            { term: 'fahren', gloss: 'to go by vehicle' },
            { term: 'reisen', gloss: 'to travel' },
          ],
          grammar: {
            notes: 'Verb. Often used for movement on foot and for going somewhere in general.',
          },
          pronunciation: 'GAY-en',
          verbConjugation: {
            title: 'Present indicative',
            rows: [
              { label: 'ich', form: 'gehe' },
              { label: 'du', form: 'gehst' },
              { label: 'er/sie/es', form: 'geht' },
            ],
          },
          examples: [
            { source: 'I go home.', target: 'Ich gehe nach Hause.' },
            { source: 'We go now.', target: 'Wir gehen jetzt.' },
            { source: 'Are you going too?', target: 'Gehst du auch?' },
          ],
        }}
      />,
    );

    const conjugationCard = screen.getByText('Verb conjugation').closest('section');

    expect(screen.getByText('Present indicative')).toBeVisible();
    expect(conjugationCard).not.toBeNull();

    const scoped = within(conjugationCard as HTMLElement);
    expect(scoped.getByRole('table')).toBeVisible();
    expect(scoped.getByText('ich')).toBeVisible();
    expect(scoped.getByText('gehe')).toBeVisible();
    expect(scoped.getByText('gehst')).toBeVisible();
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
          grammar: {
            notes: 'Noun. Neutral gender. Refers to a house or home depending on context.',
          },
          pronunciation: 'hows',
          verbConjugation: null,
          examples: [
            { source: 'The house is large.', target: 'Das Haus ist groß.' },
            { source: 'This is my house.', target: 'Das ist mein Haus.' },
            { source: 'We bought a house.', target: 'Wir haben ein Haus gekauft.' },
          ],
        }}
      />,
    );

    expect(screen.queryByText('Verb conjugation')).not.toBeInTheDocument();
  });
});
