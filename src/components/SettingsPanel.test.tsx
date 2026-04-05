import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SettingsPanel } from './SettingsPanel';

const usePWAMock = vi.hoisted(() => vi.fn());

vi.mock('../hooks/usePWA', () => ({
  usePWA: usePWAMock,
}));

const defaultSettings = {
  provider: 'openai' as const,
  model: 'gpt-5.4-mini',
  apiKeys: {
    openai: '',
    anthropic: '',
    gemini: '',
  },
  nativeLanguage: 'English',
  targetLanguage: 'German',
  translationContext: 'General' as const,
  themeMode: 'system' as const,
};

describe('SettingsPanel PWA install UI', () => {
  it('opens browser guidance when install falls back to an unsupported browser', async () => {
    usePWAMock.mockReturnValue({
      isInstalled: false,
      canInstall: true,
      nativePromptAvailable: false,
      installMode: 'unsupported',
      install: vi.fn(),
    });

    render(
      <SettingsPanel open settings={defaultSettings} onClose={vi.fn()} onChange={vi.fn()} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /install/i }));

    expect(screen.getByText('Install Worven')).toBeVisible();
    expect(screen.getByText(/install is not available in this browser right now/i)).toBeVisible();
    expect(
      screen.getByText(/firefox on desktop does not currently support manifest-installed pwas/i),
    ).toBeVisible();
  });

  it('shows an installed disabled state when Worven is already installed', () => {
    usePWAMock.mockReturnValue({
      isInstalled: true,
      canInstall: true,
      nativePromptAvailable: false,
      installMode: 'unsupported',
      install: vi.fn(),
    });

    render(<SettingsPanel open settings={defaultSettings} onClose={vi.fn()} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /installed/i })).toBeDisabled();
  });
});
