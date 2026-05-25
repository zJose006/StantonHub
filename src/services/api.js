const apiBaseUrl = '';
const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

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
  if (!isLocalHost) return requestStaticJson('/static-api/state.json');
  try {
    return await requestJson('/api/state');
  } catch {
    return requestStaticJson('/static-api/state.json');
  }
}

async function requestStaticJson(path) {
  const response = await fetch(path, { headers: { Accept: 'application/json' } });
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || !contentType.includes('application/json')) throw new Error('No existe el JSON estatico de produccion.');
  return response.json();
}

/** Carga catalogo desde backend local o desde el snapshot estatico preparado para IONOS. */
export async function loadVehiclesCatalog() {
  if (!isLocalHost) {
    const payload = await requestStaticJson('/static-api/vehicles.json');
    return { ...payload, source: payload.source || 'Snapshot estatico de produccion' };
  }
  try {
    return await requestJson('/api/vehicles');
  } catch (error) {
    const payload = await requestStaticJson('/static-api/vehicles.json');
    return { ...payload, source: payload.source || 'Snapshot estatico de produccion' };
  }
}

/** Carga detalle de nave desde backend local o snapshot estatico preparado para IONOS. */
export async function loadVehicleDetail(identifier) {
  if (!isLocalHost) return requestStaticJson('/static-api/vehicles/' + encodeURIComponent(identifier) + '.json');
  try {
    return await requestJson('/api/vehicles/' + encodeURIComponent(identifier));
  } catch (error) {
    return requestStaticJson('/static-api/vehicles/' + encodeURIComponent(identifier) + '.json');
  }
}
