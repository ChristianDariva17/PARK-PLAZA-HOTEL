import { useEffect, useRef, useState } from "react";
import { useHotel } from "../state/hotelContext.js";
import { PermissionButton } from "../components/auth/PermissionButton.jsx";
import { useActionPermission } from "../components/auth/useActionPermission.js";
import { Dialog } from "../components/ui/Overlay.jsx";
import { MetricStrip, PageHeader, ResourceState, StatusBadge } from "../components/views/SharedViewParts.jsx";
import { evidenceClient } from "../documents/evidenceClient.js";
import { useStaffResource } from "../hooks/useStaffResource.js";

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

function CleaningLoadingSkeleton() {
  return (
    <div className="cleaning-loading-skeleton" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Cargando tareas de limpieza...</span>
      <div className="cleaning-loading-grid" aria-hidden="true">
        {[1, 2, 3].map((card) => (
          <div className="cleaning-loading-card" key={card}>
            <span className="loading-skeleton cleaning-loading-title" />
            <span className="loading-skeleton cleaning-loading-line" />
            <span className="loading-skeleton cleaning-loading-line cleaning-loading-line-short" />
            <span className="loading-skeleton cleaning-loading-button" />
          </div>
        ))}
      </div>
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
  const [busyAction, setBusyAction] = useState(null);
  const busyActionRef = useRef(null);

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

  const runBusy = async (actionName, operation) => {
    if (busyActionRef.current || commandRequest?.retryBlocked) return false;
    busyActionRef.current = actionName;
    setBusyAction(actionName);
    try {
      await operation();
      return true;
    } finally {
      busyActionRef.current = null;
      setBusyAction(null);
    }
  };

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

  const save = () => runBusy("save", async () => {
    if (!selected) return;
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
        const result = run(
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
        if (!result) return;
      }
      notify(
        "Tarea actualizada",
        "Asignación, observación y evidencia quedaron auditadas.",
        "success",
      );
    } catch (error) {
      notify("Error al actualizar", error.message, "error");
    }
  });

  const advance = () => runBusy("advance", async () => {
    if (!selected) return;
    try {
      const evidence = await uploadPhotos();
      if (cleaningCommands) {
        await cleaningCommands.progress(selected.id, selected.status, evidence);
      } else {
        const result = run(
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
        if (!result) return;
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
  });

  const expressApprove = (taskToApprove) => runBusy("approve", async () => {
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
  });

  const advanceTaskDirectly = (task, e) => runBusy("direct-progress", async () => {
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
  });

  const incident = () => runBusy("incident", async () => {
    if (!selected) return;
    if (!form.incidentDescription.trim()) {
      notify("Descripción requerida", "Describí la falla o daño antes de crear la incidencia.", "error");
      return;
    }
    if (cleaningCommands) {
      try {
        const evidence = await uploadPhotos();
        await cleaningCommands.reportIncident(
          selected.id,
          form.incidentDescription,
          evidence,
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
  });

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

  const generateTicket = () => runBusy("generate", async () => {
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
  });

  const cleaningStatus = state.cleaningRequest?.status || "idle";
  const cleaningHasTasks = state.cleaningTasks.length > 0;
  const commandRequest = state.cleaningCommandRequest || { status: "idle", error: null };
  const reloadCleaningView = async () => {
    try {
      await (cleaningCommands?.refreshForRetry?.() || cleaningCommands?.reload?.());
      notify("Limpieza actualizada", "Se cargó el estado autoritativo de las tareas.", "success");
    } catch (error) {
      notify("No se pudo actualizar", error.message, "error");
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

      {commandRequest.status === "error" ? (
        <div className="state-panel state-error" role="alert">
          <strong>No se pudo confirmar la última operación de limpieza.</strong>
          <p>{commandRequest.error || "Actualizá las tareas antes de reintentar."}</p>
          <button type="button" className="btn btn-primary" onClick={reloadCleaningView} disabled={Boolean(busyAction)}>
            Actualizar tareas
          </button>
        </div>
      ) : null}

      {!cleaningHasTasks && cleaningStatus !== "success" ? (
        <ResourceState
          status={cleaningStatus}
          error={state.cleaningRequest?.error}
          onRetry={cleaningStatus === "error" ? reloadCleaningView : undefined}
          loadingFallback={<CleaningLoadingSkeleton />}
          emptyTitle="Sin tareas de limpieza"
          emptyDescription="Las tareas aparecerán después de un check-out o al generar un ticket."
        />
      ) : null}

      {cleaningHasTasks ? (
        <>
          {cleaningStatus === "loading" ? (
            <div className="state-refreshing" role="status" aria-live="polite">
              <span aria-hidden="true" />
              Actualizando tareas de limpieza...
            </div>
          ) : null}
          {cleaningStatus === "error" ? (
            <div className="state-panel state-error" role="alert">
              <strong>Mostrando el último estado conocido.</strong>
              <p>{state.cleaningRequest?.error || "Actualizá las tareas para continuar."}</p>
              <button type="button" className="btn btn-primary" onClick={reloadCleaningView} disabled={Boolean(busyAction)}>
                Reintentar actualización
              </button>
            </div>
          ) : null}
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
              className="card operation-card operations-bordered"
              key={task.id}
            >
              <div className="row-between">
                <div
                  className="operations-row-secondary"
                >
                  <div
                    className="operations-row-compact"
                  >
                    🧹
                  </div>
                  <div>
                    <span
                      className="eyebrow operations-text-secondary"
                    >
                      Tarea #{shortTaskId}
                    </span>
                    <h3
                      className="operations-text-compact"
                    >
                      {roomLabel}
                    </h3>
                  </div>
                </div>
                <StatusBadge>{task.status}</StatusBadge>
              </div>

              <div
                className="operations-stack-secondary"
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
                className="operations-stack0"
              >
                <button
                  type="button"
                  className="btn btn-sm btn-outline operations-stack1"
                  onClick={() => open(task)}
                  disabled={Boolean(busyAction || commandRequest.retryBlocked)}
                >
                  {isApproved ? "👁️ Ver Auditoría" : "✏️ Gestionar / Fotos"}
                </button>

                {canProgress && !isApproved ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary operations-stack2"
                      onClick={(e) => advanceTaskDirectly(task, e)}
                      disabled={Boolean(busyAction || commandRequest.retryBlocked)}
                      aria-busy={busyAction === "direct-progress"}
                    >
                      {task.status === "Pendiente"
                        ? "▶ Iniciar"
                        : task.status === "En proceso"
                          ? "✔ Completar"
                          : "★ Aprobar"}
                    </button>

                    <button
                      type="button"
                      className="btn btn-sm btn-outline operations-stack3"
                      title="Liberar inmediatamente y marcar habitación disponible en 1 clic"
                      onClick={(e) => {
                        e.stopPropagation();
                        expressApprove(task);
                      }}
                      disabled={Boolean(busyAction || commandRequest.retryBlocked)}
                      aria-busy={busyAction === "approve"}
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
        </>
      ) : cleaningStatus === "success" ? (
        <ResourceState
          status="empty"
          emptyTitle="Sin tareas de limpieza"
          emptyDescription="Las tareas aparecerán después de un check-out o al generar un ticket."
        />
      ) : null}

      <Dialog
        open={Boolean(selected)}
        onClose={() => {
          if (!busyAction) setSelectedId(null);
        }}
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
                className="operations-stack4"
              >
                <div
                  className="operations-stack5"
                >
                  <div
                    className="operations-stack6"
                  >
                    <div
                      className="operations-stack7"
                    >
                      ✅
                    </div>
                    <div>
                      <h3
                        className="operations-stack8"
                      >
                        Habitación{" "}
                        {selectedRoom ? selectedRoom.number : selected.roomId}{" "}
                        Aprobada y Disponible
                      </h3>
                      <p
                        className="operations-stack9"
                      >
                        Limpieza certificada e inventario listo para asignación
                        inmediata.
                      </p>
                    </div>
                  </div>
                  <span
                    className="badge badge-green operations-row0"
                  >
                    Disponible
                  </span>
                </div>

                <div
                    className="drawer-specs-grid operations-row1"
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
                      className="operations-row2"
                    >
                      {selected.observation}
                    </p>
                  </div>
                ) : null}

                <div
                  className="operations-row3"
                >
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setSelectedId(null)}
                    disabled={Boolean(busyAction || commandRequest.retryBlocked)}
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
                  className="operations-row4"
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
                  ].map((step) => {
                    return (
                      <div
                        key={step.statusKey}
                        className="operations-row5"
                      >
                        {step.icon} {step.label}
                      </div>
                    );
                  })}
                </div>

                {/* Room Info Header */}
                <div
                  className="operations-row6"
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
                      disabled={Boolean(busyAction || commandRequest.retryBlocked)}
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
                      disabled={Boolean(busyAction || commandRequest.retryBlocked)}
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
                        disabled={Boolean(busyAction || commandRequest.retryBlocked)}
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
                      disabled={Boolean(busyAction)}
                      placeholder="Ej: Habitación limpia y sanitizada, toallas reemplazadas."
                      onChange={(event) =>
                        setForm({ ...form, observation: event.target.value })
                      }
                    />
                  </label>
                  {photos.length ? (
                    <div
                      className="span-2 operations-row7"
                    >
                      {photos.map((photo) => (
                        <figure
                          key={`${photo.fileName}-${photo.size}`}
                          className="operations-row8"
                        >
                          <img
                            src={photo.dataUrl}
                            alt={photo.fileName}
                            className="operations-row9"
                          />
                          <figcaption
                            className="operations-text0"
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
                  className="operations-text1"
                >
                  {canUpdate ? (
                    <button
                      className="btn btn-outline"
                      type="button"
                      onClick={save}
                      disabled={Boolean(busyAction)}
                      aria-busy={busyAction === "save"}
                    >
                      {busyAction === "save" ? "Guardando..." : "💾 Guardar asignación"}
                    </button>
                  ) : (
                    <div />
                  )}

                  <div
                    className="operations-text2"
                  >
                    {canProgress ? (
                      <button
                        type="button"
                        className="btn btn-outline operations-text3"
                        title="Aprobar directamente y liberar habitación en 1 clic"
                        onClick={() => expressApprove(selected)}
                        disabled={Boolean(busyAction || commandRequest.retryBlocked)}
                        aria-busy={busyAction === "approve"}
                      >
                        ⚡ Liberación Exprés (1 Clic)
                      </button>
                    ) : null}

                    {canProgress ? (
                      <button
                        className="btn btn-primary operations-text4"
                        type="button"
                        onClick={advance}
                        disabled={Boolean(busyAction || commandRequest.retryBlocked)}
                        aria-busy={busyAction === "advance"}
                      >
                        {busyAction === "advance"
                          ? "Procesando..."
                          : selected.status === "Pendiente"
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
                    className="operations-text5"
                  >
                    <summary
                      className="operations-text6"
                    >
                      ⚠️ Reportar Incidencia Bloqueante (opcional si la
                      habitación presenta daños)
                    </summary>
                    <div
                      className="operations-text7"
                    >
                      <textarea
                        rows={2}
                        value={form.incidentDescription}
                        disabled={Boolean(busyAction)}
                        placeholder="Describa la falla o daño (ej: Fuga de agua en lavatorio o cortina dañada)..."
                        onChange={(event) =>
                          setForm({
                            ...form,
                            incidentDescription: event.target.value,
                          })
                        }
                      />
                      <button
                        className="btn btn-danger operations-text8"
                        type="button"
                        onClick={incident}
                        disabled={Boolean(busyAction)}
                        aria-busy={busyAction === "incident"}
                      >
                        {busyAction === "incident" ? "Creando..." : "Crear Incidencia Bloqueante"}
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
        onClose={() => {
          if (!busyAction) setShowGenerator(false);
        }}
        title="Generar Ticket de Limpieza"
      >
        <div className="form-grid">
          <label className="span-2">
            Habitación
            <select
              value={ticketForm.roomId}
              disabled={Boolean(busyAction || commandRequest.retryBlocked)}
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
              disabled={Boolean(busyAction || commandRequest.retryBlocked)}
              onChange={(event) =>
                setTicketForm({ ...ticketForm, reason: event.target.value })
              }
            />
          </label>
          <label className="span-2">
            Responsable Asignado (Opcional)
            <select
              value={ticketForm.assignedStaffId}
              disabled={Boolean(busyAction || commandRequest.retryBlocked)}
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
              disabled={Boolean(busyAction || commandRequest.retryBlocked)}
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
              disabled={Boolean(busyAction)}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={generateTicket}
              disabled={Boolean(busyAction)}
              aria-busy={busyAction === "generate"}
            >
              {busyAction === "generate" ? "Generando..." : "Generar Ticket"}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
