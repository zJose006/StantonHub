import React, { useEffect, useMemo, useState } from 'react';
import { loadVehiclesCatalog, requestJson } from '../services/api.js';
import { money, meters, slugify, textValue, uniqueSorted } from '../utils/format.js';
import { can } from '../utils/permissions.js';
import { isCatalogVehicle, shipMatches, sortShips } from '../utils/ships.js';
import { routes } from '../config/routes.js';
import { routeClick } from '../utils/navigation.js';

const pageSizeOptions = [20, 40, 80, 120];
const shipsStateKey = 'stantonHubShipsState';
const shipsScrollKey = 'stantonHubShipsScroll';
const defaultFilters = { search: '', manufacturer: '', type: '', role: '', sort: '' };

/** Pagina de catalogo de naves con filtros, paginacion y sincronizacion protegida. */
export function ShipsPage({ currentUser, navigate }) {
  const [ships, setShips] = useState([]);
  const [status, setStatus] = useState('Cargando catalogo local...');
  const [syncing, setSyncing] = useState(false);
  const initialCatalogState = readShipsState();
  const [page, setPage] = useState(initialCatalogState.page);
  const [pageSize, setPageSize] = useState(initialCatalogState.pageSize);
  const [filters, setFilters] = useState(initialCatalogState.filters);

  useEffect(() => {
    loadVehiclesCatalog()
      .then((payload) => {
        setShips((payload.vehicles || []).filter(isCatalogVehicle));
        setStatus(payload.warnings?.length ? 'Naves cargadas desde ' + payload.source + '. Algunos precios no estan disponibles temporalmente.' : 'Datos cargados desde ' + payload.source + '.');
      })
      .catch((error) => setStatus(error.message.includes('EACCES') ? 'No se pudo acceder a UEX desde este entorno. Abre la web con npm run dev desde tu terminal local.' : 'No se pudo cargar el catalogo: ' + error.message));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filters, pageSize]);

  useEffect(() => {
    window.sessionStorage?.setItem(shipsStateKey, JSON.stringify({ page, pageSize, filters }));
  }, [page, pageSize, filters]);

  useEffect(() => {
    const scrollY = Number(window.sessionStorage?.getItem(shipsScrollKey) || 0);
    if (scrollY > 0) {
      window.requestAnimationFrame(() => window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' }));
      window.sessionStorage.removeItem(shipsScrollKey);
    }
  }, []);

  async function syncVehicles() {
    setSyncing(true);
    setStatus('Sincronizando precios y datos tecnicos con la base de datos local...');
    try {
      const payload = await requestJson('/api/vehicles/sync', { method: 'POST' });
      setShips((payload.vehicles || []).filter(isCatalogVehicle));
      setStatus(payload.warnings?.length ? 'Base de datos actualizada. Algunas naves no tienen detalles completos.' : 'Base de datos actualizada con precios y datos tecnicos.');
    } catch (error) {
      setStatus('No se pudo sincronizar el catalogo: ' + error.message);
    } finally {
      setSyncing(false);
    }
  }

  const catalogShips = ships.filter(isCatalogVehicle);
  const manufacturers = uniqueSorted(catalogShips.map((ship) => textValue(ship.manufacturer)).filter(Boolean));
  const roles = uniqueSorted(catalogShips.flatMap((ship) => ship.tags || []).map((tag) => textValue(tag)).filter(Boolean));
  const filteredShips = useMemo(() => sortShips(catalogShips.filter((ship) => shipMatches(ship, filters)), filters.sort), [catalogShips, filters]);
  const totalPages = Math.max(1, Math.ceil(filteredShips.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedShips = filteredShips.slice((safePage - 1) * pageSize, safePage * pageSize);
  const rangeStart = filteredShips.length ? (safePage - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(safePage * pageSize, filteredShips.length);

  return (
    <main className="container ships-shell">
      <section className="ships-toolbar panel">
        <div className="ships-toolbar-header">
          <div><span className="section-label">Busqueda</span><h2>Filtra el catalogo</h2><p>{status}</p></div>
          <div className="ships-toolbar-actions">
            <span className="ships-count">{ships.length ? `${rangeStart}-${rangeEnd} / ${filteredShips.length}` : 'Cargando...'}</span>
            {can(currentUser, 'ships.sync') && <button className="action-btn" type="button" onClick={syncVehicles} disabled={syncing}>{syncing ? 'Sincronizando...' : 'Sincronizar datos'}</button>}
          </div>
        </div>

        <div className="ships-controls">
          <ShipInput label="Buscar" value={filters.search} onChange={(value) => setFilters({ ...filters, search: value })} />
          <ShipSelect label="Fabricante" value={filters.manufacturer} values={manufacturers} onChange={(value) => setFilters({ ...filters, manufacturer: value })} />
          <ShipSelect label="Tipo" value={filters.type} values={[[ 'spaceship','Naves'],['ground','Terrestres'],['quantum','Quantum'],['concept','Concept']]} onChange={(value) => setFilters({ ...filters, type: value })} />
          <ShipSelect label="Rol" value={filters.role} values={roles} onChange={(value) => setFilters({ ...filters, role: value })} />
          <ShipSelect label="Orden" value={filters.sort} values={[[ '', 'Todos'], ['size','Tamano de pad'],['name','Nombre'],['pledge','Precio pledge'],['purchase','Compra in-game'],['rental','Alquiler'],['cargo','SCU']]} onChange={(value) => setFilters({ ...filters, sort: value })} hideDefault />
          <ShipSelect label="Por pagina" value={String(pageSize)} values={pageSizeOptions.map((value) => [String(value), String(value)])} onChange={(value) => setPageSize(Number(value))} hideDefault />
        </div>
      </section>

      <section className={`ships-status ${filteredShips.length ? 'hidden' : ''}`}>{filteredShips.length ? '' : status}</section>
      <section className={`ships-grid ${pagedShips.length <= 2 ? 'ships-grid-compact' : ''}`}>{pagedShips.map((ship) => <ShipCard key={ship.id} ship={ship} navigate={navigate} />)}</section>
      <Pagination page={safePage} totalPages={totalPages} setPage={setPage} totalItems={filteredShips.length} />
    </main>
  );
}

function readShipsState() {
  try {
    const stored = JSON.parse(window.sessionStorage?.getItem(shipsStateKey) || '{}');
    return {
      page: Number(stored.page || 1),
      pageSize: pageSizeOptions.includes(Number(stored.pageSize)) ? Number(stored.pageSize) : 20,
      filters: { ...defaultFilters, ...(stored.filters || {}) }
    };
  } catch {
    return { page: 1, pageSize: 20, filters: defaultFilters };
  }
}

/** Campo de busqueda del catalogo. */
function ShipInput({ label, value, onChange }) {
  return <label>{label}<input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Nombre, fabricante, rol..." /></label>;
}

/** Selector reutilizable para filtros del catalogo. */
function ShipSelect({ label, value, values, onChange, hideDefault = false }) {
  return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}>{!hideDefault && <option value="">Todos</option>}{values.map((item) => { const optionValue = Array.isArray(item) ? item[0] : item; const optionLabel = Array.isArray(item) ? item[1] : item; return <option key={optionValue} value={optionValue}>{optionLabel}</option>; })}</select></label>;
}

/** Controles de paginacion del catalogo. */
function Pagination({ page, totalPages, setPage, totalItems }) {
  if (!totalItems || totalPages <= 1) return null;
  const pages = paginationRange(page, totalPages);
  return (
    <nav className="ships-pagination" aria-label="Paginacion de naves">
      <button type="button" onClick={() => setPage(1)} disabled={page === 1}>Primera</button>
      <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>Anterior</button>
      <div className="ships-page-numbers">
        {pages.map((item, index) => item === '...'
          ? <span className="ships-page-ellipsis" key={item + index}>...</span>
          : <button className={item === page ? 'is-active' : ''} type="button" key={item} onClick={() => setPage(item)} aria-current={item === page ? 'page' : undefined}>{item}</button>)}
      </div>
      <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page === totalPages}>Siguiente</button>
      <button type="button" onClick={() => setPage(totalPages)} disabled={page === totalPages}>Ultima</button>
    </nav>
  );
}

function paginationRange(page, totalPages) {
  if (totalPages <= 9) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set([1, totalPages, page, page - 1, page + 1, page - 2, page + 2].filter((value) => value >= 1 && value <= totalPages));
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((value, index) => index && value - sorted[index - 1] > 1 ? ['...', value] : [value]);
}

/** Tarjeta visual de una nave, con fallback de imagen. */
function ShipCard({ ship, navigate }) {
  const [imageIndex, setImageIndex] = useState(0);
  const rawImages = ship.imageCandidates?.length ? ship.imageCandidates : [ship.photo, ship.wikiImageProxy].filter(Boolean);
  const images = rawImages;
  const currentImage = images[imageIndex];
  const shipName = textValue(ship.name, 'Nave sin nombre');
  const detailPath = `${routes.ships}/${ship.id}-${slugify(shipName)}`;
  return <article className="ship-card"><a className="ship-card-link" href={detailPath} onClick={(event) => { window.sessionStorage?.setItem(shipsScrollKey, String(window.scrollY)); routeClick(event, detailPath, navigate); }}><div className="ship-image">{currentImage ? <img src={currentImage} width="1600" height="900" alt={shipName} loading="lazy" onError={() => setImageIndex((index) => index + 1)} /> : <div className="ship-image-placeholder">SC</div>}</div><div className="ship-card-body"><div className="ship-title-row"><div><span>{textValue(ship.manufacturer, 'Fabricante desconocido')}</span><h3>{shipName}</h3></div><strong>{textValue(ship.padType, 'N/D')}</strong></div><div className="ship-tags">{ship.tags?.slice(0, 4).map((tag) => <span key={textValue(tag)}>{textValue(tag)}</span>) || <span>Sin rol</span>}</div><dl className="ship-specs"><div><dt>Pledge</dt><dd>{money(ship.pledge?.price, ship.pledge?.currency || 'USD')}</dd></div><div><dt>Compra</dt><dd>{money(ship.purchase?.price)}</dd></div><div><dt>Alquiler</dt><dd>{money(ship.rental?.price)}</dd></div><div><dt>Carga</dt><dd>{ship.scu ? ship.scu + ' SCU' : 'N/D'}</dd></div><div><dt>Tripulacion</dt><dd>{textValue(ship.crew, 'N/D')}</dd></div><div><dt>Longitud</dt><dd>{meters(ship.length)}</dd></div></dl><div className="ship-locations"><strong>Compra:</strong><span>{ship.purchase?.locations?.length ? ship.purchase.locations.map((item) => textValue(item)).join(', ') : 'Sin terminal conocido'}</span></div><div className="ship-locations"><strong>Alquiler:</strong><span>{ship.rental?.locations?.length ? ship.rental.locations.map((item) => textValue(item)).join(', ') : 'Sin terminal conocido'}</span></div><span className="ship-link">Ver ficha completa</span></div></a></article>;
}
