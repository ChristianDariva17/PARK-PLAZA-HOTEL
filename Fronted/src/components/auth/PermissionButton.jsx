import { useActionPermission } from './useActionPermission.js';

export function PermissionButton({ actionType, subjectType, ...props }) {
  const allowed = useActionPermission(actionType, subjectType);
  if (!allowed) return null;
  return <button {...props} />;
}

export function PermissionGate({ actionType, subjectType, children }) {
  return useActionPermission(actionType, subjectType) ? children : null;
}
