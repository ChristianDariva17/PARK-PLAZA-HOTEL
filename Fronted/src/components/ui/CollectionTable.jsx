import { Children, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, MoreHorizontal } from 'lucide-react';
import { usePermissions } from '../../auth/authContext';
import { permissionForPrimaryAction } from '../../auth/permissions';

export function SortableHeader({ column, sort, onSort }) {
  const active = sort.key === column.key;
  const Icon = active ? (sort.direction === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return <th scope="col" aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}><button type="button" className="table-sort" onClick={() => onSort(column.key)}>{column.label}<Icon size={14} aria-hidden="true" /><span className="sr-only">{active ? `Orden ${sort.direction === 'asc' ? 'ascendente' : 'descendente'}` : 'Sin ordenar'}</span></button></th>;
}

export function Pagination({ page, pageCount, total, onPage }) {
  if (!total) return null;
  return <nav className="table-pagination" aria-label="Paginación de resultados"><span>Página {page} de {pageCount} · {total} registros</span><div><button type="button" className="btn btn-sm btn-outline" disabled={page === 1} onClick={() => onPage(page - 1)}>Anterior</button><button type="button" className="btn btn-sm btn-outline" disabled={page === pageCount} onClick={() => onPage(page + 1)}>Siguiente</button></div></nav>;
}

export function RowActions({ label, children }) {
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    rootRef.current?.querySelector('[role="menuitem"]')?.focus();
    const close = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    const keyDown = (event) => { if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', keyDown);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', keyDown); };
  }, [open]);
  const route = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  const authorizedChildren = Children.toArray(children).filter((child) => {
    const required = permissionForPrimaryAction(route, child.props?.children);
    return !required || can(required);
  });
  if (!authorizedChildren.length) return null;
  return <div ref={rootRef} className="row-actions"><button ref={triggerRef} type="button" className="icon-button" aria-label={`Acciones para ${label}`} aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((value) => !value)}><MoreHorizontal size={18} /></button>{open ? <div id={menuId} className="row-actions-menu" role="menu" onClick={() => setOpen(false)}>{authorizedChildren}</div> : null}</div>;
}
