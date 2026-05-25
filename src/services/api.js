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
