import type { TranslationContext, TranslationRequest } from '../types.js';

type JsonSchema = Record<string, unknown>;

const CONTEXT_INSTRUCTIONS: Record<TranslationContext, string> = {
  General: 'Use a neutral, broadly applicable translation that sounds natural in everyday usage.',
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

function buildConjugationTableSchema(focusLanguage: string): JsonSchema {
  return {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description:
          'Short label for the conjugation set, such as "Present indicative" or "Simple future".',
      },
      rows: {
        type: 'array',
        description:
          'Three to six learner-useful conjugation rows. Each row should pair a person, pronoun, or grammatical label with the conjugated form.',
        items: {
          type: 'object',
          properties: {
            label: {
              type: 'string',
              description: 'Short pronoun or grammatical label for the row.',
            },
            form: {
              type: 'string',
              description: `Conjugated verb form in ${focusLanguage}.`,
            },
          },
          required: ['label', 'form'],
          additionalProperties: false,
        },
      },
    },
    required: ['title', 'rows'],
    additionalProperties: false,
  };
}

function buildVerbConjugationSchema(focusLanguage: string, coverage: 'basic' | 'full'): JsonSchema {
  return {
    type: ['object', 'null'],
    description: `Verb conjugation details for the focus lexical item in ${focusLanguage}. Return null when the focus lexical item is not a verb.`,
    properties: {
      coverage: {
        type: 'string',
        enum: [coverage],
      },
      present: {
        type: 'array',
        description: 'Present-tense conjugation tables.',
        items: buildConjugationTableSchema(focusLanguage),
      },
      past: {
        type: 'array',
        description: 'Past-tense conjugation tables.',
        items: buildConjugationTableSchema(focusLanguage),
      },
      future: {
        type: 'array',
        description: 'Future-tense conjugation tables.',
        items: buildConjugationTableSchema(focusLanguage),
      },
    },
    required: ['coverage', 'present', 'past', 'future'],
    additionalProperties: false,
  };
}

function buildNounCaseTableSchema(focusLanguage: string): JsonSchema {
  return {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description:
          'Short label for the noun-case set, such as "Singular", "Plural", or "With article".',
      },
      rows: {
        type: 'array',
        description:
          'Learner-useful noun-case rows. Each row should pair a grammatical case label with the corresponding form, article-plus-form, or ending pattern.',
        items: {
          type: 'object',
          properties: {
            label: {
              type: 'string',
              description: 'Short case label such as nominative, genitive, dative, or accusative.',
            },
            form: {
              type: 'string',
              description: `Case form, article-plus-form, or ending pattern in ${focusLanguage}.`,
            },
          },
          required: ['label', 'form'],
          additionalProperties: false,
        },
      },
    },
    required: ['title', 'rows'],
    additionalProperties: false,
  };
}

function buildNounCasesSchema(focusLanguage: string): JsonSchema {
  return {
    type: ['object', 'null'],
    description: `Noun-case or declension details for the focus lexical item in ${focusLanguage}. Return null when the focus lexical item is not a noun or when case tables are not relevant for the language.`,
    properties: {
      tables: {
        type: 'array',
        description:
          'One to three learner-useful noun-case tables. Use multiple tables when the language distinguishes singular and plural or other common declension groupings.',
        items: buildNounCaseTableSchema(focusLanguage),
      },
    },
    required: ['tables'],
    additionalProperties: false,
  };
}

function buildWordSchema(focusLanguage: string, glossLanguage: string): JsonSchema {
  return {
    type: 'object',
    properties: {
      primary: {
        type: 'string',
        description: 'Best primary translation for the source word or short phrase.',
      },
      alternatives: {
        type: 'array',
        description: `Two or three related or alternative terms in ${focusLanguage}, each with a short gloss in ${glossLanguage}.`,
        items: {
          type: 'object',
          properties: {
            term: {
              type: 'string',
              description: `Related or alternative term in ${focusLanguage}.`,
            },
            gloss: {
              type: 'string',
              description: `Short gloss or equivalent meaning in ${glossLanguage}.`,
            },
          },
          required: ['term', 'gloss'],
          additionalProperties: false,
        },
      },
      grammar: {
        type: 'object',
        properties: {
          notes: {
            type: 'string',
            description: `Brief linguistic notes for the focus lexical item in ${focusLanguage}, such as part of speech, gender, inflection, or register when relevant.`,
          },
        },
        required: ['notes'],
        additionalProperties: false,
      },
      pronunciation: {
        type: 'string',
        description:
          'Pronunciation guidance for the focus lexical item, written for a speaker of the user native language.',
      },
      verbConjugation: buildVerbConjugationSchema(focusLanguage, 'basic'),
      nounCases: buildNounCasesSchema(focusLanguage),
      examples: {
        type: 'array',
        description: 'Two or three short usage-example pairs.',
        items: {
          type: 'object',
          properties: {
            source: {
              type: 'string',
              description: 'A concise natural example on the source side of the lookup.',
            },
            target: {
              type: 'string',
              description: 'The corresponding translation on the target side of the lookup.',
            },
          },
          required: ['source', 'target'],
          additionalProperties: false,
        },
      },
    },
    required: [
      'primary',
      'alternatives',
      'grammar',
      'pronunciation',
      'verbConjugation',
      'nounCases',
      'examples',
    ],
    additionalProperties: false,
  };
}

function buildVerbConjugationExpansionSchema(focusLanguage: string): JsonSchema {
  return {
    type: 'object',
    properties: {
      verbConjugation: buildVerbConjugationSchema(focusLanguage, 'full'),
    },
    required: ['verbConjugation'],
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
        description: 'A clearly different alternative rendering when requested, otherwise null.',
      },
    },
    required: ['translation', 'alternative'],
    additionalProperties: false,
  };
}

export function buildTranslationPrompts(request: TranslationRequest) {
  const contextInstruction = CONTEXT_INSTRUCTIONS[request.context];
  const detailFocus = request.detailFocus ?? 'target';
  const foreignLanguage =
    detailFocus === 'target'
      ? request.targetLanguage
      : request.sourceLanguageHint || 'the detected source language';
  const foreignTermLocationInstruction =
    detailFocus === 'target'
      ? `The foreign-language term being learned is the translated output in ${foreignLanguage}, not the user's source text.`
      : `The foreign-language term being learned is the source text in ${foreignLanguage}, not the native-language translation output.`;
  const baseRules = [
    'You are a translation engine.',
    'Auto-detect the source language from the user input.',
    'Translate into the requested target language.',
    `Apply this translation style exactly: ${contextInstruction}`,
    'Preserve meaning before ornamentation.',
    'Preserve paragraph breaks and line breaks where they carry structure from the source text.',
    'Return valid JSON only.',
    'Do not wrap the JSON in markdown fences.',
    'Do not add commentary outside the JSON object.',
  ];

  if (request.mode === 'word') {
    const glossLanguage = request.nativeLanguage;

    if (request.requestVerbConjugationExpansion) {
      return {
        outputSchema: buildVerbConjugationExpansionSchema(foreignLanguage),
        systemPrompt: [
          ...baseRules,
          'Treat the source as a standalone lexical item or very short phrase, not as a full sentence.',
          foreignTermLocationInstruction,
          `Identify the foreign-language verb being learned in ${foreignLanguage}.`,
          'Return only verb conjugation data.',
          `If the foreign-language lexical item is not a verb, return null for "verbConjugation".`,
          'This is an explicit expansion request, not a minimal sample.',
          'Do not return only one extra table if the language commonly uses several distinct tense or aspect patterns.',
          'Group the conjugations into present, past, and future.',
          'A single tense bucket may contain multiple tables when the language commonly distinguishes multiple forms, such as simple vs. progressive, continuous, perfect, literary vs. colloquial, or auxiliary-based vs. synthetic paradigms.',
          'When the language has multiple common present-time forms, include them all in the present bucket, not just the default simple present.',
          'Prefer fuller learner-useful coverage over conservative under-generation.',
          'Use empty arrays for tense buckets that do not naturally apply.',
          `Keep every conjugated form in ${foreignLanguage}.`,
        ].join(' '),
        userPrompt: `
Expand verb conjugation data for this word lookup.

Source text: ${request.sourceText}
Target language: ${request.targetLanguage}
Translation context: ${request.context}
User native language: ${request.nativeLanguage}
Foreign language being learned: ${foreignLanguage}
Foreign-language term location: ${detailFocus === 'target' ? 'translated output' : 'source text'}

Return exactly this JSON shape:
{
  "verbConjugation": {
    "coverage": "full",
    "present": [
      {
        "title": "string",
        "rows": [
          { "label": "string", "form": "string" },
          { "label": "string", "form": "string" }
        ]
      }
    ],
    "past": [
      {
        "title": "string",
        "rows": [
          { "label": "string", "form": "string" },
          { "label": "string", "form": "string" }
        ]
      }
    ],
    "future": [
      {
        "title": "string",
        "rows": [
          { "label": "string", "form": "string" },
          { "label": "string", "form": "string" }
        ]
      }
    ]
  }
}

Requirements:
- Use the foreign-language term described above, even if it is not in the UI block labeled "Source".
- If that foreign-language term is not a verb, "verbConjugation" must be null.
- If it is a verb, "coverage" must be "full".
- Include all commonly useful present, past, and future conjugation tables for learners.
- This is a full expansion request, so do not stop after only one or two tables if more common forms exist in the language.
- Include additional present-time forms such as continuous, progressive, habitual, or perfect-present patterns whenever they are common in the language.
- A tense bucket may contain multiple tables when the language distinguishes multiple common forms.
- For languages with multiple present, past, or future paradigms, include each common paradigm as its own table with a distinct title.
- If a tense bucket is not applicable, return an empty array for it.
- Keep labels concise and keep every conjugated form in ${foreignLanguage}.
`.trim(),
      };
    }

    return {
      outputSchema: buildWordSchema(foreignLanguage, glossLanguage),
      systemPrompt: [
        ...baseRules,
        'Treat the source as a standalone lexical item or very short phrase, not as a full sentence.',
        'Prefer dictionary-quality translations that a learner could reuse confidently.',
        foreignTermLocationInstruction,
        `Explain and contextualize the foreign-language lexical item in ${foreignLanguage}.`,
        'Return alternatives that are genuinely different common renderings, not tiny rewrites of the same phrase.',
        'For languages where dictionary forms commonly include articles or determiners for nouns, include them whenever relevant. For example, German nouns should include "der", "die", or "das".',
        `Write grammar.notes in ${request.nativeLanguage}, explain the ${foreignLanguage} term clearly, and use double quotes instead of single quotes.`,
        `Pronunciation must always be for the ${foreignLanguage} term being learned, never for the native-language translation, and must be written in the user native language/script: ${request.nativeLanguage}.`,
        `For related words, always return the foreign-language term being learned in ${foreignLanguage}, with only a short gloss in ${glossLanguage}.`,
        `If the foreign-language lexical item is a noun and the language uses grammatical cases or productive declension patterns, return learner-useful noun-case tables in ${foreignLanguage}.`,
        'For German nouns, include the article together with each form when relevant, for example "der Mann" or "dem Mann".',
        'For Russian and similar highly inflected languages, you may return the full form or the ending pattern, whichever is more useful to the learner.',
      ].join(' '),
      userPrompt: `
Translate this input in word mode.

Source text: ${request.sourceText}
Target language: ${request.targetLanguage}
Translation context: ${request.context}
User native language for pronunciation: ${request.nativeLanguage}
Foreign language being learned: ${foreignLanguage}
Foreign-language term location: ${detailFocus === 'target' ? 'translated output' : 'source text'}

Return exactly this JSON shape:
{
  "primary": "string",
  "alternatives": [
    { "term": "string", "gloss": "string" },
    { "term": "string", "gloss": "string" }
  ],
  "grammar": { "notes": "string" },
  "pronunciation": "string",
  "verbConjugation": {
    "coverage": "basic",
    "present": [
      {
        "title": "string",
        "rows": [
          { "label": "string", "form": "string" },
          { "label": "string", "form": "string" }
        ]
      }
    ],
    "past": [],
    "future": []
  },
  "nounCases": {
    "tables": [
      {
        "title": "string",
        "rows": [
          { "label": "string", "form": "string" },
          { "label": "string", "form": "string" }
        ]
      }
    ]
  },
  "examples": [
    { "source": "string", "target": "string" },
    { "source": "string", "target": "string" }
  ]
}

Requirements:
- "primary" should be the best main translation in the requested target language.
- If the foreign-language term is the translated output, keep all word details anchored to that translated ${foreignLanguage} term.
- If the foreign-language term is the source text, keep all word details anchored to the source ${foreignLanguage} term the user entered.
- If the foreign-language term is a noun in a language like German, include its dictionary article in that ${foreignLanguage} term and in related-word "term" values when relevant.
- "pronunciation" must always be for the foreign-language term in ${foreignLanguage}, never for the native-language translation or whichever UI column is labeled "Source".
- If the foreign-language term is a verb, return "verbConjugation" with "coverage" set to "basic".
- In the default word lookup, include exactly one present-tense table in "verbConjugation.present".
- In the default word lookup, keep "verbConjugation.past" and "verbConjugation.future" as empty arrays.
- If the foreign-language term is not a verb, "verbConjugation" must be null.
- If the foreign-language term is a noun and case information is useful in the language, return "nounCases" with one to three concise tables.
- For German nouns, include the article in the noun-case forms when relevant.
- For Russian and similar languages, it is acceptable for noun-case "form" values to be full inflected forms or concise ending patterns.
- If the foreign-language term is not a noun, or if case tables are not useful for the language, "nounCases" must be null.
- Keep every conjugated "form" in ${foreignLanguage}.
- Provide exactly 3 alternatives.
- For each alternative, "term" must be the related word in ${foreignLanguage}, and "gloss" must be a short meaning in ${glossLanguage}.
- Provide exactly 3 concise source/target example pairs.
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
- Preserve the same paragraph structure as the source text.
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
- Preserve the same paragraph structure as the source text.
`.trim(),
  };
}
