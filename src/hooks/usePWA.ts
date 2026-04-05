import { useEffect, useMemo, useState } from 'react';

export type PWAInstallMode =
  | 'native-prompt'
  | 'ios-share'
  | 'safari-mac'
  | 'android-manual'
  | 'unsupported';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface BrowserDetails {
  isIOS: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  isMac: boolean;
  isChromium: boolean;
  isFirefox: boolean;
}

function getUserAgent(): string {
  return typeof navigator === 'undefined' ? '' : navigator.userAgent;
}

function getBrowserDetails(): BrowserDetails {
  const userAgent = getUserAgent();

  return {
    isIOS: /iPad|iPhone|iPod/.test(userAgent),
    isAndroid: /Android/.test(userAgent),
    isSafari: /Safari/.test(userAgent) && !/(Chrome|Chromium|CriOS|Edg|OPR|FxiOS)/.test(userAgent),
    isMac: /Macintosh|Mac OS X/.test(userAgent),
    isChromium: /(Chrome|Chromium|CriOS|Edg|OPR|SamsungBrowser)/.test(userAgent),
    isFirefox: /(Firefox|FxiOS)/.test(userAgent),
  };
}

function detectInstalled(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function resolveFallbackInstallMode(details: BrowserDetails): PWAInstallMode {
  if (details.isIOS) {
    return 'ios-share';
  }

  if (details.isSafari && details.isMac) {
    return 'safari-mac';
  }

  if (details.isAndroid) {
    return 'android-manual';
  }

  return 'unsupported';
}

export function usePWA() {
  const [isInstalled, setIsInstalled] = useState(() => detectInstalled());
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const browserDetails = useMemo(() => getBrowserDetails(), []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installMode = isInstalled
    ? 'unsupported'
    : deferredPrompt
      ? 'native-prompt'
      : resolveFallbackInstallMode(browserDetails);

  const nativePromptAvailable = !isInstalled && deferredPrompt !== null;
  const canInstall = typeof window !== 'undefined';

  async function install(): Promise<boolean> {
    if (!deferredPrompt) {
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;

      if (result.outcome === 'accepted') {
        setDeferredPrompt(null);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error showing install prompt:', error);
      return false;
    }
  }

  return {
    isInstalled,
    canInstall,
    nativePromptAvailable,
    installMode,
    install,
  };
}
