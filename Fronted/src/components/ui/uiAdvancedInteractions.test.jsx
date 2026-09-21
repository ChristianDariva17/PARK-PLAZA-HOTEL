/** @vitest-environment jsdom */

import { useState } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react/pure';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePermissions } from '../../auth/authContext.js';
import { useActionPermission } from '../auth/useActionPermission.js';
import { PermissionButton, PermissionGate } from '../auth/PermissionButton.jsx';
import GlobalSearch from '../layout/GlobalSearch.jsx';
import { HotelSearchStateContext } from '../../state/hotelContext.js';
import { useWebSocketEvents } from '../../hooks/useWebSocket.js';
import * as socketClient from '../../realtime/socketClient.js';
import { Pagination, RowActions, SortableHeader } from './CollectionTable';
import { FilterBar } from './FilterBar';
import { AsyncButton } from './P1Atoms';
import { ConfirmAction, DataTable, EmptyState, PageHeader, ResourceState, StatusBadge } from '../views/SharedViewParts.jsx';
import { Dialog } from './Overlay';

vi.mock('../../auth/authContext.js', () => ({
  usePermissions: vi.fn(),
}));

vi.mock('../auth/useActionPermission.js', () => ({
  useActionPermission: vi.fn(),
}));

vi.mock('../../realtime/socketClient.js', () => ({
  addConnectionListener: vi.fn(),
  connectSocket: vi.fn(),
  getSocket: vi.fn(),
  subscribeToEvent: vi.fn(),
}));

let appRoot;
let connectionListener;
let connectionUnsubscribe;
let eventSubscriptions;
let eventUnsubscribers;

beforeEach(() => {
  appRoot = document.createElement('div');
  appRoot.id = 'root';
  document.body.appendChild(appRoot);
  window.location.hash = '#/reservas';

  vi.clearAllMocks();
  vi.mocked(useActionPermission).mockReturnValue(true);
  vi.mocked(usePermissions).mockReturnValue({ can: () => true });
  vi.mocked(socketClient.getSocket).mockReturnValue({ id: 'socket-1' });
  connectionUnsubscribe = vi.fn();
  eventSubscriptions = new Map();
  eventUnsubscribers = new Map();
  vi.mocked(socketClient.addConnectionListener).mockImplementation((listener) => {
    connectionListener = listener;
    return connectionUnsubscribe;
  });
  vi.mocked(socketClient.subscribeToEvent).mockImplementation((eventName, callback) => {
    eventSubscriptions.set(eventName, callback);
    const unsubscribe = vi.fn();
    eventUnsubscribers.set(eventName, unsubscribe);
    return unsubscribe;
  });
});

afterEach(() => {
  cleanup();
  appRoot?.remove();
  appRoot = null;
});

function WebSocketHarness({ eventNames = ['room.updated'], onEvent }) {
  const state = useWebSocketEvents(eventNames, onEvent);
  return <output data-testid="socket-state">{state.status}:{String(state.isConnected)}</output>;
}

function NestedOverlayHarness() {
  const [outerOpen, setOuterOpen] = useState(false);
  const [innerOpen, setInnerOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOuterOpen(true)}>Abrir externo</button>
      <Dialog open={outerOpen} onClose={() => setOuterOpen(false)} title="Externo">
        <button type="button" onClick={() => setInnerOpen(true)}>Abrir interno</button>
        <Dialog open={innerOpen} onClose={() => setInnerOpen(false)} title="Interno">
          <button type="button">Acción interna</button>
        </Dialog>
      </Dialog>
    </>
  );
}

function ConfirmActionHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Abrir confirmación</button>
      <ConfirmAction
        open={open}
        onCancel={() => setOpen(false)}
        onConfirm={() => setOpen(false)}
        title="Confirmar operación"
        description="Esta acción es irreversible."
        confirmLabel="Continuar"
      />
    </>
  );
}

function SearchHarness({ state, ...props }) {
  return <HotelSearchStateContext.Provider value={state}><GlobalSearch {...props} /></HotelSearchStateContext.Provider>;
}

describe('advanced shared UI interactions', () => {
  it('renders permission-controlled buttons and gates only when authorized', () => {
    vi.mocked(useActionPermission).mockReturnValue(false);
    render(
      <>
        <PermissionButton actionType="ROOM_UPDATE">Editar habitación</PermissionButton>
        <PermissionGate actionType="ROOM_UPDATE"><span>Editar contenido</span></PermissionGate>
      </>,
    );

    expect(screen.queryByRole('button', { name: 'Editar habitación' })).toBeNull();
    expect(screen.queryByText('Editar contenido')).toBeNull();

    vi.mocked(useActionPermission).mockReturnValue(true);
    render(
      <>
        <PermissionButton actionType="ROOM_UPDATE">Editar habitación</PermissionButton>
        <PermissionGate actionType="ROOM_UPDATE"><span>Editar contenido</span></PermissionGate>
      </>,
    );

    expect(screen.getByRole('button', { name: 'Editar habitación' })).toBeTruthy();
    expect(screen.getByText('Editar contenido')).toBeTruthy();
  });

  it('searches permitted records and selects results with the keyboard', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onNavigate = vi.fn();
    const state = {
      clients: [
        { id: 'client-1', name: 'María Soria', documentNumber: '71909099', email: 'maria@example.com', documentType: 'dni' },
        { id: 'client-2', name: 'María Dariva', documentNumber: '71909999', email: 'dariva@example.com', documentType: 'dni' },
      ],
      reservations: [],
      rooms: [],
      orders: [],
    };

    render(<SearchHarness open onClose={onClose} onNavigate={onNavigate} can={() => true} state={state} />);

    const input = screen.getByRole('combobox', { name: 'Buscar en el hotel' });
    await user.type(input, 'maría');
    expect(screen.getByRole('option', { name: /María Soria/ }).getAttribute('aria-selected')).toBe('true');

    await user.keyboard('{ArrowDown}');
    expect(input.getAttribute('aria-activedescendant')).toBe('global-result-1');
    expect(screen.getByRole('option', { name: /María Dariva/ }).getAttribute('aria-selected')).toBe('true');

    await user.keyboard('{Enter}');
    expect(onNavigate).toHaveBeenCalledWith('clientes', { type: 'select-record', recordId: 'client-2' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not show search results for routes the user cannot access', async () => {
    const user = userEvent.setup();
    const state = {
      clients: [],
      reservations: [],
      rooms: [{ id: '101', category: 'Doble', status: 'available' }],
      orders: [],
    };
    const can = (permission) => permission === 'guests.read';

    render(<SearchHarness open onClose={vi.fn()} onNavigate={vi.fn()} can={can} state={state} />);
    await user.type(screen.getByRole('combobox', { name: 'Buscar en el hotel' }), '101');

    expect(screen.getByRole('status').textContent).toContain('Sin resultados');
    expect(screen.queryByRole('option')).toBeNull();
  });

  it('filters the search region and paginates table results', async () => {
    const user = userEvent.setup();
    const onPage = vi.fn();
    const onSort = vi.fn();

    render(
      <>
        <FilterBar label="Filtros de habitaciones"><input aria-label="Buscar habitación" /></FilterBar>
        <table>
          <thead><tr><SortableHeader column={{ key: 'name', label: 'Nombre' }} sort={{ key: 'name', direction: 'asc' }} onSort={onSort} /></tr></thead>
        </table>
        <Pagination page={1} pageCount={2} total={3} onPage={onPage} />
      </>,
    );

    expect(screen.getByRole('search', { name: 'Filtros de habitaciones' })).toBeTruthy();
    const sortButton = screen.getByRole('button', { name: 'NombreOrden ascendente' });
    await user.click(sortButton);
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(onSort).toHaveBeenCalledWith('name');
    expect(onPage).toHaveBeenCalledWith(2);
    expect(screen.getByRole('button', { name: 'Anterior' }).disabled).toBe(true);
  });

  it.each([
    ['Activo', 'badge-green'],
    ['Cliente presente', 'badge-blue'],
    ['Pendiente', 'badge-yellow'],
    ['Ocupada', 'badge-purple'],
    ['Cancelado', 'badge-red'],
    ['Estado nuevo', 'badge-gray'],
  ])('maps the status variant %s to the shared tone %s', (label, className) => {
    render(<StatusBadge>{label}</StatusBadge>);

    expect(screen.getByText(label).className).toContain(className);
  });

  it('keeps page actions behind the shared permission contract', () => {
    vi.mocked(usePermissions).mockReturnValue({ can: () => false });
    render(<PageHeader title="Habitaciones" description="Inventario" actionType="ROOM_UPDATE" action={<button>Editar</button>} />);
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();

    vi.mocked(usePermissions).mockReturnValue({ can: () => true });
    render(<PageHeader title="Habitaciones" description="Inventario" actionType="ROOM_UPDATE" action={<button>Editar</button>} />);
    expect(screen.getByRole('button', { name: 'Editar' })).toBeTruthy();
  });

  it('uses the shared empty and populated table variants', () => {
    const { rerender } = render(<DataTable caption="Habitaciones" columns={['Número']} emptyTitle="Sin habitaciones" />);
    expect(screen.getByText('Sin habitaciones')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();

    rerender(
      <DataTable caption="Habitaciones" columns={['Número']}>
        <tr><td>101</td></tr>
      </DataTable>,
    );
    expect(screen.getByRole('region', { name: 'Habitaciones' }).getAttribute('tabindex')).toBe('0');
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByText('101')).toBeTruthy();
  });

  it('covers shared page, resource, empty, error, and async action states', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { rerender } = render(
      <ResourceState status="loading" />,
    );
    expect(screen.getByRole('status').textContent).toContain('Cargando');
    expect(screen.getByRole('status').getAttribute('aria-busy')).toBe('true');

    rerender(<ResourceState status="refreshing"><span>Datos existentes</span></ResourceState>);
    expect(screen.getByRole('status').textContent).toContain('Actualizando');
    expect(screen.getByRole('status').className).toContain('state-refreshing');
    expect(screen.getByText('Datos existentes')).toBeTruthy();

    rerender(<ResourceState status="error" error="No disponible" onRetry={onRetry} />);
    expect(screen.getByRole('alert').textContent).toContain('No disponible');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalledOnce();

    rerender(<EmptyState title="Sin habitaciones" description="No hay datos." />);
    expect(screen.getByText('Sin habitaciones')).toBeTruthy();
    expect(screen.getByText('No hay datos.')).toBeTruthy();

    rerender(<AsyncButton pending pendingLabel="Guardando...">Guardar</AsyncButton>);
    const button = screen.getByRole('button', { name: 'Guardando...' });
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
  });

  it('confirms destructive actions through the shared dialog contract', async () => {
    const user = userEvent.setup();
    render(<ConfirmActionHarness />);

    const trigger = screen.getByRole('button', { name: 'Abrir confirmación' });
    await user.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Confirmar operación' })).toBeTruthy();
    expect(screen.getByText('Esta acción es irreversible.')).toBeTruthy();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens row actions, focuses the first item, and restores the trigger on Escape', async () => {
    const user = userEvent.setup();
    render(
      <RowActions label="Reserva 123">
        <button type="button">Editar</button>
        <button type="button">Cancelar</button>
      </RowActions>,
    );

    const trigger = screen.getByRole('button', { name: 'Acciones para Reserva 123' });
    await user.click(trigger);

    const menu = screen.getByRole('menu');
    const edit = screen.getByRole('menuitem', { name: 'Editar' });
    expect(menu).toBeTruthy();
    expect(document.activeElement).toBe(edit);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps nested overlays isolated and restores body and root state after closing', async () => {
    const user = userEvent.setup();
    render(<NestedOverlayHarness />);

    const outerTrigger = screen.getByRole('button', { name: 'Abrir externo' });
    await user.click(outerTrigger);
    await user.click(screen.getByRole('button', { name: 'Abrir interno' }));

    expect(screen.getByRole('dialog', { name: 'Interno' })).toBeTruthy();
    expect(document.body.style.overflow).toBe('hidden');
    expect(appRoot.getAttribute('aria-hidden')).toBe('true');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Interno' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Externo' })).toBeTruthy();
    expect(document.body.style.overflow).toBe('hidden');
    expect(appRoot.getAttribute('aria-hidden')).toBe('true');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(appRoot.hasAttribute('aria-hidden')).toBe(false);
    expect(document.activeElement).toBe(outerTrigger);
  });
});

describe('websocket lifecycle interactions', () => {
  it('connects, publishes connection status, forwards events, and cleans subscriptions', async () => {
    const onEvent = vi.fn();
    const { unmount } = render(<WebSocketHarness eventNames={['room.updated', 'reservation.updated']} onEvent={onEvent} />);

    expect(socketClient.connectSocket).toHaveBeenCalledOnce();
    expect(socketClient.addConnectionListener).toHaveBeenCalledOnce();
    expect(socketClient.subscribeToEvent).toHaveBeenCalledTimes(2);

    act(() => connectionListener(true, 'connected'));
    expect(screen.getByTestId('socket-state').textContent).toBe('connected:true');

    act(() => eventSubscriptions.get('room.updated')({ id: 'room-1' }));
    expect(onEvent).toHaveBeenCalledWith({ id: 'room-1' });

    unmount();
    expect(connectionUnsubscribe).toHaveBeenCalledOnce();
    expect(eventUnsubscribers.get('room.updated')).toHaveBeenCalledOnce();
    expect(eventUnsubscribers.get('reservation.updated')).toHaveBeenCalledOnce();
  });

  it('uses the latest callback without resubscribing the event', () => {
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();
    const { rerender } = render(<WebSocketHarness onEvent={firstCallback} />);

    rerender(<WebSocketHarness onEvent={secondCallback} />);
    act(() => eventSubscriptions.get('room.updated')({ id: 'room-2' }));

    expect(firstCallback).not.toHaveBeenCalled();
    expect(secondCallback).toHaveBeenCalledWith({ id: 'room-2' });
    expect(socketClient.subscribeToEvent).toHaveBeenCalledOnce();
  });
});
