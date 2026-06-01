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

/** Actualidad oficial del juego con lectura rapida para la comunidad. */
export function GameNewsPage({ navigate }) {
  const [payload, setPayload] = useState({ items: [], source: '', updatedAt: '' });
  const [status, setStatus] = useState('Sincronizando actualidad...');

  useEffect(() => {
    loadGameNews()
      .then((data) => {
        setPayload(data);
        setStatus(data.items?.length ? `Actualizado: ${data.updatedLabel || 'ahora'}` : 'No hay noticias disponibles temporalmente.');
      })
      .catch((error) => setStatus('No se pudo cargar la actualidad: ' + error.message));
  }, []);

  const main = payload.items?.[0];
  const secondary = payload.items?.slice(1, 7) || [];

  return (
    <main className="container game-news-shell">
      <section className="panel game-news-brief">
        <div>
          <span className="section-label">Noticias</span>
          <h2>Ultimas noticias de Star Citizen</h2>
          <p>{status}</p>
        </div>
        <a className="action-btn" href={routes.news} onClick={(event) => routeClick(event, routes.news, navigate)}>Intel de comunidad</a>
      </section>

      {main ? (
        <section className="game-news-feature">
          <a className="panel game-news-card featured" href={newsPath(main)} onClick={(event) => routeClick(event, newsPath(main), navigate)}>
            {main.image ? <img src={highQualityNewsImage(main.image)} alt="" loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = fallbackNewsImage(event.currentTarget.src); }} /> : null}
            <span>{main.category || 'Comm-Link'}</span>
            <h3>{main.title}</h3>
            <p>{main.excerpt}</p>
            <div>
              <time>{main.publishedLabel}</time>
              <span className="ship-link">Leer noticia</span>
            </div>
          </a>
          <aside className="panel game-news-source">
            <span className="section-label">Fuente</span>
            <h3>Actualizacion automatica</h3>
            <p>Esta seccion consulta periodicamente las comunicaciones oficiales y guarda una cache corta para que la web cargue rapido.</p>
            <strong>{payload.source || 'Comm-Link oficial'}</strong>
          </aside>
        </section>
      ) : null}

      <section className="game-news-list">
        {secondary.map((item) => (
          <a className="panel game-news-card" key={item.url || item.title} href={newsPath(item)} onClick={(event) => routeClick(event, newsPath(item), navigate)}>
            {item.image ? <img src={highQualityNewsImage(item.image)} alt="" loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = fallbackNewsImage(event.currentTarget.src); }} /> : null}
            <span>{item.category || 'Comm-Link'}</span>
            <h3>{item.title}</h3>
            <p>{item.excerpt}</p>
            <div>
              <time>{item.publishedLabel}</time>
              <span className="ship-link">Abrir</span>
            </div>
          </a>
        ))}
      </section>
    </main>
  );
}
