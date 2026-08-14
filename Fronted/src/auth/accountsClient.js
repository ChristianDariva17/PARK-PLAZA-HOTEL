import { AuthRequestError, authRequest } from './authClient.js';

function normalize(error) {
  if (!(error instanceof AuthRequestError)) return new Error('No se pudo completar la operación. Intentá nuevamente.');
  if (error.known) return new Error(error.message);
  if (error.status === 400) return new Error('Revisá los datos ingresados y la política de contraseña.');
  if (error.status === 401) return new Error('La sesión venció. Volvé a iniciar sesión.');
  if (error.status === 403) return new Error('No tenés permiso para realizar esta operación.');
  if (error.status === 404) return new Error('La cuenta ya no está disponible.');
  if (error.status === 409) return new Error('El correo o el vínculo de personal ya está en uso, o la operación dejaría al hotel sin administrador activo.');
  if (error.status === 503) return new Error('No se pudo validar la seguridad de la contraseña. Intentá más tarde.');
  return new Error(error.message || 'No se pudo completar la operación.');
}

async function accountsRequest(url, options) {
  try { return await authRequest(url, options); }
  catch (error) { throw normalize(error); }
}

export const getAccounts = () => accountsRequest('/api/accounts');
export const createAccount = (body) => accountsRequest('/api/accounts', { method: 'POST', body: JSON.stringify(body) });
export const updateAccount = (accountId, body) => accountsRequest(`/api/accounts/${accountId}`, { method: 'PATCH', body: JSON.stringify(body) });
export const resetAccountPassword = (accountId, temporaryPassword) => accountsRequest(`/api/accounts/${accountId}/reset-password`, { method: 'POST', body: JSON.stringify({ temporaryPassword }) });
