import { FormField } from './FormField';

export function P1Button({ variant = 'primary', className = '', style: _style, children, ...props }) {
  const variantClass = 
    variant === 'primary' ? 'btn-primary' : 
    variant === 'secondary' ? 'btn-outline' : 
    variant === 'danger' ? 'btn-danger' :
    'btn-outline';
    
  return (
    <button 
      className={`btn ${variantClass} ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
}

export function AsyncButton({ pending = false, pendingLabel = 'Procesando...', disabled = false, children, ...props }) {
  return (
    <P1Button {...props} disabled={disabled || pending} aria-busy={pending}>
      {pending ? pendingLabel : children}
    </P1Button>
  );
}

export function P1Input({ label, type = 'text', className = '', controlClassName = '', style: _style, helperText, error, required, ...props }) {
  return <FormField label={label} required={required} helperText={helperText} error={error} className={className}>
    <input {...props} type={type} required={required} className={`form-control ${controlClassName}`.trim()} />
  </FormField>;
}

export function P1Select({ label, className = '', controlClassName = '', style: _style, helperText, error, required, children, ...props }) {
  return <FormField label={label} required={required} helperText={helperText} error={error} className={className}>
    <select {...props} required={required} className={`form-control ${controlClassName}`.trim()}>{children}</select>
  </FormField>;
}

export function P1Textarea({ label, className = '', controlClassName = '', style: _style, helperText, error, required, ...props }) {
  return <FormField label={label} required={required} helperText={helperText} error={error} className={className}>
    <textarea {...props} required={required} className={`form-control ${controlClassName}`.trim()} />
  </FormField>;
}

export function P1Badge({ children, className = '', variant = 'primary', style: _style, ...props }) {
  return (
    <span
      className={`p1-badge p1-badge-${variant} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
