// Show the install CTA only when the browser can install the PWA.

const initInstallPrompt = () => {
  const installBtn = document.getElementById('installBtn');

  const hideInstallCta = () => installBtn?.setAttribute('hidden', '');

  const isRunningAsApp = () => {
    const params = new URLSearchParams(window.location.search);

    const twaMode = params.get('app') === 'twa';

    const standaloneModes = ['standalone', 'fullscreen', 'minimal-ui'];
    const appModeMatches = standaloneModes.some((mode) =>
      window.matchMedia(`(display-mode: ${mode})`).matches
    );

    const inWebAppView =
      window.navigator.standalone === true ||
      window.location.protocol === 'file:' ||
      /android-app|iphone-app|ipad-app|windows-app/i.test(document.referrer || '') ||
      /\bwv\b/i.test(window.navigator.userAgent || '') ||
      Boolean(
        window.Android ||
        window.Capacitor ||
        window.cordova ||
        window.ReactNativeWebView
      );

    return twaMode || appModeMatches || inWebAppView;
  };

  if (isRunningAsApp()) {
    hideInstallCta();
    return;
  }

  let deferredPrompt;

  const showInstallPrompt = () => {
    if (!installBtn) return;
    installBtn.textContent = '📲 Install app';
    installBtn.setAttribute('aria-label', 'Install Trio Day');
    installBtn.removeAttribute('hidden');
    installBtn.hidden = false;
  };

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!isRunningAsApp()) {
      showInstallPrompt();
    }
  });

  installBtn?.addEventListener('click', async (event) => {
    if (!deferredPrompt || isRunningAsApp()) return;
    event.preventDefault();
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('Install outcome:', outcome);
    deferredPrompt = null;
    if (outcome === 'accepted') {
      hideInstallCta();
    }
  });

  window.addEventListener('appinstalled', () => {
    hideInstallCta();
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initInstallPrompt, { once: true });
} else {
  initInstallPrompt();
}
