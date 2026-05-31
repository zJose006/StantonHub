import React, { useEffect, useState } from 'react';
import { routes } from '../config/routes.js';
import { loadGameNews } from '../services/api.js';
import { routeClick } from '../utils/navigation.js';

/** Pagina de bienvenida con accesos directos a las secciones principales. */
export function Home({ navigate }) {
  const [latestNews, setLatestNews] = useState([]);

  useEffect(() => {
    loadGameNews().then((payload) => setLatestNews((payload.items || []).slice(0, 3))).catch(() => setLatestNews([]));
  }, []);

  const cards = [
    [routes.ships, 'Catalogo tecnico', 'Naves', 'Filtra vehiculos por fabricante, rol, tamano, precio y revisa fichas con hardpoints, modulos y puntuacion operacional.'],
    [routes.components, 'Equipamiento', 'Componentes', 'Consulta armas, escudos, quantum, propulsion y sistemas relacionados con las naves del catalogo.'],
    [routes.guides, 'Aprendizaje', 'Guias', 'Manuales de farmeo, preparacion de rutas, mecanicas y recomendaciones creadas por la comunidad.'],
    [routes.forum, 'Operaciones', 'Base de operaciones', 'Publica rutas, dudas, hallazgos y consejos rapidos para otros pilotos.'],
    [routes.gameNews, 'Actualidad', 'Noticias oficiales', 'Ultimas comunicaciones del desarrollo para estar al dia antes de despegar.'],
    [routes.news, 'Comunidad', 'Intel', 'Avisos, eventos y oportunidades utiles publicadas por pilotos del hub.'],
    [routes.profile, 'Cuenta', 'Perfil', 'Acceso con Discord, actividad, publicaciones y herramientas para aportar contenido.']
  ];
  const workflow = [
    ['Planifica', 'Compara naves, revisa componentes y decide que llevar antes de iniciar una ruta.'],
    ['Ejecuta', 'Usa guias e intel para priorizar actividades, farmeo, compras y pruebas de carga.'],
    ['Comparte', 'Publica ayudas con imagenes, comentarios y votos para que la informacion mejore con la comunidad.']
  ];
  const status = [
    ['Catalogo', 'Naves y componentes enlazados'],
    ['Guias', 'Farmeo, preparacion y rutas'],
    ['Comunidad', 'Intel, votos y comentarios']
  ];
  const slides = [
    ['Combate', 'Naves, hardpoints y lectura rapida de potencia ofensiva.'],
    ['Sistemas', 'Componentes, energia, quantum y configuraciones preparadas para comparar.'],
    ['Exploracion', 'Fichas pensadas para elegir nave, rol y preparacion de vuelo.']
  ];

  return (
    <main className="container home-shell">
      <section className="home-command">
        <div className="home-command-copy">
          <span className="section-label">Centro de mando</span>
          <h2>Organiza tus operaciones en Stanton</h2>
          <p>Stanton Hub concentra guias, rutas, intel, catalogo de naves y componentes para que cualquier piloto pueda preparar una sesion sin perder tiempo saltando entre fuentes.</p>
          <div className="home-command-actions">
            <a className="action-btn primary-action" href={routes.ships} onClick={(event) => routeClick(event, routes.ships, navigate)}>Explorar naves</a>
            <a className="action-btn" href={routes.guides} onClick={(event) => routeClick(event, routes.guides, navigate)}>Ver guias</a>
          </div>
          <dl className="home-status-strip">
            {status.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
        </div>
        <div className="home-carousel" aria-label="Capturas destacadas de Star Citizen">
          {slides.map(([label, text], index) => (
            <article className={`home-carousel-slide home-carousel-slide-${index + 1}`} key={label}>
              <span>{label}</span>
              <strong>{text}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="home-workflow" aria-label="Flujo de uso">
        {workflow.map(([title, text]) => <article className="home-highlight" key={title}><strong>{title}</strong><p>{text}</p></article>)}
      </section>

      <section className="home-news-panel" aria-label="Ultimas noticias de Star Citizen">
        <div className="home-news-heading">
          <span className="section-label">Actualidad</span>
          <h2>Ultimas noticias del verso</h2>
          <a className="ship-link" href={routes.gameNews} onClick={(event) => routeClick(event, routes.gameNews, navigate)}>Ver actualidad</a>
        </div>
        <div className="home-news-grid">
          {(latestNews.length ? latestNews : [['Cargando actualidad...', 'La seccion se actualiza automaticamente desde Comm-Link.', '']].map(([title, excerpt, url]) => ({ title, excerpt, url }))).map((item) => (
            <article className="home-news-card" key={item.url || item.title}>
              {item.image ? <img src={item.image} alt="" loading="lazy" /> : null}
              <span>{item.category || 'Comm-Link'}</span>
              <strong>{item.title}</strong>
              <p>{item.excerpt}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-sections" aria-label="Apartados principales">
        {cards.map(([path, label, title, text]) => <a key={path} className="section-card" href={path} onClick={(event) => routeClick(event, path, navigate)}><span>{label}</span><strong>{title}</strong><p>{text}</p></a>)}
      </section>
    </main>
  );
}
