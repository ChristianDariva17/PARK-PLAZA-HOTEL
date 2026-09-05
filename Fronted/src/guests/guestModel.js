export const GUEST_DOCUMENT_TYPES = Object.freeze({
  dni: 'DNI',
  passport: 'Pasaporte',
  foreign_id: 'Carnet de extranjería',
  other: 'Otro',
});

export const GUEST_STATUS_LABELS = Object.freeze({ active: 'Activo', archived: 'Archivado' });

const GUEST_FIELDS = ['firstName', 'lastName', 'nationality', 'email', 'phone', 'address', 'emergencyContact', 'notes'];
const NULLABLE_FIELDS = new Set(['nationality', 'email', 'phone', 'address', 'emergencyContact', 'notes']);
const LOCAL_DEFAULTS = Object.freeze({
  visits: 0,
  totalSpent: 0,
  petIds: Object.freeze([]),
  preferences: Object.freeze([]),
});

const trimmed = (value) => typeof value === 'string' ? value.trim() : '';
const nullableText = (value) => trimmed(value) || null;
const countryCode = (value, required = false) => {
  const normalized = trimmed(value).toUpperCase();
  if (!normalized && !required) return null;
  if (!/^[A-Z]{2}$/.test(normalized)) throw new Error('Use códigos de país ISO de dos letras.');
  return normalized;
};

function requiredText(value, label) {
  const normalized = trimmed(value);
  if (!normalized) throw new Error(`${label} es obligatorio.`);
  return normalized;
}

function normalizeDocument(document) {
  const type = document?.type;
  if (!Object.hasOwn(GUEST_DOCUMENT_TYPES, type)) throw new Error('Seleccione un tipo de documento válido.');
  return {
    type,
    issuingCountry: type === 'dni' || type === 'foreign_id' ? 'PE' : countryCode(document.issuingCountry, true),
    documentNumber: requiredText(document.documentNumber, 'El número de documento').toUpperCase(),
  };
}

function normalizeGuestFields(input, documentType) {
  const fields = {
    firstName: requiredText(input.firstName, 'Los nombres'),
    lastName: requiredText(input.lastName, 'Los apellidos'),
    nationality: documentType === 'passport' ? countryCode(input.nationality, true) : null,
    email: nullableText(input.email)?.toLowerCase() ?? null,
    phone: nullableText(input.phone),
    address: nullableText(input.address),
    emergencyContact: nullableText(input.emergencyContact),
    notes: nullableText(input.notes),
  };
  if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) throw new Error('Ingrese un correo válido o déjelo vacío.');
  return fields;
}

export function adaptGuestResponse(response, localGuest = {}) {
  const document = response.primaryDocument;
  return {
    id: response.id,
    firstName: response.firstName,
    lastName: response.lastName,
    name: `${response.firstName} ${response.lastName}`.trim(),
    birthDate: response.birthDate ?? '',
    nationality: response.nationality ?? '',
    email: response.email ?? '',
    phone: response.phone ?? '',
    address: response.address ?? '',
    emergencyContact: response.emergencyContact ?? '',
    notes: response.notes ?? '',
    status: GUEST_STATUS_LABELS[response.status] || response.status,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
    primaryDocument: { ...document },
    documentType: GUEST_DOCUMENT_TYPES[document.type] || document.type,
    documentNumber: document.documentNumber,
    issuingCountry: document.issuingCountry,
    documentExpiresOn: document.expiresOn ?? '',
    visits: localGuest.visits ?? LOCAL_DEFAULTS.visits,
    totalSpent: localGuest.totalSpent ?? LOCAL_DEFAULTS.totalSpent,
    petIds: localGuest.petIds ?? [],
    preferences: localGuest.preferences ?? [],
    ...(localGuest.biometric ? { biometric: localGuest.biometric } : {}),
  };
}

export function buildGuestCreateDto(input) {
  const primaryDocument = normalizeDocument(input.primaryDocument);
  return {
    ...normalizeGuestFields(input, primaryDocument.type),
    primaryDocument,
  };
}

export function buildGuestPatchDto(current, input) {
  const document = normalizeDocument(input.primaryDocument);
  const candidate = normalizeGuestFields(input, document.type);
  const patch = {};
  for (const field of GUEST_FIELDS) {
    const currentValue = NULLABLE_FIELDS.has(field) ? (current[field] || null) : current[field];
    if (candidate[field] !== currentValue) patch[field] = candidate[field];
  }

  const currentDocument = current.primaryDocument;
  if (document.type !== currentDocument.type
    || document.issuingCountry !== currentDocument.issuingCountry
    || document.documentNumber !== currentDocument.documentNumber) {
    patch.primaryDocument = document;
  }

  return Object.keys(patch).length ? patch : null;
}
