import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applyTheme,
  loadSettings,
  loadSettingsSnapshot,
  persistSettings,
} from '../lib/settings';
import type { AppSettings } from '../types';

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettingsSnapshot());
  const [hydrated, setHydrated] = useState(false);
  const hasLocalChanges = useRef(false);

  const updateSettings = useCallback((next: React.SetStateAction<AppSettings>) => {
    hasLocalChanges.current = true;
    setSettings(next);
  }, []);

  useEffect(() => {
    applyTheme(settings.themeMode);
  }, [settings.themeMode]);

  useEffect(() => {
    let active = true;

    void loadSettings().then((loadedSettings) => {
      if (!active) {
        return;
      }

      if (!hasLocalChanges.current) {
        setSettings(loadedSettings);
      }

      setHydrated(true);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (hydrated) {
      void persistSettings(settings);
    }
  }, [hydrated, settings]);

  useEffect(() => {
    if (settings.themeMode !== 'system' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme('system');

    handleChange();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [settings.themeMode]);

  return { settings, updateSettings };
}
