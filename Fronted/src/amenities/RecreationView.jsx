import { useCallback, useEffect, useState } from "react";
import { formatMoney } from "../domain/hotelModel.js";
import { useHotel } from "../state/hotelContext.js";
import { Dialog } from "../components/ui/Overlay.jsx";
import { FilterBar } from "../components/ui/FilterBar.jsx";
import { DataTable, MetricStrip, PageHeader, StatusBadge } from "../components/views/SharedViewParts.jsx";
import { useAmenityReservations } from "./useAmenityReservations.js";
import {
  fetchAmenityReservationTab,
  settleAmenityReservation,
  updateAmenityReservationIdentity,
  fetchAmenityConfigs,
  fetchAmenityOccupancy,
} from "./amenitiesClient.js";
import { AmenityPassModal } from "./AmenityPassModal.jsx";
import { AmenityConfigModal } from "./AmenityConfigModal.jsx";
import { AmenityTicketModal } from "./AmenityTicketModal.jsx";
import { useWebSocket } from "../hooks/useWebSocket.js";
import { Search, QrCode, Settings2, Plus, Waves, Mountain } from "lucide-react";

const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString("es-PE") : "No registrado";
function AmenityIdentityDialog({ reservation, onClose, notify, reload }) {
  const [documentNumber, setDocumentNumber] = useState(
    reservation.documentNumber || "",
  );
  const [customerName, setCustomerName] = useState(
    reservation.customerName || "",
  );
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateAmenityReservationIdentity(reservation.id, {
        documentNumber: documentNumber.trim(),
        customerName: customerName.trim(),
      });
      notify(
        "Identificación actualizada",
        "Los datos del titular fueron guardados correctamente.",
        "success",
      );
      reload();
      onClose();
    } catch (err) {
      notify("Error al guardar datos", err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="form-grid operations-stack04" onSubmit={submit}>
      <div
        className="span-2 operations-stack05"
      >
        <div>
          <span
            className="operations-stack06"
          >
            Zona Reservada
          </span>
          <div
            className="operations-stack07"
          >
            {reservation.amenityType} · #{reservation.id.slice(0, 8)}
          </div>
        </div>
        <div className="operations-stack08">
          {reservation.pax} persona(s)
        </div>
      </div>

      <label>
        DNI / Documento de Identidad *
        <input
          required
          autoFocus
          placeholder="Ej. 74859632"
          value={documentNumber}
          onChange={(e) => setDocumentNumber(e.target.value)}
          className="operations-stack09"
        />
      </label>
      <label>
        Nombre Completo del Titular *
        <input
          required
          placeholder="Nombre y Apellido"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className="operations-stack10"
        />
      </label>

      <div
        className="form-actions span-2 operations-stack11"
      >
        <button
          type="button"
          className="btn btn-outline"
          onClick={onClose}
          disabled={submitting}
        >
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Guardando..." : "Guardar Identificación"}
        </button>
      </div>
    </form>
  );
}

function AmenitySettlementDialog({ reservation, onClose, notify, reload }) {
  const [tabData, setTabData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("Efectivo");
  const [settling, setSettling] = useState(false);
  const [documentNumber, setDocumentNumber] = useState(
    reservation.documentNumber || "",
  );
  const [customerName, setCustomerName] = useState(
    reservation.customerName || "",
  );

  const paymentOptions = [
    { id: "Efectivo", label: "Efectivo", icon: "💵" },
    { id: "Tarjeta", label: "Tarjeta (POS)", icon: "💳" },
    { id: "Yape", label: "Yape", icon: "📱" },
    { id: "Plin", label: "Plin", icon: "📱" },
    { id: "Transferencia", label: "Transferencia", icon: "🏦" },
  ];

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchAmenityReservationTab(reservation.id);
        if (active) {
          setTabData(data);
          if (data.reservation?.documentNumber)
            setDocumentNumber(data.reservation.documentNumber);
          if (data.reservation?.customerName)
            setCustomerName(data.reservation.customerName);
        }
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [reservation.id]);

  const handleSettle = async () => {
    if (!documentNumber.trim() && !reservation.documentNumber) {
      notify(
        "DNI requerido",
        "Por favor registre el DNI del visitante antes de liquidar la cuenta.",
        "error",
      );
      return;
    }
    setSettling(true);
    try {
      if (
        documentNumber.trim() !== (reservation.documentNumber || "") ||
        customerName.trim() !== (reservation.customerName || "")
      ) {
        await updateAmenityReservationIdentity(reservation.id, {
          documentNumber: documentNumber.trim(),
          customerName: customerName.trim(),
        });
      }
      const result = await settleAmenityReservation(reservation.id, {
        paymentMethod,
      });
      notify(
        "Cuenta liquidada con éxito",
        `Se registró el cobro de ${formatMoney(result.totalAmount)} (${paymentMethod}) en Caja.`,
        "success",
      );
      reload();
      onClose();
    } catch (err) {
      notify("Error al liquidar cuenta", err.message, "error");
    } finally {
      setSettling(false);
    }
  };

  const isPaid =
    tabData?.paymentStatus === "paid" || reservation.paymentStatus === "paid";
  const isPiscina = reservation.amenityType === "Piscina";

  return (
    <div className="operations-stack12">
      {loading ? (
        <div
          className="operations-stack13"
        >
          <div
            className="operations-stack14"
          ></div>
          <p className="operations-stack15">
            Cargando cuenta y consumos...
          </p>
        </div>
      ) : error ? (
        <div
          className="alert-banner alert-banner-danger operations-stack16"
        >
          {error}
        </div>
      ) : tabData ? (
        <>
          {/* Card Resumen de la Zona & Titular */}
          <div
            className="operations-stack17"
          >
            <div
              className="operations-stack18"
            >
              <div
                className="operations-stack19"
              >
                <span className="operations-stack20">
                  {isPiscina ? "🏊" : "🌄"}
                </span>
                <div>
                  <h3
                    className="operations-stack21"
                  >
                    {reservation.amenityType}
                  </h3>
                  <span className="operations-stack22">
                    Reserva #{reservation.id.slice(0, 8)}
                  </span>
                </div>
              </div>
              <span
                className={`badge ${isPaid ? "badge-green" : "badge-yellow"} operations-stack23`}
              >
                {isPaid ? "✓ Liquidado en Caja" : "● Cuenta Abierta"}
              </span>
            </div>

            {/* Inputs de Identidad del Titular */}
            {!isPaid ? (
              <div
                className="operations-stack24"
              >
                <div>
                  <label
                    className="operations-stack25"
                  >
                    DNI / Documento *
                  </label>
                  <input
                    placeholder="Ej. 74859632"
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    className="operations-stack26"
                  />
                </div>
                <div>
                  <label
                    className="operations-stack27"
                  >
                    Nombre del Titular
                  </label>
                  <input
                    placeholder="Nombre completo"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="operations-stack28"
                  />
                </div>
              </div>
            ) : (
              <div
                className="operations-stack29"
              >
                <div>
                  <strong>Titular:</strong> {customerName || "No registrado"}
                </div>
                <div>
                  <strong>DNI:</strong> {documentNumber || "No registrado"}
                </div>
                <div>
                  <strong>Personas:</strong> {reservation.pax} pax
                </div>
              </div>
            )}
          </div>

          {/* Desglose Limpio de Conceptos */}
          <div
            className="operations-stack30"
          >
            <div
              className="operations-stack31"
            >
              <span
                className="operations-stack32"
              >
                Desglose de Consumos
              </span>
              <span className="operations-stack33">
                {tabData.orders?.length
                  ? `${tabData.orders.length} comanda(s) asociada(s)`
                  : "Solo tarifa de acceso"}
              </span>
            </div>

            <div
              className="operations-stack34"
            >
              {/* Tarifa de Entrada */}
              <div
                className="operations-stack35"
              >
                <div
                  className="operations-stack36"
                >
                  <div
                    className="operations-stack37"
                  >
                    🎟️
                  </div>
                  <div>
                    <div
                      className="operations-stack38"
                    >
                      Entrada / Alquiler {reservation.amenityType}
                    </div>
                    <div className="operations-stack39">
                      Acceso a zona recreativa ({reservation.pax} personas)
                    </div>
                  </div>
                </div>
                <div
                  className="operations-stack40"
                >
                  {formatMoney(Number(tabData.entryPrice))}
                </div>
              </div>

              {/* Comandas de Bar y Restaurante */}
              {tabData.orders?.map((order) => (
                <div
                  key={order.id}
                  className="operations-stack41"
                >
                  <div className="operations-stack42">
                    <div
                      className="operations-stack43"
                    >
                      🍽️
                    </div>
                    <div>
                      <div
                        className="operations-stack44"
                      >
                        Comanda #{order.id.slice(0, 6)}
                        <span
                          className="operations-stack45"
                        >
                          {formatDateTime(order.createdAt)}
                        </span>
                      </div>
                      <div
                        className="operations-stack46"
                      >
                        {order.items?.map((item, idx) => (
                          <span key={item.id}>
                            {idx > 0 && " · "}
                            <strong>{item.quantity}x</strong>{" "}
                            {item.menuItemName}{" "}
                            {item.menuItemVariantName
                              ? `(${item.menuItemVariantName})`
                              : ""}
                          </span>
                        ))}
                      </div>
                      {order.comment ? (
                        <div
                          className="operations-stack47"
                        >
                          Nota: {order.comment}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div
                    className="operations-stack48"
                  >
                    {formatMoney(Number(order.total))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Banner Total Destacado */}
          <div
            className="operations-stack49"
          >
            <div>
              <span
                className="operations-stack50"
              >
                Entrada {formatMoney(Number(tabData.entryPrice))} + Consumos{" "}
                {formatMoney(Number(tabData.consumptionsTotal))}
              </span>
              <strong
                className="operations-stack51"
              >
                Total a Liquidar:
              </strong>
            </div>
            <div
              className="operations-stack52"
            >
              {formatMoney(Number(tabData.totalAmount))}
            </div>
          </div>

          {/* Selector de Método de Pago y Acciones */}
          {!isPaid ? (
            <div
              className="operations-stack53"
            >
              <div>
                <label
                  className="operations-stack54"
                >
                  Seleccione Método de Pago en Caja:
                </label>
                <div
                  className="operations-stack55"
                >
                  {paymentOptions.map((opt) => {
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPaymentMethod(opt.id)}
                        className="operations-stack56"
                      >
                        <span className="operations-stack57">{opt.icon}</span>
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                className="operations-stack58"
              >
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={onClose}
                  disabled={settling}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary operations-stack59"
                  onClick={handleSettle}
                  disabled={settling}
                >
                  {settling
                    ? "Registrando en caja..."
                    : `Cobrar ${formatMoney(Number(tabData.totalAmount))} y Cerrar`}
                </button>
              </div>
            </div>
          ) : (
            <div
              className="operations-stack60"
            >
              <button
                type="button"
                className="btn btn-outline"
                onClick={onClose}
              >
                Cerrar recibo
              </button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

export function P1RecreationView({ notify }) {
  const { state } = useHotel();
  const {
    data: reservations,
    status,
    error,
    reload,
  } = useAmenityReservations();
  const [zone, setZone] = useState("Todas");
  const [paymentFilter, setPaymentFilter] = useState("Todos");
  const [query, setQuery] = useState("");
  const [settlementTarget, setSettlementTarget] = useState(null);
  const [identityTarget, setIdentityTarget] = useState(null);
  const [ticketTarget, setTicketTarget] = useState(null);
  const [passModalOpen, setPassModalOpen] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configs, setConfigs] = useState([]);
  const [occupancy, setOccupancy] = useState({});

  const loadExtraData = useCallback(async () => {
    try {
      const [cfg, occ] = await Promise.all([
        fetchAmenityConfigs(),
        fetchAmenityOccupancy(),
      ]);
      setConfigs(cfg || []);
      setOccupancy(occ || {});
    } catch (e) {
      console.warn('Error al cargar datos adicionales de amenidades:', e);
    }
  }, []);

  useEffect(() => {
    loadExtraData();
  }, [loadExtraData]);

  // WebSocket real-time events for recreation
  useWebSocket('amenity:occupancy_changed', (occ) => {
    if (occ) setOccupancy(occ);
  });

  useWebSocket('amenity:reservation_created', () => {
    reload();
    loadExtraData();
  });

  useWebSocket('amenity:config_updated', () => {
    loadExtraData();
  });

  useWebSocket('amenity:reservation_settled', () => {
    reload();
  });

  const formatReservationMoney = (amount) => formatMoney(Number(amount || 0));

  const records = reservations.filter((item) => {
    const matchesZone = zone === "Todas" || item.amenityType === zone;
    const matchesPayment =
      paymentFilter === "Todos" || item.paymentStatus === paymentFilter;
    const textSearch =
      `${item.documentNumber || ""} ${item.customerName || ""} ${item.amenityType} ${item.id} ${item.roomId || ""}`.toLowerCase();
    const matchesQuery =
      !query.trim() || textSearch.includes(query.toLowerCase());
    return matchesZone && matchesPayment && matchesQuery;
  });

  const totalCollected = reservations
    .filter((r) => r.paymentStatus === "paid")
    .reduce((sum, r) => sum + Number(r.totalAmount || r.price || 0), 0);

  const openTabsCount = reservations.filter(
    (r) =>
      r.paymentStatus === "open_tab" ||
      (Number(r.consumptionsTotal || 0) > 0 && r.paymentStatus !== "paid"),
  ).length;

  const piscinaOcc = occupancy.piscina || {
    currentPax: 0,
    capacity: 24,
    occupancyPercentage: 0,
    stateBadge: 'Disponible',
    priceExternal: 50,
  };

  const miradorOcc = occupancy.mirador || {
    currentPax: 0,
    capacity: 12,
    occupancyPercentage: 0,
    stateBadge: 'Disponible',
    priceExternal: 30,
  };

  return (
    <div className="view-container">
      <PageHeader
        metadata="Cobro unificado de entradas y comandas"
        title="Piscina y Mirador"
        description="Control de acceso, registro de DNI de visitantes, cuenta abierta de consumos, aforo en vivo y liquidación en caja."
        action={
          <div className="flex gap-2 items-center flex-wrap">
            <button
              className="btn btn-outline flex items-center gap-1.5"
              onClick={() => setConfigModalOpen(true)}
              title="Configurar precios, aforo y horarios"
            >
              <Settings2 size={16} />
              <span>Tarifas & Aforo</span>
            </button>
            <button
              className="btn btn-primary flex items-center gap-1.5"
              onClick={() => setPassModalOpen(true)}
            >
              <Plus size={16} />
              <span>Registrar Acceso / Pase</span>
            </button>
            <button
              className="btn btn-outline"
              onClick={() => {
                reload();
                loadExtraData();
              }}
              disabled={status === "loading"}
            >
              Actualizar datos
            </button>
          </div>
        }
      />

      {/* Tarjetas de Aforo en Tiempo Real (Estilo Sistema Park Plaza) */}
      <div className="operations-stack61">
        {/* Card Piscina */}
        <div className="operations-stack62">
          <div className="operations-stack63">
            <div className="operations-stack64">
              <div className="kpi-icon-circle tone-blue operations-stack65">
                <Waves size={22} />
              </div>
              <div>
                <div className="operations-stack66">
                  Control de Aforo
                </div>
                <h3 className="operations-stack67">
                  Piscina Principal
                </h3>
              </div>
            </div>
            <span className="operations-stack68">
              {piscinaOcc.stateBadge}
            </span>
          </div>

          <div className="operations-stack69">
            <div>
              <span className="operations-stack70">Tarifa Day Pass: </span>
              <strong className="operations-stack71">{formatMoney(piscinaOcc.priceExternal)}</strong>
            </div>
            <div className="operations-stack72">
              <span className="operations-stack73">
                {piscinaOcc.currentPax}
              </span>
              <span className="operations-stack74">
                {" "}de {piscinaOcc.capacity} personas ({piscinaOcc.occupancyPercentage}%)
              </span>
            </div>
          </div>

          <div className="operations-stack75">
            <div
              className="operations-stack76"
            />
          </div>
        </div>

        {/* Card Mirador */}
        <div className="operations-stack77">
          <div className="operations-stack78">
            <div className="operations-stack79">
              <div className="kpi-icon-circle tone-purple operations-stack80">
                <Mountain size={22} />
              </div>
              <div>
                <div className="operations-stack81">
                  Control de Aforo
                </div>
                <h3 className="operations-stack82">
                  Mirador Terraza
                </h3>
              </div>
            </div>
            <span className="operations-stack83">
              {miradorOcc.stateBadge}
            </span>
          </div>

          <div className="operations-stack84">
            <div>
              <span className="operations-stack85">Tarifa Day Pass: </span>
              <strong className="operations-stack86">{formatMoney(miradorOcc.priceExternal)}</strong>
            </div>
            <div className="operations-stack87">
              <span className="operations-stack88">
                {miradorOcc.currentPax}
              </span>
              <span className="operations-stack89">
                {" "}de {miradorOcc.capacity} personas ({miradorOcc.occupancyPercentage}%)
              </span>
            </div>
          </div>

          <div className="operations-stack90">
            <div
              className="operations-stack91"
            />
          </div>
        </div>
      </div>

      <MetricStrip
        items={[
          { label: "Reservas Totales", value: reservations.length },
          {
            label: "Piscina",
            value: reservations.filter((r) => r.amenityType === "Piscina")
              .length,
          },
          {
            label: "Mirador",
            value: reservations.filter((r) => r.amenityType === "Mirador")
              .length,
          },
          { label: "Cuentas Abiertas", value: openTabsCount },
          {
            label: "Personas Confirmadas",
            value: reservations.reduce((total, r) => total + (r.pax || 0), 0),
          },
          {
            label: "Total Liquidado",
            value: formatReservationMoney(totalCollected),
          },
        ]}
      />

      {error ? (
        <div className="alert-banner alert-banner-danger" role="alert">
          <span>{error}</span>
          <button className="btn btn-sm btn-outline" onClick={reload}>
            Reintentar
          </button>
        </div>
      ) : null}

      <FilterBar label="Filtros de recreación">
        <label className="search-label">
          <Search size={16} />
          <input
            aria-label="Buscar visitante o reserva"
            placeholder="DNI, titular o habitación"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          Zona
          <select value={zone} onChange={(e) => setZone(e.target.value)}>
            <option>Todas</option>
            <option>Piscina</option>
            <option>Mirador</option>
          </select>
        </label>
        <label>
          Estado de Pago
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
          >
            <option value="Todos">Todos</option>
            <option value="pending">Pendiente</option>
            <option value="open_tab">Cuenta Abierta</option>
            <option value="paid">Pagado</option>
          </select>
        </label>
        <span className="filter-result">
          {records.length} reserva(s) visible(s)
        </span>
      </FilterBar>

      <DataTable
        caption="Reservas y Cuentas de Zonas Recreativas"
        columns={[
          "Zona y Ref",
          "Titular / DNI",
          "Origen",
          "Horario",
          "Entrada",
          "Consumos Bar",
          "Total Acumulado",
          "Estado Cuenta",
          "Acciones",
        ]}
        emptyTitle={
          status === "loading"
            ? "Cargando reservas..."
            : "Sin reservas registradas"
        }
        emptyDescription="Las reservas de piscina y mirador y sus cuentas de consumos aparecerán aquí."
      >
        {records.map((reservation) => {
          const isPaid = reservation.paymentStatus === "paid";
          const isOpenTab =
            reservation.paymentStatus === "open_tab" ||
            Number(reservation.consumptionsTotal || 0) > 0;
          return (
            <tr key={reservation.id}>
              <td>
                <strong>{reservation.amenityType}</strong>
                <br />
                <small className="operations-stack92">
                  #{reservation.id.slice(0, 8)}
                </small>
              </td>
              <td>
                <strong>{reservation.customerName || "Sin registrar"}</strong>
                <br />
                <span
                  className="operations-stack93"
                >
                  {reservation.documentNumber
                    ? `DNI: ${reservation.documentNumber}`
                    : "⚠️ DNI no registrado"}
                </span>
              </td>
              <td>
                {reservation.roomId ? (
                  <span className="badge badge-info">
                    Hab. {reservation.roomId}
                  </span>
                ) : (
                  <span className="badge badge-neutral">Visitante Externo</span>
                )}
              </td>
              <td>
                {formatDateTime(reservation.startTime)}
                <br />
                <small className="operations-stack94">
                  Hasta {formatDateTime(reservation.endTime)} ·{" "}
                  {reservation.pax} pax
                </small>
              </td>
              <td>{formatReservationMoney(reservation.price)}</td>
              <td>
                {Number(reservation.consumptionsTotal || 0) > 0 ? (
                  <span
                    className="operations-stack95"
                  >
                    {formatReservationMoney(reservation.consumptionsTotal)}
                    <br />
                    <small className="operations-stack96">
                      {reservation.ordersCount} pedido(s)
                    </small>
                  </span>
                ) : (
                  <span className="operations-stack97">S/ 0.00</span>
                )}
              </td>
              <td>
                <strong
                  className="operations-stack98"
                >
                  {formatReservationMoney(
                    reservation.totalAmount || reservation.price,
                  )}
                </strong>
              </td>
              <td>
                <StatusBadge
                  status={
                    isPaid ? "success" : isOpenTab ? "warning" : "neutral"
                  }
                >
                  {isPaid
                    ? "Pagado"
                    : isOpenTab
                      ? "Cuenta Abierta"
                      : "Pendiente"}
                </StatusBadge>
              </td>
              <td>
                <div className="inline-actions">
                  <button
                    className={`btn btn-sm ${isPaid ? "btn-outline" : "btn-primary"}`}
                    onClick={() => setSettlementTarget(reservation)}
                    title={
                      isPaid
                        ? "Ver recibo de liquidación"
                        : "Liquidar y cobrar cuenta"
                    }
                  >
                    {isPaid ? "Ver Recibo" : "Liquidar"}
                  </button>
                  <button
                    className="btn btn-sm btn-outline flex items-center gap-1"
                    onClick={() => setTicketTarget(reservation)}
                    title="Ver Ticket QR y Validar Ingreso"
                  >
                    <QrCode size={14} />
                    <span>Ticket</span>
                  </button>
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => setIdentityTarget(reservation)}
                    title="Editar o registrar DNI del visitante"
                  >
                    DNI
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </DataTable>

      {/* Modal de Liquidación y Desglose de Consumos */}
      <Dialog
        open={Boolean(settlementTarget)}
        onClose={() => setSettlementTarget(null)}
        title={
          settlementTarget
            ? `Cuenta de ${settlementTarget.amenityType} - #${settlementTarget.id.slice(0, 8)}`
            : "Cuenta"
        }
      >
        {settlementTarget && (
          <AmenitySettlementDialog
            reservation={settlementTarget}
            onClose={() => setSettlementTarget(null)}
            notify={notify}
            reload={reload}
          />
        )}
      </Dialog>

      {/* Modal de Actualización de DNI / Identidad */}
      <Dialog
        open={Boolean(identityTarget)}
        onClose={() => setIdentityTarget(null)}
        title={
          identityTarget
            ? `Registrar DNI de Visitante - ${identityTarget.amenityType}`
            : "Identificación"
        }
      >
        {identityTarget && (
          <AmenityIdentityDialog
            reservation={identityTarget}
            onClose={() => setIdentityTarget(null)}
            notify={notify}
            reload={reload}
          />
        )}
      </Dialog>

      {/* Modal de Registro Manual de Pase */}
      <AmenityPassModal
        open={passModalOpen}
        onClose={() => setPassModalOpen(false)}
        configs={configs}
        stays={state.stays || []}
        onSuccess={() => {
          reload();
          loadExtraData();
        }}
        notify={notify}
      />

      {/* Modal de Configuración de Tarifas & Aforo */}
      <AmenityConfigModal
        open={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        configs={configs}
        onSuccess={() => {
          loadExtraData();
          reload();
        }}
        notify={notify}
      />

      {/* Modal de Ticket QR de Acceso */}
      <AmenityTicketModal
        open={Boolean(ticketTarget)}
        onClose={() => setTicketTarget(null)}
        reservation={ticketTarget}
        onCheckInSuccess={() => {
          reload();
          loadExtraData();
        }}
        notify={notify}
      />
    </div>
  );
}
