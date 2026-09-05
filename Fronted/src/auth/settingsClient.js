import { authRequest } from './authClient.js';

export const getSettings = () => authRequest('/api/settings');
export const updateSettings = (body) => authRequest('/api/settings', { method: 'PUT', body: JSON.stringify(body) });
