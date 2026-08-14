import { usePermissions } from '../../auth/authContext.js';
import { permissionForAction } from '../../auth/permissions.js';

export function useActionPermission(actionType, subjectType) {
  const { can } = usePermissions();
  const permission = permissionForAction({ type: actionType, subjectType });
  return Boolean(permission && can(permission));
}
