import type {
  AppSettings,
  TranslationDirectionMode,
  TranslationRequest,
} from '../types';

type RequestSettings = Pick<
  AppSettings,
  'nativeLanguage' | 'targetLanguage' | 'translationContext'
>;

interface BaseRequestOptions {
  sourceText: string;
}

interface SentenceRequestOptions extends BaseRequestOptions {
  mode: 'sentence';
  requestAlternative?: boolean;
}

interface WordRequestOptions extends BaseRequestOptions {
  mode: 'word';
  requestVerbConjugationExpansion?: false;
}

interface VerbConjugationRequestOptions extends BaseRequestOptions {
  mode: 'word';
  requestVerbConjugationExpansion: true;
}

type RequestOptions =
  | SentenceRequestOptions
  | WordRequestOptions
  | VerbConjugationRequestOptions;

export function buildTranslationRequest(
  settings: RequestSettings,
  directionMode: TranslationDirectionMode,
  options: VerbConjugationRequestOptions,
): TranslationRequest & { mode: 'word'; requestVerbConjugationExpansion: true };
export function buildTranslationRequest(
  settings: RequestSettings,
  directionMode: TranslationDirectionMode,
  options: WordRequestOptions,
): TranslationRequest & { mode: 'word' };
export function buildTranslationRequest(
  settings: RequestSettings,
  directionMode: TranslationDirectionMode,
  options: SentenceRequestOptions,
): TranslationRequest & { mode: 'sentence' };
export function buildTranslationRequest(
  settings: RequestSettings,
  directionMode: TranslationDirectionMode,
  options: RequestOptions,
): TranslationRequest {
  const targetLanguage =
    directionMode === 'source_to_target' ? settings.targetLanguage : settings.nativeLanguage;
  const baseRequest = {
    sourceText: options.sourceText,
    targetLanguage,
    nativeLanguage: settings.nativeLanguage,
    context: settings.translationContext,
    mode: options.mode,
  } as const;

  if (options.mode === 'sentence') {
    return {
      ...baseRequest,
      requestAlternative: options.requestAlternative,
    };
  }

  return {
    ...baseRequest,
    detailFocus: directionMode === 'source_to_target' ? 'target' : 'source',
    sourceLanguageHint:
      directionMode === 'source_to_target' ? settings.nativeLanguage : settings.targetLanguage,
    requestVerbConjugationExpansion: options.requestVerbConjugationExpansion,
  };
}
