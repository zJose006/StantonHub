import React, { useEffect, useState } from 'react';
import { routes } from '../config/routes.js';
import { loadComponentDetail } from '../services/api.js';
import { textValue } from '../utils/format.js';
import { routeClick } from '../utils/navigation.js';
import { componentIcon, componentPath, componentVisual } from './ComponentsPage.jsx';

/** Ficha tecnica de componente con datos utiles y naves relacionadas. */
export function ComponentDetailPage({ identifier, navigate }) {
  const [detail, setDetail] = useState(null);
  const [status, setStatus] = useState('Cargando componente...');

  useEffect(() => {
    loadComponentDetail(identifier)
      .then((payload) => {
        setDetail(payload);
        setStatus('Componente cargado.');
      })
      .catch((error) => setStatus(error.message));
  }, [identifier]);

  if (!detail) {
    return (
      <main className="container single-column">
        <section className="panel component-detail-panel">
          <span className="section-label">Componente</span>
          <h2>Ficha tecnica</h2>
          <p className="auth-message">{status}</p>
          <BackLink navigate={navigate} />
        </section>
      </main>
    );
  }

  const component = detail.component;
  const related = detail.related || [];
  const sameFamily = detail.sameFamily || [];
  const intelligence = componentIntel(component);

  return (
    <main className="container component-detail-shell">
      <section className="component-detail-hero panel">
        <img className="component-detail-image" src={componentVisual(component.category, component.name)} alt="" />
        <div className="component-detail-hero-copy">
          <span className="section-label">{component.category || 'Componente'}</span>
          <h2>{component.name}</h2>
          <p>{componentSummary(component)}</p>
          <div className="component-chip-row">
            {component.size ? <span>S{component.size}</span> : null}
            {component.grade ? <span>Grado {component.grade}</span> : null}
            {component.type ? <span>{component.type}</span> : null}
            {component.subType ? <span>{component.subType}</span> : null}
          </div>
        </div>
        <BackLink navigate={navigate} />
      </section>

      <section className="component-detail-grid">
        <section className="panel component-detail-panel">
          <PanelTitle icon={componentIcon(component.category)} label="Ficha" title="Informacion general" />
          <MetricGrid items={[
            ['Categoria', component.category],
            ['Tipo', component.type],
            ['Subtipo', component.subType],
            ['Clase', component.className],
            ['Tamano', component.size ? `S${component.size}` : 'N/D'],
            ['Grado', component.grade || 'N/D'],
            ['Fabricante', component.manufacturer || 'N/D'],
            ['Instalados detectados', component.totalInstalled || component.usedByCount || 0]
          ]} />
        </section>

        <section className="panel component-detail-panel">
          <PanelTitle icon="IN" label="Analisis" title="Datos de interes" />
          <div className="component-intel-list">
            {intelligence.map((item) => <article key={item.title}><span>{item.title}</span><strong>{item.value}</strong><p>{item.text}</p></article>)}
          </div>
        </section>
      </section>

      <section className="panel component-detail-panel">
        <PanelTitle icon="SC" label="Uso" title="Naves que lo montan" />
        {related.length ? <div className="related-ship-list">{related.map((item) => <RelatedShip key={`${item.vehicle}-${item.mount}`} item={item} navigate={navigate} />)}</div> : <p className="auth-message">No hay naves relacionadas en la cache local.</p>}
      </section>

      {sameFamily.length ? (
        <section className="panel component-detail-panel">
          <PanelTitle icon="FM" label="Familia" title="Componentes similares" />
          <div className="components-grid compact-components-grid">
            {sameFamily.map((item) => <a className="component-family-card" key={item.key} href={componentPath(item)} onClick={(event) => routeClick(event, componentPath(item), navigate)}><strong>{item.name}</strong><span>{[item.size ? `S${item.size}` : '', item.grade ? `Grado ${item.grade}` : '', item.type].filter(Boolean).join(' - ')}</span></a>)}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function BackLink({ navigate }) {
  return <a className="action-btn" href={routes.components} onClick={(event) => routeClick(event, routes.components, navigate)}>Componentes</a>;
}

function PanelTitle({ icon, label, title }) {
  return <div className="panel-header ship-panel-title"><span className="component-panel-mark">{icon}</span><div><span className="section-label">{label}</span><h2>{title}</h2></div></div>;
}

function MetricGrid({ items }) {
  return <dl className="component-metric-grid">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{textValue(value, 'N/D') || 'N/D'}</dd></div>)}</dl>;
}

function RelatedShip({ item, navigate }) {
  const path = item.vehicleId ? `${routes.ships}/${item.vehicleId}` : `${routes.ships}?search=${encodeURIComponent(item.vehicle || '')}`;
  return (
    <a className="related-ship-row" href={path} onClick={(event) => routeClick(event, path, navigate)}>
      <div>
        <strong>{item.vehicle || 'Nave sin nombre'}</strong>
        <span>{item.mount || 'Montaje no especificado'}</span>
      </div>
      <div className="card-badge-stack">
        {item.count > 1 ? <span className="system-count-badge">x{item.count}</span> : null}
        {item.size ? <span className="weapon-size-badge">S{item.size}</span> : null}
      </div>
    </a>
  );
}

function componentSummary(component) {
  const bits = [
    component.category,
    component.size ? `tamano S${component.size}` : '',
    component.grade ? `grado ${component.grade}` : '',
    component.usedByCount ? `detectado en ${component.usedByCount} nave${component.usedByCount === 1 ? '' : 's'}` : ''
  ].filter(Boolean);
  return bits.length ? bits.join(' - ') : 'Componente registrado en el catalogo tecnico local.';
}

function componentIntel(component) {
  const text = textValue(component.category).toLowerCase();
  const role = /arma|misil|torreta/.test(text)
    ? ['Rol tactico', 'Combate', 'Componente ofensivo. Revisa tamano y nave compatible antes de compararlo con otras alternativas.']
    : /escudo|blindaje/.test(text)
      ? ['Rol tactico', 'Defensa', 'Sistema defensivo. Interesa especialmente su tamano, grado y cantidad instalada por nave.']
      : /quantum|propulsion|combustible/.test(text)
        ? ['Rol tactico', 'Movilidad', 'Sistema de desplazamiento o combustible. Es clave para alcance, velocidad o uso operativo.']
        : ['Rol tactico', 'Soporte', 'Modulo de soporte interno. Conviene compararlo por familia y naves compatibles.'];

  return [
    { title: role[0], value: role[1], text: role[2] },
    { title: 'Compatibilidad', value: `${component.usedByCount || 0} naves`, text: 'Numero de modelos donde aparece detectado dentro del catalogo local.' },
    { title: 'Instalaciones', value: String(component.totalInstalled || component.usedByCount || 0), text: 'Cantidad total detectada contando montajes repetidos en una misma nave.' }
  ];
}
