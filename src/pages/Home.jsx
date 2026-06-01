import React, { useEffect, useState } from 'react';
import { routes } from '../config/routes.js';
import { loadGameNews } from '../services/api.js';
import { fallbackNewsImage, highQualityNewsImage } from '../utils/news.js';
import { routeClick } from '../utils/navigation.js';

function newsIdentifier(item) {
  const source = item.id || item.slug || String(item.url || '').split('/').filter(Boolean).pop() || item.title;
  return String(source || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function newsPath(item) {
  return `${routes.gameNews}/${encodeURIComponent(newsIdentifier(item))}`;
}

/** Pagina de bienvenida con accesos directos a las secciones principales. */
export function Home({ navigate }) {
  const [latestNews, setLatestNews] = useState([]);
  const [showConstructionNotice, setShowConstructionNotice] = useState(() => !window.sessionStorage?.getItem('stantonhub-construction-notice'));

  useEffect(() => {
    loadGameNews().then((payload) => setLatestNews((payload.items || []).slice(0, 3))).catch(() => setLatestNews([]));
  }, []);

  const cards = [
    [routes.ships, 'Catalogo tecnico', 'Naves', 'Filtra vehiculos por fabricante, rol, tamano, precio y revisa fichas con hardpoints, modulos y puntuacion operacional.'],
    [routes.components, 'Equipamiento', 'Componentes', 'Consulta armas, escudos, quantum, propulsion y sistemas relacionados con las naves del catalogo.'],
    [routes.miningMaterials, 'Mineria', 'Materiales', 'Consulta donde minar recursos, calidades esperadas, metodos y consejos de extraccion.'],
    [routes.gameNews, 'Noticias', 'Comunicaciones oficiales', 'Ultimas novedades del desarrollo traducidas y enlazadas a su fuente original.'],
    [routes.profile, 'Cuenta', 'Perfil', 'Acceso con Discord, actividad y herramientas disponibles para usuarios registrados.']
  ];
  const workflow = [
    ['Consulta', 'Busca una nave, revisa su ficha y detecta rapidamente su rol, defensa, carga y rendimiento.'],
    ['Compara', 'Salta de la nave a sus componentes para entender armas, escudos, propulsion y quantum.'],
    ['Mantente al dia', 'Lee noticias traducidas y confirma siempre el contexto en la fuente oficial.']
  ];
  const status = [
    ['Catalogo', 'Naves y componentes enlazados'],
    ['Fichas', 'Datos tecnicos y puntuacion'],
    ['Mineria', 'Rutas y materiales'],
    ['Noticias', 'Comm-Link traducido']
  ];
  const slides = [
    ['Combate', 'Naves, hardpoints y lectura rapida de potencia ofensiva.'],
    ['Sistemas', 'Componentes, energia, quantum y configuraciones preparadas para comparar.'],
    ['Exploracion', 'Fichas pensadas para elegir nave, rol y preparacion de vuelo.']
  ];

  function closeConstructionNotice() {
    window.sessionStorage?.setItem('stantonhub-construction-notice', 'seen');
    setShowConstructionNotice(false);
  }

  return (
    <main className="container home-shell">
      {showConstructionNotice ? (
        <aside className="construction-notice" role="dialog" aria-label="Aviso de pagina en construccion">
          <div className="construction-notice-card">
            <span className="section-label">Aviso de desarrollo</span>
            <h2>Stanton Hub esta en construccion</h2>
            <p>La web ya se puede explorar, pero algunas secciones, datos y automatizaciones pueden cambiar mientras seguimos puliendo el hub.</p>
            <button type="button" className="action-btn primary-action" onClick={closeConstructionNotice}>Entendido</button>
          </div>
        </aside>
      ) : null}

      <section className="home-command">
        <div className="home-command-copy">
          <span className="section-label">Centro de mando</span>
          <h2>Prepara tu hangar con datos claros</h2>
          <p>Stanton Hub concentra catalogo de naves, componentes enlazados y noticias oficiales traducidas para que puedas comparar, decidir y preparar tu siguiente compra o prueba con menos vueltas.</p>
          <div className="home-command-actions">
            <a className="action-btn primary-action" href={routes.ships} onClick={(event) => routeClick(event, routes.ships, navigate)}>Explorar naves</a>
            <a className="action-btn" href={routes.components} onClick={(event) => routeClick(event, routes.components, navigate)}>Ver componentes</a>
            <a className="action-btn" href={routes.miningMaterials} onClick={(event) => routeClick(event, routes.miningMaterials, navigate)}>Planificar mineria</a>
            <a className="action-btn" href={routes.gameNews} onClick={(event) => routeClick(event, routes.gameNews, navigate)}>Leer noticias</a>
          </div>
          <dl className="home-status-strip">
            {status.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
        </div>
        <div className="home-carousel" aria-label="Capturas destacadas de Star Citizen">
          {slides.map(([label, text], index) => (
            <article className={`home-carousel-slide home-carousel-slide-${index + 1}`} key={label}>
              <div className="home-carousel-caption">
                <span>{label}</span>
                <strong>{text}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="home-workflow" aria-label="Flujo de uso">
        {workflow.map(([title, text]) => <article className="home-highlight" key={title}><strong>{title}</strong><p>{text}</p></article>)}
      </section>

      <section className="home-mission-grid" aria-label="Herramientas destacadas">
        <article className="home-mission-card home-mission-primary">
          <span className="section-label">Hangar tecnico</span>
          <h2>Del catalogo a la decision</h2>
          <p>Empieza filtrando una nave, abre su ficha y baja hasta hardpoints, modulos, compra, alquiler y puntuacion operacional.</p>
          <a className="ship-link" href={routes.ships} onClick={(event) => routeClick(event, routes.ships, navigate)}>Abrir catalogo de naves</a>
        </article>
        <article className="home-mission-card">
          <span>Componentes enlazados</span>
          <strong>Armas, escudos y sistemas</strong>
          <p>Los componentes detectados en las naves preparan el camino para fichas tecnicas reutilizables.</p>
        </article>
        <article className="home-mission-card">
          <span>Materiales minables</span>
          <strong>Rutas de extraccion</strong>
          <p>Busca Oro, Quantainium o gemas de ROC y revisa ubicaciones, riesgo, calidad y equipo recomendado.</p>
        </article>
        <article className="home-mission-card">
          <span>Noticias oficiales</span>
          <strong>Traduccion rapida</strong>
          <p>Lee el resumen en espanol y abre la fuente oficial cuando necesites confirmar detalles.</p>
        </article>
      </section>

      <section className="home-news-panel" aria-label="Ultimas noticias de Star Citizen">
        <div className="home-news-heading">
          <span className="section-label">Noticias</span>
          <h2>Ultimas noticias del verso</h2>
          <a className="ship-link" href={routes.gameNews} onClick={(event) => routeClick(event, routes.gameNews, navigate)}>Ver noticias</a>
        </div>
        <div className="home-news-grid">
          {(latestNews.length ? latestNews : [['Cargando actualidad...', 'La seccion se actualiza automaticamente desde Comm-Link.', '']].map(([title, excerpt, url]) => ({ title, excerpt, url }))).map((item) => (
            <a className="home-news-card" key={item.url || item.title} href={newsPath(item)} onClick={(event) => routeClick(event, newsPath(item), navigate)}>
              {item.image ? <img src={highQualityNewsImage(item.image)} alt="" loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = fallbackNewsImage(event.currentTarget.src); }} /> : null}
              <span>{item.category || 'Comm-Link'}</span>
              <strong>{item.title}</strong>
              <p>{item.excerpt}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="home-sections" aria-label="Apartados principales">
        {cards.map(([path, label, title, text]) => <a key={path} className="section-card" href={path} onClick={(event) => routeClick(event, path, navigate)}><span>{label}</span><strong>{title}</strong><p>{text}</p></a>)}
      </section>
    </main>
  );
}
