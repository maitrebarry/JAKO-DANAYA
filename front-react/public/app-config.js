// Runtime override for API_BASE_URL served at /app-config.js
// Useful when accessing the dev site from another device (phone/tablet).
(function(){
  if (window.APP_CONFIG) return;
  try {
    var host = window.location.hostname;
    // If user opens site via IP on their phone, use that host with backend port 8085.
    var apiHost = (host === 'localhost' || host === '127.0.0.1') ? 'http://localhost:8085' : 'http://' + host + ':8085';
    window.APP_CONFIG = { API_BASE_URL: apiHost };
    console.info('[app-config] using API_BASE_URL=', window.APP_CONFIG.API_BASE_URL);
  } catch (e) { /* ignore */ }
})();
