import { useEffect, useState } from 'react';
import {
  formatMoney,
  selectActiveStays,
  selectClientName,
} from '../domain/hotelModel.js';
import { useHotel } from '../state/hotelContext.js';
import { PermissionButton } from '../components/auth/PermissionButton.jsx';
import { useActionPermission } from '../components/auth/useActionPermission.js';
import { Dialog } from '../components/ui/Overlay.jsx';
import { FilterBar } from '../components/ui/FilterBar.jsx';
import {
  DataTable,
  DetailGrid,
  MetricStrip,
  PageHeader,
  StatusBadge,
} from '../components/views/SharedViewParts.jsx';
import { Search, Printer } from 'lucide-react';
import { ParkingVisualMap, DEFAULT_PARKING_SPACES } from './ParkingVisualMap.jsx';
import { ParkingExitModal } from './ParkingExitModal.jsx';
import { ParkingTicketModal } from './ParkingTicketModal.jsx';
import ReasonDialog from '../components/views/ReasonDialog.jsx';

const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString('es-PE') : 'No registrado';
function ParkingEditor({ vehicle, onClose, notify }) {
  const { state, parkingCommands } = useHotel();
  const isEditing = Boolean(vehicle && vehicle.id);
  const allowed = useActionPermission(
    isEditing ? "PARKING_UPDATE" : "PARKING_CREATE",
  );
  const stays = selectActiveStays(state);

  const initialIsVisitor = isEditing
    ? (vehicle.originType && vehicle.originType !== "stay") || !vehicle.stayId
    : stays.length === 0;

  const [entryMode, setEntryMode] = useState(initialIsVisitor ? "visitor" : "stay");

  const [form, setForm] = useState(
    isEditing
      ? {
          stayId: vehicle.stayId || "",
          originType: vehicle.originType || (vehicle.stayId ? "stay" : "visitor_day"),
          driverName: vehicle.driverName || "",
          driverPhone: vehicle.driverPhone || "",
          type: vehicle.type || "Auto",
          brandModel: vehicle.brandModel || "",
          vehicleColor: vehicle.vehicleColor || "",
          plate: vehicle.plate || "",
          space: vehicle.space || "",
          fee: vehicle.fee ?? 0,
          keysLeft: Boolean(vehicle.keysLeft),
          entryNotes: vehicle.entryNotes || "",
        }
      : {
          stayId: stays[0]?.id || "",
          originType: initialIsVisitor ? "visitor_day" : "stay",
          driverName: "",
          driverPhone: "",
          type: vehicle?.type || "Auto",
          brandModel: "",
          vehicleColor: "",
          plate: "",
          space: vehicle?.space || "",
          fee: 0,
          keysLeft: false,
          entryNotes: "",
        },
  );

  const selectedStay = stays.find((stay) => stay.id === form.stayId);

  useEffect(() => {
    if (!isEditing && entryMode === "stay" && !form.stayId && stays[0]) {
      setForm((current) => ({ ...current, stayId: stays[0].id }));
    }
  }, [form.stayId, isEditing, entryMode, stays]);

  const handlePlateChange = (event) => {
    const rawVal = event.target.value.toUpperCase();
    setForm((current) => {
      const next = { ...current, plate: rawVal };
      if (!isEditing && rawVal.length >= 3 && !current.brandModel) {
        const found = (state.vehicles || []).find(
          (v) => v.plate && v.plate.toUpperCase() === rawVal && v.brandModel,
        );
        if (found) {
          next.brandModel = found.brandModel;
          if (found.type) next.type = found.type;
          if (found.vehicleColor && !current.vehicleColor) next.vehicleColor = found.vehicleColor;
        }
      }
      return next;
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    const currentActor =
      state.account?.name || state.account?.email || "Recepción";
    const payload = {
      ...form,
      originType: entryMode === "stay" ? "stay" : (form.originType || "visitor_day"),
      stayId: entryMode === "stay" ? form.stayId : null,
      driverName: entryMode === "stay" ? null : form.driverName.trim(),
    };
    const action = isEditing
      ? {
          type: "PARKING_UPDATE",
          vehicleId: vehicle.id,
          payload,
          responsible: currentActor,
        }
      : { type: "PARKING_CREATE", payload, responsible: currentActor };
    try {
      await parkingCommands.execute(action);
      notify(
        isEditing ? "Vehículo actualizado" : "Ingreso registrado",
        "Placa, espacio y tarifa quedaron confirmadas por el sistema.",
        "success",
      );
      onClose();
    } catch (error) {
      notify("No se pudo guardar el vehículo", error.message, "error");
    }
  };

  if (!allowed) return null;

  return (
    <form className="form-grid" onSubmit={submit}>
      <div
        className="span-2 entry-mode-segmented-control"
      >
        <button
          type="button"
          disabled={isEditing}
          onClick={() => setEntryMode("stay")}
          className={`entry-mode-btn ${entryMode === "stay" ? "is-active" : ""}`}
        >
          🏨 Huésped de Habitación
        </button>
        <button
          type="button"
          disabled={isEditing}
          onClick={() => setEntryMode("visitor")}
          className={`entry-mode-btn ${entryMode === "visitor" ? "is-active" : ""}`}
        >
          🚗 Cliente Externo / Visita
        </button>
      </div>

      {entryMode === "stay" ? (
        <>
          <label className="span-2">
            Estadía activa
            <select
              required
              value={form.stayId}
              disabled={isEditing || !stays.length}
              onChange={(event) => setForm({ ...form, stayId: event.target.value })}
            >
              <option value="">
                {stays.length
                  ? "Seleccione una estadía"
                  : "No hay estadías activas disponibles (use pestaña Cliente Externo)"}
              </option>
              {stays.map((stay) => (
                <option key={stay.id} value={stay.id}>
                  Hab. {stay.roomNumber || stay.roomId} · {stay.clientName || selectClientName(state, stay.clientId)} ·{" "}
                  {stay.id}
                </option>
              ))}
            </select>
          </label>
          {selectedStay ? (
            <div className="span-2 card operation-card">
              <span className="eyebrow">Folio de la estadía</span>
              <strong>{selectedStay.id}</strong>
              <DetailGrid
                compact
                items={[
                  {
                    label: "Huésped",
                    value: selectedStay.clientName || selectClientName(state, selectedStay.clientId),
                  },
                  { label: "Habitación", value: `Habitación ${selectedStay.roomNumber || selectedStay.roomId}` },
                  {
                    label: "Cargo al guardar",
                    value: formatMoney(Number(form.fee) || 0),
                  },
                ]}
              />
              <small>
                La tarifa se registrará automáticamente en este folio al confirmar
                el ingreso.
              </small>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <label>
            Tipo de visita / Origen
            <select
              value={form.originType}
              onChange={(event) => setForm({ ...form, originType: event.target.value })}
            >
              <option value="visitor_day">🚗 Visita / Por horas</option>
              <option value="restaurant">🍴 Restaurante / Bar</option>
              <option value="event">🎉 Evento / Conferencia</option>
            </select>
          </label>
          <label>
            Nombre del conductor / cliente *
            <input
              required
              placeholder="Ej. Carlos Mendoza"
              value={form.driverName}
              onChange={(event) => setForm({ ...form, driverName: event.target.value })}
            />
          </label>
          <label className="span-2">
            Teléfono de contacto (WhatsApp)
            <input
              type="tel"
              placeholder="Ej. +51 987 654 321"
              value={form.driverPhone}
              onChange={(event) => setForm({ ...form, driverPhone: event.target.value })}
            />
          </label>
        </>
      )}

      <label>
        Tipo de vehículo
        <select
          value={form.type}
          onChange={(event) => setForm({ ...form, type: event.target.value })}
        >
          <option>Auto</option>
          <option>Camioneta</option>
          <option>Moto</option>
          <option>Motokar</option>
          <option>Bicicleta</option>
        </select>
      </label>
      <label>
        Marca y modelo
        <input
          placeholder="Ej. Toyota Yaris"
          value={form.brandModel}
          onChange={(event) =>
            setForm({ ...form, brandModel: event.target.value })
          }
        />
      </label>
      <label>
        Color del vehículo
        <input
          list="car-colors-datalist"
          placeholder="Ej. Gris plata, Blanco, Negro..."
          value={form.vehicleColor}
          onChange={(event) =>
            setForm({ ...form, vehicleColor: event.target.value })
          }
        />
        <datalist id="car-colors-datalist">
          <option value="Blanco" />
          <option value="Negro" />
          <option value="Gris / Plata" />
          <option value="Rojo" />
          <option value="Azul" />
          <option value="Beige / Champagne" />
          <option value="Verde" />
          <option value="Dorado" />
        </datalist>
      </label>
      <label>
        Placa *
        <input
          required
          placeholder="Ej. ABC-123"
          value={form.plate}
          onChange={handlePlateChange}
        />
      </label>
      <label className="span-2">
        Espacio asignado *
        <input
          list="parking-spaces-datalist"
          required
          placeholder="Ej. E-01"
          value={form.space}
          onChange={(event) =>
            setForm({ ...form, space: event.target.value.toUpperCase() })
          }
        />
        <datalist id="parking-spaces-datalist">
          {DEFAULT_PARKING_SPACES.map((s) => {
            const isOcc = (state.vehicles || []).some(
              (v) =>
                v.status === "Dentro" &&
                v.space?.toUpperCase() === s.code &&
                (!isEditing || v.id !== vehicle.id),
            );
            return (
              <option key={s.id} value={s.code}>
                {s.label} {isOcc ? "(Ocupado actualmente)" : "(Disponible)"}
              </option>
            );
          })}
        </datalist>
      </label>

      <div className="span-2">
        <label className="operations-bordered2">Tarifa de estacionamiento</label>
        <div className="operations-bordered3">
          <button
            type="button"
            className={`btn btn-sm ${Number(form.fee) === 0 ? "btn-primary" : "btn-outline"}`}
            onClick={() => setForm({ ...form, fee: 0 })}
          >
            Cortesía (S/ 0)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${Number(form.fee) === 5 ? "btn-primary" : "btn-outline"}`}
            onClick={() => setForm({ ...form, fee: 5 })}
          >
            Por Hora (S/ 5)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${Number(form.fee) === 15 ? "btn-primary" : "btn-outline"}`}
            onClick={() => setForm({ ...form, fee: 15 })}
          >
            Medio Día (S/ 15)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${Number(form.fee) === 20 ? "btn-primary" : "btn-outline"}`}
            onClick={() => setForm({ ...form, fee: 20 })}
          >
            Noche Completa (S/ 20)
          </button>
        </div>
        <div className="operations-bordered4">
          <span className="operations-bordered5">Importe personalizado (S/):</span>
          <input
            type="number"
            min="0"
            step="0.50"
            className="operations-bordered6"
            value={form.fee}
            onChange={(event) => setForm({ ...form, fee: event.target.value })}
          />
        </div>
        <small className="operations-bordered7">
          {entryMode === "stay"
            ? "Se cargará automáticamente al folio de la habitación seleccionada."
            : "Cobro directo en garita / recepción al ingreso o salida."}
        </small>
      </div>

      <div
        className="span-2 operations-bordered8"
      >
        <input
          type="checkbox"
          id="parking-keys-left-checkbox"
          checked={form.keysLeft}
          onChange={(event) => setForm({ ...form, keysLeft: event.target.checked })}
          className="operations-bordered9"
        />
        <label
          htmlFor="parking-keys-left-checkbox"
          className="operations-row-secondary0"
        >
          🔑 Llaves bajo custodia en recepción
          <span className="operations-row-secondary1">
            Marcar si el conductor dejó la llave del vehículo para maniobras o seguridad.
          </span>
        </label>
      </div>

      <label className="span-2">
        Estado del vehículo / Observaciones de ingreso
        <textarea
          rows={2}
          placeholder="Ej. Rayón previo en puerta lateral izquierda, sin objetos de valor a la vista."
          value={form.entryNotes}
          onChange={(event) => setForm({ ...form, entryNotes: event.target.value })}
        />
      </label>

      <div className="form-actions span-2">
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Cancelar
        </button>
        <button
          className="btn btn-primary"
          disabled={
            entryMode === "stay"
              ? (!selectedStay || !form.plate.trim() || !form.space.trim())
              : (!form.driverName.trim() || !form.plate.trim() || !form.space.trim())
          }
        >
          {isEditing ? "Guardar cambios" : "Guardar ingreso"}
        </button>
      </div>
    </form>
  );
}

export function P1ParkingView({ notify }) {
  const { state, parkingCommands } = useHotel();
  const [editor, setEditor] = useState(undefined);
  const [reasonOperation, setReasonOperation] = useState(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [viewMode, setViewMode] = useState("map");
  const [exitModalVehicle, setExitModalVehicle] = useState(null);
  const [ticketModalVehicle, setTicketModalVehicle] = useState(null);

  useEffect(() => {
    parkingCommands.reload().catch(() => {});
  }, [parkingCommands]);

  const handleExitConfirm = async ({ responsible, observation }) => {
    if (!exitModalVehicle) return;
    try {
      await parkingCommands.execute({
        type: "PARKING_EXIT",
        vehicleId: exitModalVehicle.id,
        responsible,
        observation,
      });
      notify(
        "Salida registrada",
        `Salida confirmada para vehículo ${exitModalVehicle.plate}. Espacio ${exitModalVehicle.space} liberado.`,
        "success",
      );
    } catch (error) {
      notify("No se pudo registrar la salida", error.message, "error");
      throw error;
    }
  };

  const archive = (vehicle) =>
    setReasonOperation({
      actionType: "PARKING_ARCHIVE",
      title: "Archivar registro de cochera",
      onConfirm: async ({ reason }) => {
        try {
          await parkingCommands.execute({
            type: "PARKING_ARCHIVE",
            vehicleId: vehicle.id,
            reason,
          });
          notify(
            "Registro archivado",
            "El historial de ingreso, salida y cargo permanece visible en auditoría.",
            "success",
          );
          return true;
        } catch (error) {
          notify("No se pudo archivar el registro", error.message, "error");
          return false;
        }
      },
    });

  const insideVehicles = (state.vehicles || []).filter(
    (item) => item.status === "Dentro",
  );
  const totalCapacity = DEFAULT_PARKING_SPACES.length;
  const occupancyPercent = Math.min(
    100,
    Math.round((insideVehicles.length / totalCapacity) * 100),
  );

  const records = (state.vehicles || []).filter(
    (item) =>
      `${item.plate} ${item.brandModel || ""} ${item.roomId || ""} ${item.driverName || ""} ${item.space || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (statusFilter === "Todos" || item.status === statusFilter),
  );

  return (
    <div className="view-container">
      <PageHeader
        actionType="PARKING_CREATE"
        metadata="Control vehicular hotelero · auditoría y mapa en tiempo real"
        title="Cochera"
        description="Ingreso, visualización gráfica de bahías, salida auditada y tickets de control."
        action={
          <div
            className="operations-row-secondary2"
          >
            <div
              className="cochera-view-toggle"
              role="tablist"
            >
              <button
                type="button"
                className={`cochera-view-btn ${viewMode === "map" ? "is-active" : ""}`}
                onClick={() => setViewMode("map")}
              >
                🗺️ Mapa Visual
              </button>
              <button
                type="button"
                className={`cochera-view-btn ${viewMode === "list" ? "is-active" : ""}`}
                onClick={() => setViewMode("list")}
              >
                📋 Lista de Registros
              </button>
            </div>
            <PermissionButton
              actionType="PARKING_CREATE"
              className="btn btn-primary"
              onClick={() => setEditor(null)}
            >
              Registrar ingreso
            </PermissionButton>
          </div>
        }
      />
      {state.parkingRequest?.status === "error" ? (
        <div className="alert-banner alert-banner-danger" role="alert">
          <span>{state.parkingRequest.error}</span>{" "}
          <button
            className="btn btn-sm btn-outline"
            onClick={() => parkingCommands.reload()}
          >
            Intentar nuevamente
          </button>
        </div>
      ) : null}
      <MetricStrip
        items={[
          {
            label: "Ocupación Total",
            value: `${insideVehicles.length} / ${totalCapacity} (${occupancyPercent}%)`,
          },
          {
            label: "Vehículos Dentro",
            value: insideVehicles.length,
          },
          {
            label: "Espacios Ocupados",
            value: new Set(insideVehicles.map((item) => item.space)).size,
          },
          {
            label: "Cargos Registrados",
            value: formatMoney(
              (state.vehicles || []).reduce(
                (sum, item) => sum + (Number(item.fee) || 0),
                0,
              ),
            ),
          },
        ]}
      />

      {viewMode === "map" ? (
        <ParkingVisualMap
          vehicles={state.vehicles || []}
          onSelectAvailableSpace={(spaceCode, spaceType) =>
            setEditor({ space: spaceCode, type: spaceType })
          }
          onVehicleClick={(vehicle) => setTicketModalVehicle(vehicle)}
          onVehicleExit={(vehicle) => setExitModalVehicle(vehicle)}
        />
      ) : (
        <>
          <FilterBar label="Filtros de cochera">
            <label className="search-label">
              <Search size={16} />
              <input
                aria-label="Buscar cochera"
                placeholder="Placa, modelo o habitación"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label>
              Estado
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option>Todos</option>
                <option>Dentro</option>
                <option>Fuera</option>
                <option>Archivado</option>
              </select>
            </label>
          </FilterBar>
          <DataTable
            caption="Vehículos"
            columns={[
              "Placa",
              "Origen / Conductor",
              "Espacio",
              "Tarifa",
              "Ingreso / salida",
              "Estado",
              "Acciones",
            ]}
          >
            {records.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.plate}</strong>
                  {item.vehicleColor ? (
                    <span
                      className="operations-row-secondary6"
                    >
                      ({item.vehicleColor})
                    </span>
                  ) : null}
                  {item.keysLeft ? (
                    <span
                      className="operations-row-secondary7"
                      title="Llaves bajo custodia en recepción"
                    >
                      🔑 Llaves
                    </span>
                  ) : null}
                  <br />
                  <small>{item.brandModel || item.type}</small>
                </td>
                <td>
                  {item.originType === "restaurant" ? (
                    <div>
                      <span
                        className="operations-row-secondary8"
                      >
                        🍴 Restaurante
                      </span>
                      <div
                        className="operations-row-secondary9"
                      >
                        {item.driverName || "Cliente externo"}
                      </div>
                      {item.driverPhone ? (
                        <small className="operations-row-compact0">
                          📞 {item.driverPhone}
                        </small>
                      ) : null}
                    </div>
                  ) : item.originType === "event" ? (
                    <div>
                      <span
                        className="operations-row-compact1"
                      >
                        🎉 Evento
                      </span>
                      <div
                        className="operations-row-compact2"
                      >
                        {item.driverName || "Cliente externo"}
                      </div>
                      {item.driverPhone ? (
                        <small className="operations-row-compact3">
                          📞 {item.driverPhone}
                        </small>
                      ) : null}
                    </div>
                  ) : item.originType === "visitor_day" ||
                    (!item.stayId && item.driverName) ? (
                    <div>
                      <span
                        className="operations-row-compact4"
                      >
                        🚗 Visita / Horas
                      </span>
                      <div
                        className="operations-row-compact5"
                      >
                        {item.driverName || "Cliente externo"}
                      </div>
                      {item.driverPhone ? (
                        <small className="operations-row-compact6">
                          📞 {item.driverPhone}
                        </small>
                      ) : null}
                    </div>
                  ) : (
                    <div>
                      <span className="operations-row-compact7">
                        Hab. {item.roomId || "—"}
                      </span>
                      <div
                        className="operations-row-compact8"
                      >
                        {item.clientId
                          ? selectClientName(state, item.clientId)
                          : item.stayId
                          ? `Estadía ${item.stayId.slice(0, 8)}`
                          : "Huésped"}
                      </div>
                    </div>
                  )}
                </td>
                <td>
                  <strong className="operations-row-compact9">{item.space}</strong>
                </td>
                <td>
                  {formatMoney(item.fee)}
                  {Number(item.fee) === 0 ? (
                    <span
                      className="operations-text-secondary0"
                    >
                      Cortesía
                    </span>
                  ) : null}
                </td>
                <td>
                  {formatDateTime(item.entryAt)}
                  <br />
                  <small>{formatDateTime(item.exitAt)}</small>
                </td>
                <td>
                  <StatusBadge>{item.status}</StatusBadge>
                </td>
                <td>
                  <div className="inline-actions">
                    <button
                      type="button"
                      className="btn btn-outline operations-text-secondary1"
                      title="Imprimir ticket térmico"
                      onClick={() => setTicketModalVehicle(item)}
                    >
                      <Printer size={13} /> Ticket
                    </button>
                    {item.status === "Dentro" ? (
                      <>
                        <PermissionButton
                          actionType="PARKING_UPDATE"
                          className="btn btn-outline"
                          onClick={() => setEditor(item)}
                        >
                          Editar
                        </PermissionButton>
                        <PermissionButton
                          actionType="PARKING_EXIT"
                          className="btn btn-primary"
                          onClick={() => setExitModalVehicle(item)}
                        >
                          Registrar salida
                        </PermissionButton>
                      </>
                    ) : item.status === "Fuera" ? (
                      <PermissionButton
                        actionType="PARKING_ARCHIVE"
                        className="btn btn-danger"
                        onClick={() => archive(item)}
                      >
                        Archivar
                      </PermissionButton>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        </>
      )}

      <Dialog
        open={editor !== undefined}
        onClose={() => setEditor(undefined)}
        title={
          editor?.id
            ? `Editar ${editor.plate}`
            : editor?.space
            ? `Registrar ingreso · Bahía ${editor.space}`
            : "Registrar ingreso"
        }
      >
        <ParkingEditor
          vehicle={editor || null}
          onClose={() => setEditor(undefined)}
          notify={notify}
        />
      </Dialog>
      <ParkingExitModal
        open={Boolean(exitModalVehicle)}
        onClose={() => setExitModalVehicle(null)}
        vehicle={exitModalVehicle}
        currentUser={
          state.account?.name || state.account?.email || "Recepción"
        }
        onConfirm={handleExitConfirm}
      />
      <ParkingTicketModal
        open={Boolean(ticketModalVehicle)}
        onClose={() => setTicketModalVehicle(null)}
        vehicle={ticketModalVehicle}
        clientName={
          ticketModalVehicle
            ? selectClientName(state, ticketModalVehicle.clientId)
            : ""
        }
      />
      <ReasonDialog
        operation={reasonOperation}
        onClose={() => setReasonOperation(null)}
      />
    </div>
  );
}
