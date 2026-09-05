import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatMoney,
  PAYMENT_METHODS,
  PENALTIES,
  selectAccountBalance,
  selectActiveStays,
  selectClientName,
} from "../../domain/hotelModel.js";
import { useHotel } from "../../state/hotelContext.js";
import { PermissionButton, PermissionGate } from "../auth/PermissionButton.jsx";
import { useActionPermission } from "../auth/useActionPermission.js";
import { BiometricPanel } from "../biometrics/BiometricPanel.jsx";
import { Dialog, Drawer } from "../ui/Overlay.jsx";
import {
  Search,
  CreditCard,
  Receipt,
  UserCheck,
  CheckCircle,
} from "lucide-react";
import {
  DataTable,
  DetailGrid,
  EmptyState,
  MetricStrip,
  PageHeader,
  SectionHeader,
  StatusBadge,
} from "./SharedViewParts.jsx";
import { MenuManagementView } from "../../restaurant/MenuManagementView.jsx";

import { useCommunications } from "../../communications/useCommunications.js";
import { NotificationsView } from "../../communications/NotificationsView.jsx";
import { useAmenityReservations } from "../../amenities/useAmenityReservations.js";
import {
  fetchAmenityReservationTab,
  settleAmenityReservation,
  updateAmenityReservationIdentity,
  fetchAmenityConfigs,
  fetchAmenityOccupancy,
} from "../../amenities/amenitiesClient.js";
import { AmenityPassModal } from "../../amenities/AmenityPassModal.jsx";
import { AmenityConfigModal } from "../../amenities/AmenityConfigModal.jsx";
import { AmenityTicketModal } from "../../amenities/AmenityTicketModal.jsx";
import { useWebSocket } from "../../hooks/useWebSocket.js";
import { useStaffResource } from "../../hooks/useStaffResource.js";
import { QrCode, Settings2, Plus, Waves, Mountain, Users, Flame, Printer } from "lucide-react";
import { ParkingVisualMap, DEFAULT_PARKING_SPACES } from "../../parking/ParkingVisualMap.jsx";
import { ParkingExitModal } from "../../parking/ParkingExitModal.jsx";
import { ParkingTicketModal } from "../../parking/ParkingTicketModal.jsx";
import { PetPassModal } from "../../pets/PetPassModal.jsx";

const nowIso = () => new Date().toISOString();
const createRequestId = (prefix) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;
const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString("es-PE") : "No registrado";
const MAX_EVIDENCE_PHOTO_BYTES = 3 * 1024 * 1024;
const readEvidencePhoto = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        dataUrl: reader.result,
      });
    reader.onerror = () => reject(new Error(`No se pudo leer ${file.name}`));
    reader.readAsDataURL(file);
  });
const run = (execute, action, notify, title, message) => {
  const result = execute(action);
  notify(
    result.ok ? title : "Operación rechazada",
    result.ok
      ? message
      : result.error || result.message || "No se pudo completar la operación.",
    result.ok ? "success" : "error",
  );
  return result.ok;
};
function ReasonDialog({ operation, onClose }) {
  return (
    <Dialog
      open={Boolean(operation)}
      onClose={onClose}
      title={operation?.title || "Confirmar operación"}
      description="El registro histórico no se eliminará."
    >
      {operation ? (
        <PermissionGate actionType={operation.actionType}>
          <ReasonForm operation={operation} onClose={onClose} />
        </PermissionGate>
      ) : null}
    </Dialog>
  );
}

function ReasonForm({ operation, onClose }) {
  const fields = operation.fields || [{ key: "reason", label: "Motivo" }];
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map((field) => [field.key, ""])),
  );
  const submit = async (event) => {
    event.preventDefault();
    if ((await operation.onConfirm(values)) !== false) onClose();
  };
  return (
    <form className="form-grid" onSubmit={submit}>
      {fields.map((field) => (
        <label className="span-2" key={field.key}>
          {field.label}
          <textarea
            required
            value={values[field.key]}
            onChange={(event) =>
              setValues({ ...values, [field.key]: event.target.value })
            }
          />
        </label>
      ))}
      <div className="form-actions span-2">
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Volver
        </button>
        <button className="btn btn-danger">Confirmar</button>
      </div>
    </form>
  );
}

function ClientEditor({ client, onClose, notify }) {
  const { execute } = useHotel();
  const allowed = useActionPermission(
    client ? "CLIENT_UPDATE" : "CLIENT_CREATE",
  );
  const [form, setForm] = useState(
    client
      ? { ...client }
      : {
          documentType: "DNI",
          documentNumber: "",
          firstName: "",
          lastName: "",
          phone: "",
          email: "",
          address: "",
          nationality: "Peruana",
          birthDate: "",
          emergencyContact: "",
          notes: "",
        },
  );
  const set = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = (event) => {
    event.preventDefault();
    const action = client
      ? { type: "CLIENT_UPDATE", clientId: client.id, changes: form }
      : { type: "CLIENT_CREATE", payload: form };
    if (
      run(
        execute,
        action,
        notify,
        client ? "Cliente actualizado" : "Cliente registrado",
        "El perfil quedó validado y auditado.",
      )
    )
      onClose();
  };
  if (!allowed) return null;
  return (
    <form className="form-grid" onSubmit={submit}>
      <label>
        Tipo de documento
        <select
          value={form.documentType}
          onChange={(event) => set("documentType", event.target.value)}
        >
          <option>DNI</option>
          <option>Carnet de extranjería</option>
          <option>Pasaporte</option>
        </select>
      </label>
      <label>
        Número
        <input
          required
          value={form.documentNumber}
          onChange={(event) => set("documentNumber", event.target.value)}
        />
      </label>
      <label>
        Nombres
        <input
          required
          value={form.firstName}
          onChange={(event) => set("firstName", event.target.value)}
        />
      </label>
      <label>
        Apellidos
        <input
          required
          value={form.lastName}
          onChange={(event) => set("lastName", event.target.value)}
        />
      </label>
      <label>
        Teléfono
        <input
          value={form.phone}
          onChange={(event) => set("phone", event.target.value)}
        />
      </label>
      <label>
        Correo
        <input
          type="email"
          value={form.email}
          onChange={(event) => set("email", event.target.value)}
        />
      </label>
      <label className="span-2">
        Dirección
        <input
          value={form.address}
          onChange={(event) => set("address", event.target.value)}
        />
      </label>
      <label>
        Nacionalidad
        <input
          value={form.nationality}
          onChange={(event) => set("nationality", event.target.value)}
        />
      </label>
      <label>
        Fecha de nacimiento
        <input
          type="date"
          value={form.birthDate}
          onChange={(event) => set("birthDate", event.target.value)}
        />
      </label>
      <label className="span-2">
        Contacto de emergencia
        <input
          value={form.emergencyContact}
          onChange={(event) => set("emergencyContact", event.target.value)}
        />
      </label>
      <label className="span-2">
        Observaciones
        <textarea
          value={form.notes}
          onChange={(event) => set("notes", event.target.value)}
        />
      </label>
      <div className="form-actions span-2">
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn btn-primary">Guardar cliente</button>
      </div>
    </form>
  );
}

export function P1CustomersView({ notify }) {
  const { state, execute } = useHotel();
  const [editor, setEditor] = useState(undefined);
  const [selectedId, setSelectedId] = useState(null);
  const [reasonOperation, setReasonOperation] = useState(null);
  const selected = state.clients.find((item) => item.id === selectedId);
  const transition = (client, type) =>
    setReasonOperation({
      actionType: type,
      title:
        type === "CLIENT_ARCHIVE" ? "Archivar cliente" : "Reactivar cliente",
      onConfirm: ({ reason }) =>
        run(
          execute,
          { type, clientId: client.id, reason },
          notify,
          type === "CLIENT_ARCHIVE"
            ? "Cliente archivado"
            : "Cliente reactivado",
          "El historial y sus relaciones se conservaron.",
        ),
    });
  return (
    <div className="view-container">
      <PageHeader
        actionType="CLIENT_CREATE"
        metadata="Documento único entre perfiles activos"
        title="Clientes"
        description="Alta, edición, archivo y reactivación explícita sin perder historial."
        action={
          <PermissionButton
            actionType="CLIENT_CREATE"
            className="btn btn-primary"
            onClick={() => setEditor(null)}
          >
            Registrar cliente
          </PermissionButton>
        }
      />
      <MetricStrip
        items={[
          {
            label: "Activos",
            value: state.clients.filter((item) => item.status !== "Archivado")
              .length,
          },
          {
            label: "Archivados",
            value: state.clients.filter((item) => item.status === "Archivado")
              .length,
          },
          {
            label: "Con biometría",
            value: state.clients.filter(
              (item) => item.biometric?.templateReference,
            ).length,
          },
        ]}
      />
      <div className="operation-cards">
        {state.clients.map((client) => (
          <article className="card operation-card" key={client.id}>
            <div className="row-between">
              <div>
                <span className="eyebrow">
                  {client.id} · {client.documentType} {client.documentNumber}
                </span>
                <h3>{client.name}</h3>
              </div>
              <StatusBadge>{client.status || "Activo"}</StatusBadge>
            </div>
            <DetailGrid
              compact
              items={[
                { label: "Teléfono", value: client.phone },
                { label: "Correo", value: client.email },
              ]}
            />
            <div className="inline-actions">
              <button
                className="btn btn-outline"
                onClick={() => setSelectedId(client.id)}
              >
                Ver y biometría
              </button>
              {client.status !== "Archivado" ? (
                <>
                  <PermissionButton
                    actionType="CLIENT_UPDATE"
                    className="btn btn-outline"
                    onClick={() => setEditor(client)}
                  >
                    Editar
                  </PermissionButton>
                  <PermissionButton
                    actionType="CLIENT_ARCHIVE"
                    className="btn btn-danger"
                    onClick={() => transition(client, "CLIENT_ARCHIVE")}
                  >
                    Archivar
                  </PermissionButton>
                </>
              ) : (
                <PermissionButton
                  actionType="CLIENT_REACTIVATE"
                  className="btn btn-primary"
                  onClick={() => transition(client, "CLIENT_REACTIVATE")}
                >
                  Reactivar explícitamente
                </PermissionButton>
              )}
            </div>
          </article>
        ))}
      </div>
      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={selected?.name || "Cliente"}
      >
        {selected ? (
          <div className="detail-stack">
            <DetailGrid
              items={[
                {
                  label: "Documento",
                  value: `${selected.documentType} ${selected.documentNumber}`,
                },
                { label: "Estado", value: selected.status || "Activo" },
                {
                  label: "Archivo",
                  value: formatDateTime(selected.archivedAt),
                  detail: selected.archiveReason,
                },
              ]}
            />
            <BiometricPanel
              subjectType="client"
              subjectId={selected.id}
              subjectName={selected.name}
              reference={selected.biometric?.templateReference}
              onEnrolled={(result) =>
                execute({
                  type: "BIOMETRIC_ENROLLED",
                  subjectType: "client",
                  subjectId: selected.id,
                  ...result,
                })
              }
              onAttempt={(attempt) =>
                execute({
                  type: "BIOMETRIC_ATTEMPT",
                  subjectId: selected.id,
                  ...attempt,
                })
              }
            />
          </div>
        ) : null}
      </Drawer>
      <Dialog
        open={editor !== undefined}
        onClose={() => setEditor(undefined)}
        title={editor ? `Editar ${editor.name}` : "Registrar cliente"}
        wide
      >
        <ClientEditor
          client={editor || null}
          onClose={() => setEditor(undefined)}
          notify={notify}
        />
      </Dialog>
      <ReasonDialog
        operation={reasonOperation}
        onClose={() => setReasonOperation(null)}
      />
    </div>
  );
}

function RoomEditor({ room, onClose, notify }) {
  const { execute } = useHotel();
  const allowed = useActionPermission("ROOM_UPDATE");
  const [form, setForm] = useState({
    nightlyRate: room.nightlyRate,
    capacity: room.capacity,
    beds: room.beds,
    amenities: { ...room.amenities },
  });
  const submit = (event) => {
    event.preventDefault();
    if (
      run(
        execute,
        { type: "ROOM_UPDATE", roomId: room.id, payload: form },
        notify,
        "Habitación actualizada",
        "Sólo se editaron atributos maestros; el estado derivado no fue alterado.",
      )
    )
      onClose();
  };
  if (!allowed) return null;
  return (
    <form className="form-grid" onSubmit={submit}>
      <label>
        Tarifa por noche
        <input
          type="number"
          min="0"
          value={form.nightlyRate}
          onChange={(event) =>
            setForm({ ...form, nightlyRate: event.target.value })
          }
        />
      </label>
      <label>
        Capacidad
        <input
          type="number"
          min="1"
          value={form.capacity}
          onChange={(event) =>
            setForm({ ...form, capacity: event.target.value })
          }
        />
      </label>
      <label className="span-2">
        Camas
        <input
          required
          value={form.beds}
          onChange={(event) => setForm({ ...form, beds: event.target.value })}
        />
      </label>
      <fieldset className="option-fieldset span-2">
        <legend>Comodidades</legend>
        {Object.entries(form.amenities).map(([key, enabled]) => (
          <label className="check-option" key={key}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) =>
                setForm({
                  ...form,
                  amenities: { ...form.amenities, [key]: event.target.checked },
                })
              }
            />
            {
              {
                airConditioning: "Aire acondicionado",
                television: "Televisor",
                hotWater: "Agua caliente",
                wifi: "Wi-Fi",
                minibar: "Frigobar",
              }[key]
            }
          </label>
        ))}
      </fieldset>
      <div className="form-actions span-2">
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn btn-primary">Guardar atributos</button>
      </div>
    </form>
  );
}

export function P1RoomsView({ notify }) {
  const { state, execute } = useHotel();
  const [editorId, setEditorId] = useState(null);
  const [reasonOperation, setReasonOperation] = useState(null);
  const room = state.rooms.find((item) => item.id === editorId);
  const block = (item, type) =>
    setReasonOperation({
      actionType: type,
      title:
        type === "ROOM_BLOCK"
          ? "Bloquear habitación"
          : "Desbloquear habitación",
      onConfirm: ({ reason }) =>
        run(
          execute,
          { type, roomId: item.id, reason, responsible: "Sistema" },
          notify,
          type === "ROOM_BLOCK"
            ? "Habitación bloqueada"
            : "Habitación desbloqueada",
          "La transición quedó auditada con actor y fecha.",
        ),
    });
  return (
    <div className="view-container">
      <PageHeader
        metadata="38 habitaciones · estados derivados protegidos"
        title="Maestro de habitaciones"
        description="Tarifa, capacidad, camas, comodidades y bloqueo administrativo auditable."
      />
      <MetricStrip
        items={[
          {
            label: "Disponibles",
            value: state.rooms.filter((item) => item.status === "Disponible")
              .length,
          },
          {
            label: "Bloqueo administrativo",
            value: state.rooms.filter((item) => item.operationalBlock).length,
          },
          {
            label: "Ocupadas",
            value: state.rooms.filter((item) => item.activeStayId).length,
          },
        ]}
      />
      <div className="room-floor-grid">
        {state.rooms.map((item) => (
          <article className="card" key={item.id}>
            <div className="row-between">
              <h3>Habitación {item.id}</h3>
              <StatusBadge>{item.status}</StatusBadge>
            </div>
            <DetailGrid
              compact
              items={[
                { label: "Categoría", value: item.category },
                { label: "Tarifa", value: formatMoney(item.nightlyRate) },
                { label: "Capacidad", value: item.capacity },
                { label: "Camas", value: item.beds },
              ]}
            />
            <div className="inline-actions">
              <PermissionButton
                actionType="ROOM_UPDATE"
                className="btn btn-outline"
                onClick={() => setEditorId(item.id)}
              >
                Editar maestro
              </PermissionButton>
              {item.operationalBlock ? (
                <PermissionButton
                  actionType="ROOM_UNBLOCK"
                  className="btn btn-primary"
                  onClick={() => block(item, "ROOM_UNBLOCK")}
                >
                  Desbloquear
                </PermissionButton>
              ) : (
                <PermissionButton
                  actionType="ROOM_BLOCK"
                  className="btn btn-danger"
                  onClick={() => block(item, "ROOM_BLOCK")}
                >
                  Bloquear
                </PermissionButton>
              )}
            </div>
            {item.blockReason ? (
              <small>
                Bloqueo: {item.blockReason} · {item.blockedBy} ·{" "}
                {formatDateTime(item.blockedAt)}
              </small>
            ) : null}
          </article>
        ))}
      </div>
      <Dialog
        open={Boolean(room)}
        onClose={() => setEditorId(null)}
        title={room ? `Editar habitación ${room.id}` : "Editar habitación"}
      >
        {room ? (
          <RoomEditor
            room={room}
            onClose={() => setEditorId(null)}
            notify={notify}
          />
        ) : null}
      </Dialog>
      <ReasonDialog
        operation={reasonOperation}
        onClose={() => setReasonOperation(null)}
      />
    </div>
  );
}

export function P1CheckInOutView({ notify }) {
  const { state, execute } = useHotel();
  const canCheckIn = useActionPermission("CHECK_IN");
  const canCheckOut = useActionPermission("CHECK_OUT");
  const [reservationId, setReservationId] = useState(null);
  const [checkoutId, setCheckoutId] = useState(null);
  const [checkoutMethod, setCheckoutMethod] = useState("Tarjeta");
  const [verifiedId, setVerifiedId] = useState(null);
  const [method, setMethod] = useState("biometric");
  const [documentary, setDocumentary] = useState({
    documentType: "DNI",
    documentNumber: "",
    result: "Documento vigente y datos coincidentes",
    responsible: "",
    verifiedAt: nowIso(),
  });
  const reservation = state.reservations.find(
    (item) => item.id === reservationId,
  );
  const client = state.clients.find(
    (item) => item.id === reservation?.clientId,
  );
  const confirmCheckIn = () => {
    const identityValidation =
      method === "biometric"
        ? {
            method: "biometric",
            matched: verifiedId === client?.id,
            verifiedAt: nowIso(),
            responsible: "Bridge ZK9500",
          }
        : { method: "documentary", ...documentary };
    if (
      run(
        execute,
        { type: "CHECK_IN", reservationId, identityValidation },
        notify,
        "Check-in completado",
        `La validación ${method === "biometric" ? "biométrica" : "documental"} y la apertura de estadía se aplicaron atómicamente.`,
      )
    ) {
      setReservationId(null);
      setVerifiedId(null);
    }
  };
  const checkout = () => {
    if (
      run(
        execute,
        {
          type: "CHECK_OUT",
          stayId: checkoutId,
          paymentMethod: checkoutMethod,
          operationNumber: `SALIDA-${checkoutId}`,
        },
        notify,
        "Check-out completado",
        "Cuenta, accesos, estadía y limpieza se actualizaron atómicamente.",
      )
    )
      setCheckoutId(null);
  };
  return (
    <div className="view-container">
      <PageHeader
        metadata="Biometría preservada · alternativa documental"
        title="Check-in y check-out"
        description="La biometría sigue operativa; el control documental manual es una vía adicional explícita."
      />
      <div className="operations-grid">
        <section>
          <SectionHeader title="Llegadas confirmadas" />
          <div className="operation-cards">
            {state.reservations
              .filter((item) => item.status === "Confirmada")
              .map((item) => (
                <article className="card" key={item.id}>
                  <h3>{selectClientName(state, item.clientId)}</h3>
                  <p>
                    {item.id} · Hab. {item.roomId}
                  </p>
                  <PermissionButton
                    actionType="CHECK_IN"
                    className="btn btn-primary"
                    onClick={() => {
                      setReservationId(item.id);
                      setMethod("biometric");
                      setVerifiedId(null);
                      setDocumentary((current) => ({
                        ...current,
                        documentType:
                          state.clients.find(
                            (entry) => entry.id === item.clientId,
                          )?.documentType || "DNI",
                        documentNumber:
                          state.clients.find(
                            (entry) => entry.id === item.clientId,
                          )?.documentNumber || "",
                        verifiedAt: nowIso(),
                      }));
                    }}
                  >
                    Revisar identidad y completar
                  </PermissionButton>
                </article>
              ))}
          </div>
        </section>
        <section>
          <SectionHeader title="Estadías activas" />
          <div className="operation-cards">
            {state.stays
              .filter((item) => item.status === "Activa")
              .map((stay) => (
                <article className="card" key={stay.id}>
                  <h3>{selectClientName(state, stay.clientId)}</h3>
                  <p>
                    {stay.id} · Hab. {stay.roomId} · saldo{" "}
                    {formatMoney(
                      selectAccountBalance(
                        state.accounts.find(
                          (item) => item.id === stay.accountId,
                        ),
                      ),
                    )}
                  </p>
                  <PermissionButton
                    actionType="CHECK_OUT"
                    className="btn btn-danger"
                    onClick={() => setCheckoutId(stay.id)}
                  >
                    Revisar check-out
                  </PermissionButton>
                </article>
              ))}
          </div>
        </section>
      </div>
      <Dialog
        open={Boolean(reservation)}
        onClose={() => setReservationId(null)}
        title={
          client ? `Validar identidad de ${client.name}` : "Validar identidad"
        }
        wide
      >
        <PermissionGate actionType="CHECK_IN">
          {reservation && canCheckIn ? (
            <div className="detail-stack">
              <div className="filter-bar">
                <label>
                  Vía de validación
                  <select
                    value={method}
                    onChange={(event) => setMethod(event.target.value)}
                  >
                    <option value="biometric">Biometría ZK9500</option>
                    <option value="documentary">
                      Control documental manual
                    </option>
                  </select>
                </label>
              </div>
              {method === "biometric" ? (
                <>
                  <BiometricPanel
                    subjectType="client"
                    subjectId={client.id}
                    subjectName={client.name}
                    reference={client.biometric?.templateReference}
                    onEnrolled={(result) =>
                      execute({
                        type: "BIOMETRIC_ENROLLED",
                        subjectType: "client",
                        subjectId: client.id,
                        ...result,
                      })
                    }
                    onVerified={(result) =>
                      setVerifiedId(result.matched ? client.id : null)
                    }
                    onAttempt={(attempt) =>
                      execute({
                        type: "BIOMETRIC_ATTEMPT",
                        subjectId: client.id,
                        ...attempt,
                      })
                    }
                  />
                  <div
                    className={`alert-banner ${verifiedId === client.id ? "alert-banner-success" : "alert-banner-warning"}`}
                  >
                    {verifiedId === client.id
                      ? "Coincidencia biométrica real confirmada."
                      : "La vía biométrica permanece bloqueada hasta una coincidencia real."}
                  </div>
                </>
              ) : (
                <div className="form-grid">
                  <label>
                    Tipo
                    <select
                      value={documentary.documentType}
                      onChange={(event) =>
                        setDocumentary({
                          ...documentary,
                          documentType: event.target.value,
                        })
                      }
                    >
                      <option>DNI</option>
                      <option>Carnet de extranjería</option>
                      <option>Pasaporte</option>
                    </select>
                  </label>
                  <label>
                    Número
                    <input
                      required
                      value={documentary.documentNumber}
                      onChange={(event) =>
                        setDocumentary({
                          ...documentary,
                          documentNumber: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="span-2">
                    Resultado declarado
                    <input
                      required
                      value={documentary.result}
                      onChange={(event) =>
                        setDocumentary({
                          ...documentary,
                          result: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Responsable
                    <input
                      required
                      value={documentary.responsible}
                      onChange={(event) =>
                        setDocumentary({
                          ...documentary,
                          responsible: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Fecha y hora
                    <input
                      required
                      type="datetime-local"
                      value={documentary.verifiedAt.slice(0, 16)}
                      onChange={(event) =>
                        event.target.value &&
                        setDocumentary({
                          ...documentary,
                          verifiedAt: new Date(
                            event.target.value,
                          ).toISOString(),
                        })
                      }
                    />
                  </label>
                </div>
              )}
              <div className="form-actions">
                <button
                  className="btn btn-outline"
                  onClick={() => setReservationId(null)}
                >
                  Volver
                </button>
                <PermissionButton
                  actionType="CHECK_IN"
                  className="btn btn-primary"
                  onClick={confirmCheckIn}
                >
                  Confirmar check-in atómico
                </PermissionButton>
              </div>
            </div>
          ) : null}
        </PermissionGate>
      </Dialog>
      <Dialog
        open={Boolean(checkoutId)}
        onClose={() => setCheckoutId(null)}
        title="Confirmar check-out"
        description="Se liquidará el saldo, se cerrarán cuenta y accesos y se creará limpieza."
      >
        <PermissionGate actionType="CHECK_OUT">
          {canCheckOut ? (
            <div className="form-grid">
              {(() => {
                const linkedVehiclesInside = (state.vehicles || []).filter(
                  (v) => v.stayId === checkoutId && v.status === "Dentro"
                );
                if (!linkedVehiclesInside.length) return null;
                return (
                  <div
                    className="span-2 alert-banner alert-banner-danger"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      padding: "12px 14px",
                      borderRadius: "8px",
                      marginBottom: "4px",
                    }}
                  >
                    <strong style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      ⚠️ Vehículo(s) aún registrados en cochera:
                    </strong>
                    <span style={{ fontSize: "12px" }}>
                      Esta habitación tiene {linkedVehiclesInside.length} vehículo(s) dentro:{" "}
                      <strong>
                        {linkedVehiclesInside
                          .map((v) => `${v.plate} (${v.space || 'Espacio no especificado'})`)
                          .join(", ")}
                      </strong>
                      . Verifique con el huésped o registre la salida de cochera antes de finalizar.
                    </span>
                  </div>
                );
              })()}
              <label className="span-2">
                Método de liquidación
                <select
                  value={checkoutMethod}
                  onChange={(event) => setCheckoutMethod(event.target.value)}
                >
                  {PAYMENT_METHODS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <div className="form-actions span-2">
                <button
                  className="btn btn-outline"
                  onClick={() => setCheckoutId(null)}
                >
                  Volver
                </button>
                <PermissionButton
                  actionType="CHECK_OUT"
                  className="btn btn-danger"
                  onClick={checkout}
                >
                  Confirmar check-out
                </PermissionButton>
              </div>
            </div>
          ) : null}
        </PermissionGate>
      </Dialog>
    </div>
  );
}

export function P1ContractsView({ notify }) {
  const { state, execute } = useHotel();
  const [selectedId, setSelectedId] = useState(null);
  const [reasonOperation, setReasonOperation] = useState(null);
  const selected = state.contracts.find((item) => item.id === selectedId);
  const addendum = (contract) =>
    setReasonOperation({
      actionType: "CONTRACT_ADDENDUM",
      title: "Registrar adenda",
      fields: [
        { key: "internalReference", label: "Referencia interna" },
        { key: "reason", label: "Motivo y alcance" },
      ],
      onConfirm: ({ internalReference, reason }) =>
        run(
          execute,
          {
            type: "CONTRACT_ADDENDUM",
            contractId: contract.id,
            internalReference,
            reason,
          },
          notify,
          "Adenda registrada",
          "Se agregó una versión sin sobrescribir el historial.",
        ),
    });
  const voidContract = (contract) =>
    setReasonOperation({
      actionType: "CONTRACT_VOID",
      title: "Anular contrato",
      onConfirm: ({ reason }) =>
        run(
          execute,
          { type: "CONTRACT_VOID", contractId: contract.id, reason },
          notify,
          "Contrato anulado",
          "La anulación y la nueva versión quedaron auditadas.",
        ),
    });
  return (
    <div className="view-container">
      <PageHeader
        metadata="Versiones y referencias internas"
        title="Contratos de hospedaje"
        description="Adendas y anulaciones conservan todas las versiones previas."
      />
      <DataTable
        caption="Contratos versionados"
        columns={[
          "Contrato",
          "Reserva",
          "Cliente",
          "Versión",
          "Estado",
          "Acciones",
        ]}
      >
        {state.contracts.map((item) => (
          <tr key={item.id}>
            <td>{item.id}</td>
            <td>{item.reservationId}</td>
            <td>{selectClientName(state, item.clientId)}</td>
            <td>V{item.version}</td>
            <td>
              <StatusBadge>{item.status}</StatusBadge>
            </td>
            <td>
              <div className="inline-actions">
                <button
                  className="btn btn-outline"
                  onClick={() => setSelectedId(item.id)}
                >
                  Historial
                </button>
                {item.status !== "Anulado" ? (
                  <>
                    <PermissionButton
                      actionType="CONTRACT_ADDENDUM"
                      className="btn btn-outline"
                      onClick={() => addendum(item)}
                    >
                      Adenda
                    </PermissionButton>
                    <PermissionButton
                      actionType="CONTRACT_VOID"
                      className="btn btn-danger"
                      onClick={() => voidContract(item)}
                    >
                      Anular
                    </PermissionButton>
                  </>
                ) : null}
              </div>
            </td>
          </tr>
        ))}
      </DataTable>
      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={selected?.id || "Contrato"}
      >
        {selected ? (
          <ol className="version-timeline">
            {selected.versions.map((version, index) => (
              <li key={`${version.version}-${index}`}>
                <strong>Versión {version.version}</strong>
                <span>
                  {version.internalReference
                    ? `${version.internalReference} · `
                    : ""}
                  {version.reason}
                </span>
                <small>
                  {formatDateTime(version.createdAt)} ·{" "}
                  {version.responsible || "Sistema"}
                </small>
              </li>
            ))}
          </ol>
        ) : null}
      </Drawer>
      <ReasonDialog
        operation={reasonOperation}
        onClose={() => setReasonOperation(null)}
      />
    </div>
  );
}

export function P1FinanceView({ notify }) {
  const { state, execute } = useHotel();
  const openAccounts = state.accounts.filter(
    (item) => item.status === "Abierta",
  );
  const [form, setForm] = useState({
    accountId: openAccounts[0]?.id || "",
    kind: "charge",
    concept: "",
    amount: 0,
    method: "Efectivo",
    operationNumber: "",
    penaltyId: PENALTIES[0].id,
    evidence: "",
  });
  const actionType =
    form.kind === "payment"
      ? "ACCOUNT_PAYMENT"
      : form.kind === "penalty"
        ? "PENALTY_CHARGE"
        : "ACCOUNT_CHARGE";
  const canSubmit = useActionPermission(actionType);
  const [requestId, setRequestId] = useState(() => createRequestId("FIN"));
  const [reasonOperation, setReasonOperation] = useState(null);
  const submit = (event) => {
    event.preventDefault();
    let action;
    if (form.kind === "charge")
      action = {
        type: "ACCOUNT_CHARGE",
        accountId: form.accountId,
        concept: form.concept,
        amount: Number(form.amount),
        category: "Manual",
        evidence: form.evidence,
        requestId,
      };
    else if (form.kind === "payment")
      action = {
        type: "ACCOUNT_PAYMENT",
        accountId: form.accountId,
        concept: form.concept,
        amount: Number(form.amount),
        method: form.method,
        operationNumber: form.operationNumber,
        requestId,
      };
    else
      action = {
        type: "PENALTY_CHARGE",
        accountId: form.accountId,
        penaltyId: form.penaltyId,
        evidence: form.evidence,
        requestId,
      };
    if (
      run(
        execute,
        action,
        notify,
        "Operación financiera registrada",
        "Cuenta, caja, saldo y auditoría se actualizaron exactamente una vez.",
      )
    )
      setRequestId(createRequestId("FIN"));
  };
  const reverse = (movement) =>
    setReasonOperation({
      actionType: "MOVEMENT_VOID",
      title: `Anular ${movement.id} con contramovimiento`,
      onConfirm: ({ reason }) =>
        run(
          execute,
          { type: "MOVEMENT_VOID", movementId: movement.id, reason },
          notify,
          "Contramovimiento registrado",
          "El original permanece intacto y vinculado a su opuesto.",
        ),
    });
  return (
    <div className="view-container">
      <PageHeader
        metadata="Cuenta y caja abiertas obligatorias"
        title="Finanzas"
        description="Cargos manuales, pagos parciales, penalidades con evidencia y anulaciones por contramovimiento."
      />
      {canSubmit ? (
        <section className="card">
          <SectionHeader title="Nueva operación" />
          <form className="form-grid" onSubmit={submit}>
            <label>
              Cuenta abierta
              <select
                value={form.accountId}
                onChange={(event) =>
                  setForm({ ...form, accountId: event.target.value })
                }
              >
                {openAccounts.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.id} · Hab. {item.roomId} · saldo{" "}
                    {formatMoney(selectAccountBalance(item))}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tipo
              <select
                value={form.kind}
                onChange={(event) =>
                  setForm({ ...form, kind: event.target.value })
                }
              >
                <option value="charge">Cargo manual</option>
                <option value="payment">Pago parcial</option>
                <option value="penalty">Penalidad</option>
              </select>
            </label>
            {form.kind === "penalty" ? (
              <label className="span-2">
                Penalidad
                <select
                  value={form.penaltyId}
                  onChange={(event) =>
                    setForm({ ...form, penaltyId: event.target.value })
                  }
                >
                  {PENALTIES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {formatMoney(item.amount)}
                      {item.evidenceRequired ? " · exige evidencia" : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label className="span-2">
                  Concepto
                  <input
                    required
                    value={form.concept}
                    onChange={(event) =>
                      setForm({ ...form, concept: event.target.value })
                    }
                  />
                </label>
                <label>
                  Importe
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={form.amount}
                    onChange={(event) =>
                      setForm({ ...form, amount: event.target.value })
                    }
                  />
                </label>
                {form.kind === "payment" ? (
                  <label>
                    Método
                    <select
                      value={form.method}
                      onChange={(event) =>
                        setForm({ ...form, method: event.target.value })
                      }
                    >
                      {PAYMENT_METHODS.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </>
            )}
            <label className="span-2">
              Referencia de evidencia / operación
              <input
                value={form.evidence || form.operationNumber}
                onChange={(event) =>
                  setForm({
                    ...form,
                    evidence: event.target.value,
                    operationNumber: event.target.value,
                  })
                }
              />
            </label>
            <button className="btn btn-primary span-2">
              Aplicar operación
            </button>
          </form>
        </section>
      ) : null}
      <DataTable
        caption="Movimientos de caja append-only"
        columns={[
          "Movimiento",
          "Tipo",
          "Concepto",
          "Referencia",
          "Importe",
          "Vínculo",
          "Acción",
        ]}
      >
        {state.cashMovements.map((item) => (
          <tr key={item.id}>
            <td>{item.id}</td>
            <td>{item.type}</td>
            <td>{item.concept}</td>
            <td>{item.referenceId || "Sin referencia"}</td>
            <td>{formatMoney(item.amount)}</td>
            <td>
              {item.reversalOf
                ? `Contramovimiento de ${item.reversalOf}`
                : "Original"}
            </td>
            <td>
              {!item.reversalOf &&
              !state.cashMovements.some(
                (entry) => entry.reversalOf === item.id,
              ) ? (
                <PermissionButton
                  actionType="MOVEMENT_VOID"
                  className="btn btn-danger"
                  onClick={() => reverse(item)}
                >
                  Anular
                </PermissionButton>
              ) : (
                <StatusBadge>
                  {item.reversalOf ? "Contramovimiento" : "Anulado"}
                </StatusBadge>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
      <ReasonDialog
        operation={reasonOperation}
        onClose={() => setReasonOperation(null)}
      />
    </div>
  );
}

export function P1CleaningView({ notify }) {
  const { state, execute, cleaningCommands } = useHotel();
  const { data: staffData, status: staffStatus } = useStaffResource();
  const canUpdate = useActionPermission("CLEANING_UPDATE");
  const canProgress = useActionPermission("CLEANING_PROGRESS");
  const canReportIncident = useActionPermission("CLEANING_INCIDENT");
  const canRegisterEvidence = useActionPermission("EVIDENCE_REGISTER");
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState({
    assignedStaffId: "",
    assignedTo: "",
    observation: "",
    evidence: "",
    incidentDescription: "",
  });
  const [photos, setPhotos] = useState([]);

  const [showGenerator, setShowGenerator] = useState(false);
  const [ticketForm, setTicketForm] = useState({
    roomId: "",
    reason: "Check-out completado",
    observation: "",
    assignedTo: "",
    assignedStaffId: "",
  });

  const activeStaff = staffData.staff.filter((person) =>
    ["active", "Activo"].includes(person.status),
  );
  const staffName = (person) =>
    `${person.firstName || ""} ${person.lastName || ""}`.trim();

  useEffect(() => {
    cleaningCommands?.reload?.().catch(() => {});
  }, [cleaningCommands]);

  const selected = state.cleaningTasks.find((item) => item.id === selectedId);
  const selectedRoom = selected
    ? state.rooms.find((r) => r.id === selected.roomId)
    : null;

  const open = (task) => {
    setSelectedId(task.id);
    const assigned = activeStaff.find(
      (person) => staffName(person) === task.assignedTo,
    );
    setForm({
      assignedStaffId: assigned?.id || "",
      assignedTo: task.assignedTo || "",
      observation: task.observation || "",
      evidence: "",
      incidentDescription: "",
    });
    setPhotos([]);
  };

  const selectPhotos = async (event) => {
    const files = [...event.target.files];
    event.target.value = "";
    if (files.some((file) => !file.type.startsWith("image/"))) {
      notify("Archivo rechazado", "Sólo se pueden adjuntar imágenes.", "error");
      return;
    }
    if (files.some((file) => file.size > MAX_EVIDENCE_PHOTO_BYTES)) {
      notify(
        "Imagen demasiado grande",
        "Cada foto debe pesar como máximo 3 MB.",
        "error",
      );
      return;
    }
    try {
      setPhotos(await Promise.all(files.slice(0, 5).map(readEvidencePhoto)));
    } catch (error) {
      notify("No se pudo adjuntar", error.message, "error");
    }
  };

  const uploadPhotos = async () => {
    if (!photos.length) return form.evidence;
    if (!canRegisterEvidence)
      throw new Error("Tu cuenta no tiene permiso para registrar evidencias.");
    const description =
      form.observation.trim() ||
      `Evidencia fotográfica de limpieza${selectedRoom ? ` de la habitación ${selectedRoom.number}` : ""}`;
    await Promise.all(
      photos.map((photo) =>
        evidenceClient.registerEvidence({
          sourceType: "CLEANING",
          evidenceType: "PHOTO",
          referenceId: selected.id,
          description,
          metadata: photo,
          idempotencyKey:
            globalThis.crypto?.randomUUID?.() ||
            `${Date.now()}-${Math.random()}`,
        }),
      ),
    );
    setPhotos([]);
    return (
      form.evidence || `${photos.length} foto(s) registrada(s) en Evidencias`
    );
  };

  const save = async () => {
    try {
      const evidence = await uploadPhotos();
      if (cleaningCommands) {
        await cleaningCommands.update(
          selected.id,
          form.assignedTo,
          form.observation,
          evidence,
        );
      } else {
        run(
          execute,
          {
            type: "CLEANING_UPDATE",
            taskId: selected.id,
            assignedTo: form.assignedTo,
            observation: form.observation,
            evidence,
          },
          notify,
          "Tarea actualizada",
          "Asignación, observación y evidencia quedaron auditadas.",
        );
      }
      notify(
        "Tarea actualizada",
        "Asignación, observación y evidencia quedaron auditadas.",
        "success",
      );
    } catch (error) {
      notify("Error al actualizar", error.message, "error");
    }
  };

  const advance = async () => {
    try {
      const evidence = await uploadPhotos();
      if (cleaningCommands) {
        await cleaningCommands.progress(selected.id, selected.status, evidence);
      } else {
        run(
          execute,
          {
            type: "CLEANING_PROGRESS",
            taskId: selected.id,
            expectedStatus: selected.status,
            evidence,
          },
          notify,
          "Limpieza actualizada",
          selected.status === "Completada"
            ? "La aprobación recalculó la disponibilidad."
            : "La transición conservó tiempos y evidencia real declarada.",
        );
      }
      notify(
        "Limpieza actualizada",
        selected.status === "Completada"
          ? "La aprobación recalculó la disponibilidad."
          : "La transición conservó tiempos y evidencia real declarada.",
        "success",
      );
    } catch (error) {
      notify("Error al avanzar limpieza", error.message, "error");
    }
  };

  const expressApprove = async (taskToApprove) => {
    const task = taskToApprove || selected;
    if (!task) return;
    try {
      const evidence =
        task.id === selected?.id ? await uploadPhotos() : task.evidence;
      const currentStatus = task.status;

      if (["Pendiente", "pending"].includes(currentStatus)) {
        if (cleaningCommands) {
          await cleaningCommands.progress(task.id, "Pendiente");
          await cleaningCommands.progress(task.id, "En proceso");
          await cleaningCommands.progress(task.id, "Completada", evidence);
        } else {
          run(execute, {
            type: "CLEANING_PROGRESS",
            taskId: task.id,
            expectedStatus: "Pendiente",
          });
          run(execute, {
            type: "CLEANING_PROGRESS",
            taskId: task.id,
            expectedStatus: "En proceso",
          });
          run(execute, {
            type: "CLEANING_PROGRESS",
            taskId: task.id,
            expectedStatus: "Completada",
            evidence,
          });
        }
      } else if (["En proceso", "in_progress"].includes(currentStatus)) {
        if (cleaningCommands) {
          await cleaningCommands.progress(task.id, "En proceso");
          await cleaningCommands.progress(task.id, "Completada", evidence);
        } else {
          run(execute, {
            type: "CLEANING_PROGRESS",
            taskId: task.id,
            expectedStatus: "En proceso",
          });
          run(execute, {
            type: "CLEANING_PROGRESS",
            taskId: task.id,
            expectedStatus: "Completada",
            evidence,
          });
        }
      } else if (["Completada", "completed"].includes(currentStatus)) {
        if (cleaningCommands) {
          await cleaningCommands.progress(task.id, "Completada", evidence);
        } else {
          run(execute, {
            type: "CLEANING_PROGRESS",
            taskId: task.id,
            expectedStatus: "Completada",
            evidence,
          });
        }
      }
      notify(
        "Habitación Aprobada",
        "La habitación quedó marcada como Disponible y lista para nuevas reservas.",
        "success",
      );
      if (selectedId === task.id) {
        setSelectedId(null);
      }
    } catch (error) {
      notify("Error al liberar habitación", error.message, "error");
    }
  };

  const advanceTaskDirectly = async (task, e) => {
    e?.stopPropagation();
    try {
      if (cleaningCommands) {
        await cleaningCommands.progress(task.id, task.status);
      } else {
        run(
          execute,
          {
            type: "CLEANING_PROGRESS",
            taskId: task.id,
            expectedStatus: task.status,
          },
          notify,
        );
      }
      notify(
        "Limpieza actualizada",
        task.status === "Completada"
          ? "Habitación aprobada y disponible."
          : "Estado de limpieza avanzado.",
        "success",
      );
    } catch (error) {
      notify("Error al avanzar", error.message, "error");
    }
  };

  const incident = async () => {
    if (cleaningCommands) {
      try {
        await cleaningCommands.reportIncident(
          selected.id,
          form.incidentDescription,
          form.evidence,
          form.assignedTo,
          true,
        );
        notify(
          "Incidencia creada",
          "La incidencia quedó vinculada a tarea y habitación.",
        );
      } catch (error) {
        notify("Error al crear incidencia", error.message, "error");
      }
    } else {
      run(
        execute,
        {
          type: "CLEANING_INCIDENT",
          taskId: selected.id,
          description: form.incidentDescription,
          evidence: form.evidence,
          responsible: form.assignedTo,
          blocksRoom: true,
        },
        notify,
        "Incidencia creada",
        "La incidencia quedó vinculada a tarea y habitación.",
      );
    }
  };

  const pendingCount = state.cleaningTasks.filter((t) =>
    ["Pendiente", "pending"].includes(t.status),
  ).length;
  const inProgressCount = state.cleaningTasks.filter((t) =>
    ["En proceso", "in_progress"].includes(t.status),
  ).length;
  const completedCount = state.cleaningTasks.filter((t) =>
    ["Completada", "completed"].includes(t.status),
  ).length;
  const approvedCount = state.cleaningTasks.filter((t) =>
    ["Aprobada", "approved"].includes(t.status),
  ).length;

  const generateTicket = async () => {
    if (!ticketForm.roomId)
      return notify("Error", "Debe seleccionar una habitación.", "error");
    if (cleaningCommands) {
      try {
        await cleaningCommands.create(
          ticketForm.roomId,
          ticketForm.reason,
          ticketForm.observation,
          ticketForm.assignedTo,
        );
        notify(
          "Ticket generado",
          "La tarea de limpieza ha sido registrada.",
          "success",
        );
        setShowGenerator(false);
        setTicketForm({
          roomId: "",
          reason: "Check-out completado",
          observation: "",
          assignedTo: "",
          assignedStaffId: "",
        });
      } catch (error) {
        notify("Error al generar ticket", error.message, "error");
      }
    }
  };

  return (
    <div className="view-container">
      <PageHeader
        actionType="CLEANING_ASSIGN"
        metadata="Gestión de Limpieza y Housekeeping 5★"
        title="Limpieza y Acondicionamiento"
        description="Asignación de personal, progresión de tareas, evidencia fotográfica y aprobación para retorno de habitación a disponibilidad."
        action={
          <PermissionButton
            actionType="CLEANING_ASSIGN"
            className="btn btn-primary"
            onClick={() => setShowGenerator(true)}
          >
            Generar Ticket de Limpieza
          </PermissionButton>
        }
      />

      <MetricStrip
        items={[
          { label: "Pendientes", value: pendingCount },
          { label: "En Proceso", value: inProgressCount },
          { label: "Completadas", value: completedCount },
          { label: "Aprobadas", value: approvedCount },
        ]}
      />

      <div className="operation-cards">
        {state.cleaningTasks.map((task) => {
          const room = state.rooms.find((r) => r.id === task.roomId);
          const roomLabel = room
            ? `Habitación ${room.number}`
            : `Habitación ${task.roomId?.slice?.(0, 8) || task.roomId}`;
          const shortTaskId = task.id.slice(0, 8);
          const isApproved = ["Aprobada", "approved"].includes(task.status);

          return (
            <article
              className="card operation-card"
              key={task.id}
              style={{
                padding: "20px",
                borderRadius: "12px",
                border: "1px solid var(--color-border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="row-between">
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      background: "var(--color-navy)",
                      color: "var(--color-gold)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "700",
                      fontSize: "16px",
                      border: "1px solid var(--color-gold-soft)",
                    }}
                  >
                    🧹
                  </div>
                  <div>
                    <span
                      className="eyebrow"
                      style={{ fontSize: "11px", color: "var(--color-muted)" }}
                    >
                      Tarea #{shortTaskId}
                    </span>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: "16px",
                        color: "var(--color-text)",
                      }}
                    >
                      {roomLabel}
                    </h3>
                  </div>
                </div>
                <StatusBadge>{task.status}</StatusBadge>
              </div>

              <div
                style={{
                  margin: "14px 0",
                  fontSize: "13px",
                  color: "var(--color-body)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <div>
                  👤 <strong>Responsable:</strong>{" "}
                  {task.assignedTo || "Por asignar"}
                </div>
                <div>
                  📝 <strong>Motivo:</strong>{" "}
                  {task.reason || "Check-out completado"}
                </div>
                {task.observation ? (
                  <div>
                    💬 <strong>Observación:</strong> {task.observation}
                  </div>
                ) : null}
              </div>

              {/* Direct Card Actions (Hybrid Flow) */}
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  marginTop: "12px",
                  flexWrap: "wrap",
                  borderTop: "1px solid var(--color-border)",
                  paddingTop: "12px",
                }}
              >
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  style={{ flex: 1, minWidth: "110px" }}
                  onClick={() => open(task)}
                >
                  {isApproved ? "👁️ Ver Auditoría" : "✏️ Gestionar / Fotos"}
                </button>

                {canProgress && !isApproved ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      style={{ minWidth: "95px" }}
                      onClick={(e) => advanceTaskDirectly(task, e)}
                    >
                      {task.status === "Pendiente"
                        ? "▶ Iniciar"
                        : task.status === "En proceso"
                          ? "✔ Completar"
                          : "★ Aprobar"}
                    </button>

                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      style={{
                        borderColor: "#d97706",
                        color: "#92400e",
                        background: "#fef3c7",
                        fontWeight: "700",
                      }}
                      title="Liberar inmediatamente y marcar habitación disponible en 1 clic"
                      onClick={(e) => {
                        e.stopPropagation();
                        expressApprove(task);
                      }}
                    >
                      ⚡ Liberar
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={
          selected
            ? `Gestionar Limpieza – ${selectedRoom ? `Hab. ${selectedRoom.number}` : `Tarea #${selected.id.slice(0, 8)}`}`
            : "Gestionar limpieza"
        }
        wide
      >
        {selected ? (
          <div className="detail-stack">
            {/* VIEW WHEN ALREADY APPROVED: Clean Audit Summary */}
            {["Aprobada", "approved"].includes(selected.status) ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "18px",
                }}
              >
                <div
                  style={{
                    background:
                      "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                    padding: "20px",
                    borderRadius: "12px",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    boxShadow: "var(--shadow-md)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                    }}
                  >
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "12px",
                        background: "rgba(16, 185, 129, 0.2)",
                        border: "1px solid #10b981",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "24px",
                      }}
                    >
                      ✅
                    </div>
                    <div>
                      <h3
                        style={{ margin: 0, fontSize: "18px", color: "#fff" }}
                      >
                        Habitación{" "}
                        {selectedRoom ? selectedRoom.number : selected.roomId}{" "}
                        Aprobada y Disponible
                      </h3>
                      <p
                        style={{
                          margin: "4px 0 0 0",
                          fontSize: "12px",
                          color: "#94a3b8",
                        }}
                      >
                        Limpieza certificada e inventario listo para asignación
                        inmediata.
                      </p>
                    </div>
                  </div>
                  <span
                    className="badge badge-green"
                    style={{ fontSize: "13px", padding: "6px 14px" }}
                  >
                    Disponible
                  </span>
                </div>

                <div
                  className="drawer-specs-grid"
                  style={{ gridTemplateColumns: "repeat(2, 1fr)" }}
                >
                  <div className="drawer-spec-item">
                    <div className="drawer-spec-icon">👤</div>
                    <div className="drawer-spec-text">
                      <span>Personal Responsable</span>
                      <strong>
                        {selected.assignedTo || "Personal de Turno"}
                      </strong>
                    </div>
                  </div>
                  <div className="drawer-spec-item">
                    <div className="drawer-spec-icon">📝</div>
                    <div className="drawer-spec-text">
                      <span>Motivo</span>
                      <strong>
                        {selected.reason || "Check-out completado"}
                      </strong>
                    </div>
                  </div>
                  <div className="drawer-spec-item">
                    <div className="drawer-spec-icon">⏱️</div>
                    <div className="drawer-spec-text">
                      <span>Fecha de Aprobación</span>
                      <strong>
                        {new Date(
                          selected.completedAt ||
                            selected.updatedAt ||
                            Date.now(),
                        ).toLocaleString("es-PE")}
                      </strong>
                    </div>
                  </div>
                  <div className="drawer-spec-item">
                    <div className="drawer-spec-icon">🛏️</div>
                    <div className="drawer-spec-text">
                      <span>Categoría</span>
                      <strong>
                        {selectedRoom?.category || "Habitación"} · Piso{" "}
                        {selectedRoom?.floor || "1"}
                      </strong>
                    </div>
                  </div>
                </div>

                {selected.observation ? (
                  <div className="drawer-section-card">
                    <div className="drawer-section-title">
                      💬 Observaciones de la Limpieza
                    </div>
                    <p
                      style={{
                        margin: "4px 0 0 0",
                        fontSize: "13px",
                        color: "var(--color-text)",
                      }}
                    >
                      {selected.observation}
                    </p>
                  </div>
                ) : null}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "10px",
                    borderTop: "1px solid var(--color-border)",
                    paddingTop: "16px",
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setSelectedId(null)}
                  >
                    Cerrar Ficha
                  </button>
                </div>
              </div>
            ) : (
              /* VIEW WHEN PENDING / IN PROGRESS / COMPLETED: Active Management */
              <>
                {/* Status Stepper Pipeline */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: "8px",
                    padding: "12px 16px",
                    borderRadius: "10px",
                    background: "var(--color-surface-soft)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  {[
                    {
                      statusKey: "Pendiente",
                      label: "1. Pendiente",
                      icon: "⏳",
                    },
                    {
                      statusKey: "En proceso",
                      label: "2. En proceso",
                      icon: "🧽",
                    },
                    {
                      statusKey: "Completada",
                      label: "3. Completada",
                      icon: "✨",
                    },
                    { statusKey: "Aprobada", label: "4. Aprobada", icon: "✅" },
                  ].map((step, idx) => {
                    const isCurrent = selected.status === step.statusKey;
                    const isDone =
                      [
                        "Pendiente",
                        "En proceso",
                        "Completada",
                        "Aprobada",
                      ].indexOf(selected.status) > idx;
                    return (
                      <div
                        key={step.statusKey}
                        style={{
                          textAlign: "center",
                          padding: "8px 4px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: isCurrent ? "700" : "500",
                          background: isCurrent
                            ? "var(--color-navy)"
                            : isDone
                              ? "var(--color-success-soft)"
                              : "var(--color-surface)",
                          color: isCurrent
                            ? "var(--color-gold)"
                            : isDone
                              ? "var(--color-success)"
                              : "var(--color-muted)",
                          border: isCurrent
                            ? "1px solid var(--color-gold)"
                            : "1px solid var(--color-border)",
                        }}
                      >
                        {step.icon} {step.label}
                      </div>
                    );
                  })}
                </div>

                {/* Room Info Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    background: "var(--color-surface-soft)",
                    fontSize: "13px",
                    color: "var(--color-text)",
                  }}
                >
                  <div>
                    🛏️{" "}
                    <strong>
                      {selectedRoom
                        ? `Habitación ${selectedRoom.number} (${selectedRoom.category || ""})`
                        : "Habitación"}
                    </strong>
                  </div>
                  <div>
                    📌 Motivo:{" "}
                    <strong>{selected.reason || "Check-out completado"}</strong>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="form-grid">
                  <label>
                    Personal Responsable
                    <select
                      value={form.assignedStaffId}
                      onChange={(event) => {
                        const person = activeStaff.find(
                          (item) => item.id === event.target.value,
                        );
                        setForm({
                          ...form,
                          assignedStaffId: event.target.value,
                          assignedTo: person ? staffName(person) : "",
                        });
                      }}
                    >
                      <option value="">Por asignar</option>
                      {activeStaff.map((person) => (
                        <option key={person.id} value={person.id}>
                          {staffName(person)}
                          {person.position ? ` · ${person.position}` : ""}
                        </option>
                      ))}
                    </select>
                    {staffStatus === "failed" ? (
                      <small className="muted-block">
                        No se pudo cargar el directorio de personal.
                      </small>
                    ) : null}
                    {staffStatus === "forbidden" ? (
                      <small className="muted-block">
                        Tu cuenta no tiene permiso para consultar personal.
                      </small>
                    ) : null}
                  </label>
                  <label>
                    Referencia de Evidencia
                    <input
                      value={form.evidence}
                      placeholder="Ej: Foto de habitación limpia / Check-out OK"
                      onChange={(event) =>
                        setForm({ ...form, evidence: event.target.value })
                      }
                    />
                  </label>
                  {canRegisterEvidence ? (
                    <label>
                      Fotos de Evidencia (Opcional)
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={selectPhotos}
                      />
                      <small className="muted-block">
                        Hasta 5 imágenes de 3 MB cada una. Se guardan al avanzar
                        la tarea.
                      </small>
                    </label>
                  ) : null}
                  <label className="span-2">
                    Observaciones de Limpieza
                    <textarea
                      value={form.observation}
                      placeholder="Ej: Habitación limpia y sanitizada, toallas reemplazadas."
                      onChange={(event) =>
                        setForm({ ...form, observation: event.target.value })
                      }
                    />
                  </label>
                  {photos.length ? (
                    <div
                      className="span-2"
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(120px, 1fr))",
                        gap: "10px",
                      }}
                    >
                      {photos.map((photo) => (
                        <figure
                          key={`${photo.fileName}-${photo.size}`}
                          style={{ margin: 0 }}
                        >
                          <img
                            src={photo.dataUrl}
                            alt={photo.fileName}
                            style={{
                              width: "100%",
                              height: "100px",
                              objectFit: "cover",
                              borderRadius: "8px",
                              border: "1px solid var(--color-border)",
                            }}
                          />
                          <figcaption
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontSize: "11px",
                            }}
                          >
                            {photo.fileName}
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  ) : null}
                </div>

                {/* Action Bar with Express Release Button */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    paddingTop: "14px",
                    borderTop: "1px solid var(--color-border)",
                    flexWrap: "wrap",
                  }}
                >
                  {canUpdate ? (
                    <button
                      className="btn btn-outline"
                      type="button"
                      onClick={save}
                    >
                      💾 Guardar asignación
                    </button>
                  ) : (
                    <div />
                  )}

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    {canProgress ? (
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{
                          borderColor: "#d97706",
                          color: "#92400e",
                          background: "#fef3c7",
                          fontWeight: "700",
                          padding: "10px 18px",
                        }}
                        title="Aprobar directamente y liberar habitación en 1 clic"
                        onClick={() => expressApprove(selected)}
                      >
                        ⚡ Liberación Exprés (1 Clic)
                      </button>
                    ) : null}

                    {canProgress ? (
                      <button
                        className="btn btn-primary"
                        type="button"
                        style={{
                          padding: "10px 22px",
                          fontSize: "14px",
                          fontWeight: "600",
                        }}
                        onClick={advance}
                      >
                        {selected.status === "Pendiente"
                          ? "▶ Iniciar Limpieza"
                          : selected.status === "En proceso"
                            ? "✔ Completar Limpieza"
                            : "★ Aprobar y Liberar"}
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Optional Incident Reporting Box */}
                {canReportIncident ? (
                  <details
                    style={{
                      marginTop: "16px",
                      border: "1px solid var(--color-danger)",
                      borderRadius: "10px",
                      background: "var(--color-danger-soft)",
                      padding: "12px 16px",
                    }}
                  >
                    <summary
                      style={{
                        cursor: "pointer",
                        fontWeight: "600",
                        color: "var(--color-danger)",
                        fontSize: "13px",
                      }}
                    >
                      ⚠️ Reportar Incidencia Bloqueante (opcional si la
                      habitación presenta daños)
                    </summary>
                    <div
                      style={{
                        marginTop: "12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                      }}
                    >
                      <textarea
                        rows={2}
                        value={form.incidentDescription}
                        placeholder="Describa la falla o daño (ej: Fuga de agua en lavatorio o cortina dañada)..."
                        onChange={(event) =>
                          setForm({
                            ...form,
                            incidentDescription: event.target.value,
                          })
                        }
                      />
                      <button
                        className="btn btn-danger"
                        style={{ alignSelf: "flex-end" }}
                        type="button"
                        onClick={incident}
                      >
                        Crear Incidencia Bloqueante
                      </button>
                    </div>
                  </details>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={showGenerator}
        onClose={() => setShowGenerator(false)}
        title="Generar Ticket de Limpieza"
      >
        <div className="form-grid">
          <label className="span-2">
            Habitación
            <select
              value={ticketForm.roomId}
              onChange={(event) =>
                setTicketForm({ ...ticketForm, roomId: event.target.value })
              }
            >
              <option value="" disabled>
                Seleccione una habitación
              </option>
              {state.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  Habitación {r.number} - {r.category}
                </option>
              ))}
            </select>
          </label>
          <label className="span-2">
            Motivo
            <input
              required
              value={ticketForm.reason}
              onChange={(event) =>
                setTicketForm({ ...ticketForm, reason: event.target.value })
              }
            />
          </label>
          <label className="span-2">
            Responsable Asignado (Opcional)
            <select
              value={ticketForm.assignedStaffId}
              onChange={(event) => {
                const person = activeStaff.find(
                  (item) => item.id === event.target.value,
                );
                setTicketForm({
                  ...ticketForm,
                  assignedStaffId: event.target.value,
                  assignedTo: person ? staffName(person) : "",
                });
              }}
            >
              <option value="">Por asignar</option>
              {activeStaff.map((person) => (
                <option key={person.id} value={person.id}>
                  {staffName(person)}
                  {person.position ? ` · ${person.position}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="span-2">
            Observaciones (Opcional)
            <textarea
              value={ticketForm.observation}
              onChange={(event) =>
                setTicketForm({
                  ...ticketForm,
                  observation: event.target.value,
                })
              }
            />
          </label>
          <div className="form-actions span-2">
            <button
              className="btn btn-outline"
              type="button"
              onClick={() => setShowGenerator(false)}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={generateTicket}
            >
              Generar Ticket
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

export function P1EvidenceView({ navigate }) {
  const { state } = useHotel();
  const records = [
    { source: "Limpieza", route: "limpieza", values: state.cleaningTasks },
    {
      source: "Mantenimiento",
      route: "mantenimiento",
      values: state.maintenanceTickets,
    },
    { source: "Incidencias", route: "incidencias", values: state.incidents },
  ].flatMap((group) =>
    group.values.flatMap((record) =>
      (record.evidence || []).map((detail, index) => ({
        id: `${record.id}-${index}`,
        source: group.source,
        route: group.route,
        referenceId: record.id,
        roomId: record.roomId,
        detail,
        status: record.status,
      })),
    ),
  );
  return (
    <div className="view-container">
      <PageHeader
        metadata="Referencias, no archivos"
        title="Evidencias"
        description="Cada evidencia abre su registro fuente; no existe galería ni almacenamiento."
      />
      <DataTable
        caption="Evidencias declaradas"
        columns={[
          "Fuente",
          "Referencia",
          "Habitación",
          "Detalle",
          "Estado",
          "Origen",
        ]}
      >
        {records.map((item) => (
          <tr key={item.id}>
            <td>{item.source}</td>
            <td>{item.referenceId}</td>
            <td>{item.roomId || "No aplica"}</td>
            <td>{item.detail}</td>
            <td>
              <StatusBadge>{item.status}</StatusBadge>
            </td>
            <td>
              <button
                className="btn btn-outline"
                onClick={() => navigate(item.route)}
              >
                Abrir registro fuente
              </button>
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}

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
        className="span-2"
        style={{
          display: "flex",
          gap: "8px",
          padding: "4px",
          backgroundColor: "var(--color-bg-secondary, #f1f5f9)",
          borderRadius: "8px",
          marginBottom: "8px",
        }}
      >
        <button
          type="button"
          disabled={isEditing}
          onClick={() => setEntryMode("stay")}
          style={{
            flex: 1,
            padding: "8px 12px",
            border: "none",
            borderRadius: "6px",
            fontWeight: 600,
            fontSize: "13px",
            cursor: isEditing ? "not-allowed" : "pointer",
            backgroundColor: entryMode === "stay" ? "#ffffff" : "transparent",
            color: entryMode === "stay" ? "var(--color-primary, #0f172a)" : "var(--color-text-muted, #64748b)",
            boxShadow: entryMode === "stay" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            transition: "all 0.15s ease",
          }}
        >
          🏨 Huésped de Habitación
        </button>
        <button
          type="button"
          disabled={isEditing}
          onClick={() => setEntryMode("visitor")}
          style={{
            flex: 1,
            padding: "8px 12px",
            border: "none",
            borderRadius: "6px",
            fontWeight: 600,
            fontSize: "13px",
            cursor: isEditing ? "not-allowed" : "pointer",
            backgroundColor: entryMode === "visitor" ? "#ffffff" : "transparent",
            color: entryMode === "visitor" ? "var(--color-primary, #0f172a)" : "var(--color-text-muted, #64748b)",
            boxShadow: entryMode === "visitor" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            transition: "all 0.15s ease",
          }}
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
        <label style={{ display: "block", marginBottom: "6px" }}>Tarifa de estacionamiento</label>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
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
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "14px", fontWeight: 600 }}>Importe personalizado (S/):</span>
          <input
            type="number"
            min="0"
            step="0.50"
            style={{ width: "120px" }}
            value={form.fee}
            onChange={(event) => setForm({ ...form, fee: event.target.value })}
          />
        </div>
        <small style={{ color: "var(--color-text-muted, #64748b)", display: "block", marginTop: "4px" }}>
          {entryMode === "stay"
            ? "Se cargará automáticamente al folio de la habitación seleccionada."
            : "Cobro directo en garita / recepción al ingreso o salida."}
        </small>
      </div>

      <div
        className="span-2"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "10px 14px",
          backgroundColor: form.keysLeft ? "#fef3c7" : "var(--color-bg-secondary, #f8fafc)",
          border: `1px solid ${form.keysLeft ? "#f59e0b" : "var(--color-border, #e2e8f0)"}`,
          borderRadius: "8px",
          transition: "all 0.15s ease",
        }}
      >
        <input
          type="checkbox"
          id="parking-keys-left-checkbox"
          checked={form.keysLeft}
          onChange={(event) => setForm({ ...form, keysLeft: event.target.checked })}
          style={{ width: "18px", height: "18px", cursor: "pointer" }}
        />
        <label
          htmlFor="parking-keys-left-checkbox"
          style={{ cursor: "pointer", fontSize: "13px", fontWeight: 600, margin: 0 }}
        >
          🔑 Llaves bajo custodia en recepción
          <span style={{ display: "block", fontSize: "11px", fontWeight: 400, color: "var(--color-text-muted, #64748b)" }}>
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
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                borderRadius: "8px",
                border: "1px solid var(--color-border, #cbd5e1)",
                overflow: "hidden",
                backgroundColor: "var(--color-surface, #ffffff)",
              }}
            >
              <button
                type="button"
                style={{
                  padding: "8px 14px",
                  border: "none",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  backgroundColor:
                    viewMode === "map"
                      ? "var(--color-primary, #0f172a)"
                      : "transparent",
                  color:
                    viewMode === "map" ? "#ffffff" : "var(--color-text, #0f172a)",
                  transition: "all 0.15s ease",
                }}
                onClick={() => setViewMode("map")}
              >
                🗺️ Mapa Visual
              </button>
              <button
                type="button"
                style={{
                  padding: "8px 14px",
                  border: "none",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  backgroundColor:
                    viewMode === "list"
                      ? "var(--color-primary, #0f172a)"
                      : "transparent",
                  color:
                    viewMode === "list"
                      ? "#ffffff"
                      : "var(--color-text, #0f172a)",
                  transition: "all 0.15s ease",
                }}
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
          <div className="filter-bar">
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
          </div>
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
                      style={{
                        fontSize: "11px",
                        color: "var(--color-text-muted, #64748b)",
                        marginLeft: "6px",
                      }}
                    >
                      ({item.vehicleColor})
                    </span>
                  ) : null}
                  {item.keysLeft ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "2px",
                        fontSize: "10px",
                        fontWeight: 700,
                        backgroundColor: "#fef3c7",
                        color: "#92400e",
                        padding: "1px 5px",
                        borderRadius: "4px",
                        marginLeft: "6px",
                      }}
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
                        style={{
                          backgroundColor: "#ffedd5",
                          color: "#9a3412",
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "2px 6px",
                          borderRadius: "4px",
                        }}
                      >
                        🍴 Restaurante
                      </span>
                      <div
                        style={{
                          fontWeight: 500,
                          fontSize: "12px",
                          marginTop: "2px",
                        }}
                      >
                        {item.driverName || "Cliente externo"}
                      </div>
                      {item.driverPhone ? (
                        <small style={{ color: "#64748b" }}>
                          📞 {item.driverPhone}
                        </small>
                      ) : null}
                    </div>
                  ) : item.originType === "event" ? (
                    <div>
                      <span
                        style={{
                          backgroundColor: "#f3e8ff",
                          color: "#6b21a8",
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "2px 6px",
                          borderRadius: "4px",
                        }}
                      >
                        🎉 Evento
                      </span>
                      <div
                        style={{
                          fontWeight: 500,
                          fontSize: "12px",
                          marginTop: "2px",
                        }}
                      >
                        {item.driverName || "Cliente externo"}
                      </div>
                      {item.driverPhone ? (
                        <small style={{ color: "#64748b" }}>
                          📞 {item.driverPhone}
                        </small>
                      ) : null}
                    </div>
                  ) : item.originType === "visitor_day" ||
                    (!item.stayId && item.driverName) ? (
                    <div>
                      <span
                        style={{
                          backgroundColor: "#e0f2fe",
                          color: "#0369a1",
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "2px 6px",
                          borderRadius: "4px",
                        }}
                      >
                        🚗 Visita / Horas
                      </span>
                      <div
                        style={{
                          fontWeight: 500,
                          fontSize: "12px",
                          marginTop: "2px",
                        }}
                      >
                        {item.driverName || "Cliente externo"}
                      </div>
                      {item.driverPhone ? (
                        <small style={{ color: "#64748b" }}>
                          📞 {item.driverPhone}
                        </small>
                      ) : null}
                    </div>
                  ) : (
                    <div>
                      <span style={{ fontWeight: 600, fontSize: "12px" }}>
                        Hab. {item.roomId || "—"}
                      </span>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--color-text-muted, #64748b)",
                        }}
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
                  <strong style={{ color: "#0284c7" }}>{item.space}</strong>
                </td>
                <td>
                  {formatMoney(item.fee)}
                  {Number(item.fee) === 0 ? (
                    <span
                      style={{
                        display: "block",
                        fontSize: "10px",
                        color: "#16a34a",
                        fontWeight: 600,
                      }}
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
                      className="btn btn-outline"
                      title="Imprimir ticket térmico"
                      onClick={() => setTicketModalVehicle(item)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
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

function PetEditor({ pet, onClose, notify }) {
  const { state, petCommands } = useHotel();
  const isEditing = Boolean(pet && pet.id);
  const allowed = useActionPermission(isEditing ? "PET_UPDATE" : "PET_CREATE");
  const activeStays = selectActiveStays(state);

  const initialIsVisitor = isEditing
    ? (pet.originType && pet.originType !== "stay") || !pet.stayId
    : activeStays.length === 0;

  const [entryMode, setEntryMode] = useState(initialIsVisitor ? "visitor" : "stay");

  const [form, setForm] = useState(
    isEditing
      ? {
          stayId: pet.stayId || "",
          clientId: pet.clientId || "",
          originType: pet.originType || (pet.stayId ? "stay" : "visitor"),
          ownerName: pet.ownerName || "",
          ownerPhone: pet.ownerPhone || "",
          name: pet.name || "",
          type: pet.type || "Perro",
          breed: pet.breed || "",
          size: pet.size || "Mediano",
          lodgingPlace: pet.lodgingPlace || "Habitación",
          charge: pet.charge ?? 0,
          vaccinationVerified: Boolean(pet.vaccinationVerified),
          temperament: pet.temperament || "Sociable / Amigable",
          emergencyContact: pet.emergencyContact || "",
          welcomeKitDelivered: Boolean(pet.welcomeKitDelivered),
          notes: pet.notes || "",
        }
      : {
          stayId: activeStays[0]?.id || "",
          clientId: activeStays[0]?.clientId || "",
          originType: initialIsVisitor ? "visitor" : "stay",
          ownerName: "",
          ownerPhone: "",
          name: "",
          type: "Perro",
          breed: "",
          size: "Mediano",
          lodgingPlace: "Habitación",
          charge: 0,
          vaccinationVerified: true,
          temperament: "Sociable / Amigable",
          emergencyContact: "",
          welcomeKitDelivered: false,
          notes: "",
        },
  );

  const [requestId] = useState(() => createRequestId("PET"));

  const selectedStay = (isEditing ? state.stays : activeStays).find(
    (stay) => stay.id === form.stayId,
  );
  const selectedClientId = selectedStay?.clientId || form.clientId;

  useEffect(() => {
    if (!isEditing && entryMode === "stay" && !form.stayId && activeStays[0]) {
      setForm((current) => ({
        ...current,
        stayId: activeStays[0].id,
        clientId: activeStays[0].clientId || "",
      }));
    }
  }, [form.stayId, isEditing, entryMode, activeStays]);

  const submit = async (event) => {
    event.preventDefault();
    const isStay = entryMode === "stay";
    const payload = {
      ...form,
      originType: isStay ? "stay" : (form.originType || "visitor"),
      stayId: isStay ? form.stayId : null,
      clientId: isStay ? selectedClientId : (form.clientId || null),
      ownerName: isStay ? null : form.ownerName.trim(),
    };

    const action = isEditing
      ? { type: "PET_UPDATE", petId: pet.id, payload, requestId }
      : {
          type: "PET_CREATE",
          payload,
          requestId,
        };

    const successMessage = isEditing
      ? "Los datos de la mascota se actualizaron correctamente."
      : isStay && Number(form.charge) > 0
        ? "La mascota y su tarifa quedaron confirmadas y cargadas al folio."
        : "La mascota se registró con éxito en el sistema.";

    try {
      await petCommands.execute(action);
      notify(
        isEditing ? "Mascota actualizada" : "Mascota registrada",
        successMessage,
        "success",
      );
      onClose();
    } catch (error) {
      notify("No se pudo guardar la mascota", error.message, "error");
    }
  };

  if (!allowed) return null;

  return (
    <form className="form-grid" onSubmit={submit}>
      <div
        className="span-2"
        style={{
          display: "flex",
          gap: "8px",
          padding: "4px",
          backgroundColor: "var(--color-bg-secondary, #f1f5f9)",
          borderRadius: "8px",
          marginBottom: "8px",
        }}
      >
        <button
          type="button"
          disabled={isEditing}
          onClick={() => setEntryMode("stay")}
          style={{
            flex: 1,
            padding: "8px 12px",
            border: "none",
            borderRadius: "6px",
            fontWeight: 600,
            fontSize: "13px",
            cursor: isEditing ? "not-allowed" : "pointer",
            backgroundColor: entryMode === "stay" ? "#ffffff" : "transparent",
            color: entryMode === "stay" ? "var(--color-primary, #0f172a)" : "var(--color-text-muted, #64748b)",
            boxShadow: entryMode === "stay" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            transition: "all 0.15s ease",
          }}
        >
          🏨 Huésped de Habitación
        </button>
        <button
          type="button"
          disabled={isEditing}
          onClick={() => setEntryMode("visitor")}
          style={{
            flex: 1,
            padding: "8px 12px",
            border: "none",
            borderRadius: "6px",
            fontWeight: 600,
            fontSize: "13px",
            cursor: isEditing ? "not-allowed" : "pointer",
            backgroundColor: entryMode === "visitor" ? "#ffffff" : "transparent",
            color: entryMode === "visitor" ? "var(--color-primary, #0f172a)" : "var(--color-text-muted, #64748b)",
            boxShadow: entryMode === "visitor" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            transition: "all 0.15s ease",
          }}
        >
          🐾 Cliente Externo / Restaurante / Guardería
        </button>
      </div>

      {entryMode === "stay" ? (
        <>
          <label className="span-2">
            Estadía activa
            <select
              required
              value={form.stayId || ""}
              disabled={isEditing || !activeStays.length}
              onChange={(event) =>
                setForm({
                  ...form,
                  stayId: event.target.value,
                  clientId:
                    activeStays.find((stay) => stay.id === event.target.value)
                      ?.clientId || "",
                })
              }
            >
              <option value="">
                {activeStays.length
                  ? "Seleccione una estadía activa"
                  : "No hay estadías activas disponibles (use pestaña Cliente Externo)"}
              </option>
              {activeStays.map((stay) => (
                <option key={stay.id} value={stay.id}>
                  Hab. {stay.roomNumber || stay.roomId} · {stay.clientName || selectClientName(state, stay.clientId)} ·{" "}
                  {stay.id}
                </option>
              ))}
            </select>
          </label>
          {selectedStay ? (
            <div className="span-2 card operation-card">
              <span className="eyebrow">Destino operativo</span>
              <strong>Folio de la estadía {selectedStay.id}</strong>
              <DetailGrid
                compact
                items={[
                  {
                    label: "Huésped",
                    value: selectedStay.clientName || selectClientName(state, selectedClientId),
                  },
                  { label: "Habitación", value: `Habitación ${selectedStay.roomNumber || selectedStay.roomId}` },
                  {
                    label: "Cargo al guardar",
                    value: formatMoney(Number(form.charge) || 0),
                  },
                ]}
              />
              <small>
                El cargo de la mascota se registrará automáticamente en este folio al confirmar.
              </small>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <label>
            Tipo de visita / Servicio
            <select
              value={form.originType}
              onChange={(event) => setForm({ ...form, originType: event.target.value })}
            >
              <option value="visitor">🚗 Visita general / Pase de Día</option>
              <option value="restaurant">🍴 Restaurante / Terraza Pet-Friendly</option>
              <option value="daycare">🛁 Guardería / Daycare o Spa Canino</option>
            </select>
          </label>
          <label>
            Nombre del propietario / cliente *
            <input
              required
              placeholder="Ej. María Fernández"
              value={form.ownerName}
              onChange={(event) => setForm({ ...form, ownerName: event.target.value })}
            />
          </label>
          <label className="span-2">
            Teléfono de contacto (WhatsApp)
            <input
              type="tel"
              placeholder="Ej. +51 987 654 321"
              value={form.ownerPhone}
              onChange={(event) => setForm({ ...form, ownerPhone: event.target.value })}
            />
          </label>
        </>
      )}

      <label>
        Nombre de la mascota *
        <input
          required
          placeholder="Ej. Max, Luna, Toby..."
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
      </label>
      <label>
        Especie / Tipo
        <select
          value={form.type}
          onChange={(event) => setForm({ ...form, type: event.target.value })}
        >
          <option>Perro</option>
          <option>Gato</option>
          <option>Otro</option>
        </select>
      </label>
      <label>
        Raza
        <input
          list="pet-breeds-datalist"
          placeholder="Ej. Golden Retriever, Mestizo, Siamés..."
          value={form.breed}
          onChange={(event) => setForm({ ...form, breed: event.target.value })}
        />
        <datalist id="pet-breeds-datalist">
          <option value="Golden Retriever" />
          <option value="Labrador" />
          <option value="Bulldog Francés" />
          <option value="Poodle / Caniche" />
          <option value="Schnauzer" />
          <option value="Shih Tzu" />
          <option value="Chihuahua" />
          <option value="Beagle" />
          <option value="Pug" />
          <option value="Mestizo" />
          <option value="Gato Criollo" />
          <option value="Siamés" />
          <option value="Persa" />
          <option value="Maine Coon" />
        </datalist>
      </label>
      <label>
        Tamaño
        <select
          value={form.size}
          onChange={(event) => setForm({ ...form, size: event.target.value })}
        >
          <option>Pequeño (hasta 10 kg)</option>
          <option>Mediano (10 a 25 kg)</option>
          <option>Grande (+25 kg)</option>
        </select>
      </label>
      <label className="span-2">
        Alojamiento / Ubicación autorizada
        <select
          value={form.lodgingPlace}
          onChange={(event) =>
            setForm({ ...form, lodgingPlace: event.target.value })
          }
        >
          <option>Habitación</option>
          <option>Terraza / Área exterior pet-friendly</option>
          <option>Guardería / Daycare</option>
          <option>Cochera</option>
        </select>
      </label>

      {/* Health, Safety and Kit */}
      <div
        className="span-2"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "10px 14px",
          backgroundColor: form.vaccinationVerified ? "#dcfce7" : "var(--color-bg-secondary, #f8fafc)",
          border: `1px solid ${form.vaccinationVerified ? "#22c55e" : "var(--color-border, #e2e8f0)"}`,
          borderRadius: "8px",
          transition: "all 0.15s ease",
        }}
      >
        <input
          type="checkbox"
          id="pet-vaccination-checkbox"
          checked={form.vaccinationVerified}
          onChange={(event) => setForm({ ...form, vaccinationVerified: event.target.checked })}
          style={{ width: "18px", height: "18px", cursor: "pointer" }}
        />
        <label
          htmlFor="pet-vaccination-checkbox"
          style={{ cursor: "pointer", fontSize: "13px", fontWeight: 600, margin: 0 }}
        >
          🛡️ Carnet de Vacunación y Antirrábica al día verificado
          <span style={{ display: "block", fontSize: "11px", fontWeight: 400, color: "var(--color-text-muted, #64748b)" }}>
            Confirmar que el huésped/dueño exhibió cartilla sanitaria vigente.
          </span>
        </label>
      </div>

      <label>
        Temperamento / Conducta
        <select
          value={form.temperament}
          onChange={(event) => setForm({ ...form, temperament: event.target.value })}
        >
          <option>Sociable / Amigable</option>
          <option>Tranquilo / Silencioso</option>
          <option>Tímido / Nervioso</option>
          <option>Requiere correa corta</option>
          <option>Requiere bozal en áreas comunes</option>
        </select>
      </label>
      <label>
        Veterinaria / Contacto de emergencia
        <input
          placeholder="Ej. Clínica San Borja (+51 988 776 655)"
          value={form.emergencyContact}
          onChange={(event) => setForm({ ...form, emergencyContact: event.target.value })}
        />
      </label>

      <div
        className="span-2"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "10px 14px",
          backgroundColor: form.welcomeKitDelivered ? "#f3e8ff" : "var(--color-bg-secondary, #f8fafc)",
          border: `1px solid ${form.welcomeKitDelivered ? "#a855f7" : "var(--color-border, #e2e8f0)"}`,
          borderRadius: "8px",
          transition: "all 0.15s ease",
        }}
      >
        <input
          type="checkbox"
          id="pet-welcome-kit-checkbox"
          checked={form.welcomeKitDelivered}
          onChange={(event) => setForm({ ...form, welcomeKitDelivered: event.target.checked })}
          style={{ width: "18px", height: "18px", cursor: "pointer" }}
        />
        <label
          htmlFor="pet-welcome-kit-checkbox"
          style={{ cursor: "pointer", fontSize: "13px", fontWeight: 600, margin: 0 }}
        >
          🎁 Kit de Bienvenida entregado
          <span style={{ display: "block", fontSize: "11px", fontWeight: 400, color: "var(--color-text-muted, #64748b)" }}>
            Marcar si se entregó la camita de cortesía, plato, snack gourmet y bolsas biodegradables.
          </span>
        </label>
      </div>

      {/* Quick Rate Strip */}
      <div className="span-2">
        <label style={{ display: "block", marginBottom: "6px" }}>Tarifa de hospedaje / servicio de mascota</label>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
          <button
            type="button"
            className={`btn btn-sm ${Number(form.charge) === 0 ? "btn-primary" : "btn-outline"}`}
            onClick={() => setForm({ ...form, charge: 0 })}
          >
            Cortesía (S/ 0)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${Number(form.charge) === 15 ? "btn-primary" : "btn-outline"}`}
            onClick={() => setForm({ ...form, charge: 15 })}
          >
            Pase de Día (S/ 15)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${Number(form.charge) === 35 ? "btn-primary" : "btn-outline"}`}
            onClick={() => setForm({ ...form, charge: 35 })}
          >
            Por Noche (S/ 35)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${Number(form.charge) === 50 ? "btn-primary" : "btn-outline"}`}
            onClick={() => setForm({ ...form, charge: 50 })}
          >
            Spa / Limpieza Ozono (S/ 50)
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "14px", fontWeight: 600 }}>Importe personalizado (S/):</span>
          <input
            type="number"
            min="0"
            step="1.00"
            disabled={isEditing}
            style={{ width: "120px" }}
            value={form.charge}
            onChange={(event) => setForm({ ...form, charge: event.target.value })}
          />
        </div>
        <small style={{ color: "var(--color-text-muted, #64748b)", display: "block", marginTop: "4px" }}>
          {entryMode === "stay"
            ? "Se cargará una sola vez al folio de la estadía seleccionada."
            : "Cobro directo en recepción o caja de restaurante / guardería."}
        </small>
      </div>

      <label className="span-2">
        Notas / Observaciones de cuidado
        <textarea
          rows={2}
          placeholder="Ej. Alérgico al pollo, muy tranquilo con niños, no subirse a sofás."
          value={form.notes || ""}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
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
              ? (!selectedStay || !form.name.trim())
              : (!form.ownerName.trim() || !form.name.trim())
          }
        >
          {isEditing ? "Guardar cambios" : "Guardar mascota"}
        </button>
      </div>
    </form>
  );
}

export function P1PetsView({ notify }) {
  const { state, petCommands } = useHotel();
  const [editor, setEditor] = useState(undefined);
  const [reasonOperation, setReasonOperation] = useState(null);
  const [passPet, setPassPet] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("Todos");
  const [statusFilter, setStatusFilter] = useState("Todos");

  const transition = (pet, type) =>
    setReasonOperation({
      actionType: type,
      title: type === "PET_ARCHIVE" ? "Archivar mascota" : "Reactivar mascota",
      onConfirm: async ({ reason }) => {
        try {
          await petCommands.execute({ type, petId: pet.id, reason });
          notify(
            type === "PET_ARCHIVE" ? "Mascota archivada" : "Mascota reactivada",
            "El historial permanece visible.",
            "success",
          );
          return true;
        } catch (error) {
          notify(
            "No se pudo cambiar el estado de la mascota",
            error.message,
            "error",
          );
          return false;
        }
      },
    });

  const requestStatus = state.petRequest?.status;

  const totalPets = (state.pets || []).length;
  const activePets = (state.pets || []).filter((p) => p.status !== "Archivada");
  const dogsCount = activePets.filter((p) => (p.type || "").toLowerCase().includes("perro")).length;
  const catsCount = activePets.filter((p) => (p.type || "").toLowerCase().includes("gato")).length;
  const vaccinatedCount = activePets.filter((p) => p.vaccinationVerified).length;
  const kitsDelivered = activePets.filter((p) => p.welcomeKitDelivered).length;

  const filteredPets = (state.pets || []).filter((pet) => {
    const query = searchQuery.toLowerCase();
    const matchesQuery =
      !query ||
      pet.name.toLowerCase().includes(query) ||
      (pet.breed || "").toLowerCase().includes(query) ||
      (pet.ownerName || "").toLowerCase().includes(query) ||
      (pet.type || "").toLowerCase().includes(query) ||
      (selectClientName(state, pet.clientId) || "").toLowerCase().includes(query);

    const matchesType =
      typeFilter === "Todos" ||
      (typeFilter === "Perro" && (pet.type || "").toLowerCase().includes("perro")) ||
      (typeFilter === "Gato" && (pet.type || "").toLowerCase().includes("gato")) ||
      (typeFilter === "Otros" && !(pet.type || "").toLowerCase().includes("perro") && !(pet.type || "").toLowerCase().includes("gato"));

    const matchesStatus =
      statusFilter === "Todos" ||
      (statusFilter === "Activa" && pet.status !== "Archivada") ||
      (statusFilter === "Archivada" && pet.status === "Archivada");

    return matchesQuery && matchesType && matchesStatus;
  });

  return (
    <div className="view-container">
      <PageHeader
        actionType="PET_CREATE"
        metadata="Programa Pet-Friendly · Control Sanitario y Convivencia"
        title="Mascotas"
        description="Registro de mascotas de huéspedes y comensales, control de vacunas, kit y pases."
        action={
          <PermissionButton
            actionType="PET_CREATE"
            className="btn btn-primary"
            onClick={() => setEditor(null)}
          >
            Registrar mascota
          </PermissionButton>
        }
      />

      <MetricStrip
        items={[
          {
            label: "Total Registradas",
            value: totalPets,
          },
          {
            label: "Activas en Hotel",
            value: `${activePets.length} (${dogsCount} 🐕 · ${catsCount} 🐈)`,
          },
          {
            label: "Vacunación Verificada",
            value: `${vaccinatedCount} / ${activePets.length || 1} (${Math.round((vaccinatedCount / (activePets.length || 1)) * 100)}%)`,
          },
          {
            label: "Kits Entregados",
            value: kitsDelivered,
          },
        ]}
      />

      <div className="filter-bar">
        <label className="search-label">
          <Search size={16} />
          <input
            aria-label="Buscar mascotas"
            placeholder="Buscar por mascota, raza, dueño o habitación..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </label>
        <label>
          Especie
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option>Todos</option>
            <option>Perro</option>
            <option>Gato</option>
            <option>Otros</option>
          </select>
        </label>
        <label>
          Estado
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option>Todos</option>
            <option>Activa</option>
            <option>Archivada</option>
          </select>
        </label>
      </div>

      {requestStatus === "error" ? (
        <div className="alert-banner alert-banner-danger" role="alert">
          <span>{state.petRequest.error}</span>{" "}
          <button
            className="btn btn-sm btn-outline"
            onClick={() => petCommands.reload()}
          >
            Intentar nuevamente
          </button>
        </div>
      ) : null}
      {requestStatus === "loading" ? (
        <p role="status">Cargando mascotas...</p>
      ) : null}

      <div className="operation-cards">
        {filteredPets.length ? (
          filteredPets.map((pet) => {
            const isDog = (pet.type || "").toLowerCase().includes("perro");
            const isCat = (pet.type || "").toLowerCase().includes("gato");
            const petIcon = isDog ? "🐕" : isCat ? "🐈" : "🐾";
            const isStay = pet.originType === "stay" || Boolean(pet.stayId);
            const ownerDisplay = pet.ownerName || (pet.clientId ? selectClientName(state, pet.clientId) : "Huésped");

            return (
              <article
                className="card"
                key={pet.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  borderRadius: "10px",
                  border: "1px solid var(--color-border, #e2e8f0)",
                }}
              >
                <div className="row-between">
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "28px" }}>{petIcon}</span>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "16px" }}>{pet.name}</h3>
                      <small style={{ color: "var(--color-text-muted, #64748b)" }}>
                        {pet.type} {pet.breed ? `· ${pet.breed}` : ""} · {pet.size}
                      </small>
                    </div>
                  </div>
                  <StatusBadge>{pet.status || "Activa"}</StatusBadge>
                </div>

                {/* Badges Strip */}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {pet.vaccinationVerified ? (
                    <span
                      style={{
                        backgroundColor: "#dcfce7",
                        color: "#166534",
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "2px 6px",
                        borderRadius: "4px",
                      }}
                    >
                      🛡️ Vacunas OK
                    </span>
                  ) : (
                    <span
                      style={{
                        backgroundColor: "#fef3c7",
                        color: "#92400e",
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "2px 6px",
                        borderRadius: "4px",
                      }}
                    >
                      ⚠️ Vacuna Pendiente
                    </span>
                  )}
                  {pet.welcomeKitDelivered ? (
                    <span
                      style={{
                        backgroundColor: "#f3e8ff",
                        color: "#6b21a8",
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "2px 6px",
                        borderRadius: "4px",
                      }}
                    >
                      🎁 Kit Entregado
                    </span>
                  ) : null}
                  <span
                    style={{
                      backgroundColor: isStay ? "#f1f5f9" : "#ffedd5",
                      color: isStay ? "#334155" : "#c2410c",
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    {isStay ? `🏨 Habitación` : "🐾 Visita / Restaurante"}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--color-text, #334155)",
                    backgroundColor: "var(--color-bg-secondary, #f8fafc)",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    lineHeight: 1.4,
                  }}
                >
                  <div>
                    <strong>Dueño:</strong> {ownerDisplay}{" "}
                    {pet.ownerPhone ? (
                      <span style={{ color: "#64748b" }}>({pet.ownerPhone})</span>
                    ) : null}
                  </div>
                  <div>
                    <strong>Ubicación:</strong> {pet.lodgingPlace || "Habitación"} ·{" "}
                    <strong>Tarifa:</strong> {formatMoney(pet.charge)}{" "}
                    {Number(pet.charge) === 0 ? (
                      <span style={{ color: "#16a34a", fontWeight: 600 }}>(Cortesía)</span>
                    ) : null}
                  </div>
                  {pet.temperament ? (
                    <div>
                      <strong>Carácter:</strong> {pet.temperament}
                    </div>
                  ) : null}
                </div>

                <div className="inline-actions" style={{ marginTop: "auto", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setPassPet(pet)}
                    style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                  >
                    🎫 Pase Pet-Friendly
                  </button>
                  {pet.status !== "Archivada" ? (
                    <>
                      <PermissionButton
                        actionType="PET_UPDATE"
                        className="btn btn-outline"
                        onClick={() => setEditor(pet)}
                      >
                        Editar
                      </PermissionButton>
                      <PermissionButton
                        actionType="PET_ARCHIVE"
                        className="btn btn-danger"
                        onClick={() => transition(pet, "PET_ARCHIVE")}
                      >
                        Archivar
                      </PermissionButton>
                    </>
                  ) : (
                    <PermissionButton
                      actionType="PET_REACTIVATE"
                      className="btn btn-primary"
                      onClick={() => transition(pet, "PET_REACTIVATE")}
                    >
                      Reactivar
                    </PermissionButton>
                  )}
                </div>
              </article>
            );
          })
        ) : (
          <EmptyState
            title="No hay mascotas registradas"
            description="Use el botón Registrar mascota para ingresar mascotas de huéspedes o comensales externos."
          />
        )}
      </div>

      <Dialog
        open={editor !== undefined}
        onClose={() => setEditor(undefined)}
        title={editor ? `Editar ${editor.name}` : "Registrar mascota"}
      >
        <PetEditor
          pet={editor || null}
          onClose={() => setEditor(undefined)}
          notify={notify}
        />
      </Dialog>

      <PetPassModal
        open={Boolean(passPet)}
        onClose={() => setPassPet(null)}
        pet={passPet}
        clientName={
          passPet?.clientId
            ? selectClientName(state, passPet.clientId)
            : passPet?.ownerName || ""
        }
      />

      <ReasonDialog
        operation={reasonOperation}
        onClose={() => setReasonOperation(null)}
      />
    </div>
  );
}

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
    <form className="form-grid" onSubmit={submit} style={{ gap: "16px" }}>
      <div
        className="span-2"
        style={{
          background: "#f8fafc",
          padding: "12px 16px",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <span
            style={{
              fontSize: "11px",
              textTransform: "uppercase",
              color: "#64748b",
              fontWeight: "700",
              letterSpacing: "0.05em",
            }}
          >
            Zona Reservada
          </span>
          <div
            style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a" }}
          >
            {reservation.amenityType} · #{reservation.id.slice(0, 8)}
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: "12px", color: "#64748b" }}>
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
          style={{ height: "42px", borderRadius: "10px", fontSize: "14px" }}
        />
      </label>
      <label>
        Nombre Completo del Titular *
        <input
          required
          placeholder="Nombre y Apellido"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          style={{ height: "42px", borderRadius: "10px", fontSize: "14px" }}
        />
      </label>

      <div
        className="form-actions span-2"
        style={{
          borderTop: "1px solid #e2e8f0",
          paddingTop: "14px",
          marginTop: "4px",
        }}
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
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      {loading ? (
        <div
          style={{
            padding: "36px 20px",
            textAlign: "center",
            color: "#64748b",
          }}
        >
          <div
            style={{
              display: "inline-block",
              width: "28px",
              height: "28px",
              border: "3px solid #cbd5e1",
              borderTopColor: "#0f172a",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              marginBottom: "12px",
            }}
          ></div>
          <p style={{ margin: 0, fontSize: "13px", fontWeight: "500" }}>
            Cargando cuenta y consumos...
          </p>
        </div>
      ) : error ? (
        <div
          className="alert-banner alert-banner-danger"
          style={{ borderRadius: "12px" }}
        >
          {error}
        </div>
      ) : tabData ? (
        <>
          {/* Card Resumen de la Zona & Titular */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
              padding: "16px 18px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <span style={{ fontSize: "24px" }}>
                  {isPiscina ? "🏊" : "🌄"}
                </span>
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "16px",
                      fontWeight: "800",
                      color: "#0f172a",
                    }}
                  >
                    {reservation.amenityType}
                  </h3>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    Reserva #{reservation.id.slice(0, 8)}
                  </span>
                </div>
              </div>
              <span
                className={`badge ${isPaid ? "badge-green" : "badge-yellow"}`}
                style={{
                  padding: "6px 12px",
                  fontSize: "11px",
                  borderRadius: "20px",
                }}
              >
                {isPaid ? "✓ Liquidado en Caja" : "● Cuenta Abierta"}
              </span>
            </div>

            {/* Inputs de Identidad del Titular */}
            {!isPaid ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                  paddingTop: "10px",
                  borderTop: "1px solid #e2e8f0",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "11px",
                      fontWeight: "700",
                      color: "#475569",
                      marginBottom: "4px",
                    }}
                  >
                    DNI / Documento *
                  </label>
                  <input
                    placeholder="Ej. 74859632"
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    style={{
                      width: "100%",
                      height: "38px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      padding: "0 10px",
                      fontSize: "13px",
                      background: "#fff",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "11px",
                      fontWeight: "700",
                      color: "#475569",
                      marginBottom: "4px",
                    }}
                  >
                    Nombre del Titular
                  </label>
                  <input
                    placeholder="Nombre completo"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    style={{
                      width: "100%",
                      height: "38px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      padding: "0 10px",
                      fontSize: "13px",
                      background: "#fff",
                    }}
                  />
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  gap: "20px",
                  paddingTop: "10px",
                  borderTop: "1px solid #e2e8f0",
                  fontSize: "12.5px",
                  color: "#334155",
                }}
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
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "800",
                  textTransform: "uppercase",
                  color: "#475569",
                  letterSpacing: "0.04em",
                }}
              >
                Desglose de Consumos
              </span>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                {tabData.orders?.length
                  ? `${tabData.orders.length} comanda(s) asociada(s)`
                  : "Solo tarifa de acceso"}
              </span>
            </div>

            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                overflow: "hidden",
                background: "#fff",
              }}
            >
              {/* Tarifa de Entrada */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  borderBottom: tabData.orders?.length
                    ? "1px solid #f1f5f9"
                    : "none",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      background: "#f1f5f9",
                      display: "grid",
                      placeItems: "center",
                      fontSize: "15px",
                    }}
                  >
                    🎟️
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "13.5px",
                        fontWeight: "700",
                        color: "#0f172a",
                      }}
                    >
                      Entrada / Alquiler {reservation.amenityType}
                    </div>
                    <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                      Acceso a zona recreativa ({reservation.pax} personas)
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "700",
                    color: "#0f172a",
                  }}
                >
                  {formatMoney(Number(tabData.entryPrice))}
                </div>
              </div>

              {/* Comandas de Bar y Restaurante */}
              {tabData.orders?.map((order) => (
                <div
                  key={order.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    padding: "12px 16px",
                    borderBottom: "1px solid #f1f5f9",
                    background: "#fafafa",
                  }}
                >
                  <div style={{ display: "flex", gap: "10px" }}>
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "8px",
                        background: "#fef3c7",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "15px",
                        color: "#b45309",
                        flexShrink: 0,
                      }}
                    >
                      🍽️
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: "700",
                          color: "#0f172a",
                        }}
                      >
                        Comanda #{order.id.slice(0, 6)}
                        <span
                          style={{
                            marginLeft: "8px",
                            fontSize: "11px",
                            fontWeight: "500",
                            color: "#64748b",
                          }}
                        >
                          {formatDateTime(order.createdAt)}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#475569",
                          marginTop: "3px",
                        }}
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
                          style={{
                            fontSize: "11px",
                            color: "#b45309",
                            marginTop: "2px",
                            fontStyle: "italic",
                          }}
                        >
                          Nota: {order.comment}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: "700",
                      color: "#0f172a",
                      textAlign: "right",
                      flexShrink: 0,
                    }}
                  >
                    {formatMoney(Number(order.total))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Banner Total Destacado */}
          <div
            style={{
              background: "#f8fafc",
              border: "2px solid #e2e8f0",
              borderRadius: "16px",
              padding: "16px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <span
                style={{
                  fontSize: "11.5px",
                  color: "#64748b",
                  display: "block",
                  marginBottom: "2px",
                }}
              >
                Entrada {formatMoney(Number(tabData.entryPrice))} + Consumos{" "}
                {formatMoney(Number(tabData.consumptionsTotal))}
              </span>
              <strong
                style={{
                  fontSize: "15px",
                  color: "#0f172a",
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                }}
              >
                Total a Liquidar:
              </strong>
            </div>
            <div
              style={{
                fontSize: "26px",
                fontWeight: "900",
                color: "#0f172a",
                letterSpacing: "-0.02em",
              }}
            >
              {formatMoney(Number(tabData.totalAmount))}
            </div>
          </div>

          {/* Selector de Método de Pago y Acciones */}
          {!isPaid ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                borderTop: "1px solid #e2e8f0",
                paddingTop: "16px",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: "700",
                    color: "#475569",
                    marginBottom: "8px",
                  }}
                >
                  Seleccione Método de Pago en Caja:
                </label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(105px, 1fr))",
                    gap: "8px",
                  }}
                >
                  {paymentOptions.map((opt) => {
                    const isSelected = paymentMethod === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPaymentMethod(opt.id)}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "4px",
                          padding: "10px 6px",
                          borderRadius: "12px",
                          border: isSelected
                            ? "2px solid #0f172a"
                            : "1px solid #cbd5e1",
                          background: isSelected ? "#0f172a" : "#fff",
                          color: isSelected ? "#fff" : "#1e293b",
                          fontWeight: isSelected ? "700" : "600",
                          fontSize: "12px",
                          cursor: "pointer",
                          transition: "all 150ms ease",
                          boxShadow: isSelected
                            ? "0 4px 12px rgba(15,23,42,0.15)"
                            : "none",
                        }}
                      >
                        <span style={{ fontSize: "16px" }}>{opt.icon}</span>
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "6px",
                }}
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
                  className="btn btn-primary"
                  onClick={handleSettle}
                  disabled={settling}
                  style={{
                    minWidth: "220px",
                    fontSize: "13.5px",
                    padding: "10px 20px",
                    borderRadius: "12px",
                  }}
                >
                  {settling
                    ? "Registrando en caja..."
                    : `Cobrar ${formatMoney(Number(tabData.totalAmount))} y Cerrar`}
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                borderTop: "1px solid #e2e8f0",
                paddingTop: "14px",
              }}
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", marginBottom: "24px" }}>
        {/* Card Piscina */}
        <div style={{
          position: "relative",
          padding: "24px",
          borderRadius: "var(--radius-lg, 16px)",
          background: "linear-gradient(145deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.8) 100%)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(226, 232, 240, 0.8)",
          boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))",
          overflow: "hidden",
          transition: "transform 0.3s ease, box-shadow 0.3s ease"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div className="kpi-icon-circle tone-blue" style={{ width: "44px", height: "44px", borderRadius: "12px" }}>
                <Waves size={22} />
              </div>
              <div>
                <div style={{ fontSize: "11px", fontWeight: "750", color: "var(--color-muted, #64748b)", textTransform: "uppercase", letterSpacing: "0.055em" }}>
                  Control de Aforo
                </div>
                <h3 style={{ margin: "2px 0 0 0", fontSize: "18px", fontWeight: "800", color: "var(--color-navy, #0f172a)", fontFamily: "var(--font-serif)" }}>
                  Piscina Principal
                </h3>
              </div>
            </div>
            <span style={{
              padding: "5px 14px",
              borderRadius: "999px",
              fontSize: "12px",
              fontWeight: "700",
              background: piscinaOcc.occupancyPercentage >= 90 ? "rgba(239, 68, 68, 0.1)" : piscinaOcc.occupancyPercentage >= 60 ? "rgba(245, 158, 11, 0.1)" : "rgba(16, 185, 129, 0.1)",
              color: piscinaOcc.occupancyPercentage >= 90 ? "#dc2626" : piscinaOcc.occupancyPercentage >= 60 ? "#d97706" : "#059669",
              border: `1px solid ${piscinaOcc.occupancyPercentage >= 90 ? "rgba(239, 68, 68, 0.25)" : piscinaOcc.occupancyPercentage >= 60 ? "rgba(245, 158, 11, 0.25)" : "rgba(16, 185, 129, 0.25)"}`
            }}>
              {piscinaOcc.stateBadge}
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "10px" }}>
            <div>
              <span style={{ fontSize: "12px", color: "var(--color-muted, #64748b)" }}>Tarifa Day Pass: </span>
              <strong style={{ fontSize: "13.5px", color: "var(--color-navy, #0f172a)" }}>{formatMoney(piscinaOcc.priceExternal)}</strong>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: "20px", fontWeight: "800", color: "var(--color-navy, #0f172a)", fontFamily: "var(--font-serif)" }}>
                {piscinaOcc.currentPax}
              </span>
              <span style={{ fontSize: "13px", color: "var(--color-muted, #64748b)", fontWeight: "500" }}>
                {" "}de {piscinaOcc.capacity} personas ({piscinaOcc.occupancyPercentage}%)
              </span>
            </div>
          </div>

          <div style={{ width: "100%", height: "10px", borderRadius: "999px", background: "rgba(15, 23, 42, 0.06)", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                borderRadius: "999px",
                transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                background: piscinaOcc.occupancyPercentage >= 90 ? "#ef4444" : piscinaOcc.occupancyPercentage >= 60 ? "#f59e0b" : "var(--color-primary, #2563eb)",
                width: `${Math.min(100, Math.max(0, piscinaOcc.occupancyPercentage))}%`
              }}
            />
          </div>
        </div>

        {/* Card Mirador */}
        <div style={{
          position: "relative",
          padding: "24px",
          borderRadius: "var(--radius-lg, 16px)",
          background: "linear-gradient(145deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.8) 100%)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(226, 232, 240, 0.8)",
          boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))",
          overflow: "hidden",
          transition: "transform 0.3s ease, box-shadow 0.3s ease"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div className="kpi-icon-circle tone-purple" style={{ width: "44px", height: "44px", borderRadius: "12px" }}>
                <Mountain size={22} />
              </div>
              <div>
                <div style={{ fontSize: "11px", fontWeight: "750", color: "var(--color-muted, #64748b)", textTransform: "uppercase", letterSpacing: "0.055em" }}>
                  Control de Aforo
                </div>
                <h3 style={{ margin: "2px 0 0 0", fontSize: "18px", fontWeight: "800", color: "var(--color-navy, #0f172a)", fontFamily: "var(--font-serif)" }}>
                  Mirador Terraza
                </h3>
              </div>
            </div>
            <span style={{
              padding: "5px 14px",
              borderRadius: "999px",
              fontSize: "12px",
              fontWeight: "700",
              background: miradorOcc.occupancyPercentage >= 90 ? "rgba(239, 68, 68, 0.1)" : miradorOcc.occupancyPercentage >= 60 ? "rgba(245, 158, 11, 0.1)" : "rgba(16, 185, 129, 0.1)",
              color: miradorOcc.occupancyPercentage >= 90 ? "#dc2626" : miradorOcc.occupancyPercentage >= 60 ? "#d97706" : "#059669",
              border: `1px solid ${miradorOcc.occupancyPercentage >= 90 ? "rgba(239, 68, 68, 0.25)" : miradorOcc.occupancyPercentage >= 60 ? "rgba(245, 158, 11, 0.25)" : "rgba(16, 185, 129, 0.25)"}`
            }}>
              {miradorOcc.stateBadge}
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "10px" }}>
            <div>
              <span style={{ fontSize: "12px", color: "var(--color-muted, #64748b)" }}>Tarifa Day Pass: </span>
              <strong style={{ fontSize: "13.5px", color: "var(--color-navy, #0f172a)" }}>{formatMoney(miradorOcc.priceExternal)}</strong>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: "20px", fontWeight: "800", color: "var(--color-navy, #0f172a)", fontFamily: "var(--font-serif)" }}>
                {miradorOcc.currentPax}
              </span>
              <span style={{ fontSize: "13px", color: "var(--color-muted, #64748b)", fontWeight: "500" }}>
                {" "}de {miradorOcc.capacity} personas ({miradorOcc.occupancyPercentage}%)
              </span>
            </div>
          </div>

          <div style={{ width: "100%", height: "10px", borderRadius: "999px", background: "rgba(15, 23, 42, 0.06)", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                borderRadius: "999px",
                transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                background: miradorOcc.occupancyPercentage >= 90 ? "#ef4444" : miradorOcc.occupancyPercentage >= 60 ? "#f59e0b" : "#9333ea",
                width: `${Math.min(100, Math.max(0, miradorOcc.occupancyPercentage))}%`
              }}
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

      <div className="filter-bar">
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
      </div>

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
                <small style={{ color: "var(--text-muted)" }}>
                  #{reservation.id.slice(0, 8)}
                </small>
              </td>
              <td>
                <strong>{reservation.customerName || "Sin registrar"}</strong>
                <br />
                <span
                  style={{
                    fontSize: "12px",
                    color: reservation.documentNumber
                      ? "var(--text-secondary)"
                      : "var(--color-danger, #ef4444)",
                  }}
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
                <small style={{ color: "var(--text-muted)" }}>
                  Hasta {formatDateTime(reservation.endTime)} ·{" "}
                  {reservation.pax} pax
                </small>
              </td>
              <td>{formatReservationMoney(reservation.price)}</td>
              <td>
                {Number(reservation.consumptionsTotal || 0) > 0 ? (
                  <span
                    style={{
                      color: "var(--color-warning, #f59e0b)",
                      fontWeight: "bold",
                    }}
                  >
                    {formatReservationMoney(reservation.consumptionsTotal)}
                    <br />
                    <small style={{ color: "var(--text-muted)" }}>
                      {reservation.ordersCount} pedido(s)
                    </small>
                  </span>
                ) : (
                  <span style={{ color: "var(--text-muted)" }}>S/ 0.00</span>
                )}
              </td>
              <td>
                <strong
                  style={{
                    fontSize: "14px",
                    color: isPaid
                      ? "var(--color-success, #22c55e)"
                      : "var(--color-primary, #3b82f6)",
                  }}
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

function EventEditor({ event, onClose, notify }) {
  const { state, execute } = useHotel();
  const allowed = useActionPermission(event ? "EVENT_UPDATE" : "EVENT_CREATE");
  const [form, setForm] = useState(
    event
      ? { ...event }
      : {
          clientId:
            state.clients.find((item) => item.status !== "Archivado")?.id || "",
          title: "",
          date: "",
          startTime: "18:00",
          endTime: "22:00",
          venue: "Terraza",
          attendees: 1,
          services: [],
          total: 0,
        },
  );
  const submit = (submitEvent) => {
    submitEvent.preventDefault();
    const action = event
      ? { type: "EVENT_UPDATE", eventId: event.id, payload: form }
      : { type: "EVENT_CREATE", payload: form };
    if (
      run(
        execute,
        action,
        notify,
        event ? "Evento actualizado" : "Evento creado",
        "El horario fue validado centralmente; no se generó adelanto ni movimiento financiero.",
      )
    )
      onClose();
  };
  if (!allowed) return null;
  return (
    <form className="form-grid" onSubmit={submit}>
      <label className="span-2">
        Evento
        <input
          required
          value={form.title}
          onChange={(change) =>
            setForm({ ...form, title: change.target.value })
          }
        />
      </label>
      <label>
        Cliente
        <select
          value={form.clientId}
          onChange={(change) =>
            setForm({ ...form, clientId: change.target.value })
          }
        >
          {state.clients
            .filter((item) => item.status !== "Archivado")
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        Espacio
        <select
          value={form.venue}
          onChange={(change) =>
            setForm({ ...form, venue: change.target.value })
          }
        >
          <option>Terraza</option>
          <option>Bar</option>
          <option>Salón Plaza</option>
        </select>
      </label>
      <label>
        Fecha
        <input
          type="date"
          required
          value={form.date}
          onChange={(change) => setForm({ ...form, date: change.target.value })}
        />
      </label>
      <label>
        Asistentes
        <input
          type="number"
          min="1"
          value={form.attendees}
          onChange={(change) =>
            setForm({ ...form, attendees: change.target.value })
          }
        />
      </label>
      <label>
        Inicio
        <input
          type="time"
          value={form.startTime}
          onChange={(change) =>
            setForm({ ...form, startTime: change.target.value })
          }
        />
      </label>
      <label>
        Fin
        <input
          type="time"
          value={form.endTime}
          onChange={(change) =>
            setForm({ ...form, endTime: change.target.value })
          }
        />
      </label>
      <label className="span-2">
        Importe
        <input
          type="number"
          min="0"
          value={form.total}
          onChange={(change) =>
            setForm({ ...form, total: change.target.value })
          }
        />
      </label>
      <button className="btn btn-primary span-2">Guardar evento</button>
    </form>
  );
}

function EventActions({ event, notify, onEdit }) {
  const { execute } = useHotel();
  const [reasonOperation, setReasonOperation] = useState(null);
  const apply = (type, reason = "") =>
    run(
      execute,
      { type, eventId: event.id, reason },
      notify,
      type === "EVENT_CONFIRM"
        ? "Evento confirmado"
        : type === "EVENT_CANCEL"
          ? "Evento cancelado"
          : "Evento archivado",
      "La transición quedó auditada sin movimientos financieros automáticos.",
    );
  const transition = (type) =>
    type === "EVENT_CONFIRM"
      ? apply(type)
      : setReasonOperation({
          actionType: type,
          title:
            type === "EVENT_CANCEL" ? "Cancelar evento" : "Archivar evento",
          onConfirm: ({ reason }) => apply(type, reason),
        });
  return (
    <>
      <div className="inline-actions">
        {!["Cancelado", "Archivado"].includes(event.status) ? (
          <PermissionButton
            actionType="EVENT_UPDATE"
            className="btn btn-outline"
            onClick={onEdit}
          >
            Editar
          </PermissionButton>
        ) : null}
        {event.status === "Tentativo" ? (
          <PermissionButton
            actionType="EVENT_CONFIRM"
            className="btn btn-primary"
            onClick={() => transition("EVENT_CONFIRM")}
          >
            Confirmar
          </PermissionButton>
        ) : null}
        {!["Cancelado", "Archivado"].includes(event.status) ? (
          <PermissionButton
            actionType="EVENT_CANCEL"
            className="btn btn-danger"
            onClick={() => transition("EVENT_CANCEL")}
          >
            Cancelar
          </PermissionButton>
        ) : null}
        {event.status === "Cancelado" ? (
          <PermissionButton
            actionType="EVENT_ARCHIVE"
            className="btn btn-danger"
            onClick={() => transition("EVENT_ARCHIVE")}
          >
            Archivar
          </PermissionButton>
        ) : null}
      </div>
      <ReasonDialog
        operation={reasonOperation}
        onClose={() => setReasonOperation(null)}
      />
    </>
  );
}

export function P1EventsView({ notify }) {
  const { state } = useHotel();
  const [editor, setEditor] = useState(undefined);
  return (
    <div className="view-container">
      <PageHeader
        actionType="EVENT_CREATE"
        metadata="Adelanto siempre cero"
        title="Eventos"
        description="Creación, edición, confirmación, cancelación y archivo con validación central."
        action={
          <PermissionButton
            actionType="EVENT_CREATE"
            className="btn btn-primary"
            onClick={() => setEditor(null)}
          >
            Nuevo evento
          </PermissionButton>
        }
      />
      <div className="operation-cards">
        {state.events.map((event) => (
          <article className="card" key={event.id}>
            <div className="row-between">
              <div>
                <span className="eyebrow">
                  {event.id} · {event.venue}
                </span>
                <h3>{event.title}</h3>
              </div>
              <StatusBadge>{event.status}</StatusBadge>
            </div>
            <DetailGrid
              compact
              items={[
                {
                  label: "Fecha",
                  value: event.date,
                  detail: `${event.startTime}-${event.endTime}`,
                },
                {
                  label: "Cliente",
                  value: selectClientName(state, event.clientId),
                },
                { label: "Importe", value: formatMoney(event.total) },
                { label: "Adelanto", value: formatMoney(event.advance) },
              ]}
            />
            <EventActions
              event={event}
              notify={notify}
              onEdit={() => setEditor(event)}
            />
          </article>
        ))}
      </div>
      <Dialog
        open={editor !== undefined}
        onClose={() => setEditor(undefined)}
        title={editor ? `Editar ${editor.id}` : "Nuevo evento"}
      >
        <EventEditor
          event={editor || null}
          onClose={() => setEditor(undefined)}
          notify={notify}
        />
      </Dialog>
    </div>
  );
}

export function P1EventCalendarView({ notify }) {
  const { state } = useHotel();
  const [selectedId, setSelectedId] = useState(null);
  const [editor, setEditor] = useState(undefined);
  const selected = state.events.find((item) => item.id === selectedId);
  const dates = [
    ...new Set(
      state.events
        .filter((item) => item.status !== "Archivado")
        .map((item) => item.date),
    ),
  ].toSorted();
  return (
    <div className="view-container">
      <PageHeader
        metadata="Detalle contextual"
        title="Calendario de eventos"
        description="La agenda abre el mismo editor y las mismas acciones del evento."
      />
      <div className="calendar-agenda">
        {dates.map((date) => (
          <section className="card" key={date}>
            <SectionHeader title={date} />
            <div className="record-list">
              {state.events
                .filter(
                  (item) => item.date === date && item.status !== "Archivado",
                )
                .map((event) => (
                  <article key={event.id}>
                    <div>
                      <strong>
                        {event.startTime}-{event.endTime} · {event.title}
                      </strong>
                      <span>
                        {event.venue} ·{" "}
                        {selectClientName(state, event.clientId)}
                      </span>
                    </div>
                    <button
                      className="btn btn-outline"
                      onClick={() => setSelectedId(event.id)}
                    >
                      Abrir detalle
                    </button>
                  </article>
                ))}
            </div>
          </section>
        ))}
      </div>
      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={selected?.title || "Evento"}
      >
        {selected ? (
          <div className="detail-stack">
            <DetailGrid
              items={[
                {
                  label: "Horario",
                  value: `${selected.date} ${selected.startTime}-${selected.endTime}`,
                },
                { label: "Espacio", value: selected.venue },
                { label: "Estado", value: selected.status },
                { label: "Adelanto", value: formatMoney(selected.advance) },
              ]}
            />
            <EventActions
              event={selected}
              notify={notify}
              onEdit={() => setEditor(selected)}
            />
          </div>
        ) : null}
      </Drawer>
      <Dialog
        open={editor !== undefined}
        onClose={() => setEditor(undefined)}
        title={editor ? `Editar ${editor.id}` : "Evento"}
      >
        <EventEditor
          event={editor || null}
          onClose={() => setEditor(undefined)}
          notify={notify}
        />
      </Dialog>
    </div>
  );
}

export function P1FoodBarView({ notify }) {
  return <MenuManagementView notify={notify} />;
}

export function P1NotificationsView({ navigate, notify }) {
  return <NotificationsView navigate={navigate} notify={notify} />;
}
