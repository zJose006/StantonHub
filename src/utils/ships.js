import { textValue } from './format.js';

/** Comprueba si una nave encaja con el buscador y filtros activos. */
export function shipMatches(ship, filters) {
  const query = filters.search.trim().toLowerCase();
  const tags = (ship.tags || []).map((tag) => textValue(tag));
  const haystack = [ship.name, ship.shortName, ship.manufacturer, tags.join(' ')].map((value) => textValue(value)).join(' ').toLowerCase();
  return isCatalogVehicle(ship) && (!query || haystack.includes(query)) && (!filters.manufacturer || textValue(ship.manufacturer) === filters.manufacturer) && (!filters.role || tags.includes(filters.role)) && (!filters.type || Boolean(ship.flags?.[filters.type]));
}

/** Evita pintar addons, modulos, puertos o piezas que UEX pueda devolver mezclados con vehiculos. */
export function isCatalogVehicle(ship) {
  const flags = ship.flags || {};
  const hasVehicleFlag = Boolean(flags.spaceship || flags.ground);
  const isExcludedObject = Boolean(flags.addon || flags.docking || flags.loadingDock);
  return hasVehicleFlag && !isExcludedObject && (Number(ship.length || 0) > 0 || Boolean(flags.wikiSupplement));
}

/** Ordena naves y deja siempre los concepts al final del catalogo. */
export function sortShips(ships, mode) {
  const sorted = [...ships];
  if (!mode) return sorted;
  const conceptLast = (a, b) => Number(Boolean(a.flags?.concept)) - Number(Boolean(b.flags?.concept));
  const withConceptsLast = (comparator) => sorted.sort((a, b) => conceptLast(a, b) || comparator(a, b));
  const nameSort = (a, b) => textValue(a.name).localeCompare(textValue(b.name), 'es');
  const ascendingPrice = (selector) => withConceptsLast((a, b) => (selector(a) || Number.MAX_SAFE_INTEGER) - (selector(b) || Number.MAX_SAFE_INTEGER) || nameSort(a, b));
  const sizeRank = (ship) => { const normalizedSize = textValue(ship.padType).trim().toUpperCase(); const knownSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL']; const rank = knownSizes.indexOf(normalizedSize); return rank === -1 ? Number.MAX_SAFE_INTEGER : rank; };
  if (mode === 'pledge') return ascendingPrice((ship) => ship.pledge?.price);
  if (mode === 'purchase') return ascendingPrice((ship) => ship.purchase?.price);
  if (mode === 'rental') return ascendingPrice((ship) => ship.rental?.price);
  if (mode === 'cargo') return withConceptsLast((a, b) => b.scu - a.scu || b.length - a.length || nameSort(a, b));
  if (mode === 'name') return withConceptsLast(nameSort);
  if (mode === 'size') return withConceptsLast((a, b) => sizeRank(a) - sizeRank(b) || nameSort(a, b));
  return sorted;
}
