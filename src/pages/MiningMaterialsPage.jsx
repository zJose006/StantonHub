import React, { useEffect, useMemo, useState } from 'react';
import { loadMiningMaterials } from '../services/api.js';

const allMethods = 'Todos';

export function MiningMaterialsPage() {
  const [payload, setPayload] = useState({ materials: [], sourceNote: '' });
  const [status, setStatus] = useState('Cargando materiales...');
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState(allMethods);
  const [profit, setProfit] = useState(allMethods);
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    let cancelled = false;
    loadMiningMaterials()
      .then((data) => {
        if (cancelled) return;
        const materials = Array.isArray(data.materials) ? data.materials : [];
        setPayload({ ...data, materials });
        setSelectedId((current) => current || materials[0]?.id || '');
        setStatus(`${materials.length} materiales listos para consulta.`);
      })
      .catch((error) => {
        if (!cancelled) setStatus(`No se pudo cargar la base minera: ${error.message}`);
      });
    return () => { cancelled = true; };
  }, []);

  const materials = payload.materials || [];
  const methods = useMemo(() => uniqueSorted(materials.flatMap((item) => item.miningTypes || [])), [materials]);
  const profits = useMemo(() => uniqueSorted(materials.map((item) => item.profit).filter(Boolean)), [materials]);

  const filtered = useMemo(() => {
    const token = normalize(search);
    return materials.filter((material) => {
      const matchesSearch = !token || normalize([material.name, material.category, ...(material.aliases || [])].join(' ')).includes(token);
      const matchesMethod = method === allMethods || (material.miningTypes || []).includes(method);
      const matchesProfit = profit === allMethods || material.profit === profit;
      return matchesSearch && matchesMethod && matchesProfit;
    });
  }, [materials, search, method, profit]);

  const selected = materials.find((item) => item.id === selectedId) || filtered[0] || materials[0] || null;

  useEffect(() => {
    if (selected && !filtered.some((item) => item.id === selected.id)) {
      setSelectedId(filtered[0]?.id || materials[0]?.id || '');
    }
  }, [filtered, materials, selected]);

  return (
    <main className="container mining-materials-shell">
      <section className="panel mining-briefing">
        <div>
          <span className="eyebrow">Planificador minero</span>
          <h2>Encuentra donde merece la pena minar cada material</h2>
          <p>Busca un recurso y revisa ubicaciones recomendadas, metodo de extraccion, probabilidad orientativa por calidad y consejos practicos antes de salir.</p>
        </div>
        <div className="mining-briefing-stats">
          <Metric value={materials.length} label="Materiales" />
          <Metric value={methods.length} label="Metodos" />
          <Metric value={filtered.length} label="Filtrados" />
        </div>
      </section>

      <section className="panel mining-controls-panel">
        <div className="mining-controls">
          <label>
            <span>Buscar material</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Oro, Quantainium, Hadanite..." />
          </label>
          <label>
            <span>Metodo</span>
            <select value={method} onChange={(event) => setMethod(event.target.value)}>
              <option>{allMethods}</option>
              {methods.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>Rentabilidad</span>
            <select value={profit} onChange={(event) => setProfit(event.target.value)}>
              <option>{allMethods}</option>
              {profits.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        </div>
        <p>{status}</p>
      </section>

      <section className="mining-layout">
        <aside className="panel mining-material-list" aria-label="Listado de materiales">
          <div className="section-heading">
            <span className="eyebrow">Recursos</span>
            <h2>Materiales minables</h2>
          </div>
          {filtered.length ? filtered.map((material) => (
            <button key={material.id} className={`mining-material-card ${selected?.id === material.id ? 'active' : ''}`} type="button" onClick={() => setSelectedId(material.id)}>
              <span>
                <strong>{material.name}</strong>
                <small>{material.category}</small>
              </span>
              <span className="material-card-meta">
                <b>{material.profit}</b>
                <small>{(material.miningTypes || []).join(' / ')}</small>
              </span>
            </button>
          )) : <p className="empty-state">No hay materiales con esos filtros.</p>}
        </aside>

        <MaterialDetail material={selected} sourceNote={payload.sourceNote} />
      </section>
    </main>
  );
}

function MaterialDetail({ material, sourceNote }) {
  if (!material) {
    return <section className="panel mining-detail-panel"><p className="empty-state">Selecciona un material para ver su ficha minera.</p></section>;
  }

  return (
    <section className="panel mining-detail-panel">
      <div className="mining-detail-hero">
        <div>
          <span className="eyebrow">{material.category}</span>
          <h2>{material.name}</h2>
          <p>{aliasText(material.aliases)}</p>
          <div className="ship-meta-strip">
            <span>Rentabilidad: {material.profit}</span>
            <span>Riesgo: {material.risk}</span>
            {(material.miningTypes || []).map((item) => <span key={item}>{item}</span>)}
          </div>
        </div>
        <div className="mining-rating-card">
          <span>Prioridad</span>
          <strong>{priorityLabel(material)}</strong>
          <small>{material.bestLocations?.[0]?.area || 'Ruta pendiente'}</small>
        </div>
      </div>

      <div className="mining-detail-grid">
        <section className="mining-block mining-locations">
          <div className="section-heading compact">
            <span className="eyebrow">Ubicaciones</span>
            <h3>Mejores lugares detectados</h3>
          </div>
          <div className="location-list">
            {(material.bestLocations || []).map((location, index) => (
              <article className="location-card" key={`${location.planet}-${location.area}`}>
                <div className="location-rank">{index + 1}</div>
                <div>
                  <strong>{location.area}</strong>
                  <span>{location.system} / {location.planet}</span>
                  <p>{location.notes}</p>
                </div>
                <dl>
                  <div><dt>Metodo</dt><dd>{location.method}</dd></div>
                  <div><dt>Aparicion</dt><dd>{location.appearance}</dd></div>
                  <div><dt>Calidad</dt><dd>{location.quality}</dd></div>
                  <div><dt>Deposito</dt><dd>{location.deposit}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <aside className="mining-side-column">
          <section className="mining-block">
            <div className="section-heading compact">
              <span className="eyebrow">Calidad</span>
              <h3>Probabilidad orientativa</h3>
            </div>
            <div className="quality-band-list">
              {(material.qualityBands || []).map((band) => (
                <div className="quality-band" key={band.label}>
                  <span><strong>{band.label}</strong><small>{band.range}</small></span>
                  <b>{band.chance}</b>
                </div>
              ))}
            </div>
          </section>

          <section className="mining-block">
            <div className="section-heading compact">
              <span className="eyebrow">Equipo</span>
              <h3>Herramientas recomendadas</h3>
            </div>
            <div className="mining-chip-list">
              {(material.tools || []).map((tool) => <span key={tool}>{tool}</span>)}
            </div>
          </section>

          <section className="mining-block">
            <div className="section-heading compact">
              <span className="eyebrow">Consejos</span>
              <h3>Antes de salir</h3>
            </div>
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

function Metric({ value, label }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
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

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
