import { useEffect, useState } from 'react';

const DEFAULT_ROUTE = 'dashboard';

const readRoute = () => window.location.hash.replace(/^#\/?/, '').split('?')[0] || DEFAULT_ROUTE;

export function useHashRoute(validRoutes) {
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    const onHashChange = () => {
      const nextRoute = readRoute();
      setRoute(validRoutes.has(nextRoute) ? nextRoute : DEFAULT_ROUTE);
    };
    window.addEventListener('hashchange', onHashChange);
    onHashChange();
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [validRoutes]);

  const navigate = (nextRoute) => {
    const safeRoute = validRoutes.has(nextRoute) ? nextRoute : DEFAULT_ROUTE;
    window.location.hash = `/${safeRoute}`;
  };

  return [route, navigate];
}
