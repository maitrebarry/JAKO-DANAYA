// Runtime override for API_BASE_URL served at /app-config.js
// Useful when accessing the dev site from another device (phone/tablet).
(function(){
  if (window.APP_CONFIG) return;
  try {
    var host = window.location.hostname;
    var origin = window.location.origin;
    // Local dev: keep explicit backend port.
    var apiHost = (host === 'localhost' || host === '127.0.0.1')
      ? 'http://localhost:8085'
      // Production: default to same origin (reverse proxy) unless overridden.
      : origin;

    window.APP_CONFIG = { API_BASE_URL: apiHost };
    console.info('[app-config] using API_BASE_URL=', window.APP_CONFIG.API_BASE_URL);
  } catch (e) { /* ignore */ }
})();
