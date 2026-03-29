import { parseJsonObject } from './json';
import { buildTranslationPrompts } from './prompts';
import type {
  ProviderId,
  SentenceTranslationPayload,
  TranslationRequest,
  WordTranslationPayload,
} from '../types';

type RawTranslationPayload = WordTranslationPayload | SentenceTranslationPayload;

function ensureShape(
  mode: TranslationRequest['mode'],
  payload: RawTranslationPayload,
): WordTranslationPayload | SentenceTranslationPayload {
  if (mode === 'word') {
    const wordPayload = payload as WordTranslationPayload;
    if (
      typeof wordPayload.primary !== 'string' ||
      !Array.isArray(wordPayload.alternatives) ||
      typeof wordPayload.grammar?.notes !== 'string' ||
      typeof wordPayload.pronunciation !== 'string' ||
      !Array.isArray(wordPayload.examples)
    ) {
      throw new Error('The provider response did not match the expected word JSON shape.');
    }

    return {
      primary: wordPayload.primary,
      alternatives: wordPayload.alternatives.filter(Boolean).slice(0, 3),
      grammar: { notes: wordPayload.grammar.notes },
      pronunciation: wordPayload.pronunciation,
      examples: wordPayload.examples.filter(Boolean).slice(0, 3),
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

function extractOpenAIText(data: unknown): string {
  if (
    typeof data === 'object' &&
    data !== null &&
    'output' in data &&
    Array.isArray((data as { output?: unknown[] }).output)
  ) {
    const output = (
      data as { output: Array<{ content?: Array<{ text?: string; type?: string }> }> }
    ).output;

    for (const item of output) {
      if (!Array.isArray(item.content)) continue;
      for (const content of item.content) {
        if (content.type === 'output_text' && typeof content.text === 'string') {
          return content.text;
        }
      }
    }
  }

  throw new Error('OpenAI did not return text output.');
}

function extractAnthropicText(data: unknown): string {
  if (
    typeof data === 'object' &&
    data !== null &&
    'content' in data &&
    Array.isArray((data as { content?: unknown[] }).content)
  ) {
    const blocks = (data as { content: Array<{ text?: string; type?: string }> }).content;
    const textBlock = blocks.find(
      (block) => block.type === 'text' && typeof block.text === 'string',
    );

    if (textBlock?.text) {
      return textBlock.text;
    }
  }

  throw new Error('Anthropic did not return text output.');
}

function extractGeminiText(data: unknown): string {
  if (
    typeof data === 'object' &&
    data !== null &&
    'candidates' in data &&
    Array.isArray((data as { candidates?: unknown[] }).candidates)
  ) {
    const candidates = (
      data as {
        candidates: Array<{
          content?: {
            parts?: Array<{
              text?: string;
            }>;
          };
        }>;
      }
    ).candidates;
    const firstText = candidates[0]?.content?.parts?.[0]?.text;

    if (typeof firstText === 'string') {
      return firstText;
    }
  }

  throw new Error('Gemini did not return text output.');
}

async function callOpenAI(apiKey: string, model: string, request: TranslationRequest) {
  const { systemPrompt, userPrompt } = buildTranslationPrompts(request);
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions: systemPrompt,
      input: userPrompt,
    }),
  });

  if (!response.ok) {
    throw await providerError('OpenAI', response);
  }

  const data = (await response.json()) as unknown;
  return parseJsonObject<RawTranslationPayload>(extractOpenAIText(data));
}

async function callAnthropic(apiKey: string, model: string, request: TranslationRequest) {
  const { systemPrompt, userPrompt } = buildTranslationPrompts(request);
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw await providerError('Anthropic', response);
  }

  const data = (await response.json()) as unknown;
  return parseJsonObject<RawTranslationPayload>(extractAnthropicText(data));
}

async function callGemini(apiKey: string, model: string, request: TranslationRequest) {
  const { systemPrompt, userPrompt } = buildTranslationPrompts(request);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    },
  );

  if (!response.ok) {
    throw await providerError('Gemini', response);
  }

  const data = (await response.json()) as unknown;
  return parseJsonObject<RawTranslationPayload>(extractGeminiText(data));
}

async function providerError(providerName: string, response: Response) {
  const fallbackMessage = `${providerName} request failed with status ${response.status}.`;

  try {
    const data = (await response.json()) as {
      error?: { message?: string };
      message?: string;
    };

    return new Error(data.error?.message ?? data.message ?? fallbackMessage);
  } catch {
    return new Error(fallbackMessage);
  }
}

export async function translateWithProvider(
  provider: ProviderId,
  apiKey: string,
  model: string,
  request: TranslationRequest,
) {
  if (!apiKey.trim()) {
    throw new Error('Add an API key for the selected provider in Settings before translating.');
  }

  let payload: RawTranslationPayload;

  switch (provider) {
    case 'openai':
      payload = await callOpenAI(apiKey, model, request);
      break;
    case 'anthropic':
      payload = await callAnthropic(apiKey, model, request);
      break;
    case 'gemini':
      payload = await callGemini(apiKey, model, request);
      break;
    default:
      throw new Error(`Unsupported provider: ${provider satisfies never}`);
  }

  return ensureShape(request.mode, payload);
}
