import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

let activeOverlayCount = 0;

function useOverlayFocus(open, onClose, initialFocusRef) {
  const panelRef = useRef(null);
  const previousFocus = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    previousFocus.current = document.activeElement;
    const panel = panelRef.current;
    const appRoot = document.getElementById('root');
    const supportsInert = appRoot && 'inert' in appRoot;
    activeOverlayCount += 1;
    const overlayLevel = activeOverlayCount;
    if (activeOverlayCount === 1 && supportsInert) appRoot.inert = true;
    const focusable = initialFocusRef?.current || panel?.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    focusable?.focus();
    if (activeOverlayCount === 1 && appRoot && !supportsInert) appRoot.setAttribute('aria-hidden', 'true');
    const onKeyDown = (event) => {
      if (overlayLevel !== activeOverlayCount) return;
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key !== 'Tab' || !panel) return;
      const elements = [...panel.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      activeOverlayCount = Math.max(0, activeOverlayCount - 1);
      if (activeOverlayCount === 0) document.body.style.overflow = '';
      if (activeOverlayCount === 0 && appRoot) {
        if (supportsInert) appRoot.inert = false;
        else appRoot.removeAttribute('aria-hidden');
      }
      previousFocus.current?.focus?.();
    };
  }, [open, initialFocusRef]);

  return panelRef;
}

export function Dialog({ open, onClose, title, description, children, wide = false, initialFocusRef }) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useOverlayFocus(open, onClose, initialFocusRef);
  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={panelRef} className={`modal-content accessible-modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}>
        <header className="overlay-header">
          <div><h2 id={titleId}>{title}</h2>{description ? <p id={descriptionId}>{description}</p> : null}</div>
          <button type="button" className="icon-button" onClick={onClose} aria-label={`Cerrar ${title}`}><X size={20} /></button>
        </header>
        <div className="overlay-body">{children}</div>
      </section>
    </div>, document.body
  );
}

export function Drawer({ open, onClose, title, description, children }) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useOverlayFocus(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={panelRef} className="drawer-panel accessible-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}>
        <header className="overlay-header">
          <div><h2 id={titleId}>{title}</h2>{description ? <p id={descriptionId}>{description}</p> : null}</div>
          <button type="button" className="icon-button" onClick={onClose} aria-label={`Cerrar ${title}`}><X size={20} /></button>
        </header>
        <div className="overlay-body">{children}</div>
      </section>
    </div>, document.body
  );
}

export function Tabs({ tabs, activeTab, onChange, label }) {
  const tabListRef = useRef(null);
  useEffect(() => {
    const activeButton = tabListRef.current?.querySelector('[role="tab"][aria-selected="true"]');
    const panel = tabListRef.current?.nextElementSibling;
    if (activeButton && panel?.getAttribute('role') === 'tabpanel') {
      panel.id = activeButton.getAttribute('aria-controls');
      panel.setAttribute('aria-labelledby', activeButton.id);
      panel.removeAttribute('aria-label');
    }
  }, [activeTab]);
  const handleKeyDown = (event) => {
    const index = tabs.findIndex((tab) => tab.id === activeTab);
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    onChange(tabs[nextIndex].id);
    tabListRef.current?.querySelectorAll('[role="tab"]')[nextIndex]?.focus();
  };
  return (
    <div ref={tabListRef} className="tabs" role="tablist" aria-label={label} onKeyDown={handleKeyDown}>
      {tabs.map((tab) => <button id={`tab-${tab.id}`} key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} aria-controls={`tab-panel-${tab.id}`} tabIndex={activeTab === tab.id ? 0 : -1} className={activeTab === tab.id ? 'active' : ''} onClick={() => onChange(tab.id)}>{tab.label}</button>)}
    </div>
  );
}

export function TabPanel({ active, children, label, id }) {
  if (!active) return null;
  return <section id={id ? `tab-panel-${id}` : undefined} className="tab-panel" role="tabpanel" aria-label={label} aria-labelledby={id ? `tab-${id}` : undefined} tabIndex="0">{children}</section>;
}

export function PrototypeNotice({ children }) {
  return <div className="prototype-notice" role="note"><strong>Alcance del prototipo:</strong> {children}</div>;
}
