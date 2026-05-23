/** Comprueba si una nave encaja con el buscador y filtros activos. */
export function shipMatches(ship, filters) {
  const query = filters.search.trim().toLowerCase();
  const haystack = [ship.name, ship.shortName, ship.manufacturer, ship.tags?.join(' ')].join(' ').toLowerCase();
  return isCatalogVehicle(ship) && (!query || haystack.includes(query)) && (!filters.manufacturer || ship.manufacturer === filters.manufacturer) && (!filters.role || ship.tags?.includes(filters.role)) && (!filters.type || Boolean(ship.flags?.[filters.type]));
}

/** Evita pintar addons, modulos, puertos o piezas que UEX pueda devolver mezclados con vehiculos. */
export function isCatalogVehicle(ship) {
  const flags = ship.flags || {};
  const hasVehicleFlag = Boolean(flags.spaceship || flags.ground);
  const isExcludedObject = Boolean(flags.addon || flags.docking || flags.loadingDock);
  return hasVehicleFlag && !isExcludedObject && Number(ship.length || 0) > 0;
}

/** Ordena naves y deja siempre los concepts al final del catalogo. */
export function sortShips(ships, mode) {
  const sorted = [...ships];
  const conceptLast = (a, b) => Number(Boolean(a.flags?.concept)) - Number(Boolean(b.flags?.concept));
  const withConceptsLast = (comparator) => sorted.sort((a, b) => conceptLast(a, b) || comparator(a, b));
  const ascendingPrice = (selector) => withConceptsLast((a, b) => (selector(a) || Number.MAX_SAFE_INTEGER) - (selector(b) || Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, 'es'));
  const sizeRank = (ship) => { const normalizedSize = String(ship.padType || '').trim().toUpperCase(); const knownSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL']; const rank = knownSizes.indexOf(normalizedSize); return rank === -1 ? Number.MAX_SAFE_INTEGER : rank; };
  if (mode === 'pledge') return ascendingPrice((ship) => ship.pledge?.price);
  if (mode === 'purchase') return ascendingPrice((ship) => ship.purchase?.price);
  if (mode === 'rental') return ascendingPrice((ship) => ship.rental?.price);
  if (mode === 'cargo') return withConceptsLast((a, b) => b.scu - a.scu || b.length - a.length || a.name.localeCompare(b.name, 'es'));
  if (mode === 'name') return withConceptsLast((a, b) => a.name.localeCompare(b.name, 'es'));
  return withConceptsLast((a, b) => sizeRank(a) - sizeRank(b) || a.length - b.length || a.scu - b.scu || a.name.localeCompare(b.name, 'es'));
}
