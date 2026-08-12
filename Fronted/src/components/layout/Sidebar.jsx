import { ChevronDown, Sparkle, X } from 'lucide-react';
import { NAV_SECTIONS } from './navigation';

export default function Sidebar({ currentView, navigate, pendingOrdersCount, open, onClose }) {
  return <>
    {open ? <button className="sidebar-mobile-backdrop" aria-label="Cerrar menú" onClick={onClose} /> : null}
    <aside className={`sidebar ${open ? 'mobile-open' : ''}`} aria-label="Navegación principal">
      <div className="sidebar-ambient-glow" />
      <div className="sidebar-logo"><button className="sidebar-mobile-close" onClick={onClose} aria-label="Cerrar navegación"><X size={20} /></button><div className="sidebar-crest-wrapper"><div className="sidebar-crest"><span>P</span></div><Sparkle className="crest-sparkle" size={10} color="#DFC17B" /></div><div className="sidebar-brand-hotel">HOTEL</div><div className="sidebar-brand-title">PARK PLAZA</div><div className="sidebar-stars" aria-label="Identidad visual cinco estrellas"><span>★</span><span>★</span><span>★</span><span>★</span><span>★</span></div></div>
      <nav className="sidebar-nav">{NAV_SECTIONS.map((section) => <details className="sidebar-section" key={section.title} open><summary className="sidebar-section-title"><span>{section.title}</span><ChevronDown size={14} /></summary><div className="sidebar-section-items">{section.items.map((item) => { const Icon = item.icon; const active = currentView === item.id; return <button key={item.id} className={`sidebar-link ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => { navigate(item.id); onClose(); }}><span className="sidebar-link-icon"><Icon size={17} /></span><span className="sidebar-link-text">{item.label}</span>{item.badgeKey === 'orders' && pendingOrdersCount > 0 ? <span className="sidebar-badge">{pendingOrdersCount}</span> : null}{active ? <span className="sidebar-active-indicator" /> : null}</button>; })}</div></details>)}</nav>
      <div className="sidebar-footer"><div className="sidebar-user-card"><div className="sidebar-avatar">AD</div><div className="sidebar-user-info"><div className="sidebar-user-name">Administrador demo</div><div className="sidebar-user-role">Sin sesión real</div></div></div></div>
    </aside>
  </>;
}
