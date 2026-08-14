import { useEffect, useRef } from 'react';
import { ChevronDown, LogOut, Sparkle, X } from 'lucide-react';
import { getAccountInitials, getRoleLabel } from '../../auth/authContext';
import { usePermissions } from '../../auth/authContext';
import { NAV_SECTIONS, canAccessRoute } from './navigation';

export default function Sidebar({ currentView, navigate, pendingOrdersCount, open, onClose, account, onLogout, loggingOut }) {
  const { can } = usePermissions();
  const closeButtonRef = useRef(null);
  const sections = NAV_SECTIONS.map((section) => ({ ...section, items: section.items.filter((item) => canAccessRoute(can, item.id)) })).filter((section) => section.items.length);
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
      document.querySelector('.menu-button')?.focus();
    };
    document.addEventListener('keydown', closeOnEscape);
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);
  return <>
    {open ? <button className="sidebar-mobile-backdrop" aria-label="Cerrar menú" onClick={onClose} /> : null}
    <aside id="primary-navigation" className={`sidebar ${open ? 'mobile-open' : ''}`} aria-label="Navegación principal">
      <div className="sidebar-ambient-glow" />
      <div className="sidebar-logo"><button ref={closeButtonRef} type="button" className="sidebar-mobile-close" onClick={onClose} aria-label="Cerrar navegación"><X size={20} aria-hidden="true" /></button><div className="sidebar-crest-wrapper"><div className="sidebar-crest"><span>P</span></div><Sparkle className="crest-sparkle" size={10} color="#DFC17B" /></div><div className="sidebar-brand-hotel">HOTEL</div><div className="sidebar-brand-title">PARK PLAZA</div><div className="sidebar-stars" aria-label="Identidad visual cinco estrellas"><span>★</span><span>★</span><span>★</span><span>★</span><span>★</span></div></div>
      <nav className="sidebar-nav">{sections.map((section) => <details className="sidebar-section" key={section.title} open><summary className="sidebar-section-title"><span>{section.title}</span><ChevronDown size={14} /></summary><div className="sidebar-section-items">{section.items.map((item) => { const Icon = item.icon; const active = currentView === item.id; return <button key={item.id} className={`sidebar-link ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => { navigate(item.id); onClose(); }}><span className="sidebar-link-icon"><Icon size={17} /></span><span className="sidebar-link-text">{item.label}</span>{item.badgeKey === 'orders' && pendingOrdersCount > 0 ? <span className="sidebar-badge">{pendingOrdersCount}</span> : null}{active ? <span className="sidebar-active-indicator" /> : null}</button>; })}</div></details>)}</nav>
      <div className="sidebar-footer"><div className="sidebar-user-card"><div className="sidebar-avatar">{getAccountInitials(account.email)}</div><div className="sidebar-user-info"><div className="sidebar-user-name">{account.email}</div><div className="sidebar-user-role">{getRoleLabel(account.role)}</div></div><button type="button" className="sidebar-logout" onClick={onLogout} disabled={loggingOut} aria-label="Cerrar sesión"><LogOut size={17} aria-hidden="true" /></button></div></div>
    </aside>
  </>;
}
