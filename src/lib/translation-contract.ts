import { SUPPORTED_LANGUAGES, TRANSLATION_CONTEXTS } from '../constants/languages';
import type {
  NounCaseData,
  NounCaseTable,
  SentenceTranslationPayload,
  TranslationContext,
  TranslationRequest,
  VerbConjugationData,
  VerbConjugationExpansionPayload,
  VerbConjugationTable,
  WordAlternative,
  WordTranslationPayload,
  WordUsageExample,
} from '../types';

export type TranslationApiResult =
  | WordTranslationPayload
  | SentenceTranslationPayload
  | VerbConjugationExpansionPayload;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isTranslationContext(value: unknown): value is TranslationContext {
  return (
    typeof value === 'string' &&
    TRANSLATION_CONTEXTS.some((context) => context === value)
  );
}

export function isSupportedLanguage(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    SUPPORTED_LANGUAGES.some((language) => language === value)
  );
}

function isWordAlternative(value: unknown): value is WordAlternative {
  return isRecord(value) && typeof value.term === 'string' && typeof value.gloss === 'string';
}

function isWordUsageExample(value: unknown): value is WordUsageExample {
  return isRecord(value) && typeof value.source === 'string' && typeof value.target === 'string';
}

function isLabeledFormTable(value: unknown): value is VerbConjugationTable | NounCaseTable {
  return (
    isRecord(value) &&
    typeof value.title === 'string' &&
    Array.isArray(value.rows) &&
    value.rows.every(
      (row) => isRecord(row) && typeof row.label === 'string' && typeof row.form === 'string',
    )
  );
}

export function isVerbConjugationData(value: unknown): value is VerbConjugationData {
  return (
    isRecord(value) &&
    (value.coverage === 'basic' || value.coverage === 'full') &&
    Array.isArray(value.present) &&
    value.present.every(isLabeledFormTable) &&
    Array.isArray(value.past) &&
    value.past.every(isLabeledFormTable) &&
    Array.isArray(value.future) &&
    value.future.every(isLabeledFormTable)
  );
}

export function isNounCaseData(value: unknown): value is NounCaseData {
  return (
    isRecord(value) && Array.isArray(value.tables) && value.tables.every(isLabeledFormTable)
  );
}

export function isWordTranslationPayload(value: unknown): value is WordTranslationPayload {
  return (
    isRecord(value) &&
    typeof value.primary === 'string' &&
    Array.isArray(value.alternatives) &&
    value.alternatives.every(isWordAlternative) &&
    Array.isArray(value.antonyms) &&
    value.antonyms.every(isWordAlternative) &&
    typeof value.etymology === 'string' &&
    typeof value.pronunciation === 'string' &&
    (value.verbConjugation === null || isVerbConjugationData(value.verbConjugation)) &&
    (value.nounCases === null || isNounCaseData(value.nounCases)) &&
    Array.isArray(value.examples) &&
    value.examples.every(isWordUsageExample)
  );
}

export function isSentenceTranslationPayload(
  value: unknown,
): value is SentenceTranslationPayload {
  return (
    isRecord(value) &&
    typeof value.translation === 'string' &&
    (typeof value.alternative === 'string' || value.alternative === null)
  );
}

export function isVerbConjugationExpansionPayload(
  value: unknown,
): value is VerbConjugationExpansionPayload {
  return (
    isRecord(value) &&
    (value.verbConjugation === null || isVerbConjugationData(value.verbConjugation))
  );
}

export function isTranslationApiResultForRequest(
  request: TranslationRequest,
  value: unknown,
): value is TranslationApiResult {
  if (request.mode === 'sentence') {
    return isSentenceTranslationPayload(value);
  }

  if (request.requestVerbConjugationExpansion) {
    return isVerbConjugationExpansionPayload(value);
  }

  return isWordTranslationPayload(value);
}

export function isTranslationRequest(value: unknown): value is TranslationRequest {
  if (!isRecord(value)) {
    return false;
  }

  const hasValidBase =
    typeof value.sourceText === 'string' &&
    isSupportedLanguage(value.targetLanguage) &&
    isSupportedLanguage(value.nativeLanguage) &&
    isTranslationContext(value.context) &&
    (typeof value.detailFocus === 'undefined' ||
      value.detailFocus === 'source' ||
      value.detailFocus === 'target') &&
    (typeof value.sourceLanguageHint === 'undefined' ||
      isSupportedLanguage(value.sourceLanguageHint)) &&
    (typeof value.requestAlternative === 'undefined' ||
      typeof value.requestAlternative === 'boolean') &&
    (typeof value.requestVerbConjugationExpansion === 'undefined' ||
      typeof value.requestVerbConjugationExpansion === 'boolean');

  if (!hasValidBase) {
    return false;
  }

  if (value.mode === 'sentence') {
    return (
      typeof value.requestVerbConjugationExpansion === 'undefined' &&
      typeof value.detailFocus === 'undefined' &&
      typeof value.sourceLanguageHint === 'undefined'
    );
  }

  if (value.mode === 'word') {
    return typeof value.requestAlternative === 'undefined';
  }

  return false;
}
