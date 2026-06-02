import React, { useEffect, useMemo, useState } from 'react';
import { blueprintMissions, blueprintSummary, craftingBlueprints } from '../data/craftingBlueprints.js';
import { uniqueSorted } from '../utils/format.js';

const all = 'Todos';
const acquisitionOptions = ['Con ruta', 'Todos crafteables', 'Sin ruta'];

/** Buscador interno de blueprints centrado en contratos y recompensas. */
export function BlueprintFinderPage() {
  const [filters, setFilters] = useState({ search: '', category: all, role: all, acquisition: 'Con ruta', mission: all, system: all, rarity: all });
  const [selectedId, setSelectedId] = useState(craftingBlueprints.find((item) => item.missions.length)?.id || craftingBlueprints[0]?.id || '');
  const categories = useMemo(() => [all, ...uniqueSorted(blueprintSummary.map((item) => item.label))], []);
  const roles = useMemo(() => [all, ...uniqueSorted(craftingBlueprints.map((item) => item.roleLabel))], []);
  const missions = useMemo(() => [all, ...uniqueSorted(blueprintMissions.map((item) => item.name))], []);
  const systems = useMemo(() => [all, ...uniqueSorted(blueprintMissions.map((item) => item.system))], []);
  const rarities = useMemo(() => [all, ...uniqueSorted(craftingBlueprints.map((item) => item.rarity))], []);
  const filtered = useMemo(() => craftingBlueprints.filter((blueprint) => blueprintMatches(blueprint, filters)).slice(0, 260), [filters]);
  const selected = craftingBlueprints.find((item) => item.id === selectedId) || filtered[0] || craftingBlueprints[0];

  useEffect(() => {
    if (selected && !filtered.some((item) => item.id === selected.id)) setSelectedId(filtered[0]?.id || craftingBlueprints[0]?.id || '');
  }, [filtered, selected]);

  return (
    <main className="container blueprint-shell">
      <section className="panel blueprint-briefing blueprint-briefing-missions">
        <div>
          <span className="section-label">Mission Contract Rewards Guide</span>
          <h2>Blueprint Finder</h2>
          <p>Base local importada desde el dataset de recompensas por contrato: armas personales, municion, armaduras, trajes, armas de nave y componentes.</p>
        </div>
        <div className="blueprint-stats blueprint-stats-wide">
          {blueprintSummary.slice(0, 6).map((item) => <Metric key={item.label} value={item.count} label={item.label} />)}
        </div>
      </section>

      <section className="panel blueprint-mission-strip" aria-label="Misiones destacadas">
        {blueprintMissions.slice(0, 6).map((mission) => (
          <button key={mission.id} type="button" className={filters.mission === mission.name ? 'active' : ''} onClick={() => setFilters({ ...filters, mission: filters.mission === mission.name ? all : mission.name })}>
            <span>{mission.faction}</span>
            <strong>{mission.name}</strong>
            <small>{mission.system} / {mission.activity}</small>
          </button>
        ))}
      </section>

      <section className="panel blueprint-controls blueprint-controls-missions">
        <label>Buscar<input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Pulverizer, P4-AR, WAR Neutron, Sukoran..." /></label>
        <Select label="Categoria" value={filters.category} values={categories} onChange={(value) => setFilters({ ...filters, category: value })} />
        <Select label="Rol" value={filters.role} values={roles} onChange={(value) => setFilters({ ...filters, role: value })} />
        <Select label="Obtencion" value={filters.acquisition} values={acquisitionOptions} onChange={(value) => setFilters({ ...filters, acquisition: value })} />
        <Select label="Contrato" value={filters.mission} values={missions} onChange={(value) => setFilters({ ...filters, mission: value })} />
        <Select label="Sistema" value={filters.system} values={systems} onChange={(value) => setFilters({ ...filters, system: value })} />
        <Select label="Rareza" value={filters.rarity} values={rarities} onChange={(value) => setFilters({ ...filters, rarity: value })} />
      </section>

      <section className="blueprint-layout">
        <aside className="panel blueprint-results" aria-label="Blueprints encontrados">
          <div className="section-heading compact">
            <span className="section-label">Base cargada</span>
            <h2>{filtered.length} de {craftingBlueprints.length} registros</h2>
          </div>
          {filtered.map((blueprint) => (
            <button key={blueprint.id} type="button" className={`blueprint-result ${selected?.id === blueprint.id ? 'active' : ''}`} onClick={() => setSelectedId(blueprint.id)}>
              <span>
                <strong>{blueprint.name}</strong>
                <small>{blueprint.category} / {blueprint.roleLabel} / {blueprint.acquisition.primaryFaction}</small>
              </span>
              <b title="Contratos detectados">{blueprint.missions.length || 'N/D'}</b>
            </button>
          ))}
          {!filtered.length ? <p className="empty-state">No hay blueprints con esos filtros.</p> : null}
        </aside>

        <BlueprintDetail blueprint={selected} />
      </section>
    </main>
  );
}

function BlueprintDetail({ blueprint }) {
  if (!blueprint) return <section className="panel blueprint-detail"><p className="empty-state">Selecciona un blueprint para ver donde se consigue.</p></section>;

  return (
    <section className="panel blueprint-detail">
      <div className="blueprint-detail-hero">
        <div>
          <span className="section-label">{blueprint.category}</span>
          <h2>{blueprint.name}</h2>
          <p>{blueprint.notes}</p>
          <div className="component-chip-row">
            <span>{blueprint.rarity}</span>
            <span>Tier {blueprint.tier}</span>
            <span className={`blueprint-role-chip role-${blueprint.role}`}>{blueprint.roleLabel}</span>
            <span>{blueprint.activity}</span>
            {blueprint.blueprintCode ? <span>{blueprint.blueprintCode}</span> : null}
          </div>
        </div>
        <div className="blueprint-priority-card">
          <span>Recompensa</span>
          <strong>{blueprint.rewardType}</strong>
          <small>{blueprint.family}</small>
        </div>
      </div>

      <section className="blueprint-acquisition">
        <div>
          <span className="section-label">Obtencion automatizada</span>
          <h3>{blueprint.acquisition.status}</h3>
          <p>{blueprint.missions.length ? `Ruta principal por ${blueprint.acquisition.primaryFaction}, repitiendo contratos del mismo pool hasta que rote el blueprint.` : 'No hay contrato enlazado en la fuente descargada.'}</p>
        </div>
        <dl>
          <div><dt>Faccion</dt><dd>{blueprint.acquisition.primaryFaction}</dd></div>
          <div><dt>Mision clave</dt><dd>{blueprint.acquisition.primaryMission}</dd></div>
          <div><dt>Sistema</dt><dd>{blueprint.acquisition.systems.join(', ') || 'N/D'}</dd></div>
          <div><dt>Rep. objetivo</dt><dd>{blueprint.acquisition.maxRep ? blueprint.acquisition.maxRep.toLocaleString('es-ES') : 'N/D'}</dd></div>
          <div><dt>Rep. media</dt><dd>{blueprint.acquisition.averageRepReward ? blueprint.acquisition.averageRepReward.toLocaleString('es-ES') : 'N/D'}</dd></div>
          <div><dt>Legal / Ilegal</dt><dd>{blueprint.acquisition.lawfulCount} / {blueprint.acquisition.unlawfulCount}</dd></div>
        </dl>
      </section>

      {blueprint.missions.length ? (
        <section className="blueprint-mission-grid">
          {blueprint.missions.map((mission) => (
            <article className={`blueprint-mission-card ${mission.lawful ? 'is-lawful' : 'is-unlawful'} difficulty-${normalize(mission.difficulty)}`} key={`${blueprint.id}-${mission.id}`}>
              <div className="blueprint-mission-card-head">
                <span>{mission.faction}</span>
                <b>{mission.lawful ? 'Legal' : 'Ilegal'}</b>
              </div>
              <h3>{mission.name}</h3>
              <p>{mission.notes}</p>
              <div className="blueprint-mission-tags">
                <span>{mission.activity}</span>
                <span>{mission.contractRank}</span>
                <span>{mission.probability}</span>
              </div>
              <dl>
                <div><dt>Sistema</dt><dd>{mission.system}</dd></div>
                <div><dt>Tipo</dt><dd>{mission.activity}</dd></div>
                <div><dt>Rango</dt><dd>{mission.contractRank}</dd></div>
                <div><dt>Reputacion</dt><dd>{mission.minRep ? mission.minRep.toLocaleString('es-ES') : 'N/D'}</dd></div>
                <div><dt>Ganancia</dt><dd>{mission.repReward ? mission.repReward.toLocaleString('es-ES') : 'N/D'}</dd></div>
                <div><dt>Legalidad</dt><dd>{mission.lawful ? 'Legal' : 'Ilegal'}</dd></div>
              </dl>
            </article>
          ))}
        </section>
      ) : (
        <section className="blueprint-empty-route">
          <span className="section-label">Sin contrato detectado</span>
          <h3>No hay ruta de drop en el dataset</h3>
          <p>Este registro existe como item o receta, pero la fuente descargada no lo enlaza a una mision concreta. Lo dejamos visible para busqueda y seguimiento.</p>
        </section>
      )}

      <section className="blueprint-advice">
        <div>
          <span className="section-label">Ruta recomendada</span>
          <h3>Como farmearlo</h3>
          <p>{blueprint.unlockAdvice}</p>
        </div>
        <div className="tool-pill-list">
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
  return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}>{values.map((item) => <option key={item}>{item}</option>)}</select></label>;
}

function blueprintMatches(blueprint, filters) {
  const token = normalize(filters.search);
  const haystack = normalize([blueprint.name, blueprint.category, blueprint.family, blueprint.activity, blueprint.rarity, blueprint.blueprintCode, ...blueprint.bestFor, ...blueprint.missions.flatMap((mission) => [mission.name, mission.faction, mission.system, mission.region, mission.activity, mission.repStanding])].join(' '));
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
