import React, { useMemo, useState } from 'react';
import { communityTools } from '../data/communityTools.js';
import { routeClick } from '../utils/navigation.js';

/** Directorio de herramientas comunitarias utiles para planificar actividades del verso. */
export function CommunityToolsPage({ navigate }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todas');
  const [type, setType] = useState('Todas');

  const categories = useMemo(() => ['Todas', ...new Set(communityTools.map((tool) => tool.category).sort())], []);
  const types = useMemo(() => ['Todas', ...new Set(communityTools.map((tool) => tool.type).sort())], []);
  const featured = useMemo(() => ['blueprint-finder', 'mining-material-finder', 'ship-compare', 'component-catalog']
    .map((id) => communityTools.find((tool) => tool.id === id))
    .filter(Boolean), []);
  const filteredTools = useMemo(() => {
    const query = search.trim().toLowerCase();
    return communityTools.filter((tool) => {
      const text = [tool.name, tool.provider, tool.category, tool.description, ...tool.useCases].join(' ').toLowerCase();
      return (!query || text.includes(query)) && (category === 'Todas' || tool.category === category) && (type === 'Todas' || tool.type === type);
    });
  }, [category, search, type]);

  const stats = [
    ['Herramientas', communityTools.length],
    ['Categorias', categories.length - 1],
    ['Disponibles', communityTools.filter((tool) => tool.status === 'Disponible').length],
    ['Pendientes', communityTools.filter((tool) => tool.status !== 'Disponible').length]
  ];

  return (
    <main className="container community-tools-shell">
      <section className="tools-briefing">
        <div>
          <span className="section-label">Directorio operativo</span>
          <h2>Herramientas para preparar cada salida</h2>
          <p>Un centro de herramientas internas para mineria, crafting, comercio, combate, flota, mapas, componentes y organizacion. Los modulos pendientes quedan visibles para preparar el roadmap sin mandar al usuario fuera de Stanton Hub.</p>
        </div>
        <dl className="tools-briefing-stats">
          {stats.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
      </section>

      <section className="tools-featured" aria-label="Herramientas destacadas">
        <div className="section-heading">
          <span className="section-icon">SC</span>
          <div>
            <span className="section-label">Prioridad</span>
            <h2>Accesos recomendados</h2>
          </div>
        </div>
        <div className="tools-featured-grid">
          {featured.map((tool) => <ToolCard key={tool.id} tool={tool} navigate={navigate} compact />)}
        </div>
      </section>

      <section className="tools-toolbar">
        <div className="tools-toolbar-header">
          <span className="section-label">Busqueda</span>
          <h2>Filtra el directorio</h2>
          <p>Busca por actividad, nombre, proveedor o uso recomendado.</p>
        </div>
        <div className="tools-controls">
          <label>
            <span>Buscar</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Mineria, UEX, mapas..." />
          </label>
          <label>
            <span>Categoria</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>Tipo</span>
            <select value={type} onChange={(event) => setType(event.target.value)}>
              {types.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="tool-grid" aria-label="Listado de herramientas">
        {filteredTools.map((tool) => <ToolCard key={tool.id} tool={tool} navigate={navigate} />)}
        {!filteredTools.length ? <p className="empty-state">No hay herramientas que coincidan con el filtro actual.</p> : null}
      </section>

      <aside className="tool-source-note">
        <span className="section-label">Fuente de referencia</span>
        <p>Catalogo inspirado en la recopilacion publica de Citizen Starter Guide, reinterpretado como herramientas propias de Stanton Hub. Los datos internos son orientativos y se iran ampliando con base local sincronizada.</p>
      </aside>
    </main>
  );
}

function ToolCard({ tool, navigate, compact = false }) {
  const isPending = tool.status !== 'Disponible';
  const content = (
    <>
      <div className="tool-card-head">
        <span>{tool.category}</span>
        <b>{tool.status}</b>
      </div>
      <h3>{tool.name}</h3>
      <p>{tool.description}</p>
      {!compact ? <small className="tool-provider">{tool.provider}</small> : null}
      <div className="tool-pill-list">
        {tool.useCases.map((item) => <span key={item}>{item}</span>)}
      </div>
      <span className="tool-link">{isPending ? 'Modulo en desarrollo' : 'Abrir herramienta'}</span>
    </>
  );

  return isPending
    ? <article className={`tool-card tool-card-disabled ${compact ? 'tool-card-compact' : ''}`}>{content}</article>
    : <a className={`tool-card ${compact ? 'tool-card-compact' : ''}`} href={tool.url} onClick={(event) => routeClick(event, tool.url, navigate)}>{content}</a>;
}
