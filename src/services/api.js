const apiBaseUrl = '';

/** Ejecuta una peticion JSON contra el backend local y normaliza errores. */
export async function requestJson(url, options = {}) {
  const response = await fetch(apiBaseUrl + url, { headers: { 'Content-Type': 'application/json' }, ...options });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'No se pudo completar la accion.');
  return payload;
}

/** Carga el estado publico y la sesion actual de la web. */
export function loadState() { return requestJson('/api/state'); }
