import type { TranslationContext, TranslationRequest } from '../types';

type JsonSchema = Record<string, unknown>;

const CONTEXT_INSTRUCTIONS: Record<TranslationContext, string> = {
  General:
    'Use a neutral, broadly applicable translation that sounds natural in everyday usage.',
  Formal:
    'Use a polished, professional, and polite register appropriate for business or official communication.',
  Legal:
    'Preserve legal meaning precisely, avoid casual paraphrase, and prefer terminology suitable for contracts, policies, or compliance material.',
  Medical:
    'Preserve medical meaning carefully, keep terminology accurate, and avoid embellishment or simplification that changes clinical intent.',
  Technical:
    'Preserve technical meaning exactly, keep domain terminology precise, and retain established acronyms or jargon when appropriate.',
  Casual:
    'Use natural conversational phrasing that sounds relaxed and idiomatic without becoming sloppy or inaccurate.',
  Literary:
    'Favor expressive, stylistically rich wording while preserving the original meaning, imagery, and emotional tone.',
};

function buildWordSchema(): JsonSchema {
  return {
    type: 'object',
    properties: {
      primary: {
        type: 'string',
        description: 'Best primary translation for the source word or short phrase.',
      },
      alternatives: {
        type: 'array',
        description: 'Two or three distinct alternative translations.',
        items: {
          type: 'string',
        },
      },
      grammar: {
        type: 'object',
        properties: {
          notes: {
            type: 'string',
            description:
              'Brief linguistic notes for the target language, such as part of speech, gender, inflection, or register when relevant.',
          },
        },
        required: ['notes'],
        additionalProperties: false,
      },
      pronunciation: {
        type: 'string',
        description:
          'Pronunciation guidance for the primary translation, written for a speaker of the user native language.',
      },
      examples: {
        type: 'array',
        description: 'Two or three short usage-example pairs.',
        items: {
          type: 'object',
          properties: {
            source: {
              type: 'string',
              description: 'A concise natural example in the detected source language.',
            },
            target: {
              type: 'string',
              description: 'The translated version of that example in the target language.',
            },
          },
          required: ['source', 'target'],
          additionalProperties: false,
        },
      },
    },
    required: ['primary', 'alternatives', 'grammar', 'pronunciation', 'examples'],
    additionalProperties: false,
  };
}

function buildSentenceSchema(): JsonSchema {
  return {
    type: 'object',
    properties: {
      translation: {
        type: 'string',
        description: 'Best default translation for the full source sentence or passage.',
      },
      alternative: {
        type: ['string', 'null'],
        description:
          'A clearly different alternative rendering when requested, otherwise null.',
      },
    },
    required: ['translation', 'alternative'],
    additionalProperties: false,
  };
}

export function buildTranslationPrompts(request: TranslationRequest) {
  const contextInstruction = CONTEXT_INSTRUCTIONS[request.context];
  const baseRules = [
    'You are a translation engine.',
    'Auto-detect the source language from the user input.',
    'Translate into the requested target language.',
    `Apply this translation style exactly: ${contextInstruction}`,
    'Preserve meaning before ornamentation.',
    'Return valid JSON only.',
    'Do not wrap the JSON in markdown fences.',
    'Do not add commentary outside the JSON object.',
  ];

  if (request.mode === 'word') {
    return {
      outputSchema: buildWordSchema(),
      systemPrompt: [
        ...baseRules,
        'Treat the source as a standalone lexical item or very short phrase, not as a full sentence.',
        'Prefer dictionary-quality translations that a learner could reuse confidently.',
        'Return alternatives that are genuinely different common renderings, not tiny rewrites of the same phrase.',
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
  "examples": [
    { "source": "string", "target": "string" },
    { "source": "string", "target": "string" }
  ]
}

Requirements:
- Provide 2 or 3 alternatives.
- Provide 2 or 3 concise source/target example pairs.
- Keep examples natural, useful, and short.
`.trim(),
    };
  }

  if (request.requestAlternative) {
    return {
      outputSchema: buildSentenceSchema(),
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
    outputSchema: buildSentenceSchema(),
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
