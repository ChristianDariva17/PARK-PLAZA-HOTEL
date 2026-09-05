import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  Building2,
  Check,
  CreditCard,
  IdCard,
  Mail,
  Phone,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { Dialog } from '../../components/ui/Overlay.jsx';
import { staffClient } from '../../staff/staffClient.js';

const DEPARTMENTS = [
  'Recepción y Reservas',
  'Housekeeping / Limpieza',
  'Alimentos y Bebidas (Cocina/Bar)',
  'Mantenimiento y Servicios',
  'Administración y Finanzas',
  'Seguridad y Accesos',
  'Recreación y Spa',
];

export function StaffEditorModal({ staffId, onClose, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    documentNormalized: '',
    position: '',
    department: '',
    phone: '',
    email: '',
  });

  useEffect(() => {
    if (staffId) {
      setFetching(true);
      setError(null);
      staffClient.getStaffProfile(staffId)
        .then((data) => {
          setFormData({
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            documentNormalized: data.documentNormalized || '',
            position: data.position || '',
            department: data.department || '',
            phone: data.phone || '',
            email: data.email || '',
          });
        })
        .catch((err) => setError(err.message || 'Error al cargar perfil de personal'))
        .finally(() => setFetching(false));
    }
  }, [staffId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (staffId) {
        await staffClient.updateStaff(staffId, formData);
      } else {
        await staffClient.createStaff(formData);
      }
      onSaved();
    } catch (err) {
      setError(err.message || 'Error al guardar el colaborador.');
    } finally {
      setLoading(false);
    }
  };

  const initials = `${formData.firstName?.[0] || ''}${formData.lastName?.[0] || ''}`.toUpperCase() || 'HP';
  const fullName = `${formData.firstName || ''} ${formData.lastName || ''}`.trim() || 'Nombre del Colaborador';

  return (
    <Dialog
      open={true}
      onClose={onClose}
      title={staffId ? 'Editar Información del Personal' : 'Nuevo Registro de Personal'}
      description={staffId ? 'Actualizá los datos de contacto, departamento o cargo laboral.' : 'Registrá a un nuevo colaborador para la gestión de asistencia, turnos y operaciones.'}
      wide
    >
      {fetching ? (
        <div className="card route-loading" role="status" style={{ padding: '40px', textAlign: 'center' }}>
          Cargando datos del colaborador…
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="form-grid" style={{ gap: '18px' }}>
          {/* Live Preview Card */}
          <div className="staff-preview-card span-2">
            <div className="staff-preview-left">
              <div className="staff-preview-avatar">
                <span>{initials}</span>
              </div>
              <div className="staff-preview-info">
                <span className="staff-preview-kicker">
                  <Sparkles size={13} />
                  {staffId ? 'Ficha de Colaborador' : 'Vista Previa del Perfil'}
                </span>
                <h4>{fullName}</h4>
                <div className="staff-preview-tags">
                  <span className="staff-tag position">
                    <Briefcase size={12} />
                    {formData.position || 'Cargo sin definir'}
                  </span>
                  <span className="staff-tag department">
                    <Building2 size={12} />
                    {formData.department || 'Departamento no asignado'}
                  </span>
                  {formData.documentNormalized && (
                    <span className="staff-tag doc">
                      <IdCard size={12} />
                      {formData.documentNormalized}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="staff-preview-status">
              <span className="status-pill active">
                <span className="status-dot" />
                {staffId ? 'Activo' : 'Nuevo Ingreso'}
              </span>
            </div>
          </div>

          {error && (
            <div className="alert-banner alert-banner-danger span-2" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Personal Info */}
          <div className="span-2 form-section-divider">
            <span className="form-section-title">
              <User size={14} /> 1. Identificación y Datos Personales
            </span>
          </div>

          <label>
            <span>Nombres <strong style={{ color: 'var(--color-danger)' }}>*</strong></span>
            <div className="field-icon-wrap">
              <User size={16} />
              <input
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="Ej. Valeria Sofía"
                required
                disabled={loading}
                autoFocus
              />
            </div>
          </label>

          <label>
            <span>Apellidos <strong style={{ color: 'var(--color-danger)' }}>*</strong></span>
            <div className="field-icon-wrap">
              <User size={16} />
              <input
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Ej. Mendoza Castro"
                required
                disabled={loading}
              />
            </div>
          </label>

          <label className="span-2">
            <span>Documento de Identidad (DNI / Pasaporte / CE) <strong style={{ color: 'var(--color-danger)' }}>*</strong></span>
            <div className="field-icon-wrap">
              <CreditCard size={16} />
              <input
                name="documentNormalized"
                value={formData.documentNormalized}
                onChange={handleChange}
                placeholder="Ej. 70889901"
                required
                disabled={loading}
              />
            </div>
            <small style={{ color: 'var(--color-muted)', fontSize: '11px', marginTop: '2px' }}>
              Este documento se utiliza para el control de asistencia y verificación de identidad.
            </small>
          </label>

          {/* Section 2: Job Assignment */}
          <div className="span-2 form-section-divider">
            <span className="form-section-title">
              <Briefcase size={14} /> 2. Cargo y Asignación Operativa
            </span>
          </div>

          <label>
            <span>Cargo o Puesto</span>
            <div className="field-icon-wrap">
              <Briefcase size={16} />
              <input
                name="position"
                value={formData.position}
                onChange={handleChange}
                placeholder="Ej. Recepcionista Principal"
                disabled={loading}
              />
            </div>
          </label>

          <label>
            <span>Departamento</span>
            <div className="field-icon-wrap">
              <Building2 size={16} />
              <input
                list="department-options"
                name="department"
                value={formData.department}
                onChange={handleChange}
                placeholder="Seleccioná o escribí el departamento"
                disabled={loading}
              />
              <datalist id="department-options">
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept} />
                ))}
              </datalist>
            </div>
          </label>

          {/* Section 3: Contact */}
          <div className="span-2 form-section-divider">
            <span className="form-section-title">
              <Phone size={14} /> 3. Información de Contacto
            </span>
          </div>

          <label>
            <span>Teléfono / WhatsApp</span>
            <div className="field-icon-wrap">
              <Phone size={16} />
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Ej. +51 987 654 321"
                disabled={loading}
              />
            </div>
          </label>

          <label>
            <span>Correo Electrónico</span>
            <div className="field-icon-wrap">
              <Mail size={16} />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="colaborador@hotelparkplaza.com"
                disabled={loading}
              />
            </div>
          </label>

          {/* Form Actions */}
          <div className="form-actions span-2" style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={loading}
            >
              <X size={16} /> Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>Guardando personal…</>
              ) : (
                <>
                  <Check size={16} /> {staffId ? 'Guardar Cambios' : 'Registrar Colaborador'}
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
