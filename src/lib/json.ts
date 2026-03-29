export function extractJsonObject(rawText: string): string {
  const trimmed = rawText.trim();
  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

  if (withoutFence.startsWith('{') && withoutFence.endsWith('}')) {
    return withoutFence;
  }

  const firstBrace = withoutFence.indexOf('{');
  const lastBrace = withoutFence.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('The model response did not contain JSON.');
  }

  return withoutFence.slice(firstBrace, lastBrace + 1);
}

export function parseJsonObject<T>(rawText: string): T {
  const json = extractJsonObject(rawText);
  return JSON.parse(json) as T;
}
