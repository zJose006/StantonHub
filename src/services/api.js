const apiBaseUrl = '';

/** Ejecuta una peticion JSON contra el backend local y normaliza errores. */
export async function requestJson(url, options = {}) {
  const response = await fetch(apiBaseUrl + url, { headers: { 'Content-Type': 'application/json' }, ...options });
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(text.trim().startsWith('<!doctype') || text.trim().startsWith('<html') ? 'La ruta devolvio HTML en vez de JSON.' : 'La ruta no devolvio JSON valido.');
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error('La ruta no devolvio JSON valido.');
  }
  if (!response.ok) throw new Error(payload.error || 'No se pudo completar la accion.');
  return payload;
}

/** Carga el estado publico y la sesion actual de la web. */
export async function loadState() {
  return requestJson('/api/state');
}

/** Carga catalogo desde el backend de Stanton Hub. */
export async function loadVehiclesCatalog() {
  return requestJson('/api/vehicles');
}

/** Carga detalle de nave desde el backend de Stanton Hub. */
export async function loadVehicleDetail(identifier) {
  return requestJson('/api/vehicles/' + encodeURIComponent(identifier));
}

/** Carga el catalogo de componentes preparado desde las fichas de naves. */
export async function loadComponentCatalog() {
  return requestJson('/api/components/catalog');
}

/** Carga una ficha individual de componente. */
export async function loadComponentDetail(identifier) {
  const catalog = await loadComponentCatalog();
  const components = Array.isArray(catalog.components) ? catalog.components : [];
  const decoded = decodeComponentIdentifier(identifier);
  const normalized = normalizeComponentToken(decoded);
  const component = components.find((item) => item.key === decoded)
    || components.find((item) => normalizeComponentToken(item.key) === normalized)
    || components.find((item) => normalizeComponentToken(item.name) === normalized);

  if (!component) throw new Error('Componente no encontrado en el catalogo local.');

  const vehicleLookup = await buildVehicleLookup();
  const related = (component.examples || []).map((example) => {
    const vehicleName = example.vehicle || '';
    const matchedVehicle = vehicleLookup.get(normalizeComponentToken(vehicleName));
    return {
    ...example,
    vehicleId: example.vehicleId || matchedVehicle?.id || '',
    vehicle: vehicleName || matchedVehicle?.name || '',
    count: Number(example.count || 1),
    size: Number(example.size || component.size || 0) || null
    };
  });
  const sameFamily = components
    .filter((item) => item.key !== component.key && item.category === component.category && normalizeComponentToken(item.name) === normalizeComponentToken(component.name))
    .slice(0, 12);

  return {
    source: 'Catalogo local de componentes',
    generatedAt: catalog.generatedAt || '',
    component,
    related,
    sameFamily
  };
}

function decodeComponentIdentifier(identifier) {
  const raw = decodeURIComponent(String(identifier || '')).trim();
  if (!raw) return '';
  if (raw.includes('|')) return raw;
  try {
    const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return decodeURIComponent(escape(atob(padded))) || raw;
  } catch {
    return raw;
  }
}

function normalizeComponentToken(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function buildVehicleLookup() {
  try {
    const payload = await loadVehiclesCatalog();
    return new Map((payload.vehicles || []).map((vehicle) => [normalizeComponentToken(vehicle.name), vehicle]));
  } catch {
    return new Map();
  }
}
