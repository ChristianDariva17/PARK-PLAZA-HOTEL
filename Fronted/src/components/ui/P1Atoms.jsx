import React from 'react';

export function P1Button({ variant = 'primary', className = '', style = {}, children, ...props }) {
  const variantClass = 
    variant === 'primary' ? 'btn-primary' : 
    variant === 'secondary' ? 'btn-outline' : 
    variant === 'danger' ? 'btn-danger' :
    'btn-outline';
    
  return (
    <button 
      className={`btn ${variantClass} ${className}`} 
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontWeight: 700,
        borderRadius: 10,
        padding: '10px 18px',
        fontSize: 13.5,
        cursor: 'pointer',
        transition: 'all 0.2s',
        ...style
      }} 
      {...props}
    >
      {children}
    </button>
  );
}

export function P1Input({ label, type = 'text', className = '', style = {}, helperText, error, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }} className={className}>
      {label && (
        <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-navy, #1E3A8A)', letterSpacing: '0.01em' }}>
          {label}
        </label>
      )}
      <input 
        type={type} 
        style={{
          width: '100%',
          padding: '10px 14px',
          border: error ? '1.5px solid var(--color-danger, #DC2626)' : '1px solid var(--color-border, #E5E7EB)',
          borderRadius: 10,
          background: 'var(--color-surface, #FFFFFF)',
          color: 'var(--color-text, #111827)',
          fontSize: 14,
          outline: 'none',
          boxSizing: 'border-box',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
        }}
        {...props} 
      />
      {helperText && <span style={{ fontSize: 11.5, color: 'var(--color-muted, #6B7280)' }}>{helperText}</span>}
      {error && <span style={{ fontSize: 11.5, color: 'var(--color-danger, #DC2626)', fontWeight: 600 }}>{error}</span>}
    </div>
  );
}

export function P1Select({ label, className = '', style = {}, helperText, error, children, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }} className={className}>
      {label && (
        <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-navy, #1E3A8A)', letterSpacing: '0.01em' }}>
          {label}
        </label>
      )}
      <select 
        style={{
          width: '100%',
          padding: '10px 14px',
          border: error ? '1.5px solid var(--color-danger, #DC2626)' : '1px solid var(--color-border, #E5E7EB)',
          borderRadius: 10,
          background: 'var(--color-surface, #FFFFFF)',
          color: 'var(--color-text, #111827)',
          fontSize: 14,
          outline: 'none',
          boxSizing: 'border-box',
          cursor: 'pointer',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
        }}
        {...props} 
      >
        {children}
      </select>
      {helperText && <span style={{ fontSize: 11.5, color: 'var(--color-muted, #6B7280)' }}>{helperText}</span>}
      {error && <span style={{ fontSize: 11.5, color: 'var(--color-danger, #DC2626)', fontWeight: 600 }}>{error}</span>}
    </div>
  );
}

export function P1Badge({ children, className = '', variant = 'primary', style = {}, ...props }) {
  const stylesByVariant = {
    success: { bg: '#DCFCE7', text: '#15803D', border: '#86EFAC' },
    warning: { bg: '#FEF3C7', text: '#B45309', border: '#FDE047' },
    danger: { bg: '#FEE2E2', text: '#B91C1C', border: '#FCA5A5' },
    neutral: { bg: '#F3F4F6', text: '#4B5563', border: '#E5E7EB' },
    primary: { bg: 'rgba(30, 58, 138, 0.08)', text: '#1E3A8A', border: 'rgba(30, 58, 138, 0.2)' },
    gold: { bg: 'rgba(212, 175, 55, 0.12)', text: '#92400E', border: 'rgba(212, 175, 55, 0.3)' },
  };

  const current = stylesByVariant[variant] || stylesByVariant.primary;

  return (
    <span 
      className={className} 
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 700,
        background: current.bg,
        color: current.text,
        border: `1px solid ${current.border}`,
        ...style
      }} 
      {...props}
    >
      {children}
    </span>
  );
}
