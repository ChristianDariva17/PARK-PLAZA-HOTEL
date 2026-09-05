import { authRequest } from './authClient.js';

export const getRoles = () => authRequest('/api/roles');
export const getPermissions = () => authRequest('/api/roles/permissions');

export const createRole = (data) => authRequest('/api/roles', {
  method: 'POST',
  body: JSON.stringify(data),
});

export const updateRole = (roleId, data) => authRequest(`/api/roles/${roleId}`, {
  method: 'PATCH',
  body: JSON.stringify(data),
});

export const deleteRole = (roleId) => authRequest(`/api/roles/${roleId}`, {
  method: 'DELETE',
});
