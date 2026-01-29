export const APP_ENV = process.env.EXPO_PUBLIC_ENV || 'local';
const API_BASE_URL_LOCAL = process.env.EXPO_PUBLIC_API_BASE_URL_LOCAL || 'http://192.168.1.199:8085';
const API_BASE_URL_PROD = process.env.EXPO_PUBLIC_API_BASE_URL_PROD || API_BASE_URL_LOCAL;

export const API_BASE_URL = APP_ENV === 'prod' ? API_BASE_URL_PROD : API_BASE_URL_LOCAL;
