import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { PERMISSIONS } from '../auth/permissions.js';
import { adaptCashCountsList, adaptCashMovement, adaptCashMovementsList, adaptCashSession, adaptCashSessionsList, buildCashMovementDto, buildCountCashSessionDto, buildOpenCashSessionDto } from './cashModel.js';
import { CashRequestError, closeCashSession, countCashSession, createCashMovement, getActiveCashSession, getCashCounts, getCashMovements, getCashSessions, openCashSession } from './cashClient.js';

const identityKeyFor = (authStatus, account) => authStatus === 'authenticated'
  ? `${account?.id || account?.email || ''}:${account?.propertyId || ''}`
  : '';

export function createCashCommands({ authRef, commitInternal, reloadCash, loadCashSessionDetails }) {
  const assertPermission = (permission, message) => {
    if (authRef.current.authStatus !== 'authenticated' || !authRef.current.permissions.includes(permission)) throw new CashRequestError(message, 403);
  };

  const open = async (input) => {
    assertPermission(PERMISSIONS.cashOpen, 'No cuenta con permiso para abrir caja.');
    const controller = new AbortController();
    try {
      const dto = await openCashSession(buildOpenCashSessionDto(input), controller.signal);
      const session = adaptCashSession(dto);
      commitInternal({ type: 'CASH_SESSION_OPENED', session });
      await reloadCash();
      return session;
    } catch (error) {
      if (error.reloadRecommended) reloadCash().catch(() => {});
      throw error;
    }
  };

  const count = async (sessionId, input) => {
    assertPermission(PERMISSIONS.cashCount, 'No cuenta con permiso para arqueo de caja.');
    const dto = await countCashSession(sessionId, buildCountCashSessionDto(input), new AbortController().signal);
    const session = adaptCashSession(dto);
    await reloadCash();
    return session;
  };

  const close = async (sessionId, input) => {
    assertPermission(PERMISSIONS.cashClose, 'No cuenta con permiso para cerrar caja.');
    const controller = new AbortController();
    try {
      const dto = await closeCashSession(sessionId, buildCountCashSessionDto(input), controller.signal);
      const session = adaptCashSession(dto);
      commitInternal({ type: 'CASH_SESSION_CLOSED', session });
      await reloadCash();
      return session;
    } catch (error) {
      if (error.reloadRecommended) reloadCash().catch(() => {});
      throw error;
    }
  };

  const move = async (input) => {
    assertPermission(PERMISSIONS.cashMove, 'No cuenta con permiso para registrar movimientos de caja.');
    const controller = new AbortController();
    try {
      const dto = await createCashMovement(buildCashMovementDto(input), controller.signal);
      const movement = adaptCashMovement(dto);
      commitInternal({ type: 'CASH_MOVEMENT_CREATED', movement });
      await reloadCash();
      return movement;
    } catch (error) {
      if (error.reloadRecommended) reloadCash().catch(() => {});
      throw error;
    }
  };

  return { reload: reloadCash, loadDetails: loadCashSessionDetails, open, count, close, move };
}

export function useCashCommands({ authStatus, account, permissions = [], commitInternal, projectedState }) {
  const authRef = useRef({ authStatus, account, permissions });
  const generationRef = useRef(0);
  const controllerRef = useRef(null);

  useLayoutEffect(() => {
    authRef.current = { authStatus, account, permissions };
  }, [account, authStatus, permissions]);

  const cancelCashLoad = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    if (projectedState.current.cashRequest?.status === 'loading') commitInternal({ type: 'CASH_LOAD_CANCELLED' });
  }, [commitInternal, projectedState]);

  const runCashLoad = useCallback(async (generation, controller) => {
    commitInternal({ type: 'CASH_LOAD_STARTED' });
    try {
      const [active, history] = await Promise.all([
        getActiveCashSession(controller.signal),
        getCashSessions(controller.signal),
      ]);
      if (generation !== generationRef.current || controller.signal.aborted) return null;

      const [movements, counts] = active
        ? await Promise.all([getCashMovements(active.id, controller.signal), getCashCounts(active.id, controller.signal)])
        : [[], []];
      if (generation !== generationRef.current || controller.signal.aborted) return null;

      const result = {
        openSession: adaptCashSession(active),
        cashSessions: adaptCashSessionsList(history),
        cashMovements: adaptCashMovementsList(movements),
        cashCounts: adaptCashCountsList(counts),
      };
      commitInternal({ type: 'CASH_LOAD_SUCCEEDED', ...result });
      return result;
    } catch (error) {
      if (generation !== generationRef.current || controller.signal.aborted || error.status === 401) return null;
      commitInternal({ type: 'CASH_LOAD_FAILED', error: error.message });
      throw error;
    }
  }, [commitInternal]);

  const reloadCash = useCallback(() => {
    const current = authRef.current;
    if (current.authStatus !== 'authenticated' || !current.permissions.includes(PERMISSIONS.cashRead)) throw new CashRequestError('No cuenta con permiso para consultar caja.', 403);
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    cancelCashLoad();
    const controller = new AbortController();
    controllerRef.current = controller;
    return runCashLoad(generation, controller);
  }, [cancelCashLoad, runCashLoad]);

  const loadCashSessionDetails = useCallback(async (sessionId) => {
    const current = authRef.current;
    if (current.authStatus !== 'authenticated' || !current.permissions.includes(PERMISSIONS.cashRead)) throw new CashRequestError('No cuenta con permiso para consultar caja.', 403);
    const [movements, counts] = await Promise.all([getCashMovements(sessionId), getCashCounts(sessionId)]);
    commitInternal({
      type: 'CASH_SESSION_DETAILS_LOADED',
      sessionId,
      cashMovements: adaptCashMovementsList(movements),
      cashCounts: adaptCashCountsList(counts),
    });
  }, [commitInternal]);

  const identityKey = identityKeyFor(authStatus, account);
  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    cancelCashLoad();
    commitInternal({ type: 'CASH_RESET' });
    if (authStatus !== 'authenticated' || !identityKey || !permissions.includes(PERMISSIONS.cashRead)) return undefined;
    const controller = new AbortController();
    controllerRef.current = controller;
    runCashLoad(generation, controller).catch(() => {});
    return () => {
      controller.abort();
      if (generationRef.current === generation) generationRef.current += 1;
    };
  }, [authStatus, cancelCashLoad, commitInternal, identityKey, permissions, runCashLoad]);

  return useMemo(() => createCashCommands({
    authRef,
    commitInternal,
    reloadCash,
    loadCashSessionDetails,
  }), [commitInternal, loadCashSessionDetails, reloadCash]);
}
