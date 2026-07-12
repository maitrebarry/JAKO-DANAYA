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
      // Production: backend on different domain
      : 'https://jako-danaya.onrender.com';

    window.APP_CONFIG = { API_BASE_URL: apiHost };
  } catch (e) { 
    window.APP_CONFIG = { API_BASE_URL: 'https://jako-danaya.onrender.com' };
  }
})();
