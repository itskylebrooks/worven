import type { TranslationRequest } from '../types';

export function buildTranslationPrompts(request: TranslationRequest) {
  const baseRules = [
    'You are a translation engine.',
    'Auto-detect the source language from the user input.',
    'Translate into the requested target language.',
    'Respect the requested translation context.',
    'Return valid JSON only.',
    'Do not wrap the JSON in markdown fences.',
    'Do not add commentary outside the JSON object.',
  ];

  if (request.mode === 'word') {
    return {
      systemPrompt: [
        ...baseRules,
        'For grammar.notes, include whatever linguistic metadata is most useful for the target language.',
        `Pronunciation must be written in the user native language/script: ${request.nativeLanguage}.`,
      ].join(' '),
      userPrompt: `
Translate this input in word mode.

Source text: ${request.sourceText}
Target language: ${request.targetLanguage}
Translation context: ${request.context}
User native language for pronunciation: ${request.nativeLanguage}

Return exactly this JSON shape:
{
  "primary": "string",
  "alternatives": ["string", "string"],
  "grammar": { "notes": "string" },
  "pronunciation": "string",
  "examples": ["string", "string"]
}

Requirements:
- Provide 2 or 3 alternatives.
- Provide 2 or 3 concise examples in the target language.
- Keep examples natural and useful.
`.trim(),
    };
  }

  if (request.requestAlternative) {
    return {
      systemPrompt: baseRules.join(' '),
      userPrompt: `
Translate this input in sentence mode and provide an alternative rendering.

Source text: ${request.sourceText}
Target language: ${request.targetLanguage}
Translation context: ${request.context}
User native language: ${request.nativeLanguage}

Return exactly this JSON shape:
{
  "translation": "string",
  "alternative": "string"
}

Requirements:
- "translation" should be the best default translation.
- "alternative" must be meaningfully different in tone, register, or phrasing.
`.trim(),
    };
  }

  return {
    systemPrompt: baseRules.join(' '),
    userPrompt: `
Translate this input in sentence mode.

Source text: ${request.sourceText}
Target language: ${request.targetLanguage}
Translation context: ${request.context}
User native language: ${request.nativeLanguage}

Return exactly this JSON shape:
{
  "translation": "string",
  "alternative": null
}

Requirements:
- "translation" should be the single best default translation.
- "alternative" must be null.
`.trim(),
  };
}
