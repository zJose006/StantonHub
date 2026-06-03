import React, { useEffect, useMemo, useState } from 'react';
import { loadMiningMaterials } from '../services/api.js';

const allOptions = 'Todos';

export function MiningMaterialsPage() {
  const [payload, setPayload] = useState({ materials: [], sourceNote: '', equipment: {} });
  const [status, setStatus] = useState('Cargando base minera...');
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState(allOptions);
  const [category, setCategory] = useState(allOptions);
  const [profit, setProfit] = useState(allOptions);
  const [miningRole, setMiningRole] = useState('all');
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    let cancelled = false;
    loadMiningMaterials()
      .then((data) => {
        if (cancelled) return;
        const materials = Array.isArray(data.materials) ? data.materials : [];
        setPayload({ ...data, materials });
        setSelectedId((current) => current || preferredMaterial(materials)?.id || materials[0]?.id || '');
        setStatus(`${materials.length} materiales preparados para planificar rutas.`);
      })
      .catch((error) => {
        if (!cancelled) setStatus(`No se pudo cargar la base minera: ${error.message}`);
      });
    return () => { cancelled = true; };
  }, []);

  const materials = payload.materials || [];
  const equipment = payload.equipment || {};
  const methods = useMemo(() => uniqueSorted(materials.flatMap((item) => item.miningTypes || [])), [materials]);
  const categories = useMemo(() => uniqueSorted(materials.map((item) => item.category).filter(Boolean)), [materials]);
  const profits = useMemo(() => sortProfitLabels(materials.map((item) => item.profit).filter(Boolean)), [materials]);
  const roleCards = useMemo(() => miningRoleCards(materials), [materials]);

  const filtered = useMemo(() => {
    const token = normalize(search);
    return materials.filter((material) => {
      const searchableText = [
        material.name,
        material.category,
        material.profit,
        material.risk,
        ...(material.aliases || []),
        ...(material.bestLocations || []).flatMap((location) => [location.planet, location.area])
      ].join(' ');
      return (!token || normalize(searchableText).includes(token))
        && (method === allOptions || (material.miningTypes || []).includes(method))
        && (category === allOptions || material.category === category)
        && (profit === allOptions || material.profit === profit)
        && miningRoleMatches(material, miningRole);
    });
  }, [category, materials, method, miningRole, profit, search]);

  const selected = materials.find((item) => item.id === selectedId)
    || filtered[0]
    || materials[0]
    || null;

  useEffect(() => {
    if (selected && !filtered.some((item) => item.id === selected.id)) {
      setSelectedId(filtered[0]?.id || materials[0]?.id || '');
    }
  }, [filtered, materials, selected]);

  return (
    <main className="container mining-page">
      <section className="mining-command">
        <div className="mining-command-copy">
          <span className="eyebrow">Planificador minero</span>
          <h2>Elige material, ruta y refineria sin perder tiempo</h2>
          <p>Consulta donde aparece cada recurso, que tan rentable es, que riesgo tiene la roca y que estacion conviene usar antes de llenar la bodega.</p>
          <div className="mining-command-actions" aria-label="Accesos rapidos">
            <button type="button" onClick={() => quickSelect(materials, setSelectedId, 'Oro')}>Oro</button>
            <button type="button" onClick={() => quickSelect(materials, setSelectedId, 'Quantainium')}>Quantainium</button>
            <button type="button" onClick={() => quickSelect(materials, setSelectedId, 'Querinite')}>Querinite</button>
          </div>
        </div>
        <div className="mining-command-grid">
          <Metric value={materials.length} label="Materiales" />
          <Metric value={methods.length} label="Metodos" />
          <Metric value={filtered.length} label="Resultados" />
          <Metric value={equipmentCount(equipment)} label="Equipos" />
        </div>
      </section>

      <section className="mining-role-board" aria-label="Roles de mineria">
        {roleCards.map((role) => (
          <button
            key={role.id}
            type="button"
            className={`mining-role-filter role-${role.tone} ${miningRole === role.id ? 'active' : ''}`}
            onClick={() => setMiningRole(miningRole === role.id && role.id !== 'all' ? 'all' : role.id)}
          >
            <span>{role.label}</span>
            <strong>{role.count}</strong>
            <small>{role.text}</small>
          </button>
        ))}
      </section>

      <section className="mining-planner">
        <MaterialRouteCard material={selected} />
        <div className="mining-search-panel">
          <div className="section-heading compact">
            <span className="eyebrow">Busqueda</span>
            <h3>Filtra el recurso</h3>
          </div>
          <div className="mining-filter-grid">
            <label className="mining-search-field">
              <span>Material, luna o categoria</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ej: Oro, Daymar, gema..." />
            </label>
            <label>
              <span>Metodo</span>
              <select value={method} onChange={(event) => setMethod(event.target.value)}>
                <option>{allOptions}</option>
                {methods.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>Categoria</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option>{allOptions}</option>
                {categories.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>Rentabilidad</span>
              <select value={profit} onChange={(event) => setProfit(event.target.value)}>
                <option>{allOptions}</option>
                {profits.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          </div>
          <p>{status}</p>
        </div>
      </section>

      <section className="mining-workbench">
        <aside className="mining-results" aria-label="Materiales encontrados">
          <div className="section-heading compact">
            <span className="eyebrow">Recursos</span>
            <h3>{filtered.length} materiales</h3>
          </div>
          <div className="mining-results-list">
            {filtered.length ? filtered.map((material) => (
              <button
                key={material.id}
                className={`mining-result-card ${selected?.id === material.id ? 'active' : ''}`}
                type="button"
                onClick={() => setSelectedId(material.id)}
              >
                <span className="mining-result-main">
                  <strong>{material.name}</strong>
                  <small>{material.category} - {(material.miningTypes || []).join(' / ') || 'Metodo N/D'}</small>
                </span>
                <span className={`mining-result-profit ${profitTone(material.profit)}`}>{material.profit || 'N/D'}</span>
              </button>
            )) : <p className="empty-state">No hay materiales con esos filtros.</p>}
          </div>
        </aside>

        <MaterialDetail material={selected} sourceNote={payload.sourceNote} />
      </section>

      <EquipmentDock equipment={equipment} />
    </main>
  );
}

function MaterialRouteCard({ material }) {
  const mainLocation = material?.bestLocations?.[0];
  const refinery = material?.bestRefineries?.[0];
  const sheetData = material?.sheetData || {};

  return (
    <section className="mining-route-card">
      <div>
        <span className="eyebrow">Ruta sugerida</span>
        <h3>{material?.name || 'Selecciona un material'}</h3>
        <p>{mainLocation ? `${mainLocation.area}, ${mainLocation.planet}. ${mainLocation.notes || ''}` : 'Elige un recurso para preparar la ruta mas interesante.'}</p>
      </div>
      <div className="mining-route-steps">
        <RouteStep label="Lugar" value={mainLocation ? `${mainLocation.planet} / ${mainLocation.area}` : 'Pendiente'} />
        <RouteStep label="Metodo" value={mainLocation?.method || material?.miningTypes?.[0] || 'N/D'} />
        <RouteStep label="Refineria" value={refinery ? `${refinery.code} ${refinery.label}` : 'Sin bonus'} />
        <RouteStep label="Precio" value={sheetData.averageUnitPrice ? `${formatNumber(sheetData.averageUnitPrice)} aUEC/u` : 'N/D'} />
      </div>
    </section>
  );
}

function MaterialDetail({ material, sourceNote }) {
  if (!material) {
    return (
      <section className="mining-detail-empty">
        <span className="eyebrow">Sin seleccion</span>
        <h3>Selecciona un material</h3>
        <p>Usa los filtros o pulsa un recurso para ver ubicaciones, refineria, riesgo y equipo recomendado.</p>
      </section>
    );
  }

  const sheetData = material.sheetData || {};
  const locations = material.bestLocations || [];
  const refineries = material.bestRefineries || [];

  return (
    <section className="mining-detail">
      <div className="mining-detail-header">
        <div>
          <span className="eyebrow">{material.category}</span>
          <h2>{material.name}</h2>
          <p>{aliasText(material.aliases)}</p>
          <div className="ship-meta-strip">
            <span>{material.profit || 'Rentabilidad N/D'}</span>
            <span>Riesgo: {material.risk || 'N/D'}</span>
            {(material.miningTypes || []).map((item) => <span key={item}>{item}</span>)}
          </div>
        </div>
        <div className={`mining-priority ${profitTone(material.profit)}`}>
          <span>Prioridad</span>
          <strong>{priorityLabel(material)}</strong>
          <small>{locations[0]?.quality || 'Sin ruta calculada'}</small>
        </div>
      </div>

      <div className="mining-stats-strip">
        <DataCard label="Precio medio" value={sheetData.averageUnitPrice ? `${formatNumber(sheetData.averageUnitPrice)} aUEC/u` : 'N/D'} />
        <DataCard label="Densidad" value={formatValue(sheetData.density)} />
        <DataCard label="Inestabilidad" value={formatValue(sheetData.instability)} tone={Number(sheetData.instability) >= 5 ? 'warn' : 'ok'} />
        <DataCard label="Resistencia" value={formatValue(sheetData.resistance)} />
        <DataCard label="Ventana optima" value={formatValue(sheetData.optimalWindowThickness)} />
      </div>

      <div className="mining-detail-sections">
        <section className="mining-card mining-location-section">
          <div className="section-heading compact">
            <span className="eyebrow">Donde minar</span>
            <h3>Mejores ubicaciones</h3>
          </div>
          <div className="mining-location-grid">
            {locations.length ? locations.slice(0, 6).map((location, index) => (
              <article className="mining-location-card" key={`${location.planet}-${location.area}-${index}`}>
                <div className="mining-location-rank">{index + 1}</div>
                <div>
                  <strong>{location.area}</strong>
                  <span>{location.system} / {location.planet}</span>
                  <p>{location.notes || 'Ubicacion detectada en la base local.'}</p>
                </div>
                <div className="mining-location-meta">
                  <MetricPill label="Metodo" value={location.method} />
                  <MetricPill label="Aparicion" value={location.appearance} />
                  <MetricPill label="Calidad" value={location.quality} />
                  <MetricPill label="Deposito" value={location.deposit} />
                </div>
              </article>
            )) : <p className="empty-state">No hay ubicaciones registradas para este recurso.</p>}
          </div>
        </section>

        <aside className="mining-card mining-support-panel">
          <section>
            <span className="eyebrow">Refineria</span>
            <h3>Mejor rendimiento</h3>
            <div className="mining-refinery-list">
              {refineries.length ? refineries.map((refinery) => (
                <div className="mining-refinery-card" key={`${refinery.code}-${refinery.station}`}>
                  <span>
                    <strong>{refinery.code}</strong>
                    <small>{refinery.station}</small>
                  </span>
                  <b className={Number(refinery.yieldBonus) >= 0 ? 'positive' : 'negative'}>{refinery.label}</b>
                </div>
              )) : <p className="empty-state">Sin bonus de refineria registrado.</p>}
            </div>
          </section>

          <section>
            <span className="eyebrow">Calidad</span>
            <h3>Lectura de la roca</h3>
            <div className="mining-quality-list">
              {(material.qualityBands || []).map((band) => (
                <div className="mining-quality-row" key={band.label}>
                  <span><strong>{band.label}</strong><small>{band.range}</small></span>
                  <b>{band.chance}</b>
                </div>
              ))}
            </div>
          </section>

          <section>
            <span className="eyebrow">Equipo</span>
            <h3>Preparacion</h3>
            <div className="mining-tool-tags">
              {(material.tools || []).map((tool) => <span key={tool}>{tool}</span>)}
            </div>
          </section>

          <section>
            <span className="eyebrow">Consejos</span>
            <h3>Antes de salir</h3>
            <ul className="mining-tip-list">
              {(material.tips || []).map((tip) => <li key={tip}>{tip}</li>)}
            </ul>
          </section>
        </aside>
      </div>

      <p className="mining-source-note">{sourceNote}</p>
    </section>
  );
}

function EquipmentDock({ equipment }) {
  const lasers = (equipment.miningLasers || []).slice(0, 5);
  const modules = (equipment.miningModulesAndGadgets || []).slice(0, 5);
  if (!lasers.length && !modules.length) return null;

  return (
    <section className="mining-equipment-dock">
      <div className="section-heading compact">
        <span className="eyebrow">Equipo disponible</span>
        <h3>Laseres, modulos y gadgets</h3>
      </div>
      <div className="mining-equipment-rail">
        {lasers.map((laser) => (
          <article className="mining-equipment-chip" key={laser.name}>
            <span>Laser S{laser.size || 'N/D'}</span>
            <strong>{laser.name}</strong>
            <small>{laser.miningLaserPower ? `${formatNumber(laser.miningLaserPower)} potencia` : 'Potencia N/D'}</small>
          </article>
        ))}
        {modules.map((module) => (
          <article className="mining-equipment-chip" key={`${module.category}-${module.name}`}>
            <span>{module.category || 'Modulo'}</span>
            <strong>{module.name}</strong>
            <small>{module.price ? `${formatNumber(module.price)} aUEC` : module.duration || 'Uso N/D'}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function RouteStep({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Metric({ value, label }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function DataCard({ label, value, tone }) {
  return (
    <div className={`mining-data-card ${tone ? `is-${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MetricPill({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value || 'N/D'}</strong>
    </div>
  );
}

function aliasText(aliases = []) {
  return aliases.length ? `Tambien conocido como: ${aliases.join(', ')}.` : 'Material registrado en la base minera local.';
}

function priorityLabel(material) {
  if (String(material.profit).includes('Muy alta')) return 'Objetivo premium';
  if (String(material.profit).includes('Alta')) return 'Ruta rentable';
  if (String(material.risk).includes('Bajo')) return 'Farmeo estable';
  return 'Objetivo situacional';
}

function preferredMaterial(materials) {
  return materials.find((item) => normalize(item.name) === 'oro')
    || materials.find((item) => normalize(item.name) === 'quantainium')
    || materials[0];
}

function quickSelect(materials, setSelectedId, name) {
  const found = materials.find((item) => normalize(item.name) === normalize(name));
  if (found) setSelectedId(found.id);
}

function equipmentCount(equipment) {
  return (equipment.miningLasers || []).length + (equipment.miningModulesAndGadgets || []).length;
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
}

function sortProfitLabels(values) {
  const order = ['Muy alta', 'Alta', 'Media', 'Media-baja', 'Baja', 'Sin dato'];
  return [...new Set(values.filter(Boolean))].sort((a, b) => {
    const left = order.indexOf(a);
    const right = order.indexOf(b);
    if (left === -1 && right === -1) return a.localeCompare(b, 'es');
    if (left === -1) return 1;
    if (right === -1) return -1;
    return left - right;
  });
}

function profitTone(value) {
  const text = String(value || '');
  if (text.includes('Muy alta')) return 'is-premium';
  if (text.includes('Alta')) return 'is-high';
  if (text.includes('Baja')) return 'is-low';
  return 'is-medium';
}

function miningRoleCards(materials) {
  const cards = [
    { id: 'all', label: 'Todos', tone: 'all', text: 'Base completa' },
    { id: 'premium', label: 'Alta rentabilidad', tone: 'premium', text: 'Prioridad de venta' },
    { id: 'ship', label: 'Nave minera', tone: 'ship', text: 'Prospector / Mole' },
    { id: 'roc', label: 'ROC', tone: 'roc', text: 'Superficie' },
    { id: 'hand', label: 'Manual', tone: 'hand', text: 'A pie / cuevas' },
    { id: 'refinery', label: 'Refineria', tone: 'refinery', text: 'Con bonus registrado' }
  ];
  return cards.map((card) => ({ ...card, count: materials.filter((material) => miningRoleMatches(material, card.id)).length }));
}

function miningRoleMatches(material, role) {
  if (role === 'all') return true;
  const text = normalize([
    material.name,
    material.category,
    material.profit,
    material.risk,
    ...(material.miningTypes || []),
    ...(material.tools || [])
  ].join(' '));
  if (role === 'premium') return text.includes('muy alta') || text.includes('alta');
  if (role === 'ship') return text.includes('nave') || text.includes('ship') || text.includes('prospector') || text.includes('mole');
  if (role === 'roc') return text.includes('roc') || text.includes('vehiculo');
  if (role === 'hand') return text.includes('manual') || text.includes('hand') || text.includes('a pie') || text.includes('cueva');
  if (role === 'refinery') return (material.bestRefineries || []).length > 0;
  return true;
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function formatNumber(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 'N/D';
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: numberValue >= 100 ? 0 : 2 }).format(numberValue);
}

function formatValue(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 'N/D';
  return formatNumber(numberValue);
}
