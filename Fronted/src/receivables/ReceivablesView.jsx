import { useCallback, useEffect, useState } from 'react';
import { usePermissions } from '../auth/authContext';
import { PERMISSIONS } from '../auth/permissions';
import { useHotel } from '../state/hotelContext.js';
import { collectReceivable, getReceivable, getReceivables, reverseReceivableCollection } from './receivablesClient';
import { getFolio } from '../folios/folioClient';
import { DataTable, EmptyState, MetricStrip, PageHeader, StatusBadge } from '../components/views/SharedViewParts';
import { Drawer } from '../components/ui/Overlay';
import FolioPanel from '../folios/FolioPanel';
import { CreditCard, Building2, RefreshCw } from 'lucide-react';

const money = (value) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(value));
const methods = ['Efectivo', 'Tarjeta', 'Transferencia', 'Yape', 'Plin'];

export default function ReceivablesView({ notify }) {
  const { can } = usePermissions();
  const { state } = useHotel();
  const [activeTab, setActiveTab] = useState('inhouse'); // 'inhouse' | 'receivables'
  const [filters, setFilters] = useState({ status: 'open', age: '' });
  const [items, setItems] = useState([]);
  const [inHouseFolios, setInHouseFolios] = useState({});
  const [detail, setDetail] = useState(null);
  const [activeStayForFolio, setActiveStayForFolio] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ amount: '', method: 'Efectivo', reference: '' });
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  // Load post-checkout receivables
  const refreshReceivables = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await getReceivables(filters));
    } catch (failure) {
      setError(failure.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Load active stays folios (in-house balances)
  const refreshInHouseBalances = useCallback(async () => {
    const activeStays = state.persistentStays.filter((s) => s.status === 'active');
    const foliosMap = {};
    await Promise.allSettled(
      activeStays.map(async (stay) => {
        try {
          const folio = await getFolio(stay.id);
          foliosMap[stay.id] = folio;
        } catch {
          // ignore individual fetch errors
        }
      })
    );
    setInHouseFolios(foliosMap);
  }, [state.persistentStays]);

  const refreshAll = useCallback(async () => {
    await Promise.allSettled([refreshReceivables(), refreshInHouseBalances()]);
  }, [refreshReceivables, refreshInHouseBalances]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const open = async (id) => {
    try {
      setDetail(await getReceivable(id));
      setForm({ amount: '', method: 'Efectivo', reference: '' });
      setReason('');
    } catch (failure) {
      setError(failure.message);
    }
  };

  const collect = async (event) => {
    event.preventDefault();
    if (!detail) return;
    setBusy(true);
    try {
      await collectReceivable(detail.id, form);
      await open(detail.id);
      await refreshAll();
      notify?.('Cobranza registrada', 'El pago se agregó al folio original y actualizó la cuenta por cobrar.', 'success');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  const reverse = async (entryId) => {
    if (!detail || !reason.trim()) return;
    setBusy(true);
    try {
      await reverseReceivableCollection(detail.id, entryId, { reason: reason.trim() });
      await open(detail.id);
      await refreshAll();
      notify?.('Reversión registrada', 'El asiento original permanece intacto.', 'success');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  // Calculations for In-House Active Stays
  const activeStaysList = state.persistentStays
    .filter((s) => s.status === 'active')
    .map((stay) => {
      const reservation = state.persistentReservations.find((r) => r.id === stay.reservationId);
      const guest = state.clients.find((g) => g.id === reservation?.primaryGuestId);
      const room = state.rooms.find((r) => r.id === stay.roomId);
      const folio = inHouseFolios[stay.id] || null;
      const balance = Number(folio?.balance || 0);
      return {
        stay,
        reservation,
        guestName: guest?.name || (guest?.firstName ? `${guest.firstName} ${guest.lastName || ''}`.trim() : 'Huésped Titular'),
        guestDoc: guest?.primaryDocument?.documentNumber || 'Sin doc',
        roomNumber: room?.number || 'N/A',
        roomCategory: room?.category || '',
        checkInAt: stay.checkInAt,
        balance,
        folio,
      };
    });

  const inHouseTotalDebt = activeStaysList.reduce((sum, item) => sum + Math.max(0, item.balance), 0);
  const inHouseWithDebtCount = activeStaysList.filter((item) => item.balance > 0).length;

  const receivablesOpenCount = items.filter((item) => item.status === 'open').length;
  const receivablesTotalDebt = items.reduce((sum, item) => sum + (item.status === 'open' ? Number(item.outstandingAmount) : 0), 0);

  const grandTotalDebt = inHouseTotalDebt + receivablesTotalDebt;

  return (
    <div className="view-container">
      <PageHeader
        metadata="Gestión Financiera, Folios y Cuentas por Cobrar"
        title="Pagos y Cuentas"
        description="Supervisión integral de saldos en curso (huéspedes alojados) y cobranzas posteriores al check-out."
      />

      <MetricStrip
        items={[
          { label: 'Saldos en curso (Alojados)', value: money(inHouseTotalDebt), detail: `${inHouseWithDebtCount} habitaciones con saldo` },
          { label: 'Cuentas por cobrar (Post Check-out)', value: money(receivablesTotalDebt), detail: `${receivablesOpenCount} abiertas` },
          { label: 'Cartera Total por Cobrar', value: money(grandTotalDebt), detail: 'Consolidado hotel' },
        ]}
      />

      {error ? <div className="alert-banner alert-banner-danger" role="alert">{error}</div> : null}

      {/* Navigation Tabs between In-House Stays and Post-Checkout Receivables */}
      <div className="menu-surface-secondary5">
        <button
          type="button"
          onClick={() => setActiveTab('inhouse')}
          className={`menu-surface-secondary ${activeTab === 'inhouse' ? 'is-active' : ''}`}
        >
          <Building2 size={16} /> 🏨 Saldos de Habitaciones en Curso ({activeStaysList.length})
          {inHouseWithDebtCount > 0 && (
            <span className="menu-surface-secondary7">
              {inHouseWithDebtCount} con saldo
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('receivables')}
          className={`menu-surface-secondary ${activeTab === 'receivables' ? 'is-active' : ''}`}
        >
          <CreditCard size={16} /> 📋 Cuentas por Cobrar (Post Check-out) ({items.length})
        </button>

        <div className="menu-surface-secondary9">
          <button
            type="button"
            className="btn btn-sm btn-outline menu-row0"
            onClick={() => void refreshAll()}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Actualizar Datos
          </button>
        </div>
      </div>

      {/* TAB 1: IN-HOUSE STAYS (Huéspedes alojados actualmente con consumos o saldos) */}
      {activeTab === 'inhouse' && (
        <div>
          <div className="menu-row1">
            Huéspedes que se encuentran actualmente hospedados en el hotel. Puedes registrar abonos, liquidar consumos o revisar su estado de cuenta en tiempo real.
          </div>

          <DataTable
            caption="Saldos de estadías en curso"
            columns={['Huésped', 'Habitación', 'Ingreso', 'Estado Folio', 'Saldo Acumulado', 'Acción']}
          >
            {activeStaysList.map((item) => (
              <tr key={item.stay.id}>
                <td>
                  <strong>{item.guestName}</strong>
                  <div className="menu-row2">Doc: {item.guestDoc}</div>
                </td>
                <td>
                  <strong className="menu-row3">Hab. {item.roomNumber}</strong>
                  <div className="menu-row4">{item.roomCategory}</div>
                </td>
                <td className="menu-row5">
                  {new Date(item.checkInAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td>
                  <StatusBadge>{item.balance > 0 ? 'Pendiente de pago' : 'Liquidado'}</StatusBadge>
                </td>
                <td>
                  <strong className="menu-row6">
                    {money(item.balance)}
                  </strong>
                </td>
                <td>
                  <button
                    className="btn btn-outline btn-sm menu-row7"
                    onClick={() => setActiveStayForFolio(item)}
                  >
                    Ver Folio / Cobrar
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>

          {activeStaysList.length === 0 && (
            <EmptyState
              title="Sin estadías activas"
              description="No hay habitaciones ocupadas en este momento."
            />
          )}
        </div>
      )}

      {/* TAB 2: POST-CHECKOUT RECEIVABLES */}
      {activeTab === 'receivables' && (
        <div>
          <div className="filter-bar menu-row8">
            <label className="menu-row9">
              Estado
              <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                <option value="open">Abiertas</option>
                <option value="settled">Liquidadas</option>
              </select>
            </label>
            <label className="menu-text-secondary0">
              Antigüedad
              <select value={filters.age} onChange={(event) => setFilters((current) => ({ ...current, age: event.target.value }))}>
                <option value="">Todas</option>
                <option value="0_30">0–30 días</option>
                <option value="31_60">31–60 días</option>
                <option value="61_90">61–90 días</option>
                <option value="91_plus">91+ días</option>
              </select>
            </label>
            <button className="btn btn-outline" onClick={() => void refreshReceivables()} disabled={loading}>
              Filtrar
            </button>
          </div>

          <DataTable
            caption="Cuentas por cobrar"
            columns={['Huésped', 'Reserva', 'Estado', 'Antigüedad', 'Original', 'Pendiente', 'Acción']}
          >
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.guest.name}</td>
                <td>{item.reservation.id.slice(0, 8)}</td>
                <td><StatusBadge>{item.status === 'open' ? 'Abierta' : 'Liquidada'}</StatusBadge></td>
                <td>{item.ageDays} días</td>
                <td>{money(item.originalAmount)}</td>
                <td><strong className="menu-text-secondary1">{money(item.outstandingAmount)}</strong></td>
                <td>
                  <button className="btn btn-outline btn-sm" onClick={() => void open(item.id)}>
                    Ver detalle
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>

          {!loading && !items.length ? (
            <EmptyState
              title="Sin cuentas por cobrar"
              description="No hay cuentas por cobrar post check-out que coincidan con los filtros seleccionados."
            />
          ) : null}
        </div>
      )}

      {/* DRAWER FOR IN-HOUSE STAY FOLIO */}
      <Drawer
        open={Boolean(activeStayForFolio)}
        onClose={() => { setActiveStayForFolio(null); refreshInHouseBalances(); }}
        title={activeStayForFolio ? `Folio de Habitación ${activeStayForFolio.roomNumber} · ${activeStayForFolio.guestName}` : 'Folio de Habitación'}
      >
        {activeStayForFolio ? (
          <div className="detail-stack menu-text-secondary2">
            <div className="menu-text-secondary3">
              <div><span>Huésped:</span> <strong>{activeStayForFolio.guestName}</strong></div>
              <div><span>Habitación:</span> <strong>Hab. {activeStayForFolio.roomNumber} ({activeStayForFolio.roomCategory})</strong></div>
              <div><span>N.º Estadía:</span> <span className="menu-text-secondary4">#{activeStayForFolio.stay.id.slice(0, 8)}</span></div>
              <div><span>Ingreso:</span> <span>{new Date(activeStayForFolio.checkInAt).toLocaleString('es-PE')}</span></div>
            </div>

            <FolioPanel
              stayId={activeStayForFolio.stay.id}
              canCharge={can(PERMISSIONS.financeCharge)}
              canPay={can(PERMISSIONS.financePayment)}
              canReverse={can(PERMISSIONS.financeReverse)}
              onFolioChange={(next) => {
                setInHouseFolios((current) => ({ ...current, [activeStayForFolio.stay.id]: next }));
              }}
            />
          </div>
        ) : null}
      </Drawer>

      {/* DRAWER FOR POST-CHECKOUT RECEIVABLE */}
      <Drawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? `Cuenta por cobrar · ${detail.guest.name}` : 'Cuenta por cobrar'}
      >
        {detail ? (
          <div className="detail-stack">
            <p>Folio original: <strong>{detail.folio.id}</strong></p>
            <p>Saldo pendiente: <strong>{money(detail.outstandingAmount)}</strong></p>
            <ol className="version-timeline">
              {detail.history.map((entry) => (
                <li key={entry.id}>
                  <strong>{entry.type === 'payment' ? 'Cobranza' : 'Reversión'} · {money(entry.amount)}</strong>
                  <span>{entry.reason || entry.paymentMethod || 'Sin referencia'}</span>
                  {can(PERMISSIONS.financeReverse) && detail.status === 'settled' && entry.type === 'payment' && !entry.reversalOfEntryId ? (
                    <button className="btn btn-danger btn-sm" disabled={busy || !reason.trim()} onClick={() => void reverse(entry.id)}>
                      Revertir
                    </button>
                  ) : null}
                </li>
              ))}
            </ol>
            {can(PERMISSIONS.financePayment) && detail.status === 'open' ? (
              <form className="form-grid" onSubmit={collect}>
                <label>
                  Importe (S/)
                  <input
                    required
                    pattern="\d+\.\d{2}"
                    value={form.amount || Number(detail.outstandingAmount).toFixed(2)}
                    onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                    placeholder="0.00"
                  />
                </label>
                <label>
                  Método
                  <select value={form.method} onChange={(event) => setForm((current) => ({ ...current, method: event.target.value }))}>
                    {methods.map((method) => <option key={method}>{method}</option>)}
                  </select>
                </label>
                <label className="span-2">
                  Referencia
                  <input maxLength="300" value={form.reference} onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))} />
                </label>
                <button className="btn btn-primary span-2" disabled={busy}>
                  {busy ? 'Procesando…' : 'Registrar cobranza'}
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
