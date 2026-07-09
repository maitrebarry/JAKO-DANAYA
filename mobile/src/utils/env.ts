export const APP_ENV = process.env.EXPO_PUBLIC_ENV || 'local';
// Local Wi-Fi address of the development machine. Override this value with
// EXPO_PUBLIC_API_BASE_URL_LOCAL whenever the machine changes network.
const API_BASE_URL_LOCAL = process.env.EXPO_PUBLIC_API_BASE_URL_LOCAL || 'http://172.20.10.5:8085';
const API_BASE_URL_PROD = process.env.EXPO_PUBLIC_API_BASE_URL_PROD || 'https://jako-danaya.onrender.com';

export const API_BASE_URL = (APP_ENV === 'prod' ? API_BASE_URL_PROD : API_BASE_URL_LOCAL).replace(/\/$/, '');

// OAuth2 redirect URL used by backend success handler (web uses /oauth2/redirect).
// For mobile, we reuse this URL and intercept the final redirect to extract the `token`.
const FRONTEND_BASE_URL_LOCAL = process.env.EXPO_PUBLIC_FRONTEND_BASE_URL_LOCAL || 'http://172.20.10.5:5173';
const FRONTEND_BASE_URL_PROD = process.env.EXPO_PUBLIC_FRONTEND_BASE_URL_PROD || 'https://jako-danaya.onrender.com';

export const FRONTEND_BASE_URL = (APP_ENV === 'prod' ? FRONTEND_BASE_URL_PROD : FRONTEND_BASE_URL_LOCAL).replace(/\/$/, '');

export const OAUTH_REDIRECT_URL =
	process.env.EXPO_PUBLIC_OAUTH_REDIRECT_URL ||
	(FRONTEND_BASE_URL + '/oauth2/redirect');
