import type {
  NounCaseData,
  NounCaseTable,
  SentenceTranslationPayload,
  TranslationRequest,
  VerbConjugationCoverage,
  VerbConjugationData,
  VerbConjugationExpansionPayload,
  VerbConjugationTable,
  WordTranslationPayload,
} from '../types.js';
import type { RawTranslationPayload } from './providers/types.js';

export function normalizeTranslationResult(
  request: TranslationRequest,
  payload: RawTranslationPayload,
): RawTranslationPayload {
  if (request.mode === 'word' && request.requestVerbConjugationExpansion) {
    const verbPayload = payload as VerbConjugationExpansionPayload;

    return {
      verbConjugation: normalizeVerbConjugation(verbPayload.verbConjugation, 'full'),
    };
  }

  if (request.mode === 'word') {
    const wordPayload = payload as WordTranslationPayload;
    const legacyGrammar = 'grammar' in wordPayload ? wordPayload.grammar : null;
    const etymology =
      typeof wordPayload.etymology === 'string'
        ? wordPayload.etymology
        : typeof legacyGrammar === 'object' &&
            legacyGrammar !== null &&
            typeof (legacyGrammar as { notes?: unknown }).notes === 'string'
          ? (legacyGrammar as { notes: string }).notes
          : null;

    if (
      typeof wordPayload.primary !== 'string' ||
      !Array.isArray(wordPayload.alternatives) ||
      typeof etymology !== 'string' ||
      typeof wordPayload.pronunciation !== 'string' ||
      !Array.isArray(wordPayload.examples)
    ) {
      throw new Error('The provider response did not match the expected word JSON shape.');
    }

    const primarySplit = splitPrimaryAndFallbackAlternatives(wordPayload.primary);
    const alternatives = normalizeWordRelations(
      wordPayload.alternatives,
      primarySplit.fallbackAlternatives,
    );
    const antonyms = normalizeWordRelations(
      'antonyms' in wordPayload ? wordPayload.antonyms : [],
    );

    const examples = wordPayload.examples
      .filter(
        (example): example is WordTranslationPayload['examples'][number] =>
          typeof example === 'object' &&
          example !== null &&
          typeof example.source === 'string' &&
          typeof example.target === 'string',
      )
      .slice(0, 3);

    return {
      primary: primarySplit.primary,
      alternatives,
      antonyms,
      etymology: normalizeTextQuotes(etymology),
      pronunciation: wordPayload.pronunciation,
      verbConjugation: normalizeVerbConjugation(
        'verbConjugation' in wordPayload ? wordPayload.verbConjugation : null,
        'basic',
      ),
      nounCases: normalizeNounCases('nounCases' in wordPayload ? wordPayload.nounCases : null),
      examples,
    };
  }

  const sentencePayload = payload as SentenceTranslationPayload;
  if (
    typeof sentencePayload.translation !== 'string' ||
    !(typeof sentencePayload.alternative === 'string' || sentencePayload.alternative === null)
  ) {
    throw new Error('The provider response did not match the expected sentence JSON shape.');
  }

  return sentencePayload;
}

function normalizeWordRelations(
  value: unknown,
  fallbackTerms: string[] = [],
): WordTranslationPayload['alternatives'] {
  const items = Array.isArray(value) ? value : [];

  return items
    .map((item) => {
      if (typeof item === 'string') {
        return {
          term: item.trim(),
          gloss: '',
        };
      }

      if (
        typeof item === 'object' &&
        item !== null &&
        typeof (item as { term?: unknown }).term === 'string' &&
        typeof (item as { gloss?: unknown }).gloss === 'string'
      ) {
        return item as WordTranslationPayload['alternatives'][number];
      }

      if (
        typeof item === 'object' &&
        item !== null &&
        typeof (item as { target?: unknown }).target === 'string' &&
        typeof (item as { source?: unknown }).source === 'string'
      ) {
        return {
          term: ((item as { target: string }).target || '').trim(),
          gloss: ((item as { source: string }).source || '').trim(),
        };
      }

      return null;
    })
    .filter(
      (item): item is WordTranslationPayload['alternatives'][number] =>
        item !== null && item.term.trim().length > 0,
    )
    .concat(fallbackTerms.map((term) => ({ term, gloss: '' })))
    .filter(
      (item, index, items) =>
        items.findIndex((candidate) => candidate.term.toLowerCase() === item.term.toLowerCase()) ===
        index,
    )
    .slice(0, 3);
}

function normalizeVerbConjugation(
  value: unknown,
  coverage: VerbConjugationCoverage,
): VerbConjugationData | null {
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { title?: unknown }).title === 'string' &&
    Array.isArray((value as { rows?: unknown[] }).rows)
  ) {
    const legacyTable = normalizeVerbConjugationTable(value);
    if (!legacyTable) {
      return null;
    }

    return {
      coverage: 'basic',
      present: [legacyTable],
      past: [],
      future: [],
    };
  }

  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const present = normalizeVerbConjugationTables((value as { present?: unknown }).present);
  const past = normalizeVerbConjugationTables((value as { past?: unknown }).past);
  const future = normalizeVerbConjugationTables((value as { future?: unknown }).future);

  if (coverage === 'basic') {
    if (present.length === 0) {
      return null;
    }

    return {
      coverage: 'basic',
      present: present.slice(0, 1),
      past: [],
      future: [],
    };
  }

  if (present.length === 0 && past.length === 0 && future.length === 0) {
    return null;
  }

  return {
    coverage: 'full',
    present,
    past,
    future,
  };
}

function normalizeNounCases(value: unknown): NounCaseData | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const tables = normalizeNounCaseTables((value as { tables?: unknown }).tables);

  if (tables.length === 0) {
    return null;
  }

  return { tables };
}

function normalizeVerbConjugationTables(value: unknown): VerbConjugationTable[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((table) => normalizeVerbConjugationTable(table))
    .filter((table): table is VerbConjugationTable => table !== null)
    .slice(0, 4);
}

function normalizeNounCaseTables(value: unknown): NounCaseTable[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((table) => normalizeNounCaseTable(table))
    .filter((table): table is NounCaseTable => table !== null)
    .slice(0, 3);
}

function normalizeVerbConjugationTable(value: unknown): VerbConjugationTable | null {
  const normalized = normalizeLabeledFormTable(value, 6);
  if (!normalized) {
    return null;
  }

  return normalized;
}

function normalizeNounCaseTable(value: unknown): NounCaseTable | null {
  const normalized = normalizeLabeledFormTable(value, 8);
  if (!normalized) {
    return null;
  }

  return normalized;
}

function normalizeLabeledFormTable(
  value: unknown,
  maxRows: number,
): { title: string; rows: Array<{ label: string; form: string }> } | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const title =
    typeof (value as { title?: unknown }).title === 'string'
      ? (value as { title: string }).title.trim()
      : '';
  const rawRows = Array.isArray((value as { rows?: unknown[] }).rows)
    ? ((value as { rows: unknown[] }).rows ?? [])
    : [];
  const rows = rawRows
    .map((row) => {
      if (typeof row !== 'object' || row === null) {
        return null;
      }

      const label =
        typeof (row as { label?: unknown }).label === 'string'
          ? (row as { label: string }).label.trim()
          : '';
      const form =
        typeof (row as { form?: unknown }).form === 'string'
          ? (row as { form: string }).form.trim()
          : '';

      if (!label || !form) {
        return null;
      }

      return { label, form };
    })
    .filter((row): row is Array<{ label: string; form: string }>[number] => row !== null)
    .slice(0, maxRows);

  if (!title || rows.length === 0) {
    return null;
  }

  return {
    title,
    rows,
  };
}

function normalizeTextQuotes(text: string) {
  return text
    .replace(/[“”]/g, '"')
    .replace(/‘([^’]+)’/g, '"$1"')
    .replace(/'([^']+)'/g, '"$1"')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitPrimaryAndFallbackAlternatives(primary: string) {
  const normalized = primary.replace(/\s+/g, ' ').trim();
  const pieces = normalized
    .split(/\s*(?:,|;|\/|\|)\s*/g)
    .map((item) => item.trim())
    .filter(Boolean);

  const looksLikeList =
    pieces.length > 1 &&
    pieces.length <= 5 &&
    pieces.every((item) => item.split(/\s+/).length <= 4);

  if (!looksLikeList) {
    return {
      primary: normalized,
      fallbackAlternatives: [] as string[],
    };
  }

  return {
    primary: pieces[0],
    fallbackAlternatives: pieces.slice(1),
  };
}

