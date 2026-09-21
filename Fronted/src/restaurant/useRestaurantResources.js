import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { PERMISSIONS } from '../auth/permissions.js';
import { normalizeRequestError } from '../api/requestError.js';
import { adaptInventoryList, adaptLedgerList, adaptMenuList, adaptOrdersList } from './restaurantModel.js';
import { getInventory, getInventoryLedger, getMenu, getOrders } from './restaurantClient.js';

export const RESTAURANT_RESOURCE_KEYS = Object.freeze(['menu', 'orders', 'inventory', 'inventoryLedger']);
export const INITIAL_RESTAURANT_RESOURCE_KEYS = Object.freeze(['orders', 'inventory']);

export const RESTAURANT_RESOURCE_DEFINITIONS = Object.freeze({
  menu: { permission: PERMISSIONS.ordersRead, domainKey: 'recipes', fetch: getMenu, adapt: adaptMenuList },
  orders: { permission: PERMISSIONS.ordersRead, domainKey: 'orders', fetch: getOrders, adapt: adaptOrdersList },
  inventory: { permission: PERMISSIONS.inventoryRead, domainKey: 'inventory', fetch: getInventory, adapt: adaptInventoryList },
  inventoryLedger: { permission: PERMISSIONS.inventoryRead, domainKey: 'inventoryLedger', fetch: getInventoryLedger, adapt: adaptLedgerList },
});

const identityKeyFor = (authStatus, account) => authStatus === 'authenticated'
  ? `${account?.id || account?.email || ''}:${account?.propertyId || ''}`
  : '';

export function useRestaurantResources({ authStatus, account, permissions = [], commitInternal }) {
  const authRef = useRef({ authStatus, account, permissions });
  const resourceRefs = useRef(Object.fromEntries(RESTAURANT_RESOURCE_KEYS.map((key) => [key, { generation: 0, controller: null }])));

  useLayoutEffect(() => {
    authRef.current = { authStatus, account, permissions };
  }, [account, authStatus, permissions]);

  const cancelResourceLoad = useCallback((resourceKey) => {
    const ref = resourceRefs.current[resourceKey];
    if (!ref) return;
    const controller = ref.controller;
    if (!controller) return;
    controller.abort();
    ref.controller = null;
    const current = authRef.current;
    commitInternal({
      type: 'RESOURCE_LOAD_CANCELLED',
      resourceKey,
      identityKey: identityKeyFor(current.authStatus, current.account),
      generation: ref.generation,
    });
  }, [commitInternal]);

  const runResourceLoad = useCallback(async (resourceKey, generation, controller) => {
    const config = RESTAURANT_RESOURCE_DEFINITIONS[resourceKey];
    if (!config) return null;

    const currentAuth = authRef.current;
    const identityKey = identityKeyFor(currentAuth.authStatus, currentAuth.account);
    if (currentAuth.authStatus !== 'authenticated' || !currentAuth.permissions.includes(config.permission)) {
      commitInternal({ type: 'RESOURCE_ACCESS_FORBIDDEN', resourceKey, domainKey: config.domainKey, generation, identityKey });
      return null;
    }

    commitInternal({ type: 'RESOURCE_LOAD_STARTED', resourceKey, generation });
    try {
      const raw = await config.fetch(controller.signal);
      const currentRef = resourceRefs.current[resourceKey];
      if (generation !== currentRef.generation || controller.signal.aborted) return null;

      currentRef.controller = null;
      const data = config.adapt(raw);
      commitInternal({
        type: 'RESOURCE_LOAD_SUCCEEDED',
        resourceKey,
        domainKey: config.domainKey,
        data,
        generation,
        identityKey,
        updatedAt: new Date().toISOString(),
      });
      return data;
    } catch (error) {
      const currentRef = resourceRefs.current[resourceKey];
      if (generation !== currentRef.generation || controller.signal.aborted) return null;
      currentRef.controller = null;
      const details = normalizeRequestError(error);
      if (details.type === 'unauthorized') return null;

      if (details.type === 'forbidden') {
        commitInternal({ type: 'RESOURCE_ACCESS_FORBIDDEN', resourceKey, domainKey: config.domainKey, generation, identityKey });
      } else {
        commitInternal({ type: 'RESOURCE_LOAD_FAILED', resourceKey, generation, error: details.message, errorDetails: details, identityKey });
      }
      return null;
    }
  }, [commitInternal]);

  const reloadResource = useCallback((resourceKey) => {
    const config = RESTAURANT_RESOURCE_DEFINITIONS[resourceKey];
    const currentAuth = authRef.current;
    if (!config || currentAuth.authStatus !== 'authenticated' || !currentAuth.permissions.includes(config.permission)) {
      return Promise.resolve(null);
    }

    cancelResourceLoad(resourceKey);
    const ref = resourceRefs.current[resourceKey];
    ref.generation += 1;
    const controller = new AbortController();
    ref.controller = controller;
    return runResourceLoad(resourceKey, ref.generation, controller);
  }, [cancelResourceLoad, runResourceLoad]);

  const identityKey = identityKeyFor(authStatus, account);
  useEffect(() => {
    commitInternal({ type: 'RESTAURANT_RESOURCES_RESET', identityKey });

    if (authStatus !== 'authenticated' || !identityKey) return undefined;

    RESTAURANT_RESOURCE_KEYS.forEach((resourceKey) => {
      cancelResourceLoad(resourceKey);
      const config = RESTAURANT_RESOURCE_DEFINITIONS[resourceKey];
      const ref = resourceRefs.current[resourceKey];
      if (!INITIAL_RESTAURANT_RESOURCE_KEYS.includes(resourceKey)) {
        if (!permissions.includes(config.permission)) {
          commitInternal({ type: 'RESOURCE_ACCESS_FORBIDDEN', resourceKey, domainKey: config.domainKey, generation: ref.generation, identityKey });
        }
        return;
      }
      if (permissions.includes(config.permission)) {
        ref.generation += 1;
        const controller = new AbortController();
        ref.controller = controller;
        runResourceLoad(resourceKey, ref.generation, controller).catch(() => {});
      } else {
        commitInternal({ type: 'RESOURCE_ACCESS_FORBIDDEN', resourceKey, domainKey: config.domainKey, generation: ref.generation, identityKey });
      }
    });

    const resources = resourceRefs.current;
    return () => {
      RESTAURANT_RESOURCE_KEYS.forEach((resourceKey) => resources[resourceKey]?.controller?.abort());
    };
  }, [authStatus, cancelResourceLoad, commitInternal, identityKey, permissions, runResourceLoad]);

  return { reloadResource };
}
