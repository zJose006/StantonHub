import React, { useEffect, useMemo, useState } from 'react';
import { routes } from '../config/routes.js';
import { loadVehicleDetail, loadVehiclesCatalog } from '../services/api.js';
import { money, slugify, textValue, uniqueSorted } from '../utils/format.js';
import { routeClick } from '../utils/navigation.js';
import { isCatalogVehicle, sortShips } from '../utils/ships.js';

const metricDefinitions = [
  ['Salud', 'SAL', (detail) => detail.wiki?.health || detail.vehicle?.wiki?.health, 250000, 'Resistencia estructural de casco.'],
  ['Armadura', 'ARM', (detail) => detail.wiki?.armor?.health || detail.vehicle?.wiki?.armor, 45000, 'Proteccion fisica y energetica del blindaje.'],
  ['Escudos', 'ESC', (detail) => detail.wiki?.shield?.hp || detail.wiki?.shield_hp || detail.vehicle?.wiki?.shieldHp, 260000, 'Capacidad total de escudos.'],
  ['Movimiento', 'MOV', (detail) => detail.wiki?.speed?.max || detail.wiki?.max_speed, 1200, 'Velocidad maxima detectada.'],
  ['SCM', 'SCM', (detail) => detail.wiki?.speed?.scm || detail.wiki?.scm_speed, 260, 'Velocidad practica en maniobra sostenida.'],
  ['Ataque', 'ATQ', (detail) => detail.wiki?.weaponry?.pilot_alpha || detail.combat?.totals?.alphaTotal, 22000, 'Dano alpha principal detectado.'],
  ['Misiles', 'MIS', (detail) => detail.wiki?.weaponry?.total_missile_damage || detail.wiki?.weaponry?.missiles?.damage?.total, 120000, 'Potencial de dano de misiles o torpedos.'],
  ['Carga', 'CRG', (detail) => detail.wiki?.cargo_capacity || detail.vehicle?.scu, 700, 'Capacidad logistica util.']
];

/** Comparador visual de dos naves con grafico operativo y datos clave. */
export function ShipComparePage({ navigate }) {
  const [ships, setShips] = useState([]);
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');
  const [leftDetail, setLeftDetail] = useState(null);
  const [rightDetail, setRightDetail] = useState(null);
  const [status, setStatus] = useState('Cargando catalogo local...');
  const [leftFilters, setLeftFilters] = useState(defaultCompareFilters);
  const [rightFilters, setRightFilters] = useState(defaultCompareFilters);

  useEffect(() => {
    loadVehiclesCatalog()
      .then((payload) => {
        const catalog = sortShips((payload.vehicles || []).filter(isCatalogVehicle), 'name');
        setShips(catalog);
        setLeftId(String(catalog[0]?.id || ''));
        setRightId(String(catalog[1]?.id || catalog[0]?.id || ''));
        setStatus('Selecciona dos naves para comparar sus datos tecnicos.');
      })
      .catch((error) => setStatus('No se pudo cargar el catalogo: ' + error.message));
  }, []);

  useEffect(() => {
    if (!leftId) return;
    setLeftDetail(null);
    loadVehicleDetail(vehicleIdentifier(ships, leftId)).then(setLeftDetail).catch((error) => setStatus(error.message));
  }, [leftId, ships]);

  useEffect(() => {
    if (!rightId) return;
    setRightDetail(null);
    loadVehicleDetail(vehicleIdentifier(ships, rightId)).then(setRightDetail).catch((error) => setStatus(error.message));
  }, [rightId, ships]);

  const leftScores = useMemo(() => leftDetail ? buildCompareScores(leftDetail) : [], [leftDetail]);
  const rightScores = useMemo(() => rightDetail ? buildCompareScores(rightDetail) : [], [rightDetail]);
  const rows = useMemo(() => compareRows(leftDetail, rightDetail), [leftDetail, rightDetail]);
  const specializedSections = useMemo(() => buildSpecializedSections(leftDetail, rightDetail), [leftDetail, rightDetail]);
  const manufacturers = useMemo(() => uniqueSorted(ships.map((ship) => textValue(ship.manufacturer)).filter(Boolean)), [ships]);
  const roles = useMemo(() => uniqueSorted(ships.flatMap((ship) => ship.tags || []).map((tag) => textValue(tag)).filter(Boolean)), [ships]);

  return (
    <main className="container ship-compare-shell">
      <section className="panel ship-compare-control">
        <div>
          <span className="section-label">Comparador</span>
          <h2>Elige dos naves</h2>
          <p>{status}</p>
        </div>
        <p className="ship-compare-hint">Usa los filtros de cada lado para enfrentar modelos concretos, variantes o roles distintos.</p>
      </section>

      <section className="ship-compare-stage">
        <section className="compare-side-column">
          <ShipSelector label="Nave izquierda" ships={ships} value={leftId} onChange={setLeftId} filters={leftFilters} setFilters={setLeftFilters} manufacturers={manufacturers} roles={roles} color="blue" />
          <CompareShipCard detail={leftDetail} color="blue" navigate={navigate} />
        </section>
        <section className="panel compare-radar-panel">
          <span className="section-label">Radar operativo</span>
          <h2>Rendimiento relativo</h2>
          <CompareRadar leftScores={leftScores} rightScores={rightScores} />
          <div className="compare-legend">
            <span><i className="compare-dot blue" />{leftDetail ? textValue(leftDetail.vehicle?.name, 'Nave A') : 'Nave A'}</span>
            <span><i className="compare-dot orange" />{rightDetail ? textValue(rightDetail.vehicle?.name, 'Nave B') : 'Nave B'}</span>
          </div>
          <CompareScoreBoard leftScores={leftScores} rightScores={rightScores} />
        </section>
        <section className="compare-side-column">
          <ShipSelector label="Nave derecha" ships={ships} value={rightId} onChange={setRightId} filters={rightFilters} setFilters={setRightFilters} manufacturers={manufacturers} roles={roles} color="orange" />
          <CompareShipCard detail={rightDetail} color="orange" navigate={navigate} />
        </section>
      </section>

      <section className="panel compare-table-panel">
        <div className="ship-card-heading">
          <span className="ship-system-icon module" aria-hidden="true">VS</span>
          <h3>Datos enfrentados</h3>
        </div>
        <div className="compare-table">
          {rows.map((row) => <CompareDataRow key={row.label} row={row} />)}
        </div>
      </section>

      <section className="panel compare-specialized-panel">
        <div className="ship-card-heading">
          <span className="ship-system-icon turret" aria-hidden="true">SP</span>
          <div>
            <span className="section-label">Propiedades</span>
            <h3>Comparativa especializada</h3>
          </div>
        </div>
        <div className="compare-specialized-grid">
          {specializedSections.map((section) => <SpecializedSection key={section.key} section={section} />)}
        </div>
      </section>
    </main>
  );
}

const defaultCompareFilters = { search: '', manufacturer: '', role: '' };

function ShipSelector({ label, ships, value, onChange, filters, setFilters, manufacturers, roles, color }) {
  const filteredShips = filterCompareShips(ships, filters);
  const selectedExists = filteredShips.some((ship) => String(ship.id) === String(value));
  const selectValue = selectedExists ? value : '';

  return (
    <section className={`panel compare-picker ${color}`}>
      <div>
        <span className="section-label">{label}</span>
        <strong>{filteredShips.length} resultados</strong>
      </div>
      <div className="compare-picker-grid">
        <label>Buscar<input type="search" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Nombre, fabricante..." /></label>
        <label>Fabricante<select value={filters.manufacturer} onChange={(event) => setFilters({ ...filters, manufacturer: event.target.value })}><option value="">Todos</option>{manufacturers.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label>Rol<select value={filters.role} onChange={(event) => setFilters({ ...filters, role: event.target.value })}><option value="">Todos</option>{roles.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label>Nave<select value={selectValue} onChange={(event) => onChange(event.target.value)}><option value="" disabled>{filteredShips.length ? 'Selecciona nave' : 'Sin resultados'}</option>{filteredShips.map((ship) => <option key={ship.id} value={ship.id}>{textValue(ship.name, 'Nave sin nombre')}</option>)}</select></label>
      </div>
    </section>
  );
}

function CompareShipCard({ detail, color, navigate }) {
  if (!detail) {
    return <section className={`panel compare-ship-card ${color}`}><div className="compare-ship-skeleton">Cargando nave...</div></section>;
  }
  const { vehicle, wiki } = detail;
  const name = textValue(vehicle.name, 'Nave sin nombre');
  const image = [vehicle.imageCandidates?.[0], vehicle.photoProxy, vehicle.photo, vehicle.wikiImageProxy].find(Boolean);
  const path = `${routes.ships}/${vehicle.id}-${slugify(name)}`;
  return (
    <section className={`panel compare-ship-card ${color}`}>
      <div className="compare-ship-image">{image ? <img src={image} alt={name} /> : <span>SC</span>}</div>
      <div className="compare-ship-body">
        <span className="section-label">{textValue(vehicle.manufacturer, 'Fabricante desconocido')}</span>
        <h2>{name}</h2>
        <p>{shortDescription(textValue(wiki?.description?.en_EN || wiki?.description || ''), 150)}</p>
        <div className="ship-meta-strip">
          <span>{textValue(wiki?.role || vehicle.tags?.[0], 'Rol N/D')}</span>
          <span>{textValue(wiki?.size || vehicle.padType, 'Tamano N/D')}</span>
          <span>{money(vehicle.pledge?.price, vehicle.pledge?.currency || 'EUR')}</span>
        </div>
        <a className="action-btn" href={path} onClick={(event) => routeClick(event, path, navigate)}>Abrir ficha</a>
      </div>
    </section>
  );
}

function CompareRadar({ leftScores, rightScores }) {
  const scores = leftScores.length ? leftScores : metricDefinitions.map(([label, axis]) => ({ label, axis, value: 0 }));
  const pointAt = (index, value) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / scores.length;
    const radius = (Math.max(0, Math.min(10, Number(value || 0))) / 10) * 38;
    return [50 + Math.cos(angle) * radius, 50 + Math.sin(angle) * radius];
  };
  const polygon = (items) => items.map((score, index) => pointAt(index, score.value).join(',')).join(' ');

  return (
    <div className="compare-radar">
      <svg viewBox="-14 -14 128 128" role="img" aria-label="Grafico comparativo de naves">
        {[2, 4, 6, 8, 10].map((ring) => <polygon key={ring} className="score-grid" points={scores.map((_, index) => pointAt(index, ring).join(',')).join(' ')} />)}
        {scores.map((score, index) => {
          const [x, y] = pointAt(index, 10);
          return <line key={score.axis} className="score-axis" x1="50" y1="50" x2={x} y2={y} />;
        })}
        <polygon className="compare-fill-blue" points={polygon(scores)} />
        <polygon className="compare-fill-orange" points={polygon(rightScores.length ? rightScores : scores.map((score) => ({ ...score, value: 0 })))} />
      </svg>
      {scores.map((score, index) => <span key={score.axis} className={`compare-radar-label compare-radar-label-${index + 1}`}>{score.axis}</span>)}
    </div>
  );
}

function CompareScoreBoard({ leftScores, rightScores }) {
  const scores = leftScores.length ? leftScores : metricDefinitions.map(([label, axis]) => ({ label, axis, value: 0 }));
  const comparison = scores.map((score, index) => ({ ...score, right: rightScores[index]?.value || 0 }));
  return (
    <div className="compare-score-board">
      {comparison.map((score) => (
        <article key={score.label}>
          <span>{score.axis}</span>
          <strong>{score.label}</strong>
          <div>
            <b className="blue">{score.value.toFixed(1)}</b>
            <i />
            <b className="orange">{score.right.toFixed(1)}</b>
          </div>
        </article>
      ))}
    </div>
  );
}

function CompareDataRow({ row }) {
  const winner = compareNumber(row.leftRaw, row.rightRaw, row.higherBetter);
  return (
    <article className="compare-data-row">
      <strong className={winner === 'left' ? 'winner' : ''}>{row.left}</strong>
      <span>{row.label}</span>
      <strong className={winner === 'right' ? 'winner' : ''}>{row.right}</strong>
    </article>
  );
}

function SpecializedSection({ section }) {
  return (
    <section className="compare-specialized-section">
      <header>
        <span>{section.label}</span>
        <h3>{section.title}</h3>
      </header>
      <div className="compare-specialized-rows">
        {section.rows.map((row) => <CompareDataRow key={row.label} row={row} />)}
      </div>
    </section>
  );
}

function filterCompareShips(ships, filters) {
  const search = normalizeText(filters.search);
  const manufacturer = normalizeText(filters.manufacturer);
  const role = normalizeText(filters.role);
  return ships.filter((ship) => {
    const haystack = normalizeText([ship.name, ship.shortName, ship.manufacturer, ...(ship.tags || [])].map(textValue).join(' '));
    if (search && !haystack.includes(search)) return false;
    if (manufacturer && normalizeText(ship.manufacturer) !== manufacturer) return false;
    if (role && !(ship.tags || []).some((tag) => normalizeText(tag) === role)) return false;
    return true;
  });
}

function normalizeText(value) {
  return textValue(value, '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function buildSpecializedSections(leftDetail, rightDetail) {
  const left = buildSpecializedProfile(leftDetail);
  const right = buildSpecializedProfile(rightDetail);
  const sections = [
    {
      key: 'mining',
      label: 'Mineria',
      title: 'Rayo, fractura y extraccion',
      enabled: left.roles.mining || right.roles.mining,
      rows: [
        specializedRow('Herramientas mineria', left.mining.count, right.mining.count, formatNumber),
        specializedRow('Mayor tamano laser', left.mining.maxSize, right.mining.maxSize, sizeValue),
        specializedRow('Potencia detectada', left.mining.power, right.mining.power, segmentOrMissing),
        specializedRow('Inestabilidad', left.mining.instability, right.mining.instability, percentOrMissing, false),
        specializedRow('Componentes clave', left.mining.names, right.mining.names, listValue)
      ]
    },
    {
      key: 'refuel',
      label: 'Repostaje',
      title: 'Combustible y apoyo logistico',
      enabled: left.roles.refuel || right.roles.refuel,
      rows: [
        specializedRow('Pods externos', left.refuel.externalPods, right.refuel.externalPods, formatNumber),
        specializedRow('Puertos / brazos', left.refuel.ports, right.refuel.ports, formatNumber),
        specializedRow('Tanques combustible', left.refuel.tanks, right.refuel.tanks, formatNumber),
        specializedRow('Mayor tamano tanque', left.refuel.maxSize, right.refuel.maxSize, sizeValue),
        specializedRow('Capacidad repostaje', left.refuel.capacity, right.refuel.capacity, capacityValue)
      ]
    },
    {
      key: 'salvage',
      label: 'Chatarreria',
      title: 'Recuperacion y almacenaje',
      enabled: left.roles.salvage || right.roles.salvage,
      rows: [
        specializedRow('Sistemas salvage', left.salvage.count, right.salvage.count, formatNumber),
        specializedRow('Herramientas detectadas', left.salvage.names, right.salvage.names, listValue),
        specializedRow('Carga util', left.cargo.scu, right.cargo.scu, scuValue),
        specializedRow('Stowage', left.cargo.stowage, right.cargo.stowage, microScuValue)
      ]
    },
    {
      key: 'cargo',
      label: 'Carga',
      title: 'Transporte y volumen util',
      enabled: left.roles.cargo || right.roles.cargo,
      rows: [
        specializedRow('SCU', left.cargo.scu, right.cargo.scu, scuValue),
        specializedRow('Stowage', left.cargo.stowage, right.cargo.stowage, microScuValue),
        specializedRow('Compra in-game', left.cargo.purchase, right.cargo.purchase, money, false),
        specializedRow('Alquiler', left.cargo.rental, right.cargo.rental, money, false)
      ]
    },
    {
      key: 'combat',
      label: 'Combate',
      title: 'Armas, torretas y municion',
      enabled: left.roles.combat || right.roles.combat || left.combat.weaponCount || right.combat.weaponCount,
      rows: [
        specializedRow('Armas piloto', left.combat.pilotWeapons, right.combat.pilotWeapons, formatNumber),
        specializedRow('Torretas', left.combat.turrets, right.combat.turrets, formatNumber),
        specializedRow('Mayor tamano canon', left.combat.maxSize, right.combat.maxSize, sizeValue),
        specializedRow('DPS detectado', left.combat.dps, right.combat.dps, formatNumber),
        specializedRow('Municion total', left.combat.ammo, right.combat.ammo, formatNumber),
        specializedRow('Tipos principales', left.combat.damageTypes, right.combat.damageTypes, listValue)
      ]
    }
  ];
  return sections.filter((section) => section.enabled);
}

function buildSpecializedProfile(detail) {
  if (!detail) return emptySpecializedProfile();
  const groups = [...(detail.modules?.groups || []), ...(detail.modules?.items || [])];
  const tags = (detail.vehicle?.tags || []).map(normalizeText);
  const wiki = detail.wiki || {};
  const fuelGroups = groups.filter((group) => /combustible|fuel|hydrogen|quantumfuel|fuelpod|refuel|repost/.test(groupSignal(group)));
  const refuelGroups = fuelGroups.filter((group) => /externalfueltank|fuelpod|fuel\s*pod|fuelport|fuel\s*port|refuel|repost|toolarm|dockingcollar/.test(groupSignal(group)));
  const miningGroups = groups.filter((group) => /mining|mineria|arbor|hofstede|pitman|lawson/.test(groupSignal(group)));
  const salvageGroups = groups.filter((group) => /salvage|salvamento|chatarr|scraper|reclaimer|vulture|recycling/.test(groupSignal(group)));
  const weaponGroups = groups.filter((group) => /armas|weapon|gun|cannon|laser|repeater|gatling|missile|misil|torreta|turret/.test(groupSignal(group)));
  const turretGroups = groups.filter((group) => /torreta|turret/.test(groupSignal(group)));
  const combatWeapons = detail.combat?.weapons || [];

  return {
    roles: {
      mining: tags.includes('mineria') || miningGroups.length > 0,
      refuel: refuelGroups.length > 0,
      salvage: tags.includes('salvage') || salvageGroups.length > 0,
      cargo: tags.includes('cargo') || Number(wiki.cargo_capacity || detail.vehicle?.scu || 0) > 0,
      combat: tags.includes('combate') || weaponGroups.length > 0 || combatWeapons.length > 0
    },
    mining: {
      count: sumCounts(miningGroups),
      maxSize: maxSize(miningGroups),
      power: firstMetric(miningGroups, /(power|laser|optimal|charge|rate)/i),
      instability: firstMetric(miningGroups, /(instability|inestabilidad|resistance|resistencia)/i),
      names: groupNames(miningGroups, 3)
    },
    refuel: {
      externalPods: sumCounts(refuelGroups.filter((group) => /externalfueltank|fuelpod|fuel\s*pod/.test(groupSignal(group)))),
      ports: sumCounts(refuelGroups.filter((group) => /fuelport|fuel\s*port|refuel|toolarm|dockingcollar/.test(groupSignal(group)))),
      tanks: sumCounts(fuelGroups.filter((group) => /tank|fueltank|quantumfueltank/.test(groupSignal(group)))),
      maxSize: maxSize(fuelGroups),
      capacity: firstMetric(fuelGroups, /(capacity|capac|fuel|tank|volume)/i),
      names: groupNames(refuelGroups, 3)
    },
    salvage: {
      count: sumCounts(salvageGroups),
      names: groupNames(salvageGroups, 3)
    },
    cargo: {
      scu: Number(wiki.cargo_capacity || detail.vehicle?.scu || 0),
      stowage: Number(wiki.vehicle_inventory || 0),
      purchase: Number(detail.vehicle?.purchase?.price || 0),
      rental: Number(detail.vehicle?.rental?.price || 0)
    },
    combat: {
      weaponCount: sumCounts(weaponGroups),
      pilotWeapons: combatWeapons.filter((weapon) => !/turret|torreta|missile|misil/i.test([weapon.mountKind, weapon.mount, weapon.name, weapon.type].map(textValue).join(' '))).length || sumCounts(weaponGroups.filter((group) => /weapon|arma|gun|cannon|laser|repeater/.test(groupSignal(group)) && !/turret|torreta|missile|misil/.test(groupSignal(group)))),
      turrets: sumCounts(turretGroups),
      maxSize: Math.max(maxSize(weaponGroups), ...combatWeapons.map((weapon) => Number(weapon.size || 0))),
      dps: Number(wiki.weaponry?.pilot_dps || wiki.weaponry?.turret_dps || detail.combat?.totals?.burst || 0),
      ammo: sumMetric(weaponGroups, /(ammo|ammunition|capacity|rounds)/i),
      damageTypes: uniqueList([...weaponGroups.map((group) => group.meta?.damageType || group.type || group.subType), ...combatWeapons.map((weapon) => weapon.meta?.damageType || weapon.type)])
    }
  };
}

function emptySpecializedProfile() {
  return {
    roles: {},
    mining: { count: 0, maxSize: 0, power: 0, instability: 0, names: [] },
    refuel: { externalPods: 0, ports: 0, tanks: 0, maxSize: 0, capacity: 0, names: [] },
    salvage: { count: 0, names: [] },
    cargo: { scu: 0, stowage: 0, purchase: 0, rental: 0 },
    combat: { weaponCount: 0, pilotWeapons: 0, turrets: 0, maxSize: 0, dps: 0, ammo: 0, damageTypes: [] }
  };
}

function specializedRow(label, leftRaw, rightRaw, formatter, higherBetter = true) {
  return row(label, leftRaw, rightRaw, formatter, higherBetter);
}

function groupSignal(group) {
  return [group.category, group.name, group.type, group.subType, group.className, group.componentClass, group.mount, ...(group.mounts || [])].map(normalizeText).join(' ');
}

function sumCounts(groups) {
  return groups.reduce((sum, group) => sum + (Number(group.count || group.totalInstalled || 1) || 1), 0);
}

function maxSize(groups) {
  return Math.max(0, ...groups.map((group) => Number(group.size || group.equippedSize || group.meta?.size || 0)).filter(Number.isFinite));
}

function groupNames(groups, limit = 4) {
  return uniqueList(groups.map((group) => cleanName(group.name || group.examples?.[0]?.mount || group.type)).filter(Boolean)).slice(0, limit);
}

function uniqueList(values) {
  return [...new Set(values.map((value) => textValue(value, '').trim()).filter(Boolean).filter((value) => !/^(modulo|weapons|turrets|fuel tanks|fuel intakes|n\/d)$/i.test(value)))];
}

function cleanName(value) {
  const text = textValue(value, '').replace(/_/g, ' ').trim();
  return /hardpoint|placeholder|itemport|decal|\$slot|control panel|light group|button/i.test(text) ? '' : text;
}

function firstMetric(groups, keyPattern) {
  for (const group of groups) {
    const found = findNumericByKey(group, keyPattern);
    if (found) return found;
  }
  return 0;
}

function sumMetric(groups, keyPattern) {
  return groups.reduce((sum, group) => sum + (findNumericByKey(group, keyPattern) || 0), 0);
}

function findNumericByKey(value, keyPattern, depth = 0) {
  if (!value || depth > 5) return 0;
  if (Array.isArray(value)) return value.reduce((found, item) => found || findNumericByKey(item, keyPattern, depth + 1), 0);
  if (typeof value !== 'object') return 0;
  for (const [key, child] of Object.entries(value)) {
    if (keyPattern.test(key)) {
      const number = Number(child);
      if (Number.isFinite(number) && number > 0) return number;
    }
    const found = findNumericByKey(child, keyPattern, depth + 1);
    if (found) return found;
  }
  return 0;
}

function vehicleIdentifier(ships, id) {
  const ship = ships.find((item) => String(item.id) === String(id));
  return ship ? `${ship.id}-${slugify(ship.name)}` : id;
}

function buildCompareScores(detail) {
  return metricDefinitions.map(([label, axis, getter, max, reason]) => {
    const raw = Number(getter(detail) || 0);
    return { label, axis, value: scoreScale(raw, max), reason };
  });
}

function compareRows(leftDetail, rightDetail) {
  const left = leftDetail || {};
  const right = rightDetail || {};
  return [
    row('Precio pledge', left.vehicle?.pledge?.price, right.vehicle?.pledge?.price, (value) => money(value, 'EUR'), false),
    row('Compra in-game', left.vehicle?.purchase?.price, right.vehicle?.purchase?.price, money, false),
    row('Carga', left.wiki?.cargo_capacity || left.vehicle?.scu, right.wiki?.cargo_capacity || right.vehicle?.scu, (value) => value ? `${formatNumber(value)} SCU` : 'N/D'),
    row('Tripulacion', left.wiki?.crew?.max || left.vehicle?.crew, right.wiki?.crew?.max || right.vehicle?.crew, formatNumber),
    row('Masa', left.wiki?.mass_total || left.vehicle?.mass, right.wiki?.mass_total || right.vehicle?.mass, (value) => value ? `${formatNumber(value)} kg` : 'N/D', false),
    row('SCM', left.wiki?.speed?.scm, right.wiki?.speed?.scm, (value) => value ? `${formatNumber(value)} m/s` : 'N/D'),
    row('Velocidad max.', left.wiki?.speed?.max, right.wiki?.speed?.max, (value) => value ? `${formatNumber(value)} m/s` : 'N/D'),
    row('HP casco', left.wiki?.health || left.vehicle?.wiki?.health, right.wiki?.health || right.vehicle?.wiki?.health, formatNumber),
    row('Escudos', left.wiki?.shield?.hp || left.vehicle?.wiki?.shieldHp, right.wiki?.shield?.hp || right.vehicle?.wiki?.shieldHp, formatNumber),
    row('Alpha piloto', left.wiki?.weaponry?.pilot_alpha || left.combat?.totals?.alphaTotal, right.wiki?.weaponry?.pilot_alpha || right.combat?.totals?.alphaTotal, formatNumber)
  ];
}

function row(label, leftRaw, rightRaw, formatter, higherBetter = true) {
  return {
    label,
    leftRaw: Number(leftRaw || 0),
    rightRaw: Number(rightRaw || 0),
    left: formatter(leftRaw),
    right: formatter(rightRaw),
    higherBetter
  };
}

function compareNumber(left, right, higherBetter = true) {
  if (!left || !right || left === right) return '';
  if (higherBetter) return left > right ? 'left' : 'right';
  return left < right ? 'left' : 'right';
}

function scoreScale(value, max) {
  const number = Number(value || 0);
  return Math.max(0, Math.min(10, Math.round((number / max) * 100) / 10));
}

function formatNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number ? Number.isInteger(number) ? number.toLocaleString('es-ES') : number.toLocaleString('es-ES', { maximumFractionDigits: 2 }) : 'N/D';
}

function sizeValue(value) {
  const number = Number(value || 0);
  return number ? `S${formatNumber(number)}` : 'N/D';
}

function scuValue(value) {
  return Number(value || 0) ? `${formatNumber(value)} SCU` : 'N/D';
}

function microScuValue(value) {
  const number = Number(value || 0);
  return number ? `${formatNumber(Math.round(number / 1000))}K uSCU` : 'N/D';
}

function capacityValue(value) {
  return Number(value || 0) ? formatNumber(value) : 'N/D';
}

function segmentOrMissing(value) {
  return Number(value || 0) ? formatNumber(value) : 'N/D';
}

function percentOrMissing(value) {
  return Number(value || 0) ? `${formatNumber(value)}%` : 'N/D';
}

function listValue(value) {
  return Array.isArray(value) && value.length ? value.join(', ') : 'N/D';
}

function shortDescription(value, max) {
  const text = textValue(value, '');
  return text.length <= max ? text : `${text.slice(0, max - 3).trim()}...`;
}
