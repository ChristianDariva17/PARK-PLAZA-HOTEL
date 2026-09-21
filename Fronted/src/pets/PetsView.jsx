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
  EmptyState,
  DetailGrid,
  MetricStrip,
  PageHeader,
  StatusBadge,
} from '../components/views/SharedViewParts.jsx';
import { Search } from 'lucide-react';
import { PetPassModal } from './PetPassModal.jsx';
import ReasonDialog from '../components/views/ReasonDialog.jsx';

const createRequestId = (prefix) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;
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
        className="span-2 operations-text-secondary5"
      >
        <input
          type="checkbox"
          id="pet-vaccination-checkbox"
          checked={form.vaccinationVerified}
          onChange={(event) => setForm({ ...form, vaccinationVerified: event.target.checked })}
          className="operations-text-secondary6"
        />
        <label
          htmlFor="pet-vaccination-checkbox"
          className="operations-text-secondary7"
        >
          🛡️ Carnet de Vacunación y Antirrábica al día verificado
          <span className="operations-text-secondary8">
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
        className="span-2 operations-text-secondary9"
      >
        <input
          type="checkbox"
          id="pet-welcome-kit-checkbox"
          checked={form.welcomeKitDelivered}
          onChange={(event) => setForm({ ...form, welcomeKitDelivered: event.target.checked })}
          className="operations-text-compact0"
        />
        <label
          htmlFor="pet-welcome-kit-checkbox"
          className="operations-text-compact1"
        >
          🎁 Kit de Bienvenida entregado
          <span className="operations-text-compact2">
            Marcar si se entregó la camita de cortesía, plato, snack gourmet y bolsas biodegradables.
          </span>
        </label>
      </div>

      {/* Quick Rate Strip */}
      <div className="span-2">
        <label className="operations-text-compact3">Tarifa de hospedaje / servicio de mascota</label>
        <div className="operations-text-compact4">
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
        <div className="operations-text-compact5">
          <span className="operations-text-compact6">Importe personalizado (S/):</span>
          <input
            type="number"
            min="0"
            step="1.00"
            disabled={isEditing}
            className="operations-text-compact7"
            value={form.charge}
            onChange={(event) => setForm({ ...form, charge: event.target.value })}
          />
        </div>
        <small className="operations-text-compact8">
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

  useEffect(() => {
    petCommands.reload().catch(() => {});
  }, [petCommands]);

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

      <FilterBar label="Filtros de mascotas">
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
      </FilterBar>

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
                className="card operations-text-compact9"
                key={pet.id}
              >
                <div className="row-between">
                  <div className="operations-stack-secondary0">
                    <span className="operations-stack-secondary1">{petIcon}</span>
                    <div>
                      <h3 className="operations-stack-secondary2">{pet.name}</h3>
                      <small className="operations-stack-secondary3">
                        {pet.type} {pet.breed ? `· ${pet.breed}` : ""} · {pet.size}
                      </small>
                    </div>
                  </div>
                  <StatusBadge>{pet.status || "Activa"}</StatusBadge>
                </div>

                {/* Badges Strip */}
                <div className="operations-stack-secondary4">
                  {pet.vaccinationVerified ? (
                    <span
                      className="operations-stack-secondary5"
                    >
                      🛡️ Vacunas OK
                    </span>
                  ) : (
                    <span
                      className="operations-stack-secondary6"
                    >
                      ⚠️ Vacuna Pendiente
                    </span>
                  )}
                  {pet.welcomeKitDelivered ? (
                    <span
                      className="operations-stack-secondary7"
                    >
                      🎁 Kit Entregado
                    </span>
                  ) : null}
                  <span
                    className="operations-stack-secondary8"
                  >
                    {isStay ? `🏨 Habitación` : "🐾 Visita / Restaurante"}
                  </span>
                </div>

                <div
                  className="operations-stack-secondary9"
                >
                  <div>
                    <strong>Dueño:</strong> {ownerDisplay}{" "}
                    {pet.ownerPhone ? (
                      <span className="operations-stack00">({pet.ownerPhone})</span>
                    ) : null}
                  </div>
                  <div>
                    <strong>Ubicación:</strong> {pet.lodgingPlace || "Habitación"} ·{" "}
                    <strong>Tarifa:</strong> {formatMoney(pet.charge)}{" "}
                    {Number(pet.charge) === 0 ? (
                      <span className="operations-stack01">(Cortesía)</span>
                    ) : null}
                  </div>
                  {pet.temperament ? (
                    <div>
                      <strong>Carácter:</strong> {pet.temperament}
                    </div>
                  ) : null}
                </div>

                <div className="inline-actions operations-stack02">
                  <button
                    type="button"
                    className="btn btn-outline operations-stack03"
                    onClick={() => setPassPet(pet)}
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
