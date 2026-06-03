import React, { useEffect, useMemo, useState } from 'react';
import { blueprintMissions, blueprintSummary, craftingBlueprints } from '../data/craftingBlueprints.js';
import { uniqueSorted } from '../utils/format.js';

const all = 'Todos';
const acquisitionOptions = ['Con ruta', 'Todos crafteables', 'Sin ruta'];

const roleToneMap = {
  FPS: 'fps',
  'Combate nave': 'ship',
  Proteccion: 'armor',
  Sistemas: 'systems',
  Utilidad: 'utility',
  Logistica: 'logistics',
  Referencia: 'reference'
};

/** Buscador interno de blueprints centrado en contratos, rol y ruta de obtencion. */
export function BlueprintFinderPage() {
  const defaultBlueprint = craftingBlueprints.find((item) => item.missions.length) || craftingBlueprints[0];
  const [filters, setFilters] = useState({ search: '', category: all, role: all, acquisition: 'Con ruta', mission: all, system: all, rarity: all });
  const [selectedId, setSelectedId] = useState(defaultBlueprint?.id || '');

  const categories = useMemo(() => [all, ...uniqueSorted(blueprintSummary.map((item) => item.label))], []);
  const roles = useMemo(() => [all, ...uniqueSorted(craftingBlueprints.map((item) => item.roleLabel))], []);
  const missions = useMemo(() => [all, ...uniqueSorted(blueprintMissions.map((item) => item.name))], []);
  const systems = useMemo(() => [all, ...uniqueSorted(blueprintMissions.map((item) => item.system))], []);
  const rarities = useMemo(() => [all, ...uniqueSorted(craftingBlueprints.map((item) => item.rarity))], []);
  const roleCards = useMemo(() => roles.filter((item) => item !== all).map((role) => ({
    role,
    count: craftingBlueprints.filter((item) => item.roleLabel === role).length,
    routed: craftingBlueprints.filter((item) => item.roleLabel === role && item.missions.length).length,
    tone: roleToneMap[role] || 'reference'
  })), [roles]);

  const filtered = useMemo(() => craftingBlueprints.filter((blueprint) => blueprintMatches(blueprint, filters)).slice(0, 320), [filters]);
  const selected = craftingBlueprints.find((item) => item.id === selectedId) || filtered[0] || defaultBlueprint || null;

  useEffect(() => {
    if (selected && !filtered.some((item) => item.id === selected.id)) {
      setSelectedId(filtered[0]?.id || defaultBlueprint?.id || '');
    }
  }, [defaultBlueprint, filtered, selected]);

  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const clearFilters = () => setFilters({ search: '', category: all, role: all, acquisition: 'Con ruta', mission: all, system: all, rarity: all });

  return (
    <main className="container blueprint-shell">
      <section className="blueprint-command">
        <div className="blueprint-command-copy">
          <span className="eyebrow">Mission Contract Rewards Guide</span>
          <h2>Encuentra el plano y la mision que lo desbloquea</h2>
          <p>Filtra por rol, categoria, sistema o contrato. La prioridad es saber que actividad repetir y que recompensa esperar, sin convertir la pagina en una hoja de calculo.</p>
          <div className="blueprint-command-actions">
            <button type="button" onClick={() => setFilter('search', 'Pulverizer')}>Pulverizer</button>
            <button type="button" onClick={() => setFilter('role', 'FPS')}>Armas FPS</button>
            <button type="button" onClick={() => setFilter('role', 'Combate nave')}>Naves</button>
            <button type="button" onClick={clearFilters}>Limpiar filtros</button>
          </div>
        </div>
        <div className="blueprint-command-grid">
          <Metric value={craftingBlueprints.length} label="Planos" />
          <Metric value={blueprintMissions.length} label="Contratos" />
          <Metric value={filtered.length} label="Resultados" />
          <Metric value={craftingBlueprints.filter((item) => item.missions.length).length} label="Con ruta" />
        </div>
      </section>

      <section className="blueprint-role-board" aria-label="Roles de blueprints">
        <button type="button" className={`blueprint-role-filter role-all ${filters.role === all ? 'active' : ''}`} onClick={() => setFilter('role', all)}>
          <span>Todos</span>
          <strong>{craftingBlueprints.length}</strong>
          <small>Vista completa</small>
        </button>
        {roleCards.map((item) => (
          <button
            key={item.role}
            type="button"
            className={`blueprint-role-filter role-${item.tone} ${filters.role === item.role ? 'active' : ''}`}
            onClick={() => setFilter('role', filters.role === item.role ? all : item.role)}
          >
            <span>{item.role}</span>
            <strong>{item.count}</strong>
            <small>{item.routed} con ruta</small>
          </button>
        ))}
      </section>

      <section className="blueprint-workbench">
        <aside className="blueprint-filter-panel">
          <div className="section-heading compact">
            <span className="eyebrow">Filtros</span>
            <h3>Afina la busqueda</h3>
          </div>
          <label className="blueprint-search-field">
            <span>Nombre, mision, faccion o codigo</span>
            <input value={filters.search} onChange={(event) => setFilter('search', event.target.value)} placeholder="Ej: P4-AR, WAR, Headhunters..." />
          </label>
          <div className="blueprint-filter-grid">
            <Select label="Categoria" value={filters.category} values={categories} onChange={(value) => setFilter('category', value)} />
            <Select label="Obtencion" value={filters.acquisition} values={acquisitionOptions} onChange={(value) => setFilter('acquisition', value)} />
            <Select label="Sistema" value={filters.system} values={systems} onChange={(value) => setFilter('system', value)} />
            <Select label="Rareza" value={filters.rarity} values={rarities} onChange={(value) => setFilter('rarity', value)} />
          </div>
          <Select label="Contrato concreto" value={filters.mission} values={missions} onChange={(value) => setFilter('mission', value)} />

          <section className="blueprint-mission-focus">
            <span className="eyebrow">Contratos utiles</span>
            <div className="blueprint-mission-stack">
              {blueprintMissions.slice(0, 5).map((mission) => (
                <button key={mission.id} type="button" className={filters.mission === mission.name ? 'active' : ''} onClick={() => setFilter('mission', filters.mission === mission.name ? all : mission.name)}>
                  <strong>{mission.name}</strong>
                  <span>{mission.faction} / {mission.system}</span>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="blueprint-results-panel">
          <div className="blueprint-results-head">
            <div>
              <span className="eyebrow">Resultados</span>
              <h3>{filtered.length} de {craftingBlueprints.length}</h3>
            </div>
            <span>{filters.role === all ? 'Todos los roles' : filters.role}</span>
          </div>
          <div className="blueprint-result-list" aria-label="Blueprints encontrados">
            {filtered.length ? filtered.map((blueprint) => (
              <button key={blueprint.id} type="button" className={`blueprint-result-card role-${roleToneMap[blueprint.roleLabel] || 'reference'} ${selected?.id === blueprint.id ? 'active' : ''}`} onClick={() => setSelectedId(blueprint.id)}>
                <span className="blueprint-result-main">
                  <strong>{blueprint.name}</strong>
                  <small>{blueprint.category} / {blueprint.acquisition.primaryFaction}</small>
                </span>
                <span className="blueprint-result-meta">
                  <b>{blueprint.missions.length || 'N/D'}</b>
                  <small>{blueprint.roleLabel}</small>
                </span>
              </button>
            )) : <p className="empty-state">No hay blueprints con esos filtros.</p>}
          </div>
        </section>

        <BlueprintDetail blueprint={selected} />
      </section>
    </main>
  );
}

function BlueprintDetail({ blueprint }) {
  if (!blueprint) {
    return (
      <section className="blueprint-detail-panel">
        <span className="eyebrow">Sin seleccion</span>
        <h3>Selecciona un blueprint</h3>
        <p>El detalle mostrara mision, faccion, sistema, reputacion y consejos para farmearlo.</p>
      </section>
    );
  }

  const roleTone = roleToneMap[blueprint.roleLabel] || 'reference';
  const bestMissions = blueprint.missions.slice(0, 6);

  return (
    <section className={`blueprint-detail-panel role-${roleTone}`}>
      <div className="blueprint-detail-top">
        <div>
          <span className="eyebrow">{blueprint.category}</span>
          <h2>{blueprint.name}</h2>
          <p>{blueprint.notes}</p>
          <div className="ship-meta-strip">
            <span>{blueprint.rarity}</span>
            <span>Tier {blueprint.tier}</span>
            <span>{blueprint.roleLabel}</span>
            <span>{blueprint.activity}</span>
          </div>
        </div>
        <div className="blueprint-reward-card">
          <span>Recompensa</span>
          <strong>{blueprint.rewardType}</strong>
          <small>{blueprint.family}</small>
        </div>
      </div>

      <section className="blueprint-route-summary">
        <div>
          <span className="eyebrow">Ruta de obtencion</span>
          <h3>{blueprint.acquisition.status}</h3>
          <p>{blueprint.missions.length ? `Prioriza ${blueprint.acquisition.primaryMission} con ${blueprint.acquisition.primaryFaction}. Si no aparece, repite contratos del mismo proveedor hasta refrescar el pool.` : 'Este plano existe como receta crafteable, pero no hay contrato enlazado en la base actual.'}</p>
        </div>
        <div className="blueprint-route-grid">
          <InfoTile label="Faccion" value={blueprint.acquisition.primaryFaction} />
          <InfoTile label="Sistema" value={blueprint.acquisition.systems.join(', ') || 'N/D'} />
          <InfoTile label="Rep. objetivo" value={blueprint.acquisition.maxRep ? blueprint.acquisition.maxRep.toLocaleString('es-ES') : 'N/D'} />
          <InfoTile label="Legal / ilegal" value={`${blueprint.acquisition.lawfulCount} / ${blueprint.acquisition.unlawfulCount}`} />
        </div>
      </section>

      <section className="blueprint-mission-board">
        <div className="section-heading compact">
          <span className="eyebrow">Misiones detectadas</span>
          <h3>{bestMissions.length ? 'Contratos recomendados' : 'Sin ruta detectada'}</h3>
        </div>
        {bestMissions.length ? (
          <div className="blueprint-mission-cards">
            {bestMissions.map((mission) => (
              <article className={`blueprint-mission-tile ${mission.lawful ? 'is-lawful' : 'is-unlawful'}`} key={`${blueprint.id}-${mission.id}`}>
                <div>
                  <span>{mission.faction}</span>
                  <b>{mission.lawful ? 'Legal' : 'Ilegal'}</b>
                </div>
                <h4>{mission.name}</h4>
                <p>{mission.notes}</p>
                <dl>
                  <InfoPair label="Sistema" value={mission.system} />
                  <InfoPair label="Rango" value={mission.contractRank} />
                  <InfoPair label="Rep." value={mission.minRep ? mission.minRep.toLocaleString('es-ES') : 'N/D'} />
                  <InfoPair label="Drop" value={mission.probability} />
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">No hay mision concreta para este plano. Mantenlo como referencia hasta que el dataset tenga ruta.</p>
        )}
      </section>

      <section className="blueprint-advice-panel">
        <div>
          <span className="eyebrow">Uso recomendado</span>
          <h3>Para que sirve</h3>
          <p>{blueprint.unlockAdvice}</p>
        </div>
        <div className="blueprint-pill-list">
          {blueprint.bestFor.map((item) => <span key={item}>{item}</span>)}
        </div>
      </section>
    </section>
  );
}

function Metric({ value, label }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}

function Select({ label, value, values, onChange }) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {values.map((item) => <option key={item}>{item}</option>)}
      </select>
    </label>
  );
}

function InfoTile({ label, value }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function InfoPair({ label, value }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function blueprintMatches(blueprint, filters) {
  const token = normalize(filters.search);
  const haystack = normalize([
    blueprint.name,
    blueprint.category,
    blueprint.family,
    blueprint.activity,
    blueprint.rarity,
    blueprint.blueprintCode,
    ...blueprint.bestFor,
    ...blueprint.missions.flatMap((mission) => [mission.name, mission.faction, mission.system, mission.region, mission.activity, mission.repStanding])
  ].join(' '));
  if (token && !haystack.includes(token)) return false;
  if (filters.category !== all && blueprint.category !== filters.category) return false;
  if (filters.role !== all && blueprint.roleLabel !== filters.role) return false;
  if (filters.acquisition === 'Con ruta' && !blueprint.missions.length) return false;
  if (filters.acquisition === 'Sin ruta' && blueprint.missions.length) return false;
  if (filters.rarity !== all && blueprint.rarity !== filters.rarity) return false;
  if (filters.mission !== all && !blueprint.missions.some((mission) => mission.name === filters.mission)) return false;
  if (filters.system !== all && !blueprint.missions.some((mission) => mission.system === filters.system)) return false;
  return true;
}

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
