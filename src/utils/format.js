/** Devuelve iniciales cortas para avatares sin imagen. */
export function initials(name) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'SC'; }

/** Formatea creditos o precios en moneda visible. */
export function money(value, currency = 'aUEC') { if (!value) return 'N/D'; return new Intl.NumberFormat('es-ES').format(Math.round(value)) + ' ' + textValue(currency, 'aUEC'); }

/** Formatea medidas de longitud en metros. */
export function meters(value) { if (!value) return 'N/D'; return Number(value).toLocaleString('es-ES') + ' m'; }

/** Elimina duplicados y ordena textos para selectores. */
export function uniqueSorted(values) { return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'es')); }

/** Genera un slug estable para rutas legibles. */
export function slugify(value) { return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'nave'; }

export function textValue(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return textValue(value.find(Boolean), fallback);
  if (typeof value === 'object') return textValue(value.en_EN ?? value.en_US ?? value.en ?? value.name ?? Object.values(value).find((item) => typeof item === 'string'), fallback);
  return fallback;
}
