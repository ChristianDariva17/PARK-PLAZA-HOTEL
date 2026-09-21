import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '../auth/permissions.js';
import { createCashMovement, openCashSession } from './cashClient.js';
import { createCashCommands } from './useCashCommands.js';

vi.mock('./cashClient.js', () => ({
  CashRequestError: class CashRequestError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  },
  closeCashSession: vi.fn(),
  countCashSession: vi.fn(),
  createCashMovement: vi.fn(),
  getActiveCashSession: vi.fn(),
  getCashCounts: vi.fn(),
  getCashMovements: vi.fn(),
  getCashSessions: vi.fn(),
  openCashSession: vi.fn(),
}));

const session = {
  id: 'session-1',
  propertyId: 'property-1',
  openingAmount: '100.00',
  countedAmount: null,
  expectedAmount: null,
  difference: null,
  responsible: 'Ana',
  shift: 'Mañana',
  status: 'open',
  notes: '',
};
const movement = {
  id: 'movement-1',
  sessionId: 'session-1',
  type: 'Ingreso',
  concept: 'Pago',
  referenceId: null,
  amount: '25.00',
  method: 'Efectivo',
  responsible: 'Ana',
};

describe('cash commands', () => {
  const permissions = [PERMISSIONS.cashRead, PERMISSIONS.cashOpen, PERMISSIONS.cashMove, PERMISSIONS.cashCount, PERMISSIONS.cashClose];
  const authRef = { current: { authStatus: 'authenticated', permissions } };
  const commitInternal = vi.fn();
  const reloadCash = vi.fn();
  const loadCashSessionDetails = vi.fn();

  const createCommands = (currentPermissions = permissions) => {
    authRef.current.permissions = currentPermissions;
    return createCashCommands({ authRef, commitInternal, reloadCash, loadCashSessionDetails });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    authRef.current.permissions = permissions;
    reloadCash.mockResolvedValue({ openSession: session });
  });

  it('opens a session, commits it and refreshes authoritative cash state', async () => {
    vi.mocked(openCashSession).mockResolvedValue(session);
    const commands = createCommands();

    await expect(commands.open({ openingAmount: '100', responsible: ' Ana ', shift: 'Mañana' })).resolves.toMatchObject({ id: 'session-1', status: 'Abierta' });

    expect(openCashSession).toHaveBeenCalledWith({ openingAmount: 100, responsible: 'Ana', shift: 'Mañana' }, expect.any(AbortSignal));
    expect(commitInternal).toHaveBeenCalledWith(expect.objectContaining({ type: 'CASH_SESSION_OPENED' }));
    expect(reloadCash).toHaveBeenCalled();
  });

  it('creates a cash-only movement and commits the adapted response', async () => {
    vi.mocked(createCashMovement).mockResolvedValue(movement);
    const commands = createCommands();

    await expect(commands.move({ type: 'Ingreso', concept: ' Pago ', amount: '25', method: 'Efectivo' })).resolves.toMatchObject({ id: 'movement-1', amount: 25 });

    expect(createCashMovement).toHaveBeenCalledWith({ type: 'Ingreso', concept: 'Pago', amount: 25, method: 'Efectivo' }, expect.any(AbortSignal));
    expect(commitInternal).toHaveBeenCalledWith(expect.objectContaining({ type: 'CASH_MOVEMENT_CREATED' }));
  });

  it('rejects commands when the specific permission is absent', async () => {
    const commands = createCommands([PERMISSIONS.cashRead]);

    await expect(commands.open({ openingAmount: '100', responsible: 'Ana', shift: 'Mañana' })).rejects.toMatchObject({ status: 403 });
    expect(openCashSession).not.toHaveBeenCalled();
  });
});
