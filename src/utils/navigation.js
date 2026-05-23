import { legacyRouteMap, pageMap, routes } from '../config/routes.js';

/** Normaliza rutas antiguas o alias como registro hacia la ruta React actual. */
export function normalizeRoute(path) { if (path === routes.register) return routes.login; return legacyRouteMap[path] || path.replace(/\.html$/, ''); }

/** Obtiene la pagina interna a partir de la URL actual del navegador. */
export function getCurrentPage() { return pageMap[normalizeRoute(window.location.pathname)] || 'home'; }

/** Navega sin recargar la pagina, manteniendo el router casero de la app. */
export function routeClick(event, path, navigate) { event.preventDefault(); navigate(path); }
