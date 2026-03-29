import type { TranslationContext } from '../types';

export const SUPPORTED_LANGUAGES = [
  'English',
  'Russian',
  'German',
  'French',
  'Spanish',
  'Italian',
  'Portuguese',
  'Polish',
  'Turkish',
  'Arabic',
  'Chinese (Simplified)',
  'Japanese',
  'Korean',
  'Ukrainian',
  'Dutch',
] as const;

export const TRANSLATION_CONTEXTS: TranslationContext[] = [
  'General',
  'Formal',
  'Legal',
  'Medical',
  'Technical',
  'Casual',
  'Literary',
];
