import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { registerServiceWorker } from './registerServiceWorker'

// Global handlers to surface unhandled errors/rejections in development
window.addEventListener('error', (ev) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled error captured (window.error)', ev.error || ev.message, ev);
});
window.addEventListener('unhandledrejection', (ev) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled promise rejection', ev.reason);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register PWA service worker (non-blocking)
registerServiceWorker();