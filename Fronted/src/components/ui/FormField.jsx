import { Children, cloneElement, isValidElement, useId } from 'react';

export function FormField({
  label,
  required = false,
  helperText,
  error,
  children,
  className = '',
}) {
  const generatedId = useId();
  const control = Children.toArray(children).find(isValidElement);
  const controlId = control?.props.id || generatedId;
  const helperId = helperText ? `${controlId}-helper` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [control?.props['aria-describedby'], helperId, errorId]
    .filter(Boolean)
    .join(' ') || undefined;
  const enhancedChildren = Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    return cloneElement(child, {
      id: child.props.id || controlId,
      'aria-describedby': describedBy,
      'aria-invalid': error ? 'true' : undefined,
      className: `${child.props.className || ''}${error ? ' has-error' : ''}`.trim(),
    });
  });

  return (
    <div className={`form-field ${className}`.trim()}>
      {label ? <label className="form-label" htmlFor={controlId}>{label}{required ? <span className="form-required" aria-hidden="true"> *</span> : null}</label> : null}
      {enhancedChildren}
      {helperText ? <span id={helperId} className="form-helper">{helperText}</span> : null}
      {error ? <span id={errorId} className="form-error" role="alert">{error}</span> : null}
    </div>
  );
}
