const shipsGrid = document.getElementById('ships-grid');
const shipsStatus = document.getElementById('ships-status');
const shipsCount = document.getElementById('ships-count');
const searchInput = document.getElementById('ship-search');
const manufacturerSelect = document.getElementById('ship-manufacturer');
const typeSelect = document.getElementById('ship-type');
const roleSelect = document.getElementById('ship-role');
const sortSelect = document.getElementById('ship-sort');

let allShips = [];

function money(value, currency = 'aUEC') {
  if (!value) return 'N/D';
  return `${new Intl.NumberFormat('es-ES').format(Math.round(value))} ${currency}`;
}

function meters(value) {
  if (!value) return 'N/D';
  return `${Number(value).toLocaleString('es-ES')} m`;
}

function shipMatchesType(ship, type) {
  if (!type) return true;
  return Boolean(ship.flags?.[type]);
}

function getFilteredShips() {
  const query = searchInput.value.trim().toLowerCase();
  const manufacturer = manufacturerSelect.value;
  const type = typeSelect.value;
  const role = roleSelect.value;

  return allShips.filter((ship) => {
    const haystack = [ship.name, ship.shortName, ship.manufacturer, ship.tags.join(' ')].join(' ').toLowerCase();
    return (!query || haystack.includes(query))
      && (!manufacturer || ship.manufacturer === manufacturer)
      && (!role || ship.tags.includes(role))
      && shipMatchesType(ship, type);
  });
}

function sortShips(ships) {
  const mode = sortSelect.value;
  const sorted = [...ships];
  const numeric = (selector) => sorted.sort((a, b) => (selector(a) || Number.MAX_SAFE_INTEGER) - (selector(b) || Number.MAX_SAFE_INTEGER));

  if (mode === 'pledge') return numeric((ship) => ship.pledge.price);
  if (mode === 'purchase') return numeric((ship) => ship.purchase.price);
  if (mode === 'rental') return numeric((ship) => ship.rental.price);
  if (mode === 'cargo') return sorted.sort((a, b) => b.scu - a.scu);
  if (mode === 'size') return sorted.sort((a, b) => b.length - a.length);
  return sorted.sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

function renderShip(ship) {
  const tags = ship.tags.slice(0, 4).map((tag) => `<span>${escapeHtml(tag)}</span>`).join('');
  const photo = ship.photo
    ? `<img src="${escapeHtml(ship.photo)}" alt="${escapeHtml(ship.name)}" loading="lazy" />`
    : `<div class="ship-image-placeholder">SC</div>`;

  return `
    <article class="ship-card">
      <div class="ship-image">${photo}</div>
      <div class="ship-card-body">
        <div class="ship-title-row">
          <div>
            <span>${escapeHtml(ship.manufacturer)}</span>
            <h3>${escapeHtml(ship.name)}</h3>
          </div>
          <strong>${escapeHtml(ship.padType)}</strong>
        </div>
        <div class="ship-tags">${tags || '<span>Sin rol</span>'}</div>
        <dl class="ship-specs">
          <div><dt>Pledge</dt><dd>${money(ship.pledge.price, ship.pledge.currency || 'USD')}</dd></div>
          <div><dt>Compra</dt><dd>${money(ship.purchase.price)}</dd></div>
          <div><dt>Alquiler</dt><dd>${money(ship.rental.price)}</dd></div>
          <div><dt>Carga</dt><dd>${ship.scu ? `${ship.scu} SCU` : 'N/D'}</dd></div>
          <div><dt>Tripulaci&oacute;n</dt><dd>${escapeHtml(ship.crew)}</dd></div>
          <div><dt>Longitud</dt><dd>${meters(ship.length)}</dd></div>
        </dl>
        <div class="ship-locations">
          <strong>Compra:</strong>
          <span>${ship.purchase.locations.length ? escapeHtml(ship.purchase.locations.join(', ')) : 'Sin terminal conocido'}</span>
        </div>
        <div class="ship-locations">
          <strong>Alquiler:</strong>
          <span>${ship.rental.locations.length ? escapeHtml(ship.rental.locations.join(', ')) : 'Sin terminal conocido'}</span>
        </div>
        ${ship.storeUrl ? `<a class="ship-link" href="${escapeHtml(ship.storeUrl)}" target="_blank" rel="noreferrer">Ver en RSI</a>` : ''}
      </div>
    </article>
  `;
}

function renderShips() {
  const ships = sortShips(getFilteredShips());
  shipsCount.textContent = `${ships.length} / ${allShips.length}`;
  shipsStatus.classList.toggle('hidden', ships.length > 0);
  shipsStatus.textContent = ships.length ? '' : 'No hay naves que coincidan con esos filtros.';
  shipsGrid.innerHTML = ships.map(renderShip).join('');
}

function fillFilters() {
  const manufacturers = [...new Set(allShips.map((ship) => ship.manufacturer).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const roles = [...new Set(allShips.flatMap((ship) => ship.tags))].sort((a, b) => a.localeCompare(b, 'es'));

  manufacturerSelect.innerHTML = '<option value="">Todos</option>' + manufacturers.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
  roleSelect.innerHTML = '<option value="">Todos</option>' + roles.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
}

async function loadShips() {
  try {
    const response = await fetch('/api/vehicles');
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar las naves.');
    allShips = payload.vehicles || [];
    fillFilters();
    shipsStatus.textContent = `Datos cargados desde ${payload.source}.`;
    renderShips();
  } catch (error) {
    shipsCount.textContent = 'Sin datos';
    shipsStatus.textContent = `No se pudo conectar con UEX: ${error.message}`;
  }
}

[searchInput, manufacturerSelect, typeSelect, roleSelect, sortSelect].forEach((control) => {
  control.addEventListener('input', renderShips);
});

loadShips();
