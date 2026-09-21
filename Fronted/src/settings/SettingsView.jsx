import { useEffect, useState } from 'react';
import { getSettings } from '../auth/settingsClient';
import { AlertTriangle } from 'lucide-react';
import { useHotel } from '../state/hotelContext';
import { MetricStrip, PageHeader, SectionHeader, StatusBadge } from '../components/views/SharedViewParts';

export function SettingsView() {
  const { state } = useHotel();
  const [dbSettings, setDbSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState(null);
  const [settingsReload, setSettingsReload] = useState(0);
  useEffect(() => {
    let active = true;
    setSettingsLoading(true);
    setSettingsError(null);
    getSettings()
      .then((res) => {
        if (active) {
          setDbSettings(res);
          setSettingsLoading(false);
        }
      })
      .catch((error) => {
        if (active) {
          setSettingsError(error.message || "No se pudo cargar la configuración.");
          setSettingsLoading(false);
        }
      });
    return () => { active = false; };
  }, [settingsReload]);
  const groups = [
    { name: "Mensajería", ids: ["INT-MSG"] },
    { name: "Fiscal", ids: ["INT-FISCAL"] },
    { name: "Hardware", ids: ["INT-POOL"] },
    { name: "Seguridad", ids: ["INT-AUTH"] },
    { name: "Almacenamiento", ids: ["INT-BACKUP"] },
  ];
  const pending = state.integrations.filter((item) =>
    item.status.includes("Pendiente"),
  ).length;
  const unconfigured = state.integrations.filter((item) =>
    item.status.includes("No configurado"),
  ).length;
  const floors = [...new Set(state.rooms.map((room) => room.floor))].toSorted(
    (left, right) => left - right,
  );
  return (
    <div className="view-container">
      <PageHeader
        metadata="Referencia operativa conectada"
        title="Configuración"
        description="Integraciones agrupadas y parámetros visibles del inventario persistente."
      />
      <MetricStrip
        items={[
          { label: "Integraciones", value: state.integrations.length },
          { label: "Pendientes", value: pending },
          { label: "No configuradas", value: unconfigured },
          { label: "Operativas externas", value: 0 },
        ]}
      />
      <section className="settings-hero">
        <div>
          <span className="eyebrow">Hotel Park Plaza</span>
          <h3>Parámetros de la propiedad</h3>
          <p>
            {state.rooms.length} habitaciones · {floors.length} piso(s) · moneda{" "}
            {dbSettings?.currency || "PEN"} · capacidad piscina{" "}
            {state.poolCapacity}
          </p>
        </div>
        <StatusBadge>
          {settingsLoading ? "Cargando Backend..." : settingsError ? "Backend no disponible" : "Conectado al Backend"}
        </StatusBadge>
      </section>
      {settingsError && (
        <div className="alert-banner alert-banner-danger" role="alert">
          <span>{settingsError}</span>
          <button className="btn btn-outline" type="button" onClick={() => setSettingsReload((value) => value + 1)}>
            Reintentar
          </button>
        </div>
      )}
      <div className="settings-groups">
        {groups.map((group) => (
          <section key={group.name} aria-labelledby={`settings-${group.name}`}>
            <SectionHeader
              id={`settings-${group.name}`}
              eyebrow="Integraciones"
              title={group.name}
            />
            <div className="integration-grid">
              {state.integrations
                .filter((item) => group.ids.includes(item.id))
                .map((item) => (
                  <article className="card integration-card" key={item.id}>
                    <div className="row-between">
                      <div className="integration-icon">
                        <AlertTriangle size={20} aria-hidden="true" />
                      </div>
                      <StatusBadge>{item.status}</StatusBadge>
                    </div>
                    <h3>{item.name}</h3>
                    <p>{item.detail}</p>
                    <button className="btn btn-outline" disabled>
                      Configuración no disponible
                    </button>
                  </article>
                ))}
            </div>
          </section>
        ))}
      </div>
      <section className="card">
        <SectionHeader
          eyebrow="Valores actuales"
          title="Referencia del dominio"
          description="El inventario y configuración base proviene del backend."
        />
        <div className="reference-groups">
          <article>
            <strong>Hotel</strong>
            <span>
              {state.rooms.length} habitaciones ·{" "}
              {floors.length
                ? `pisos ${floors.join(", ")}`
                : "sin pisos provisionados"}{" "}
              · {dbSettings?.currency || "PEN"}
            </span>
          </article>
          <article>
            <strong>Categorías</strong>
            <span>
              {state.roomCategories.length
                ? state.roomCategories
                    .map((category) => category.name)
                    .join(", ")
                : "Sin categorías provisionadas"}
            </span>
          </article>
          <article>
            <strong>Day Use</strong>
            <span>
              De {dbSettings?.dayUseStart || "09:00"} a{" "}
              {dbSettings?.dayUseEnd || "18:00"}
            </span>
          </article>
          <article>
            <strong>Intervalo Reservas</strong>
            <span>{dbSettings?.reservationIntervalMinutes || 30} min</span>
          </article>
        </div>
      </section>
    </div>
  );
}
