import React, { useEffect, useState } from 'react';
import { routes } from '../config/routes.js';
import { loadVehicleDetail } from '../services/api.js';
import { money, textValue } from '../utils/format.js';
import { routeClick } from '../utils/navigation.js';
import { componentRouteId } from './ComponentsPage.jsx';

/** Ficha tecnica de nave con datos locales de API, hardpoints y componentes. */
export function ShipDetailPage({ identifier, navigate }) {
  const [detail, setDetail] = useState(null);
  const [status, setStatus] = useState('Cargando ficha local...');
  const [selectedScore, setSelectedScore] = useState('Salud');

  useEffect(() => {
    loadVehicleDetail(identifier)
      .then((payload) => {
        setDetail(payload);
        setStatus('Ficha cargada.');
      })
      .catch((error) => setStatus(error.message));
  }, [identifier]);

  if (!detail) {
    return (
      <main className="container single-column">
        <section className="panel ship-detail-panel">
          <span className="section-label">Nave</span>
          <h2>Ficha tecnica</h2>
          <p className="auth-message">{status}</p>
          <BackLink navigate={navigate} />
        </section>
      </main>
    );
  }

  const { vehicle, raw, wiki, combat, modules, prices } = detail;
  const moduleGroups = modules?.groups || vehicle.modules?.groups || [];
  const moduleItems = modules?.items || vehicle.modules?.items || [];
  const image = [vehicle.imageCandidates?.[0], vehicle.photoProxy, vehicle.photo, vehicle.wikiImageProxy].find(Boolean);
  const shipName = textValue(vehicle.name, 'Nave sin nombre');
  const description = textValue(wiki?.description?.en_EN || wiki?.description || '');
  const overview = buildOverview(vehicle, wiki);
  const scoreRows = buildShipScores(vehicle, wiki, combat);
  const selectedScoreRow = scoreRows.find((score) => score.label === selectedScore) || scoreRows[0];
  const loadout = buildLoadoutSections(combat?.weapons || [], moduleGroups, moduleItems);
  const componentSections = buildComponentSections(moduleGroups);
  const industrialProfile = buildIndustrialProfile(vehicle, wiki, moduleGroups, moduleItems);

  return (
    <main className="container ship-detail-shell ship-detail-redesign ship-sheet">
      <section className="ship-sheet-hero">
        <div className="ship-sheet-media">
          {image ? <img src={image} alt={shipName} /> : <span>SC</span>}
        </div>
        <div className="ship-sheet-intro">
          <div className="ship-sheet-titlebar">
            <div>
              <span className="section-label">{textValue(vehicle.manufacturer, 'Fabricante desconocido')}</span>
              <h2>{shipName}</h2>
            </div>
            <strong>{money(vehicle.pledge?.price, textValue(vehicle.pledge?.currency, 'EUR'))}</strong>
          </div>
          {description ? <p>{shortDescription(description, 260)}</p> : null}
          <div className="ship-meta-strip">
            <span>{textValue(wiki?.role || vehicle.tags?.[0], 'Rol N/D')}</span>
            <span>{textValue(wiki?.career || vehicle.tags?.[1], 'Tipo N/D')}</span>
            <span>{textValue(wiki?.size || vehicle.padType, 'Tamano N/D')}</span>
            <span>{textValue(wiki?.game_version || wiki?.version || vehicle.gameVersion, 'Version N/D')}</span>
          </div>
          <div className="ship-detail-actions">
            {vehicle.storeUrl && <a className="action-btn" href={vehicle.storeUrl} target="_blank" rel="noreferrer">RSI Store</a>}
          </div>
          <ShipMarketStrip vehicle={vehicle} prices={prices} />
        </div>
      </section>

      <section className="ship-sheet-top-grid">
        <section className="panel ship-sheet-panel">
          <PanelTitle icon="ship" label="Ficha" title="Informacion general" />
          <MetricGrid groups={overview.general} />
          <div className="ship-identity-line">
            <span>Clase {textValue(wiki.class_name || wiki.className, 'N/D')}</span>
            <span>ID {textValue(wiki.uuid || vehicle.wiki?.uuid, 'N/D')}</span>
          </div>
        </section>

        <section className="panel ship-sheet-panel">
          <PanelTitle icon="module" label="Evaluacion" title="Puntuacion operacional" />
          <ScoreRadar scores={scoreRows} selected={selectedScoreRow} onSelect={setSelectedScore} />
        </section>
      </section>

      {industrialProfile ? <IndustrialPanel profile={industrialProfile} navigate={navigate} /> : null}

      <section className="ship-sheet-metrics">
        <MetricPanel icon="weapon" title="Armamento" sections={overview.weaponry} />
        <MetricPanel icon="module" title="Recursos" sections={overview.resources} />
        <MetricPanel icon="shield" title="Blindaje" sections={overview.armor} />
        <MetricPanel icon="shield" title="Escudos" sections={overview.shield} />
      </section>

      <section className="panel ship-sheet-panel">
        <PanelTitle icon="turret" label="Combat & systems" title="Hardpoints y equipamiento instalado" />
        <div className="ship-loadout-board">
          <div className="ship-loadout-primary">
            {loadout.length ? loadout.map((section) => <LoadoutGroup key={section.key} section={section} navigate={navigate} />) : <p className="auth-message">Sin hardpoints detectados en la cache local.</p>}
          </div>
          <aside className="ship-component-sidebar">
            <header>
              <span className="section-label">Componentes</span>
              <h3>Resto de modulos</h3>
            </header>
            <p>Listado preparado para enlazar cada componente a su ficha cuando exista la pagina de componentes.</p>
            {componentSections.length ? componentSections.map((section) => <ComponentDetails key={section.category} section={section} navigate={navigate} />) : <p className="auth-message">Sin componentes adicionales.</p>}
          </aside>
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

function MetricGrid({ groups }) {
  return <div className="ship-kpi-grid">{groups.map(([label, value]) => <MetricTile key={label} label={label} value={value} />)}</div>;
}

function MetricTile({ label, value }) {
  return <div className="ship-kpi"><dt>{label}</dt><dd>{textValue(value, 'N/D')}</dd></div>;
}

function ShipMarketStrip({ vehicle, prices = {} }) {
  const purchaseLocations = vehicle.purchase?.locations?.length ? vehicle.purchase.locations : marketLocations(prices.purchase);
  const rentalLocations = vehicle.rental?.locations?.length ? vehicle.rental.locations : marketLocations(prices.rental);
  return (
    <div className="ship-market-strip" aria-label="Puntos de compra y alquiler">
      <article>
        <span>Compra in-game</span>
        <strong>{money(vehicle.purchase?.price)}</strong>
        <p>{purchaseLocations.length ? purchaseLocations.map((item) => textValue(item)).join(', ') : 'Sin terminal conocido'}</p>
      </article>
      <article>
        <span>Alquiler</span>
        <strong>{money(vehicle.rental?.price)}</strong>
        <p>{rentalLocations.length ? rentalLocations.map((item) => textValue(item)).join(', ') : 'Sin terminal conocido'}</p>
      </article>
    </div>
  );
}

function IndustrialPanel({ profile, navigate }) {
  return (
    <section className="panel ship-sheet-panel ship-industrial-panel">
      <PanelTitle icon="module" label="Operativa" title="Perfil industrial y logistica" />
      <div className="ship-industrial-layout">
        <div className="industrial-role-grid">
          {profile.roles.map((role) => (
            <article className="industrial-role-card" key={role.title}>
              <span>{role.label}</span>
              <h3>{role.title}</h3>
              <p>{role.text}</p>
              {role.value ? <strong>{role.value}</strong> : null}
            </article>
          ))}
        </div>
        <div className="industrial-module-board">
          {profile.sections.map((section) => (
            <section className="industrial-module-section" key={section.key}>
              <header>
                <div>
                  <span className="section-label">{section.label}</span>
                  <h3>{section.title}</h3>
                </div>
                <strong>{section.count}</strong>
              </header>
              <div className="industrial-module-grid">
                {section.items.map((item) => <IndustrialModuleCard key={item.key} item={item} navigate={navigate} />)}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}

function IndustrialModuleCard({ item, navigate }) {
  const path = componentDetailPath(item.componentKey);
  const title = path
    ? <a className="component-inline-link" href={path} onClick={(event) => routeClick(event, path, navigate)}>{item.name}</a>
    : <strong>{item.name}</strong>;

  return (
    <article className="industrial-module-card">
      <div className="industrial-module-head">
        <div>
          {title}
          <span>{item.subtitle}</span>
        </div>
        <div className="card-badge-stack">
          {item.count > 1 ? <span className="system-count-badge">x{item.count}</span> : null}
          {item.size ? <span className="weapon-size-badge">S{item.size}</span> : null}
          {item.grade ? <span className="weapon-size-badge">G{item.grade}</span> : null}
        </div>
      </div>
      {item.stats.length ? <dl>{item.stats.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : null}
    </article>
  );
}

function marketLocations(rows = []) {
  return [...new Set((rows || []).map((row) => row.terminal_name || row.location_name || row.city_name || row.planet_name).filter(Boolean))].slice(0, 4);
}

function MetricPanel({ icon, title, sections }) {
  return (
    <section className="panel ship-sheet-panel">
      <div className="ship-card-heading"><SystemIcon type={icon} /><h3>{title}</h3></div>
      <div className="metric-section-grid">
        {sections.map((section) => (
          <section className="metric-section" key={section.title}>
            <h4>{section.title}</h4>
            <dl>{section.items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className={metricClass(value)}>{textValue(value, 'N/D')}</dd></div>)}</dl>
          </section>
        ))}
      </div>
    </section>
  );
}

function ScoreRadar({ scores, selected, onSelect }) {
  const rings = [2, 4, 6, 8, 10];
  const pointAt = (index, value) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / scores.length;
    const radius = (value / 10) * 38;
    return [50 + Math.cos(angle) * radius, 50 + Math.sin(angle) * radius];
  };
  const polygon = scores.map((score, index) => pointAt(index, clampScore(score.value)).join(',')).join(' ');
  const average = scores.reduce((sum, score) => sum + score.value, 0) / scores.length;

  return (
    <div className="score-radar-layout">
      <div className="score-radar">
        <svg viewBox="-12 -12 124 124" role="img" aria-label="Grafico de puntuacion de nave">
          {rings.map((ring) => <polygon key={ring} className="score-grid" points={scores.map((_, index) => pointAt(index, ring).join(',')).join(' ')} />)}
          {scores.map((score, index) => {
            const [x, y] = pointAt(index, 10);
            return <line key={`axis-${score.label}`} className="score-axis" x1="50" y1="50" x2={x} y2={y} />;
          })}
          <polygon className="score-fill" points={polygon} />
        </svg>
        <div className="score-total"><strong>{average.toFixed(1)}</strong><span>/10</span></div>
        {scores.map((score, index) => {
          const active = selected.label === score.label;
          return (
            <button
              key={score.label}
              className={`score-vertex-button score-vertex-${index + 1} ${active ? 'active' : ''}`}
              type="button"
              onClick={() => onSelect(score.label)}
              aria-label={`Ver explicacion de ${score.label}`}
            >
              {score.axis}
            </button>
          );
        })}
      </div>
      <article className="score-explanation">
        <span className="section-label">{selected.axis}</span>
        <h3>{selected.label}: {selected.value.toFixed(1)}</h3>
        <p>{selected.reason}</p>
      </article>
    </div>
  );
}

function LoadoutGroup({ section, navigate }) {
  return (
    <section className="loadout-family">
      <header>
        <SystemIcon type={section.icon} />
        <div>
          <h3>{section.title}</h3>
          <span>{section.count} instalado{section.count === 1 ? '' : 's'}</span>
        </div>
      </header>
      <div className="loadout-row-list">
        {section.items.map((item) => <LoadoutItem key={item.key} item={item} navigate={navigate} />)}
      </div>
    </section>
  );
}

function LoadoutItem({ item, navigate }) {
  const path = componentDetailPath(item.componentKey);
  return (
    <article className="loadout-row">
      <div>
        {path ? <a className="component-inline-link" href={path} onClick={(event) => routeClick(event, path, navigate)}>{item.name}</a> : <strong>{item.name}</strong>}
        <span>{item.subtitle}</span>
      </div>
      <div className="card-badge-stack">
        {item.count > 1 ? <span className="system-count-badge">x{item.count}</span> : null}
        {item.size ? <span className="weapon-size-badge">S{item.size}</span> : null}
      </div>
      {item.stats.length ? <dl>{item.stats.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : null}
    </article>
  );
}

function ComponentDetails({ section, navigate }) {
  return (
    <details className="component-details">
      <summary><span>{section.category}</span><strong>{section.items.length}</strong></summary>
      <div>
        {section.items.map((item) => (
          <article className="component-mini-card" key={item.key} data-component-key={item.componentKey}>
            {componentDetailPath(item.componentKey) ? <a href={componentDetailPath(item.componentKey)} onClick={(event) => routeClick(event, componentDetailPath(item.componentKey), navigate)}><strong>{item.name}</strong></a> : <strong>{item.name}</strong>}
            <span>{[item.count > 1 ? `x${item.count}` : '', item.size ? `S${item.size}` : '', item.grade ? `Grado ${item.grade}` : ''].filter(Boolean).join(' · ') || 'Componente'}</span>
          </article>
        ))}
      </div>
    </details>
  );
}

function componentDetailPath(componentKey) {
  return componentKey ? `${routes.components}/${componentRouteId({ key: componentKey })}` : '';
}

function RawCard({ title, data }) {
  return <section className="panel ship-raw-card"><h3>{title}</h3><pre>{JSON.stringify(scrubTechnicalData(data || {}), null, 2)}</pre></section>;
}

function buildOverview(vehicle, wiki = {}, combat = {}) {
  const weaponry = wiki.weaponry || {};
  const armor = wiki.armor || {};
  const shield = wiki.shield || {};
  const signature = wiki.signature || {};
  const speed = wiki.speed || {};
  const cooling = wiki.cooling || {};
  const power = wiki.power || {};
  const crew = wiki.crew || {};

  return {
    general: [
      ['Cargo', wiki.cargo_capacity ? `${formatNumber(wiki.cargo_capacity)} SCU` : vehicle.scu ? `${vehicle.scu} SCU` : 'N/D'],
      ['Stowage', wiki.vehicle_inventory ? `${formatNumber(Math.round(wiki.vehicle_inventory / 1000))}K uSCU` : 'N/D'],
      ['Tripulacion', formatNumber(crew.max || crew.min || vehicle.crew)],
      ['Masa', wiki.mass_total ? `${formatNumber(wiki.mass_total)} kg` : vehicle.mass ? `${formatNumber(vehicle.mass)} kg` : 'N/D'],
      ['SCM', speed.scm ? `${formatNumber(speed.scm)} m/s` : 'N/D'],
      ['Max', speed.max ? `${formatNumber(speed.max)} m/s` : 'N/D'],
      ['IR', formatNumber(signature.ir_shields || wiki.emission?.ir)],
      ['EM', formatNumber(signature.em_shields || wiki.emission?.em_idle)],
      ['HP', formatNumber(wiki.health || vehicle.wiki?.health)],
      ['Escudos', formatNumber(shield.hp || wiki.shield_hp || vehicle.wiki?.shieldHp)]
    ],
    weaponry: [
      { title: 'Armas piloto', items: [['DPS', formatNumber(weaponry.pilot_dps || combat.totals?.burst)], ['Sostenido', formatNumber(weaponry.pilot_sustained_dps || combat.totals?.sustained60s)], ['Alpha', formatNumber(weaponry.pilot_alpha || combat.totals?.alphaTotal)]] },
      { title: 'Torretas', items: [['DPS', formatNumber(weaponry.turret_dps)], ['Sostenido', formatNumber(weaponry.turret_sustained_dps)], ['Alpha', formatNumber(weaponry.turret_alpha)]] },
      { title: 'Misiles', items: [['Cantidad', formatNumber(weaponry.missiles?.count)], ['Dano total', formatNumber(weaponry.total_missile_damage || weaponry.missiles?.damage?.total)]] }
    ],
    resources: [
      { title: 'Firma', items: [['IR', formatNumber(signature.ir_shields)], ['EM', formatNumber(signature.em_shields)], ['Quantum EM', formatNumber(signature.em_groups_quantum?.PowerPlant || signature.em_quantum)]] },
      { title: 'Refrigeracion', items: [['Generacion', segmentValue(cooling.generation_segments)], ['Uso escudos', percent(cooling.usage_shields_pct)], ['Uso quantum', percent(cooling.usage_quantum_pct)]] },
      { title: 'Energia', items: [['Generacion', segmentValue(power.generation_segments)], ['Escudos usado', segmentValue(power.used_segments_shields)], ['Quantum usado', segmentValue(power.used_segments_quantum)]] }
    ],
    armor: [
      { title: 'Salud y deflexion', items: [['Salud', armor.health ? `${formatNumber(armor.health)} HP` : 'N/D'], ['Def. fisica', formatNumber(armor.deflection?.physical)], ['Def. energia', formatNumber(armor.deflection?.energy)]] },
      { title: 'Multiplicadores', items: [['Fisico', signedPercent(armor.damage_multiplier?.physical_change)], ['Energia', signedPercent(armor.damage_multiplier?.energy_change)], ['Distorsion', signedPercent(armor.damage_multiplier?.distortion_change)]] }
    ],
    shield: [
      { title: 'Info', items: [['Tipo', textValue(shield.face_type, 'N/D')], ['Salud', shield.hp ? `${formatNumber(shield.hp)} HP` : 'N/D'], ['Regeneracion', shield.regeneration_time ? `${formatNumber(shield.regeneration_time)}s` : 'N/D']] },
      { title: 'Resistencia', items: [['Fisico', percent(shield.resistance?.physical?.maximum)], ['Energia', percent(shield.resistance?.energy?.maximum)], ['Distorsion', percent(shield.resistance?.distortion?.maximum)]] }
    ]
  };
}

function buildShipScores(vehicle, wiki = {}, combat = {}) {
  const speed = wiki.speed || {};
  const weaponry = wiki.weaponry || {};
  const armor = wiki.armor || {};
  const shield = wiki.shield || {};
  const cargo = Number(wiki.cargo_capacity || vehicle.scu || 0);
  const rows = [
    ['Salud', 'SAL', wiki.health || vehicle.wiki?.health, 250000, 'Mide la resistencia estructural de la nave. Cuanto mas HP tenga, mejor aguanta dano directo.'],
    ['Armadura', 'ARM', armor.health || vehicle.wiki?.armor, 45000, 'Valora la proteccion fisica y energetica del blindaje instalado.'],
    ['Escudos', 'ESC', shield.hp || wiki.shield_hp || vehicle.wiki?.shieldHp, 260000, 'Representa la capacidad total de escudos antes de recibir dano en casco.'],
    ['Movimiento', 'MOV', speed.max || wiki.max_speed, 1200, 'Puntua la velocidad maxima y la capacidad de reposicion general.'],
    ['SCM', 'SCM', speed.scm || wiki.scm_speed, 260, 'Valora la velocidad practica en combate y maniobras sostenidas.'],
    ['Armamento', 'ATQ', weaponry.pilot_alpha || combat.totals?.alphaTotal, 22000, 'Calcula el dano alpha del armamento principal detectado.'],
    ['Misiles', 'MIS', weaponry.total_missile_damage || weaponry.missiles?.damage?.total, 120000, 'Resume el dano potencial de misiles, torpedos o racks detectados.'],
    ['Carga', 'CRG', cargo, 700, 'Puntua la capacidad logistica de carga util frente a otras naves.']
  ];
  return rows.map(([label, axis, raw, max, reason]) => ({ label, axis, value: scoreScale(raw, max), reason: `${reason} Valor detectado: ${formatNumber(raw)} / referencia ${formatNumber(max)}.` }));
}

function buildLoadoutSections(weapons, moduleGroups, moduleItems) {
  const weaponSections = groupWeapons(weapons, moduleItems);
  const utilityItems = moduleGroups
    .filter((group) => /pdc|plc|misil|missile|contramedida|counter|decoy|noise|chaff|flare/i.test([group.name, group.category, group.type, group.subType].map(textValue).join(' ')))
    .map(moduleToLoadoutItem);
  if (utilityItems.length) {
    weaponSections.push({ key: 'utility', title: 'PDC, misiles y utilidades', icon: 'turret', count: utilityItems.reduce((sum, item) => sum + item.count, 0), items: utilityItems });
  }
  return weaponSections;
}

function groupWeapons(weapons, moduleItems) {
  const catalog = buildWeaponCatalog(moduleItems);
  const groups = new Map();
  for (const weapon of mergeWeaponData(weapons, catalog)) {
    const kind = weaponKind(weapon, catalog);
    if (!groups.has(kind)) groups.set(kind, { key: kind, title: kind, icon: /torreta|pdc/i.test(kind) ? 'turret' : 'weapon', count: 0, items: [] });
    const group = groups.get(kind);
    const count = Number(weapon.countOverride || 1);
    group.count += count;
    group.items.push(weaponToLoadoutItem(weapon, kind, count));
  }
  const order = ['Armas pilotadas', 'Torretas tripuladas', 'Torretas remotas', 'PDC / PLC', 'Misiles', 'Otros'];
  return [...groups.values()].sort((a, b) => order.indexOf(a.title) - order.indexOf(b.title));
}

function weaponToLoadoutItem(weapon, kind, count) {
  const meta = weapon.meta || {};
  return {
    key: `${kind}-${weapon.name}-${weapon.size}-${count}`,
    componentKey: weapon.componentKey,
    name: textValue(weapon.name, 'Arma sin nombre'),
    subtitle: [kind, textValue(weapon.mount)].filter(Boolean).join(' · '),
    count,
    size: numericSize(weapon),
    stats: compactStats([
      ['Tipo', textValue(meta.damageType)],
      ['DPS', numberOrMissing(weapon.damage?.sustained60s || weapon.damage?.burst)],
      ['Alpha', numberOrMissing(weapon.damage?.alphaTotal)],
      ['Municion', numberOrMissing(meta.ammoCapacity)]
    ])
  };
}

function moduleToLoadoutItem(group) {
  const meta = group.meta || {};
  return {
    key: `${group.componentKey || group.category}-${group.name}-${group.size}`,
    componentKey: group.componentKey,
    name: textValue(group.name, group.examples?.[0] || textValue(group.category, 'Sistema')),
    subtitle: textValue(group.category, 'Sistema auxiliar'),
    count: group.count || 1,
    size: numericSize(group),
    stats: compactStats([
      ['Tipo', utilityType(group)],
      ['Energia', numberOrMissing(meta.powerDraw)],
      ['Salud', numberOrMissing(meta.health)],
      ['Montaje', group.mounts?.slice(0, 2).join(', ')]
    ])
  };
}

function buildComponentSections(moduleGroups) {
  const byCategory = new Map();
  for (const group of moduleGroups) {
    if (/arma|weapon|misil|missile|torreta|turret|pdc|plc/i.test(textValue(group.category))) continue;
    const category = textValue(group.category, 'Componentes');
    if (!byCategory.has(category)) byCategory.set(category, { category, items: [] });
    byCategory.get(category).items.push({
      key: `${group.componentKey || category}-${group.name}-${group.size}`,
      componentKey: group.componentKey,
      name: textValue(group.name, group.examples?.[0] || category),
      count: group.count || 1,
      size: numericSize(group),
      grade: textValue(group.grade || group.meta?.grade)
    });
  }
  return [...byCategory.values()].sort((a, b) => a.category.localeCompare(b.category, 'es'));
}

function buildIndustrialProfile(vehicle, wiki = {}, moduleGroups = [], moduleItems = []) {
  const tags = (vehicle.tags || []).map((tag) => normalizeName(tag));
  const allGroups = dedupeIndustrialGroups([...(moduleGroups || []), ...(moduleItems || [])]);
  const sections = [
    buildIndustrialSection('fuel-service', 'Repostaje', 'Pods y puertos de combustible', allGroups, isRefuelModule),
    buildIndustrialSection('fuel', 'Combustible', 'Tanques y admision', allGroups, (group) => isFuelModule(group) && !isRefuelModule(group)),
    buildIndustrialSection('mining', 'Mineria', 'Herramientas de mineria', allGroups, isMiningModule),
    buildIndustrialSection('salvage', 'Chatarreria', 'Sistemas de salvamento', allGroups, isSalvageModule),
    buildIndustrialSection('cargo', 'Carga', 'Capacidad y logistica', allGroups, isCargoModule)
  ].filter(Boolean);
  const hasFuelService = sections.some((section) => section.key === 'fuel-service');
  const hasMining = tags.includes('mineria') || sections.some((section) => section.key === 'mining');
  const hasSalvage = tags.includes('salvage') || tags.includes('chatarreria') || sections.some((section) => section.key === 'salvage');
  const cargoValue = Number(wiki.cargo_capacity || vehicle.scu || 0);
  const isCargo = tags.includes('cargo');
  const isIndustrial = tags.includes('industrial') || hasFuelService || hasMining || hasSalvage || isCargo;

  if (!isIndustrial) return null;

  const roles = [];
  if (isCargo) {
    roles.push({
      label: 'Carga',
      title: cargoValue ? `${formatNumber(cargoValue)} SCU utiles` : 'Capacidad logistica',
      text: cargoValue ? 'Capacidad de carga declarada para comercio, transporte o apoyo a operaciones.' : 'Nave con perfil logistico detectado.',
      value: vehicle.flags?.loadingDock ? 'Incluye bahia / muelle de carga' : ''
    });
  }
  if (hasFuelService) {
    roles.push({
      label: 'Repostaje',
      title: 'Soporte de combustible',
      text: 'Se han detectado pods, puertos o elementos externos de combustible pensados para operaciones de repostaje.',
      value: sectionCount(sections, 'fuel-service')
    });
  }
  if (hasMining) {
    roles.push({
      label: 'Mineria',
      title: 'Extraccion y fractura',
      text: 'Componentes de mineria detectados: revisa tamano, montaje y cantidad antes de comparar variantes.',
      value: sectionCount(sections, 'mining')
    });
  }
  if (hasSalvage) {
    roles.push({
      label: 'Chatarreria',
      title: 'Recuperacion de materiales',
      text: 'Perfil orientado a raspado, recuperacion o apoyo de salvamento cuando el equipamiento lo confirma.',
      value: sectionCount(sections, 'salvage')
    });
  }
  if (!roles.length && tags.includes('industrial')) {
    roles.push({
      label: 'Industrial',
      title: 'Operacion especializada',
      text: 'Nave marcada como industrial. La ficha muestra los sistemas detectados en la base local.',
      value: ''
    });
  }

  return { roles, sections };
}

function buildIndustrialSection(key, label, title, groups, matcher) {
  const items = groups.filter(matcher).map(industrialModuleItem).filter(Boolean);
  if (!items.length) return null;
  return {
    key,
    label,
    title,
    count: items.reduce((sum, item) => sum + item.count, 0),
    items: items.slice(0, 8)
  };
}

function industrialModuleItem(group) {
  const name = cleanIndustrialName(group.name || group.examples?.[0] || group.type || group.category);
  if (!name) return null;
  const size = numericSize(group);
  const grade = textValue(group.grade || group.meta?.grade, '');
  const type = industrialTypeLabel(group);
  return {
    key: `${group.componentKey || group.key || name}-${size || ''}-${grade}`,
    componentKey: group.componentKey || group.key,
    name,
    subtitle: [type, group.mounts?.slice(0, 1).join(', ') || group.mount].filter(Boolean).join(' - '),
    count: Number(group.count || group.totalInstalled || 1) || 1,
    size,
    grade,
    stats: compactStats([
      ['Tipo', type],
      ['Fabricante', textValue(group.manufacturer)],
      ['Clase', textValue(group.className || group.componentClass)],
      ['Capacidad', industrialCapacity(group)]
    ])
  };
}

function dedupeIndustrialGroups(groups) {
  const map = new Map();
  for (const group of groups || []) {
    const key = [normalizeName(group.name), normalizeName(group.type), normalizeName(group.className), numericSize(group) || '', textValue(group.grade)].join('|');
    if (!key.replace(/\|/g, '')) continue;
    const existing = map.get(key);
    if (existing) {
      existing.count = Number(existing.count || 1) + Number(group.count || 1);
      continue;
    }
    map.set(key, { ...group });
  }
  return [...map.values()];
}

function isRefuelModule(group) {
  const signal = industrialSignal(group);
  return /externalfueltank|fuelpod|fuel\s*pod|fuelport|fuel\s*port|refuel|repost/.test(signal);
}

function isFuelModule(group) {
  const signal = industrialSignal(group);
  if (!/combustible|fuel|hydrogen|quantumfuel|quantum\s*fuel/.test(signal)) return false;
  return /tank|intake|externalfueltank|fuelpod|fuelport|fuel\s*port/.test(signal);
}

function isMiningModule(group) {
  return /mining|mineria|mineral|ore|arbor|hofstede|pitman|lawson|extraction/.test(industrialSignal(group));
}

function isSalvageModule(group) {
  return /salvage|salvamento|chatarr|scraper|tractor|reclaimer|vulture|recycling/.test(industrialSignal(group));
}

function isCargoModule(group) {
  return /cargo|container|stowage|loading|freight|bay|rack/.test(industrialSignal(group));
}

function industrialSignal(group) {
  return [
    group.category,
    group.name,
    group.type,
    group.subType,
    group.className,
    group.componentClass,
    group.mount,
    ...(group.mounts || []),
    ...(group.examples || []).map((example) => example.mount)
  ].map(normalizeName).join(' ');
}

function cleanIndustrialName(value) {
  const text = textValue(value, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text || /^(modulo|component|none|unknown|n\/d)$/i.test(text)) return '';
  if (/hardpoint|placeholder|itemport|controller|decal|door|damage|dmg_/i.test(text)) return '';
  return text;
}

function industrialTypeLabel(group) {
  const signal = industrialSignal(group);
  if (/externalfueltank|fuelpod|fuel\s*pod/.test(signal)) return 'Pod externo de combustible';
  if (/fuelport|fuel\s*port|refuel/.test(signal)) return 'Puerto de repostaje';
  if (/quantumfuel|quantum\s*fuel/.test(signal)) return 'Tanque quantum';
  if (/fueltank|fuel\s*tank|hydrogen/.test(signal)) return 'Tanque de combustible';
  if (/fuelintake|fuel\s*intake/.test(signal)) return 'Toma de combustible';
  if (/mining|laser/.test(signal)) return 'Herramienta de mineria';
  if (/salvage|scraper/.test(signal)) return 'Sistema de salvamento';
  if (/cargo|container|bay/.test(signal)) return 'Sistema de carga';
  return textValue(group.category || group.type, 'Sistema industrial');
}

function industrialCapacity(group) {
  const found = findNumericByKey(group, /(capacity|capac|fuel|tank|scu|stowage|volume)/i);
  return found ? formatNumber(found) : 'N/D';
}

function findNumericByKey(value, keyPattern, depth = 0) {
  if (!value || depth > 5) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findNumericByKey(item, keyPattern, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== 'object') return null;
  for (const [key, child] of Object.entries(value)) {
    if (keyPattern.test(key)) {
      const number = Number(child);
      if (Number.isFinite(number) && number > 0) return number;
    }
    const found = findNumericByKey(child, keyPattern, depth + 1);
    if (found) return found;
  }
  return null;
}

function sectionCount(sections, key) {
  const count = sections.find((section) => section.key === key)?.count || 0;
  return count ? `${formatNumber(count)} instalado${count === 1 ? '' : 's'}` : '';
}

function buildWeaponCatalog(moduleItems) {
  const byName = new Map();
  const turretSizes = new Set();
  const remoteSizes = new Set();
  const mannedSizes = new Set();
  for (const item of moduleItems || []) {
    const category = textValue(item.category);
    const signal = [item.name, item.type, item.subType, item.className, item.mount].map(textValue).join(' ');
    const size = numericSize(item);
    if (/torreta|turret/i.test(category) && size) {
      turretSizes.add(size);
      if (/remote|remota|s7|tiburon/i.test(signal)) remoteSizes.add(size);
      if (/manned|tripulada|s4|hammerhead/i.test(signal)) mannedSizes.add(size);
    }
    if (!/armas/i.test(category) || !/WeaponGun|Gun/i.test(signal)) continue;
    byName.set(normalizeName(item.name), { componentKey: item.componentKey, size, type: item.type, className: item.className, meta: item.meta || {} });
  }
  return { byName, turretSizes, remoteSizes, mannedSizes };
}

function mergeWeaponData(weapons, catalog) {
  return (weapons || []).map((weapon) => {
    const item = catalog.byName.get(normalizeName(weapon.name));
    return item ? { ...weapon, componentKey: item.componentKey || weapon.componentKey, size: item.size || weapon.size, type: item.type || weapon.type, className: item.className || weapon.className, meta: { ...(weapon.meta || {}), ...(item.meta || {}) } } : weapon;
  });
}

function weaponKind(weapon, catalog) {
  const signal = [weapon.mountKind, weapon.mount, weapon.type, weapon.className, weapon.name].map(textValue).join(' ');
  const size = numericSize(weapon);
  if (/missile|rack|rocket|torpedo|misil/i.test(signal)) return 'Misiles';
  if (/pdc|plc|point\s*defen/i.test(signal)) return 'PDC / PLC';
  if (/supremacy|laser beam|s10 laser|pilot/i.test(signal)) return 'Armas pilotadas';
  if (/c-?07t/i.test(textValue(weapon.name)) || (size && catalog.remoteSizes.has(size))) return 'Torretas remotas';
  if (/cf-?447|rhino/i.test(textValue(weapon.name)) || (size && catalog.mannedSizes.has(size))) return 'Torretas tripuladas';
  if (size && catalog.turretSizes.has(size)) return 'Torretas';
  if (/turret|torreta/i.test(signal)) return 'Torretas';
  if (/weapon|gun|arma|hardpoint/i.test(signal)) return 'Armas pilotadas';
  return 'Otros';
}

function SystemIcon({ type }) {
  const paths = {
    shield: <path d="M12 3l7 2.8v5.7c0 4.4-2.9 7.7-7 9.5-4.1-1.8-7-5.1-7-9.5V5.8L12 3zm0 3.1L7.5 7.9v3.6c0 3 1.7 5.2 4.5 6.6 2.8-1.4 4.5-3.6 4.5-6.6V7.9L12 6.1z" />,
    weapon: <path d="M4 14.5l9.8-9.8 5.5 5.5-9.8 9.8H4v-5.5zm2 1.1V18h2.4l8.1-8.1-2.4-2.4L6 15.6zm9.2-12L17 1.8 22.2 7 20.4 8.8 15.2 3.6z" />,
    turret: <path d="M4 16h16v3H4v-3zm2-4h8.5l3.5-5 2 1.4-4.2 6.1H6V12zm1.5-5h5v3h-5V7z" />,
    module: <path d="M8 3h8v3h3v8h-3v7H8v-7H5V6h3V3zm2 2v3H7v4h3v7h4v-7h3V8h-3V5h-4z" />,
    ship: <path d="M12 2l6 13-4.4-1.6L12 22l-1.6-8.6L6 15 12 2zm0 5.2l-2.2 4.9 2.2-.8 2.2.8L12 7.2z" />
  };
  return <span className={`ship-system-icon ${type || 'module'}`} aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">{paths[type] || paths.module}</svg></span>;
}

function compactStats(stats) {
  return stats.map(([label, value]) => [label, textValue(value)]).filter(([, value]) => value && value !== 'N/D').slice(0, 4);
}

function metricClass(value) {
  const text = textValue(value);
  if (/^-/.test(text)) return 'metric-negative';
  if (/^\+/.test(text)) return 'metric-positive';
  return '';
}

function scrubTechnicalData(value) {
  if (Array.isArray(value)) return value.map(scrubTechnicalData);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !/apiUrl|source/i.test(key)).map(([key, child]) => [key, scrubTechnicalData(child)]));
  if (typeof value === 'string') return value.replace(/Star Citizen Wiki/gi, 'Datos externos').replace(/https?:\/\/api\.star-citizen\.wiki[^\s"]*/gi, 'URL tecnica');
  return value;
}

function shortDescription(value, max = 180) {
  const text = textValue(value, '');
  return text.length <= max ? text : `${text.slice(0, max - 3).trim()}...`;
}

function normalizeName(value) {
  return textValue(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function numericSize(value) {
  const number = Number(value?.size || value?.equippedSize || value?.meta?.size || 0);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function utilityType(group) {
  const signal = [group.name, group.category, group.type, group.subType, group.meta?.componentClass, group.meta?.moduleType].map(textValue).join(' ').toLowerCase();
  if (/laser|beam|energy|repeater/.test(signal)) return 'Energia / laser';
  if (/ballistic|cannon|gatling|mass driver/.test(signal)) return 'Balistico';
  if (/missile|rocket|torpedo|misil/.test(signal)) return 'Explosivo';
  if (/decoy|noise|chaff|flare/.test(signal)) return 'Contramedida';
  return '';
}

function scoreScale(value, max) {
  const number = Number(value || 0);
  return Math.max(0, Math.min(10, Math.round((number / max) * 100) / 10));
}

function clampScore(value) {
  return Math.max(0, Math.min(10, Number(value || 0)));
}

function formatNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number ? Number.isInteger(number) ? number.toLocaleString('es-ES') : number.toLocaleString('es-ES', { maximumFractionDigits: 2 }) : 'N/D';
}

function numberOrMissing(value) {
  const number = Number(value || 0);
  return number ? Math.round(number).toLocaleString('es-ES') : 'N/D';
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

function segmentValue(value) {
  return value ? `${formatNumber(value)} seg.` : 'N/D';
}
