import { createContext, useContext, useMemo } from 'react';
import { hasPermission } from './permissions';

export const AuthStateContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthStateContext);
  if (!context) throw new Error('useAuth debe utilizarse dentro de AuthProvider');
  return context;
}

export function usePermissions() {
  const { permissions = [] } = useAuth();
  return useMemo(() => {
    const granted = new Set(permissions);
    return {
      permissions,
      can: (permission) => granted.has(permission),
      canAny: (...required) => required.some((permission) => granted.has(permission)),
      canAll: (...required) => required.every((permission) => granted.has(permission)),
    };
  }, [permissions]);
}

export { hasPermission };

export function getAccountInitials(email) {
  const localPart = email?.split('@')[0] || '';
  const parts = localPart.split(/[._-]+/).filter(Boolean);
  const initials = parts.length > 1
    ? `${parts[0][0]}${parts[1][0]}`
    : localPart.slice(0, 2);
  return initials.toUpperCase() || 'US';
}

export function getRoleLabel(role) {
  if (!role) return 'Sin rol';
  return role.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
}
