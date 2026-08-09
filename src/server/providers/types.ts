import type {
  SentenceTranslationPayload,
  VerbConjugationExpansionPayload,
  WordTranslationPayload,
} from '../../types.js';

export type RawTranslationPayload =
  | WordTranslationPayload
  | SentenceTranslationPayload
  | VerbConjugationExpansionPayload;
