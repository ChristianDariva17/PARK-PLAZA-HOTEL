import { useCallback, useEffect, useMemo, useState } from 'react';
import { permissionForRoute } from '../auth/permissions.js';
import { VALID_ROUTES } from '../components/layout/navigation.js';
import { loadModuleStyles } from '../styles/loadModuleStyles.js';
import { useHashRoute } from './useHashRoute.js';

export function useAdminNavigation(can) {
  const authorizedRoutes = useMemo(() => new Set([...VALID_ROUTES].filter((route) => can(permissionForRoute(route)))), [can]);
  const fallbackRoute = authorizedRoutes.values().next().value || '';
  const [currentView, hashNavigate] = useHashRoute(VALID_ROUTES, fallbackRoute);
  const [navigationIntent, setNavigationIntent] = useState(null);
  useEffect(() => {
    if (currentView !== 'dashboard') void loadModuleStyles();
  }, [currentView]);
  const navigate = useCallback((route, intent = null) => {
    if (route !== 'dashboard') void loadModuleStyles();
    setNavigationIntent(intent ? { ...intent, route, id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}` } : null);
    hashNavigate(route);
  }, [hashNavigate]);
  const consumeNavigationIntent = useCallback((id) => setNavigationIntent((current) => current?.id === id ? null : current), []);

  return {
    authorizedRoutes,
    currentView,
    fallbackRoute,
    navigate,
    routeAuthorized: authorizedRoutes.has(currentView),
    routeIntent: navigationIntent?.route === currentView ? navigationIntent : null,
    consumeNavigationIntent,
  };
}
