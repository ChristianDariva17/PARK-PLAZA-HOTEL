import { Suspense } from 'react';
import { isAdminContractAdmitted } from '../../contracts/admission.js';
import { VIEW_COMPONENTS } from '../../app/adminViewComponents.jsx';
import ContractBlockedView from './ContractBlockedView.jsx';
import RouteErrorBoundary from './RouteErrorBoundary.jsx';

function AccessDeniedView({ fallbackRoute, navigate }) {
  return <div className="route-error state-panel state-forbidden" role="alert"><h2>Acceso denegado</h2><p>No tenés permiso para abrir este módulo.</p>{fallbackRoute ? <button className="btn btn-primary" onClick={() => navigate(fallbackRoute)}>Ir a un módulo autorizado</button> : null}</div>;
}

export default function AdminRouteContent({ currentView, fallbackRoute, navigate, navigationIntent, notify, consumeNavigationIntent, routeAuthorized }) {
  if (!routeAuthorized) return <AccessDeniedView fallbackRoute={fallbackRoute} navigate={navigate} />;
  if (!isAdminContractAdmitted(currentView)) return <ContractBlockedView route={currentView} />;

  const View = VIEW_COMPONENTS[currentView] || VIEW_COMPONENTS.dashboard;
  return <RouteErrorBoundary key={currentView}><Suspense fallback={<div className="route-loading state-panel state-loading" role="status" aria-live="polite">Cargando módulo…</div>}><View navigate={navigate} notify={notify} navigationIntent={navigationIntent} consumeNavigationIntent={consumeNavigationIntent} /></Suspense></RouteErrorBoundary>;
}
