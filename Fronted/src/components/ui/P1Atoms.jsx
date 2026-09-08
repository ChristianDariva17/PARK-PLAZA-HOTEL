import React, { useId } from 'react';
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

export function P1Input({ label, type = 'text', className = '', controlClassName = '', style: _style, helperText, error, required, ...props }) {
  const generatedId = useId();
  const inputId = props.id || generatedId;
  const helperId = helperText ? `${inputId}-helper` : null;
  const errorId = error ? `${inputId}-error` : null;
  const describedBy = [props['aria-describedby'], helperId, errorId].filter(Boolean).join(' ') || undefined;

  return <FormField label={label} required={required} helperText={helperText} error={error} className={className}>
    <input {...props} id={inputId} type={type} required={required} className={`form-control ${controlClassName}`.trim()} aria-invalid={error ? 'true' : undefined} aria-describedby={describedBy} />
  </FormField>;
}

export function P1Select({ label, className = '', controlClassName = '', style: _style, helperText, error, required, children, ...props }) {
  const generatedId = useId();
  const selectId = props.id || generatedId;
  const helperId = helperText ? `${selectId}-helper` : null;
  const errorId = error ? `${selectId}-error` : null;
  const describedBy = [props['aria-describedby'], helperId, errorId].filter(Boolean).join(' ') || undefined;

  return <FormField label={label} required={required} helperText={helperText} error={error} className={className}>
    <select {...props} id={selectId} required={required} className={`form-control ${controlClassName}`.trim()} aria-invalid={error ? 'true' : undefined} aria-describedby={describedBy}>{children}</select>
  </FormField>;
}

export function P1Textarea({ label, className = '', controlClassName = '', style: _style, helperText, error, required, ...props }) {
  const generatedId = useId();
  const textareaId = props.id || generatedId;
  const helperId = helperText ? `${textareaId}-helper` : null;
  const errorId = error ? `${textareaId}-error` : null;
  const describedBy = [props['aria-describedby'], helperId, errorId].filter(Boolean).join(' ') || undefined;
  return <FormField label={label} required={required} helperText={helperText} error={error} className={className}>
    <textarea {...props} id={textareaId} required={required} className={`form-control ${controlClassName}`.trim()} aria-invalid={error ? 'true' : undefined} aria-describedby={describedBy} />
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
