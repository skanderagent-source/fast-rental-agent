import { useEffect, useRef, useState } from 'react';
import { Share, X } from 'lucide-react';

type InstallChoice = {
  outcome: 'accepted' | 'dismissed';
  platform: string;
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
}

type PromptMode = 'android' | 'ios';

const DISMISSED_UNTIL_KEY = 'logigo-install-prompt-dismissed-until';
const DISMISSAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

function isRunningStandalone() {
  const iosNavigator = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || iosNavigator.standalone === true;
}

function isIOSDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function promptWasDismissed() {
  try {
    return Number(window.localStorage.getItem(DISMISSED_UNTIL_KEY)) > Date.now();
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    window.localStorage.setItem(
      DISMISSED_UNTIL_KEY,
      String(Date.now() + DISMISSAL_DURATION_MS),
    );
  } catch {
    // The prompt can still be dismissed when storage is unavailable.
  }
}

export function InstallPrompt() {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<PromptMode | null>(null);

  useEffect(() => {
    if (isRunningStandalone() || promptWasDismissed()) return;

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPrompt.current = event as BeforeInstallPromptEvent;
      setMode('android');
    };
    const handleInstalled = () => {
      deferredPrompt.current = null;
      setMode(null);
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    if (isIOSDevice()) {
      setMode('ios');
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  if (!mode) return null;

  const dismiss = () => {
    rememberDismissal();
    setMode(null);
  };

  const install = async () => {
    const prompt = deferredPrompt.current;
    if (!prompt) return;

    await prompt.prompt();
    const choice = await prompt.userChoice;
    deferredPrompt.current = null;
    setMode(null);

    if (choice.outcome === 'dismissed') {
      rememberDismissal();
    }
  };

  return (
    <aside className="install-prompt" role="dialog" aria-label="Installer Logigo">
      <img className="install-prompt__icon" src="/icon-192.png" alt="" />
      <div className="install-prompt__content">
        <strong>Ajouter Logigo à l’écran d’accueil</strong>
        {mode === 'android' ? (
          <span>Installez l’application pour l’ouvrir rapidement comme une app.</span>
        ) : (
          <span className="install-prompt__ios-instruction">
            Touchez <Share aria-hidden="true" size={16} /> puis « Sur l’écran d’accueil ».
          </span>
        )}
      </div>
      {mode === 'android' && (
        <button className="install-prompt__action" type="button" onClick={() => void install()}>
          Installer
        </button>
      )}
      <button
        className="install-prompt__close"
        type="button"
        onClick={dismiss}
        aria-label="Fermer"
      >
        <X aria-hidden="true" size={18} />
      </button>
    </aside>
  );
}
