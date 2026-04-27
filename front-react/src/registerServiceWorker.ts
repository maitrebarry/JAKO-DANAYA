// Simple service worker registration helper
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then((registration) => {
          // eslint-disable-next-line no-console
          console.log('ServiceWorker registered:', registration.scope);
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.warn('ServiceWorker registration failed:', err);
        });
    });
  }
}

export function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
  }
}
