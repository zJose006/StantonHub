import React, { useEffect, useMemo, useState } from 'react';
import { routes } from '../config/routes.js';
import { loadComponentCatalog } from '../services/api.js';
import { slugify, textValue, uniqueSorted } from '../utils/format.js';
import { routeClick } from '../utils/navigation.js';

/** Catalogo de componentes preparado para navegar hacia fichas tecnicas. */
export function ComponentsPage({ navigate }) {
  const [catalog, setCatalog] = useState({ components: [], categories: {} });
  const [status, setStatus] = useState('Cargando catalogo de componentes...');
  const [filters, setFilters] = useState({ search: '', category: '', size: '', grade: '' });

  useEffect(() => {
    loadComponentCatalog()
      .then((payload) => {
        setCatalog(payload);
        setStatus(`${payload.total || payload.components?.length || 0} componentes listos para consulta.`);
      })
      .catch((error) => setStatus('No se pudo cargar el catalogo: ' + error.message));
  }, []);

  const components = catalog.components || [];
  const displayComponents = useMemo(() => dedupeDisplayComponents(components), [components]);
  const categories = uniqueSorted(components.map((item) => item.category).filter(Boolean));
  const sizes = uniqueSorted(displayComponents.map((item) => item.size ? `S${item.size}` : '').filter(Boolean));
  const grades = uniqueSorted(displayComponents.map((item) => textValue(item.grade)).filter(Boolean));
  const filtered = useMemo(() => displayComponents.filter((component) => componentMatches(component, filters)).slice(0, 160), [displayComponents, filters]);

  return (
    <main className="container components-shell">
      <section className="panel components-toolbar">
        <div className="components-toolbar-header">
          <div>
            <span className="section-label">Sistemas</span>
            <h2>Catalogo de componentes</h2>
            <p>{status}</p>
          </div>
          <span className="components-count">{filtered.length} visibles</span>
        </div>
        <div className="components-controls">
          <label>Buscar<input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Nombre, clase, nave..." /></label>
          <Select label="Categoria" value={filters.category} values={categories} onChange={(value) => setFilters({ ...filters, category: value })} />
          <Select label="Tamano" value={filters.size} values={sizes} onChange={(value) => setFilters({ ...filters, size: value })} />
          <Select label="Grado" value={filters.grade} values={grades} onChange={(value) => setFilters({ ...filters, grade: value })} />
        </div>
      </section>

      <section className="component-category-strip">
        {Object.entries(catalog.categories || {}).map(([category, count]) => (
          <button type="button" key={category} className={filters.category === category ? 'active' : ''} onClick={() => setFilters({ ...filters, category: filters.category === category ? '' : category })}>
            <img src={componentVisual(category, category)} alt="" loading="lazy" />
            <span>{category}</span>
            <strong>{count}</strong>
          </button>
        ))}
      </section>

      <section className="components-grid">
        {filtered.map((component) => <ComponentCard key={component.key} component={component} navigate={navigate} />)}
      </section>
    </main>
  );
}

function Select({ label, value, values, onChange }) {
  return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}><option value="">Todos</option>{values.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>;
}

function ComponentCard({ component, navigate }) {
  const detailPath = componentPath(component);
  return (
    <article className="component-card">
      <a href={detailPath} onClick={(event) => routeClick(event, detailPath, navigate)}>
        <img className="component-card-image" src={componentVisual(component.category, component.name)} alt="" loading="lazy" />
        <div className="component-card-top">
          <span className="component-icon">{componentIcon(component.category)}</span>
          <div>
            <span className="section-label">{component.category || 'Componente'}</span>
            <h3>{component.name}</h3>
          </div>
        </div>
        <div className="component-chip-row">
          {component.size ? <span>S{component.size}</span> : null}
          {component.grade ? <span>Grado {component.grade}</span> : null}
          {component.type ? <span>{component.type}</span> : null}
        </div>
        <dl className="component-card-stats">
          <div><dt>Instalados</dt><dd>{component.totalInstalled || component.usedByCount || 0}</dd></div>
          <div><dt>Naves</dt><dd>{component.usedByCount || 0}</dd></div>
        </dl>
        <span className="ship-link">Ver ficha tecnica</span>
      </a>
    </article>
  );
}

function componentMatches(component, filters) {
  const haystack = [component.name, component.category, component.type, component.subType, component.className, component.manufacturer, ...(component.examples || []).map((item) => item.vehicle)].map(textValue).join(' ').toLowerCase();
  if (filters.search && !haystack.includes(filters.search.toLowerCase())) return false;
  if (filters.category && component.category !== filters.category) return false;
  if (filters.size && `S${component.size}` !== filters.size) return false;
  if (filters.grade && textValue(component.grade) !== filters.grade) return false;
  return true;
}

export function componentPath(component) {
  return `${routes.components}/${componentRouteId(component)}`;
}

export function componentRouteId(component) {
  if (!component?.key) return slugify(component?.name);
  return btoa(unescape(encodeURIComponent(component.key))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function componentIcon(category = '') {
  const text = textValue(category).toLowerCase();
  if (/arma/.test(text)) return 'WG';
  if (/misil/.test(text)) return 'MS';
  if (/torreta/.test(text)) return 'TR';
  if (/escudo|blindaje/.test(text)) return 'SH';
  if (/quantum/.test(text)) return 'QD';
  if (/propulsion|combustible/.test(text)) return 'PR';
  if (/refrigeracion/.test(text)) return 'CL';
  if (/energia|planta/.test(text)) return 'PW';
  if (/sensor|computador|blade/.test(text)) return 'SN';
  return 'CP';
}

export function componentVisual(category = '', name = '') {
  const token = componentIcon(category);
  const palette = componentPalette(category);
  const title = escapeSvgText(textValue(name, 'Component').slice(0, 18).toUpperCase());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="${palette.a}"/>
        <stop offset="1" stop-color="${palette.b}"/>
      </linearGradient>
      <linearGradient id="line" x1="0" x2="1">
        <stop offset="0" stop-color="#00d9ff"/>
        <stop offset="1" stop-color="${palette.c}"/>
      </linearGradient>
    </defs>
    <rect width="640" height="360" fill="#050911"/>
    <rect x="18" y="18" width="604" height="324" rx="18" fill="url(#bg)" stroke="#1d6f87" stroke-width="2"/>
    <path d="M70 270 L210 90 L430 90 L570 270 Z" fill="none" stroke="#153b4d" stroke-width="10"/>
    <path d="M112 250 L236 122 L404 122 L528 250" fill="none" stroke="url(#line)" stroke-width="8" stroke-linecap="round"/>
    <circle cx="320" cy="178" r="72" fill="rgba(0,217,255,0.13)" stroke="#00d9ff" stroke-width="5"/>
    <text x="320" y="192" text-anchor="middle" fill="#eef8ff" font-family="Inter,Segoe UI,sans-serif" font-size="54" font-weight="900">${token}</text>
    <text x="48" y="66" fill="#ffb547" font-family="Inter,Segoe UI,sans-serif" font-size="20" font-weight="900" letter-spacing="4">${escapeSvgText(textValue(category, 'Component').toUpperCase())}</text>
    <text x="48" y="316" fill="#b7cad9" font-family="Inter,Segoe UI,sans-serif" font-size="18" font-weight="800">${title}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function componentPalette(category = '') {
  const text = textValue(category).toLowerCase();
  if (/arma|misil|torreta/.test(text)) return { a: '#21100c', b: '#07111e', c: '#ffb547' };
  if (/escudo|blindaje/.test(text)) return { a: '#082137', b: '#07111e', c: '#73e7ff' };
  if (/quantum|propulsion|combustible/.test(text)) return { a: '#111044', b: '#061827', c: '#9b8cff' };
  if (/refrigeracion|energia|planta/.test(text)) return { a: '#052d2a', b: '#07111e', c: '#53ffbf' };
  return { a: '#0b2235', b: '#07111e', c: '#00d9ff' };
}

function escapeSvgText(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));
}

function dedupeDisplayComponents(components) {
  const bySignature = new Map();
  for (const component of components || []) {
    const signature = [component.category, component.name, component.size || '', component.grade || '', component.subType || component.type || ''].map((value) => textValue(value).toLowerCase()).join('|');
    const current = bySignature.get(signature);
    if (!current || componentQuality(component) > componentQuality(current)) bySignature.set(signature, component);
  }
  return [...bySignature.values()].sort((a, b) => {
    const category = textValue(a.category).localeCompare(textValue(b.category), 'es');
    return category || textValue(a.name).localeCompare(textValue(b.name), 'es');
  });
}

function componentQuality(component) {
  return [component.size, component.grade, component.className, component.type && component.type !== 'Modulo', component.subType, component.manufacturer]
    .filter(Boolean).length;
}
