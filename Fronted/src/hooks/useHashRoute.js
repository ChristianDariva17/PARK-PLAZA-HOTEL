import { useEffect, useState } from 'react';

const readRoute = () => window.location.hash.replace(/^#\/?/, '').split('?')[0];

export function useHashRoute(validRoutes, defaultRoute = 'dashboard') {
  const [route, setRoute] = useState(() => readRoute() || defaultRoute);

  useEffect(() => {
    const onHashChange = () => {
      const nextRoute = readRoute();
      if (validRoutes.has(nextRoute)) {
        setRoute(nextRoute);
        return;
      }
      setRoute(defaultRoute);
      const fallbackHash = defaultRoute ? `#/${defaultRoute}` : '#/';
      if (window.location.hash !== fallbackHash) window.history.replaceState(null, '', fallbackHash);
    };
    window.addEventListener('hashchange', onHashChange);
    onHashChange();
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [defaultRoute, validRoutes]);

  const navigate = (nextRoute) => {
    const safeRoute = validRoutes.has(nextRoute) ? nextRoute : defaultRoute;
    window.location.hash = `/${safeRoute}`;
  };

  return [route, navigate];
}
