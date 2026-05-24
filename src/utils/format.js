/** Devuelve iniciales cortas para avatares sin imagen. */
export function initials(name) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'SC'; }

/** Formatea creditos o precios en moneda visible. */
export function money(value, currency = 'aUEC') { if (!value) return 'N/D'; return new Intl.NumberFormat('es-ES').format(Math.round(value)) + ' ' + currency; }

/** Formatea medidas de longitud en metros. */
export function meters(value) { if (!value) return 'N/D'; return Number(value).toLocaleString('es-ES') + ' m'; }

/** Elimina duplicados y ordena textos para selectores. */
export function uniqueSorted(values) { return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'es')); }

/** Genera un slug estable para rutas legibles. */
export function slugify(value) { return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'nave'; }
