export function executeWithFeedback(execute, action, notify, success) {
  const result = execute(action);
  if (!result.ok) {
    notify('Operación rechazada', result.error || result.message || 'No se pudo completar la operación.', 'error');
    return false;
  }
  notify(success.title, success.message, success.type || 'success');
  return true;
}
