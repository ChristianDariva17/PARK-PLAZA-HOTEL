import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { hasKitchenManagementAccess } from '../auth/permissions.js';
import { adaptImportPreviewResult, adaptManagedMenuList } from './restaurantModel.js';
import { applyMenuImport, archiveMenuItem, createMenuItem, getManagedMenu, previewMenuImport, reactivateMenuItem, updateMenuItem } from './restaurantClient.js';

export function createRestaurantMenuCommands({
  getPermissions,
  getState,
  commitInternal,
  reloadManagedMenu,
  reloadResource,
  cancelMenuImport,
  menuImportControllerRef,
}) {
  const assertManagementAccess = (message) => {
    if (!hasKitchenManagementAccess(getPermissions())) throw new Error(message);
  };

  const createManual = async (body) => {
    assertManagementAccess('Sin permiso para gestionar el menú.');
    const response = await createMenuItem(body);
    const item = adaptManagedMenuList([response])[0];
    commitInternal({ type: 'MENU_ITEM_COMMITTED', item });
    Promise.allSettled([reloadManagedMenu(), reloadResource('menu'), reloadResource('orders')]);
    return item;
  };

  const updateManual = async (id, body) => {
    assertManagementAccess('Sin permiso para gestionar el menú.');
    commitInternal({ type: 'MENU_MUTATION_STARTED', itemId: id });
    try {
      const response = await updateMenuItem(id, body);
      const item = adaptManagedMenuList([response])[0];
      commitInternal({ type: 'MENU_ITEM_COMMITTED', item });
      Promise.allSettled([reloadManagedMenu(), reloadResource('menu'), reloadResource('orders')]);
      return item;
    } finally {
      commitInternal({ type: 'MENU_MUTATION_DONE', itemId: id });
    }
  };

  const archiveManual = async (id, body) => {
    assertManagementAccess('Sin permiso para gestionar el menú.');
    commitInternal({ type: 'MENU_MUTATION_STARTED', itemId: id });
    try {
      const response = await archiveMenuItem(id, body);
      const item = adaptManagedMenuList([response])[0];
      commitInternal({ type: 'MENU_ITEM_COMMITTED', item });
      Promise.allSettled([reloadManagedMenu(), reloadResource('menu'), reloadResource('orders')]);
      return item;
    } finally {
      commitInternal({ type: 'MENU_MUTATION_DONE', itemId: id });
    }
  };

  const reactivateManual = async (id) => {
    assertManagementAccess('Sin permiso para gestionar el menú.');
    commitInternal({ type: 'MENU_MUTATION_STARTED', itemId: id });
    try {
      const response = await reactivateMenuItem(id);
      const item = adaptManagedMenuList([response])[0];
      commitInternal({ type: 'MENU_ITEM_COMMITTED', item });
      Promise.allSettled([reloadManagedMenu(), reloadResource('menu'), reloadResource('orders')]);
      return item;
    } finally {
      commitInternal({ type: 'MENU_MUTATION_DONE', itemId: id });
    }
  };

  const previewImport = async (markdown, contentHash) => {
    assertManagementAccess('Sin permiso para importar el menú.');
    cancelMenuImport();
    const controller = new AbortController();
    menuImportControllerRef.current = controller;
    commitInternal({ type: 'MENU_IMPORT_PREVIEW_STARTED' });
    try {
      const result = await previewMenuImport({ markdown }, controller.signal);
      commitInternal({ type: 'MENU_IMPORT_PREVIEW_DONE', result: adaptImportPreviewResult(result), contentHash });
    } catch (error) {
      if (controller.signal.aborted) return;
      commitInternal({ type: 'MENU_IMPORT_ERROR', error: error.message });
    }
  };

  const applyImport = async (markdown, expectedHash) => {
    assertManagementAccess('Sin permiso para importar el menú.');
    const state = getState();
    if (state.menuImportRequest.contentHash !== expectedHash) {
      throw new Error('El contenido fue modificado o no hay previsualización vigente.');
    }
    if (state.menuPendingMutations.length > 0) {
      throw new Error('Hay operaciones de ítem pendientes. Esperá a que terminen.');
    }

    cancelMenuImport();
    const controller = new AbortController();
    menuImportControllerRef.current = controller;
    commitInternal({ type: 'MENU_IMPORT_APPLY_STARTED' });
    try {
      const result = await applyMenuImport({ markdown }, controller.signal);
      commitInternal({ type: 'MENU_IMPORT_APPLY_DONE', result: adaptImportPreviewResult(result) });
      Promise.allSettled([reloadManagedMenu(), reloadResource('menu'), reloadResource('orders')]);
    } catch (error) {
      if (controller.signal.aborted) return;
      commitInternal({ type: 'MENU_IMPORT_ERROR', error: error.message });
      throw error;
    }
  };

  const clearImport = () => {
    cancelMenuImport();
    commitInternal({ type: 'MENU_IMPORT_CLEARED' });
  };

  return {
    reload: reloadManagedMenu,
    createManual,
    updateManual,
    archiveManual,
    reactivateManual,
    previewImport,
    applyImport,
    clearImport,
    isMutating: (id) => getState().menuPendingMutations.includes(id),
  };
}

export function useRestaurantMenuCommands({ authStatus, permissions = [], commitInternal, reloadResource, projectedState }) {
  const authRef = useRef({ authStatus, permissions });
  const managedMenuGenerationRef = useRef(0);
  const managedMenuControllerRef = useRef(null);
  const menuImportControllerRef = useRef(null);

  useLayoutEffect(() => {
    authRef.current = { authStatus, permissions };
  }, [authStatus, permissions]);

  const cancelManagedMenuLoad = useCallback(() => {
    managedMenuControllerRef.current?.abort();
    managedMenuControllerRef.current = null;
    commitInternal({ type: 'MANAGED_MENU_LOAD_CANCELLED' });
  }, [commitInternal]);

  const runManagedMenuLoad = useCallback(async (generation, controller) => {
    commitInternal({ type: 'MANAGED_MENU_LOAD_STARTED' });
    try {
      const response = await getManagedMenu(controller.signal);
      if (generation !== managedMenuGenerationRef.current || controller.signal.aborted) return null;
      const items = adaptManagedMenuList(response);
      commitInternal({ type: 'MANAGED_MENU_LOAD_SUCCEEDED', items, version: generation });
      return items;
    } catch (error) {
      if (generation !== managedMenuGenerationRef.current || controller.signal.aborted || error.status === 401) return null;
      commitInternal({ type: 'MANAGED_MENU_LOAD_FAILED', error: error.message });
      throw error;
    }
  }, [commitInternal]);

  const reloadManagedMenu = useCallback(() => {
    if (authRef.current.authStatus !== 'authenticated' || !hasKitchenManagementAccess(authRef.current.permissions)) {
      throw new Error('No cuenta con los permisos requeridos para gestionar el menú.');
    }
    cancelManagedMenuLoad();
    const generation = managedMenuGenerationRef.current + 1;
    managedMenuGenerationRef.current = generation;
    const controller = new AbortController();
    managedMenuControllerRef.current = controller;
    return runManagedMenuLoad(generation, controller);
  }, [cancelManagedMenuLoad, runManagedMenuLoad]);

  const cancelMenuImport = useCallback(() => {
    menuImportControllerRef.current?.abort();
    menuImportControllerRef.current = null;
  }, []);

  const getPermissions = useCallback(() => authRef.current.permissions, []);
  const getState = useCallback(() => projectedState.current, [projectedState]);

  return useMemo(() => createRestaurantMenuCommands({
    getPermissions,
    getState,
    commitInternal,
    reloadManagedMenu,
    reloadResource,
    cancelMenuImport,
    menuImportControllerRef,
  }), [cancelMenuImport, commitInternal, getPermissions, getState, reloadManagedMenu, reloadResource]);
}
