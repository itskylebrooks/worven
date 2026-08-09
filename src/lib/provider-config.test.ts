import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL, PROVIDER_MODELS, isAllowedModel } from './provider-config';

describe('provider model configuration', () => {
  it('supports the current GPT-5.6 family without changing the existing default', () => {
    expect(DEFAULT_MODEL).toBe('gpt-5.4-mini');
    expect(PROVIDER_MODELS.openai).toEqual(
      expect.arrayContaining(['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna']),
    );
    expect(isAllowedModel('openai', 'gpt-5.6-sol')).toBe(true);
  });

  it('supports the current generally available Claude lineup', () => {
    expect(PROVIDER_MODELS.anthropic).toEqual(
      expect.arrayContaining([
        'claude-fable-5',
        'claude-opus-5',
        'claude-sonnet-5',
        'claude-haiku-4-5',
      ]),
    );
    expect(isAllowedModel('anthropic', 'claude-opus-5')).toBe(true);
  });
});
