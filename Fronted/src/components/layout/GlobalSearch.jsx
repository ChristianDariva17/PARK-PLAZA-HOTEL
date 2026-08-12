import { useDeferredValue, useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Dialog } from '../ui/Overlay';

export default function GlobalSearch({ open, onClose, state, onNavigate }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const deferred = useDeferredValue(query.trim().toLowerCase());
  useEffect(() => { if (open) { setQuery(''); setActive(0); } }, [open]);
  const groups = deferred ? [
    { label: 'Clientes', route: 'clientes', records: state.clients.filter((item) => `${item.name} ${item.documentNumber} ${item.email}`.toLowerCase().includes(deferred)).map((item) => ({ id: item.id, title: item.name, detail: `${item.documentType} ${item.documentNumber}` })) },
    { label: 'Reservas', route: 'reservas', records: state.reservations.filter((item) => `${item.id} ${item.roomId} ${state.clients.find((client) => client.id === item.clientId)?.name}`.toLowerCase().includes(deferred)).map((item) => ({ id: item.id, title: item.id, detail: `Habitación ${item.roomId} · ${item.status}` })) },
    { label: 'Habitaciones', route: 'habitaciones', records: state.rooms.filter((item) => `${item.id} ${item.category} ${item.status}`.toLowerCase().includes(deferred)).map((item) => ({ id: item.id, title: `Habitación ${item.id}`, detail: `${item.category} · ${item.status}` })) },
    { label: 'Pedidos', route: 'pedidos-qr', records: state.orders.filter((item) => `${item.id} ${item.roomId || ''} ${item.items.map((entry) => entry.name).join(' ')}`.toLowerCase().includes(deferred)).map((item) => ({ id: item.id, title: item.id, detail: `${item.source} · ${item.status}` })) },
  ].map((group) => ({ ...group, records: group.records.slice(0, 5) })).filter((group) => group.records.length) : [];
  const flat = groups.flatMap((group) => group.records.map((record) => ({ ...record, route: group.route })));
  const choose = (result) => { onNavigate(result.route, { type: 'select-record', recordId: result.id }); onClose(); };
  const keyDown = (event) => {
    if (!flat.length) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((value) => (value + 1) % flat.length); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActive((value) => (value - 1 + flat.length) % flat.length); }
    if (event.key === 'Enter') { event.preventDefault(); choose(flat[active]); }
  };
  let resultIndex = -1;
  return <Dialog open={open} onClose={onClose} title="Búsqueda global" description="Buscá clientes, reservas, habitaciones y pedidos." wide initialFocusRef={inputRef}><div className="search-dialog"><label htmlFor="global-entity-search">Buscar en el hotel</label><div className="search-dialog-input"><Search size={18} aria-hidden="true" /><input ref={inputRef} id="global-entity-search" role="combobox" aria-autocomplete="list" aria-controls="global-entity-results" aria-expanded={Boolean(query)} aria-activedescendant={flat[active] ? `global-result-${active}` : undefined} value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }} onKeyDown={keyDown} placeholder="Nombre, código, habitación o pedido" /></div><div id="global-entity-results" role="listbox" aria-label="Resultados de búsqueda">{query && !flat.length ? <div className="empty-state" role="status"><strong>Sin resultados</strong><span>Probá con otro nombre, código o habitación.</span></div> : groups.map((group) => <section className="search-result-group" role="group" key={group.label} aria-labelledby={`search-group-${group.route}`}><h3 id={`search-group-${group.route}`}>{group.label}</h3>{group.records.map((result) => { resultIndex += 1; const index = resultIndex; return <button id={`global-result-${index}`} role="option" aria-selected={active === index} className={active === index ? 'active' : ''} key={result.id} onMouseEnter={() => setActive(index)} onClick={() => choose({ ...result, route: group.route })}><strong>{result.title}</strong><span>{result.detail}</span></button>; })}</section>)}</div></div></Dialog>;
}
