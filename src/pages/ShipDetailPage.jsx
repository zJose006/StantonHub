import React, { useEffect, useState } from 'react';
import { routes } from '../config/routes.js';
import { requestJson } from '../services/api.js';
import { money, meters, textValue } from '../utils/format.js';
import { routeClick } from '../utils/navigation.js';

/** Ficha completa de una nave almacenada en local, incluyendo precios, modulos y combate. */
export function ShipDetailPage({ identifier, navigate }) {
  const [detail, setDetail] = useState(null);
  const [status, setStatus] = useState('Cargando ficha local...');

  useEffect(() => {
    requestJson('/api/vehicles/' + encodeURIComponent(identifier))
      .then((payload) => { setDetail(payload); setStatus('Ficha cargada desde Base de datos local.'); })
      .catch((error) => setStatus(error.message));
  }, [identifier]);

  if (!detail) {
    return <main className="container single-column"><section className="panel ship-detail-panel"><span className="section-label">Nave</span><h2>Ficha tecnica</h2><p className="auth-message">{status}</p><BackLink navigate={navigate} /></section></main>;
  }

  const { vehicle, raw, wiki, combat, modules, prices, curiosity } = detail;
  const image = [vehicle.imageCandidates?.[0], vehicle.photoProxy, vehicle.photo, vehicle.wikiImageProxy].find(Boolean);
  const shipName = textValue(vehicle.name, 'Nave sin nombre');
  const moduleGroups = (modules?.groups || vehicle.modules?.groups || []).filter(isVisibleModuleGroup);
  const moduleItems = modules?.items || vehicle.modules?.items || [];
  const weaponGroups = groupWeaponsByMountKind(combat?.weapons || [], moduleItems);
  const wikiLoadoutGroups = moduleGroups.filter((group) => /torreta|misil|pdc|plc|contramedida/i.test(textValue(group.category)));
  const defenseGroups = moduleGroups.filter((group) => /escudo|shield|armadura|armor/i.test(textValue(group.category)));
  const powerGroups = moduleGroups.filter((group) => /planta|power|cooler|quantum|fuel|sensor|computadora|computer|modulo/i.test(textValue(group.category)));
  const technical = buildTechnicalSections(vehicle, wiki, combat);
  const scores = buildShipScores(vehicle, wiki, combat);
  const description = textValue(wiki?.description?.en_EN || wiki?.description || curiosity);

  return (
    <main className="container ship-detail-shell">
      <section className="ship-command-grid">
        <section className="panel ship-overview-panel">
          <div className="ship-detail-media">{image ? <img src={image} alt={shipName} /> : <span>SC</span>}</div>
          <div className="ship-overview-copy">
            <span className="section-label">{textValue(vehicle.manufacturer, 'Fabricante desconocido')}</span>
            <div className="ship-title-line"><h2>{shipName}</h2><span>{money(vehicle.pledge?.price, textValue(vehicle.pledge?.currency, 'EUR'))}</span></div>
            <p>{description}</p>
            <div className="ship-meta-strip">
              <span>{textValue(wiki?.role || vehicle.tags?.[0], 'Combate')}</span>
              <span>{textValue(wiki?.career || vehicle.tags?.[1], 'Heavy Gunship')}</span>
              <span>S{textValue(wiki?.size || vehicle.padType, 'N/D')}</span>
              <span>{technical.identity.version}</span>
            </div>
            <div className="ship-detail-actions"><BackLink navigate={navigate} />{vehicle.storeUrl && <a className="action-btn" href={vehicle.storeUrl} target="_blank" rel="noreferrer">RSI Store</a>}</div>
          </div>
        </section>

        <section className="panel ship-telemetry-panel">
          <MetricCluster title="Storage" groups={technical.storage} />
          <MetricCluster title="Stats" groups={technical.stats} />
          <MetricCluster title="Defense" groups={technical.defense} />
          <div className="ship-identity-line"><span>Class {technical.identity.className}</span><span>ID {technical.identity.uuid}</span></div>
        </section>
      </section>

      <section className="ship-score-panel panel">
        <div>
          <span className="section-label">Evaluacion</span>
          <h2>Puntuacion operacional</h2>
        </div>
        <ScoreOctagon scores={scores} />
      </section>

      <section className="ship-combat-grid">
        <MetricPanel icon="weapon" title="Weaponry" sections={technical.weaponry} />
        <MetricPanel icon="module" title="Resource Network" sections={technical.resources} />
        <MetricPanel icon="shield" title="Armor" sections={technical.armor} />
        <MetricPanel icon="shield" title="Shield" sections={technical.shield} />
      </section>

      <section className="panel ship-weapons-panel">
        <PanelTitle icon="turret" label="Hardpoints" title="Armamento instalado" />
        {weaponGroups.length ? <div className="ship-weapon-detail-grid">{weaponGroups.map((group) => <WeaponMountGroup key={String(group.kind)} group={group} />)}</div> : <p className="auth-message">No hay armas de hardpoint disponibles para esta nave en la cache local.</p>}
      </section>

      <section className="panel ship-weapons-panel">
        <PanelTitle icon="turret" label="Loadout" title="Torretas, misiles y sistemas" />
        {wikiLoadoutGroups.length ? <div className="ship-module-grid">{wikiLoadoutGroups.map((group) => <ModuleGroupRow key={`loadout-${group.category}-${group.size}`} group={group} />)}</div> : <p className="auth-message">No hay torretas o misiles detallados para esta nave.</p>}
      </section>

      <section className="panel ship-weapons-panel">
        <PanelTitle icon="module" label="Componentes" title="Sistemas de nave" />
        <div className="ship-system-zones">
          <SystemZone icon="shield" title="Escudos y blindaje" groups={defenseGroups} />
          <SystemZone icon="module" title="Energia, refrigeracion y soporte" groups={powerGroups.length ? powerGroups : moduleGroups} />
        </div>
      </section>

      <details className="panel ship-technical-details">
        <summary>Datos tecnicos completos</summary>
        <section className="ship-raw-grid">
          <RawCard title="Datos normalizados" data={vehicle} />
          <RawCard title="UEX raw" data={raw} />
          <RawCard title="Datos externos raw" data={wiki} />
          <RawCard title="Modulos normalizados" data={modules || vehicle.modules} />
          <RawCard title="Precios raw" data={prices} />
        </section>
      </details>
    </main>
  );
}

function BackLink({ navigate }) {
  return <a className="action-btn primary-action" href={routes.ships} onClick={(event) => routeClick(event, routes.ships, navigate)}>Volver a naves</a>;
}

function MetricCluster({ title, groups }) {
  return (
    <section className="metric-cluster">
      <h3>{title}</h3>
      <dl>{groups.map(([label, value]) => <div key={label}><dt>{label}</dt><MetricValue value={value} /></div>)}</dl>
    </section>
  );
}

function MetricPanel({ icon, title, sections }) {
  return (
    <section className="panel ship-metric-panel">
      <div className="ship-card-heading"><SystemIcon type={icon} /><h3>{title}</h3></div>
      <div className="metric-section-grid">
        {sections.map((section) => (
          <section className="metric-section" key={section.title}>
            <h4>{section.title}</h4>
            <dl>{section.items.map(([label, value]) => <div key={label}><dt>{label}</dt><MetricValue value={value} /></div>)}</dl>
          </section>
        ))}
      </div>
    </section>
  );
}

function MetricValue({ value }) {
  const text = textValue(value, 'N/D');
  const className = /^-/.test(text) ? 'metric-negative' : /^\+/.test(text) ? 'metric-positive' : '';
  return <dd className={className}>{text}</dd>;
}

function ScoreOctagon({ scores }) {
  const points = scores.map((score, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / scores.length;
    const radius = 22 + (Math.max(0, Math.min(10, score.value)) / 10) * 48;
    return `${50 + Math.cos(angle) * radius},${50 + Math.sin(angle) * radius}`;
  }).join(' ');
  const average = scores.reduce((sum, score) => sum + score.value, 0) / scores.length;
  return (
    <div className="score-octagon-wrap">
      <div className="score-octagon">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <polygon className="score-grid outer" points="50,2 84,16 98,50 84,84 50,98 16,84 2,50 16,16" />
          <polygon className="score-grid mid" points="50,18 73,27 82,50 73,73 50,82 27,73 18,50 27,27" />
          <polygon className="score-fill" points={points} />
        </svg>
        <div className="score-total"><strong>{average.toFixed(1)}</strong><span>/10</span></div>
      </div>
      <div className="score-list">
        {scores.map((score) => <div key={score.label}><span>{score.label}</span><strong>{score.value.toFixed(1)}</strong></div>)}
      </div>
    </div>
  );
}

function PanelTitle({ icon, label, title }) {
  return (
    <div className="panel-header ship-panel-title">
      <SystemIcon type={icon} />
      <div>
        <span className="section-label">{label}</span>
        <h2>{title}</h2>
      </div>
    </div>
  );
}

function buildTechnicalSections(vehicle, wiki = {}, combat = {}) {
  const weaponry = wiki.weaponry || {};
  const armor = wiki.armor || {};
  const shield = wiki.shield || {};
  const signature = wiki.signature || {};
  const speed = wiki.speed || {};
  const cooling = wiki.cooling || {};
  const power = wiki.power || {};
  const crew = wiki.crew || {};
  return {
    identity: {
      className: textValue(wiki.class_name || wiki.className, 'N/D'),
      uuid: textValue(wiki.uuid || vehicle.wiki?.uuid, 'N/D'),
      version: textValue(wiki.game_version || wiki.version || vehicle.gameVersion, 'N/D')
    },
    storage: [
      ['Cargo', wiki.cargo_capacity ? `${formatNumber(wiki.cargo_capacity)} SCU` : vehicle.scu ? `${vehicle.scu} SCU` : 'N/D'],
      ['Stowage', wiki.vehicle_inventory ? `${formatNumber(Math.round(wiki.vehicle_inventory / 1000))}K µSCU` : 'N/D']
    ],
    stats: [
      ['Crew', formatNumber(crew.max || crew.min || vehicle.crew)],
      ['Dimensions', formatNumber(wiki.cross_section_max || wiki.cross_section?.height || 0)],
      ['Mass', wiki.mass_total ? `${formatNumber(wiki.mass_total)} kg` : vehicle.mass ? `${formatNumber(vehicle.mass)} kg` : 'N/D'],
      ['IR', formatNumber(signature.ir_shields || wiki.emission?.ir)],
      ['EM', formatNumber(signature.em_shields || wiki.emission?.em_idle)],
      ['SCM', speed.scm ? `${formatNumber(speed.scm)} m/s` : 'N/D'],
      ['Max', speed.max ? `${formatNumber(speed.max)} m/s` : 'N/D']
    ],
    defense: [
      ['HP', formatNumber(wiki.health || vehicle.wiki?.health)],
      ['Shield', formatNumber(shield.hp || wiki.shield_hp || vehicle.wiki?.shieldHp)]
    ],
    weaponry: [
      { title: 'Pilot Weapons', items: [
        ['DPS', formatNumber(weaponry.pilot_dps || combat.totals?.burst)],
        ['Sustained DPS', formatNumber(weaponry.pilot_sustained_dps || combat.totals?.sustained60s)],
        ['Alpha', formatNumber(weaponry.pilot_alpha || combat.totals?.alphaTotal)]
      ] },
      { title: 'Turrets', items: [
        ['DPS', formatNumber(weaponry.turret_dps)],
        ['Sustained DPS', formatNumber(weaponry.turret_sustained_dps)],
        ['Alpha', formatNumber(weaponry.turret_alpha)]
      ] },
      { title: 'Missiles', items: [
        ['Count', formatNumber(weaponry.missiles?.count)],
        ['Total Damage', formatNumber(weaponry.total_missile_damage || weaponry.missiles?.damage?.total)]
      ] }
    ],
    resources: [
      { title: 'Signature', items: [
        ['IR', formatNumber(signature.ir_shields || wiki.emission?.ir)],
        ['EM', formatNumber(signature.em_shields || wiki.emission?.em_idle)],
        ['Quantum EM', formatNumber(signature.em_groups_quantum?.PowerPlant || signature.em_quantum)]
      ] },
      { title: 'Cooling', items: [
        ['Generation', cooling.generation_segments ? `${formatNumber(cooling.generation_segments)} segmentos` : 'N/D'],
        ['Shields used', cooling.used_segments_shields ? `${formatNumber(cooling.used_segments_shields)} seg.` : 'N/D'],
        ['Quantum used', cooling.used_segments_quantum ? `${formatNumber(cooling.used_segments_quantum)} seg.` : 'N/D'],
        ['Shields usage', percent(cooling.usage_shields_pct)],
        ['Quantum usage', percent(cooling.usage_quantum_pct)]
      ] },
      { title: 'Power', items: [
        ['Generation', power.generation_segments ? `${formatNumber(power.generation_segments)} segmentos` : 'N/D'],
        ['Shields used', power.used_segments_shields ? `${formatNumber(power.used_segments_shields)} seg.` : 'N/D'],
        ['Quantum used', power.used_segments_quantum ? `${formatNumber(power.used_segments_quantum)} seg.` : 'N/D']
      ] }
    ],
    armor: [
      { title: 'Health & Deflection', items: [
        ['Health', armor.health ? `${formatNumber(armor.health)} HP` : 'N/D'],
        ['Physical def.', formatNumber(armor.deflection?.physical)],
        ['Energy def.', formatNumber(armor.deflection?.energy)]
      ] },
      { title: 'Damage Multipliers', items: [
        ['Physical', signedPercent(armor.damage_multiplier?.physical_change)],
        ['Energy', signedPercent(armor.damage_multiplier?.energy_change)],
        ['Distortion', signedPercent(armor.damage_multiplier?.distortion_change)]
      ] },
      { title: 'Signal Multipliers', items: [
        ['EM', signedPercent(armor.signal_multiplier?.electromagnetic_change)],
        ['IR', signedPercent(armor.signal_multiplier?.infrared_change)],
        ['CS', signedPercent(armor.signal_multiplier?.cross_section_change)]
      ] }
    ],
    shield: [
      { title: 'Info', items: [
        ['Face type', textValue(shield.face_type, 'N/D')],
        ['Hit points', shield.hp ? `${formatNumber(shield.hp)} HP` : 'N/D'],
        ['Regeneration', shield.regeneration_time ? `${formatNumber(shield.regeneration_time)}s (${formatNumber(shield.regeneration)} HP/s)` : 'N/D']
      ] },
      { title: 'Resistance', items: [
        ['Physical', percent(shield.resistance?.physical?.maximum)],
        ['Energy', percent(shield.resistance?.energy?.maximum)],
        ['Distortion', percent(shield.resistance?.distortion?.maximum)]
      ] }
    ]
  };
}

function buildShipScores(vehicle, wiki = {}, combat = {}) {
  const speed = wiki.speed || {};
  const weaponry = wiki.weaponry || {};
  const armor = wiki.armor || {};
  const shield = wiki.shield || {};
  const cargo = Number(wiki.cargo_capacity || vehicle.scu || 0);
  return [
    ['Salud', scoreScale(wiki.health || vehicle.wiki?.health, 250000)],
    ['Armadura', scoreScale(armor.health || vehicle.wiki?.armor, 45000)],
    ['Escudos', scoreScale(shield.hp || wiki.shield_hp || vehicle.wiki?.shieldHp, 260000)],
    ['Movimiento', scoreScale(speed.max || wiki.max_speed, 1200)],
    ['SCM', scoreScale(speed.scm || wiki.scm_speed, 260)],
    ['Armamento', scoreScale(weaponry.pilot_alpha || combat.totals?.alphaTotal, 22000)],
    ['Misiles', scoreScale(weaponry.total_missile_damage || weaponry.missiles?.damage?.total, 120000)],
    ['Carga', scoreScale(cargo, 700)]
  ].map(([label, value]) => ({ label, value }));
}

function scoreScale(value, max) {
  const number = Number(value || 0);
  if (!number || !max) return 0;
  return Math.max(0, Math.min(10, Math.round((number / max) * 100) / 10));
}

function WeaponMountGroup({ group }) {
  return (
    <section className="weapon-kind-block">
      <header>
        <SystemIcon type={iconForMount(group.kind)} />
        <div>
          <h3>{textValue(group.label, 'Armamento')}</h3>
          <p>Armamento agrupado por montaje, tipo y tamano.</p>
        </div>
        <span className="system-count-badge">{group.count}</span>
      </header>
      <div className="weapon-detail-list">
        {group.weaponLines.map((line, index) => <WeaponDetailCard key={`${group.kind}-${line.title}-${index}`} line={line} />)}
      </div>
    </section>
  );
}

function WeaponDetailCard({ line }) {
  const weapon = line.weapon || {};
  const meta = line.meta || weapon.meta || {};
  return (
    <article className="weapon-detail-card">
      <div className="weapon-detail-heading">
        <div>
          <strong>{line.title}</strong>
          <span>{line.count > 1 ? `${line.count} unidades - ` : ''}{textValue(weapon.name, 'Arma sin nombre')}</span>
        </div>
        <div className="card-badge-stack">
          {line.count > 1 && <span className="system-count-badge">x{line.count}</span>}
          <span className="weapon-size-badge">{weapon.size ? `S${weapon.size}` : 'S/N'}</span>
        </div>
      </div>
      <dl className="weapon-compact-stats">
        <div><dt>Tipo</dt><dd>{textValue(meta.damageType, 'N/D')}</dd></div>
        <div><dt>DPS</dt><dd>{numberOrMissing(line.damagePerUnit?.sustained60s || weapon.damage?.burst)}</dd></div>
        <div><dt>Alpha total</dt><dd>{numberOrMissing(line.damageTotal?.alphaTotal)}</dd></div>
      </dl>
    </article>
  );
}

function ModuleGroupRow({ group }) {
  const meta = group.meta || {};
  const mounts = group.mounts?.length ? group.mounts.map((item) => textValue(item)).filter(Boolean).slice(0, 3).join(', ') : 'N/D';
  const title = textValue(group.name, group.examples?.[0] || textValue(group.category, 'Modulo'));
  const spec = [group.size && group.size !== 'N/D' ? `S${group.size}` : '', textValue(group.grade || meta.grade) ? `Grado ${textValue(group.grade || meta.grade)}` : '', textValue(meta.componentClass)].filter(Boolean).join(' · ') || textValue(group.category, 'Modulo');
  return (
    <article className="ship-module-row">
      <div className="module-row-heading">
        <div>
          <strong>{title}</strong>
          <span>{spec}</span>
        </div>
        <span className="system-count-badge">x{group.count || 1}</span>
      </div>
      <dl>
        <div><dt>Categoria</dt><dd>{textValue(group.category, 'N/D')}</dd></div>
        <div><dt>Grado</dt><dd>{textValue(group.grade || meta.grade, 'N/D')}</dd></div>
        <div><dt>Clase</dt><dd>{textValue(meta.componentClass, 'N/D')}</dd></div>
        <div><dt>Tamano</dt><dd>{textValue(group.size, 'N/D')}</dd></div>
        <div><dt>Tipo</dt><dd>{textValue(meta.moduleType || group.type, 'N/D')}</dd></div>
        <div><dt>Fabricante</dt><dd>{textValue(meta.manufacturer, 'N/D')}</dd></div>
        <div><dt>Energia</dt><dd>{numberOrMissing(meta.powerDraw)}</dd></div>
        <div><dt>Salud</dt><dd>{numberOrMissing(meta.health)}</dd></div>
        <div><dt>Velocidad</dt><dd>{numberOrMissing(meta.speed)}</dd></div>
        <div><dt>Consumo</dt><dd>{numberOrMissing(meta.fuelRate)}</dd></div>
        <div className="wide"><dt>Montaje</dt><dd>{mounts}</dd></div>
      </dl>
    </article>
  );
}

function isVisibleModuleGroup(group) {
  const title = textValue(group.name || group.examples?.[0]);
  const signal = [title, group.category, group.type, group.subType, group.meta?.componentClass].map((value) => textValue(value)).join(' ');
  if (!title || /^unknown$/i.test(title)) return false;
  if (/placeholder|hardpoint_|itemport_|controller|weapon rack|weapon_rack/i.test(signal)) return false;
  if (/^(weapons|weapon|missiles|shields|shield|heat|power|comms|security|mec|pow|ven|bar\d*)$/i.test(title)) return false;
  return true;
}

function SystemZone({ icon, title, groups }) {
  return (
    <section className="ship-system-zone">
      <header>
        <SystemIcon type={icon} />
        <h3>{title}</h3>
      </header>
      {groups.length ? <div className="ship-module-grid">{groups.map((group) => <ModuleGroupRow key={`${title}-${group.category}-${group.size}`} group={group} />)}</div> : <p className="auth-message">Sin datos detallados para este sistema.</p>}
    </section>
  );
}

function DetailCard({ icon, title, items }) {
  return (
    <section className="panel ship-detail-card">
      <div className="ship-card-heading"><SystemIcon type={icon} /><h3>{title}</h3></div>
      <dl>{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{textValue(value, 'N/D') || 'N/D'}</dd></div>)}</dl>
    </section>
  );
}

function SystemIcon({ type }) {
  const paths = {
    shield: <path d="M12 3l7 2.8v5.7c0 4.4-2.9 7.7-7 9.5-4.1-1.8-7-5.1-7-9.5V5.8L12 3zm0 3.1L7.5 7.9v3.6c0 3 1.7 5.2 4.5 6.6 2.8-1.4 4.5-3.6 4.5-6.6V7.9L12 6.1z" />,
    weapon: <path d="M4 14.5l9.8-9.8 5.5 5.5-9.8 9.8H4v-5.5zm2 1.1V18h2.4l8.1-8.1-2.4-2.4L6 15.6zm9.2-12L17 1.8 22.2 7 20.4 8.8 15.2 3.6z" />,
    turret: <path d="M4 16h16v3H4v-3zm2-4h8.5l3.5-5 2 1.4-4.2 6.1H6V12zm1.5-5h5v3h-5V7z" />,
    price: <path d="M12 3a9 9 0 109 9h-2.2A6.8 6.8 0 1112 5.2V3zm1 4v2.1h3V11h-3v1.8h3v1.9h-3V17h-2.1v-2.3H8.5v-1.9h2.4V11H8.5V9.1h2.4V7H13z" />,
    speed: <path d="M12 4a9 9 0 018.7 11.4h-2.4A6.7 6.7 0 1012 18.7c1.1 0 2.2-.3 3.1-.8l1.6 1.6A9 9 0 1112 4zm4.9 4.7l1.4 1.4-5 5a2 2 0 11-1.4-1.4l5-5z" />,
    module: <path d="M8 3h8v3h3v8h-3v7H8v-7H5V6h3V3zm2 2v3H7v4h3v7h4v-7h3V8h-3V5h-4z" />,
    ship: <path d="M12 2l6 13-4.4-1.6L12 22l-1.6-8.6L6 15 12 2zm0 5.2l-2.2 4.9 2.2-.8 2.2.8L12 7.2z" />
  };
  return <span className={`ship-system-icon ${type || 'module'}`} aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">{paths[type] || paths.module}</svg></span>;
}

function iconForMount(kind) {
  if (/torreta|pdc|plc/i.test(textValue(kind))) return 'turret';
  if (/misil/i.test(textValue(kind))) return 'weapon';
  return 'weapon';
}

function RawCard({ title, data }) {
  return <section className="panel ship-raw-card"><h3>{title}</h3><pre>{JSON.stringify(scrubTechnicalData(data || {}), null, 2)}</pre></section>;
}

function scrubTechnicalData(value) {
  if (Array.isArray(value)) return value.map(scrubTechnicalData);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !/apiUrl|source/i.test(key))
      .map(([key, child]) => [key, scrubTechnicalData(child)]));
  }
  if (typeof value === 'string') return value.replace(/Star Citizen Wiki/gi, 'Datos externos').replace(/https?:\/\/api\.star-citizen\.wiki[^\s"]*/gi, 'URL tecnica');
  return value;
}

function numberOrMissing(value) {
  const number = Number(value || 0);
  return number ? Math.round(number).toLocaleString('es-ES') : 'N/D';
}

function formatNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number ? Number.isInteger(number) ? number.toLocaleString('es-ES') : number.toLocaleString('es-ES', { maximumFractionDigits: 2 }) : 'N/D';
}

function percent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'N/D';
  return `${Math.round(number * 1000) / 10}%`;
}

function signedPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'N/D';
  const pct = Math.round(number * 1000) / 10;
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

function classifyWeaponMount(value) {
  const text = textValue(value).toLowerCase();
  if (/pdc|point\s*defen[sc]e|pointdefense|plc/.test(text)) return 'PDC / PLC';
  if (/remote.*turret|turret.*remote|remota/.test(text)) return 'Torreta remota';
  if (/manned.*turret|turret.*manned|tripulada|mann?ed/.test(text)) return 'Torreta tripulada';
  if (/turret|torreta/.test(text)) return 'Torreta';
  if (/missile|rack|rocket|torpedo|misil/.test(text)) return 'Misiles';
  if (/weapon|gun|arma|hardpoint/.test(text)) return 'Arma pilotada';
  return 'Otro';
}

function groupWeaponsByMountKind(weapons, moduleItems = []) {
  const catalog = buildWeaponCatalog(moduleItems);
  const mergedWeapons = mergeCombatAndModuleWeapons(weapons, catalog);
  const groups = new Map();
  for (const weapon of mergedWeapons || []) {
    const kind = inferWeaponMountKind(weapon, catalog);
    if (!groups.has(kind)) {
      groups.set(kind, {
        kind,
        label: kind,
        count: 0,
        sizes: [],
        examples: [],
        weapons: [],
        weaponLines: [],
        damagePerWeapon: { alphaTotal: 0, sustained60s: 0 },
        damageTotal: { alphaTotal: 0, sustained60s: 0 }
      });
    }
    const group = groups.get(kind);
    const count = Number(weapon.countOverride || 1);
    group.count += count;
    group.weapons.push(weapon);
    const size = Number(weapon.size || 0) ? `S${Number(weapon.size)}` : 'N/D';
    if (!group.sizes.includes(size)) group.sizes.push(size);
    if (group.examples.length < 5) group.examples.push(`${textValue(weapon.name, 'Arma sin nombre')} (${textValue(weapon.mount, kind)})`);
    const alpha = Number(weapon?.damage?.alphaTotal || 0);
    const sustained = Number(weapon?.damage?.sustained60s || 0);
    group.damageTotal.alphaTotal += alpha * count;
    group.damageTotal.sustained60s += sustained * count;
    group.damagePerWeapon.alphaTotal = Math.max(group.damagePerWeapon.alphaTotal, alpha);
    group.damagePerWeapon.sustained60s = Math.max(group.damagePerWeapon.sustained60s, sustained);
  }

  for (const group of groups.values()) {
    group.weaponLines = buildWeaponLines(group.weapons, group.kind);
  }

  const order = ['Arma pilotada', 'Torreta tripulada', 'Torreta remota', 'Torreta', 'PDC / PLC', 'Misiles', 'Otro'];
  return [...groups.values()].sort((a, b) => {
    const first = order.indexOf(a.kind);
    const second = order.indexOf(b.kind);
    return (first === -1 ? 99 : first) - (second === -1 ? 99 : second);
  });
}

function buildWeaponCatalog(moduleItems) {
  const byName = new Map();
  const weapons = [];
  const turretSizes = new Set();
  const mannedSizes = new Set();
  const remoteSizes = new Set();

  for (const item of moduleItems || []) {
    const category = textValue(item.category);
    const signal = [item.name, item.type, item.subType, item.className, item.mount].map((value) => textValue(value)).join(' ');
    const size = Number(item.size || item.equippedSize || 0) || null;
    if (/torreta/i.test(category) && size) {
      turretSizes.add(size);
      if (/manned|tripulada|s4|hammerhead/i.test(signal)) mannedSizes.add(size);
      if (/remote|remota|s7|tiburon/i.test(signal)) remoteSizes.add(size);
    }
    if (!isUsableWeaponModule(item)) continue;
    const normalized = normalizeWeaponName(item.name);
    const entry = {
      name: textValue(item.name, 'Arma'),
      normalized,
      size,
      type: textValue(item.type),
      className: textValue(item.className),
      mount: textValue(item.mount),
      meta: {
        ...(item.meta || {}),
        damageType: inferModuleDamageType(item),
        manufacturer: textValue(item.meta?.manufacturer)
      }
    };
    weapons.push(entry);
    byName.set(normalized, entry);
  }

  return { weapons, byName, turretSizes, mannedSizes, remoteSizes };
}

function isUsableWeaponModule(item) {
  const name = textValue(item.name);
  const category = textValue(item.category);
  const signal = [name, item.type, item.subType, item.className, item.mount].map((value) => textValue(value)).join(' ');
  if (!name || /^unknown$/i.test(name) || /placeholder|weapon rack|weapon_rack|controller|countermeasure|decoy|noise|chaff|flare|hardpoint_/i.test(signal)) return false;
  if (!/armas/i.test(category)) return false;
  if (/^s\d+\s+(weapon|laser)$/i.test(name)) return false;
  return /WeaponGun/i.test(signal);
}

function mergeCombatAndModuleWeapons(combatWeapons, catalog) {
  const merged = [];
  const seen = new Set();
  for (const weapon of combatWeapons || []) {
    const catalogItem = catalog.byName.get(normalizeWeaponName(weapon.name));
    const mergedWeapon = catalogItem ? {
      ...weapon,
      size: catalogItem.size || weapon.size,
      type: catalogItem.type || weapon.type,
      className: catalogItem.className || weapon.className,
      meta: { ...(weapon.meta || {}), ...(catalogItem.meta || {}) }
    } : weapon;
    merged.push(mergedWeapon);
    seen.add(normalizeWeaponName(mergedWeapon.name));
  }

  for (const item of catalog.weapons) {
    if (seen.has(item.normalized)) continue;
    merged.push({
      name: item.name,
      size: item.size,
      type: item.type,
      className: item.className,
      mount: item.mount,
      damage: { sustained60s: 0, burst: 0, alphaTotal: 0, maximum: 0, alpha: { physical: 0, energy: 0, distortion: 0 } },
      rpm: null,
      range: null,
      meta: item.meta
    });
  }

  return merged;
}

function inferWeaponMountKind(weapon, catalog) {
  const name = textValue(weapon.name);
  const signal = [weapon.mountKind, weapon.mount, weapon.type, weapon.className, name].map((value) => textValue(value)).join(' ');
  const size = Number(weapon.size || 0) || null;
  if (/missile|rack|rocket|torpedo|misil/i.test(signal)) return 'Misiles';
  if (/supremacy|laser beam|s10 laser|pilot/i.test(signal)) return 'Arma pilotada';
  if (/c-?07t/i.test(name)) return 'Torreta remota';
  if (/cf-?447|rhino/i.test(name)) return 'Torreta tripulada';
  if (size && catalog.remoteSizes.has(size)) return 'Torreta remota';
  if (size && catalog.mannedSizes.has(size)) return 'Torreta tripulada';
  if (size && catalog.turretSizes.has(size)) return 'Torreta';
  return classifyWeaponMount(signal);
}

function normalizeWeaponName(value) {
  return textValue(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function inferModuleDamageType(item) {
  const signal = [item.name, item.type, item.subType, item.className].map((value) => textValue(value)).join(' ').toLowerCase();
  if (/laser|beam|energy/.test(signal)) return 'Energia / laser';
  if (/ballistic|cannon|gatling|mass driver/.test(signal)) return 'Balistico';
  if (/distortion/.test(signal)) return 'Distorsion';
  if (/missile|rocket|torpedo/.test(signal)) return 'Misil';
  return '';
}

function buildWeaponLines(weapons, groupKind = '') {
  const lines = new Map();
  for (const weapon of weapons || []) {
    const meta = weapon.meta || {};
    const kind = textValue(groupKind) || classifyWeaponMount([weapon.mountKind, weapon.mount, weapon.type, weapon.className, weapon.name].join(' '));
    const key = [
      kind,
      weapon.size || 'N/D',
      meta.damageType || '',
      weapon.name || '',
      weapon.damage?.alphaTotal || 0,
      weapon.damage?.sustained60s || 0
    ].join('|');
    if (!lines.has(key)) {
      lines.set(key, {
        weapon,
        meta,
        title: weaponLineTitle(weapon, kind),
        count: 0,
        damagePerUnit: {
          alphaTotal: Number(weapon.damage?.alphaTotal || 0),
          sustained60s: Number(weapon.damage?.sustained60s || 0)
        },
        damageTotal: { alphaTotal: 0, sustained60s: 0 }
      });
    }
    const line = lines.get(key);
    const count = Number(weapon.countOverride || 1);
    line.count += count;
    line.damageTotal.alphaTotal += Number(weapon.damage?.alphaTotal || 0) * count;
    line.damageTotal.sustained60s += Number(weapon.damage?.sustained60s || 0) * count;
  }
  return [...lines.values()].sort((a, b) => b.count - a.count || Number(b.weapon.size || 0) - Number(a.weapon.size || 0));
}

function weaponLineTitle(weapon, fallbackKind = '') {
  const kind = textValue(fallbackKind) || classifyWeaponMount([weapon.mountKind, weapon.mount, weapon.type, weapon.className, weapon.name].join(' '));
  const size = weapon.size ? ` de tamano ${weapon.size}` : '';
  const damageType = textValue(weapon.meta?.damageType).toLowerCase();
  const name = textValue(weapon.name).toLowerCase();
  const type = /misil/i.test(kind) ? 'misiles' : /pdc|plc/i.test(kind) ? 'defensa puntual' : /laser|energia|beam/.test(`${damageType} ${name}`) ? 'laser' : 'canones';
  if (/torreta/i.test(kind)) return `${kind} de ${type}${size}`;
  if (/arma pilotada/i.test(kind)) return `Arma pilotada de ${type}${size}`;
  if (/misil/i.test(kind)) return `Rack de ${type}${size}`;
  return `${kind}${size}`;
}
