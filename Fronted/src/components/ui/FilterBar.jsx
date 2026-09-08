export function FilterBar({ children, label = 'Filtros', className = '' }) {
  return <div className={`filter-bar ${className}`.trim()} role="search" aria-label={label}>{children}</div>;
}
