import React, { useEffect, useMemo, useState } from 'react';
import { routes } from '../config/routes.js';
import { loadGameNewsDetail } from '../services/api.js';
import { fallbackNewsImage, highQualityNewsImage } from '../utils/news.js';
import { routeClick } from '../utils/navigation.js';

/** Ficha interna de una noticia oficial, traducida y con medios detectados. */
export function GameNewsDetailPage({ identifier, navigate }) {
  const [payload, setPayload] = useState(null);
  const [status, setStatus] = useState('Preparando noticia...');

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    loadGameNewsDetail(identifier)
      .then((data) => {
        setPayload(data);
        setStatus('');
      })
      .catch((error) => setStatus('No se pudo cargar la noticia: ' + error.message));
  }, [identifier]);

  useEffect(() => {
    if (payload?.title) document.title = `Stanton Hub - ${payload.title}`;
  }, [payload]);

  const media = useMemo(() => {
    const images = payload?.images?.length ? payload.images : (payload?.image ? [payload.image] : []);
    return images.slice(0, 8);
  }, [payload]);

  if (!payload) {
    return (
      <main className="container game-news-detail-shell">
        <section className="panel game-news-detail-empty">
          <span className="section-label">Noticias</span>
          <h2>Ficha de noticia</h2>
          <p>{status}</p>
          <a className="action-btn" href={routes.gameNews} onClick={(event) => routeClick(event, routes.gameNews, navigate)}>Volver a noticias</a>
        </section>
      </main>
    );
  }

  return (
    <main className="container game-news-detail-shell">
      <article className="panel game-news-detail-hero">
        <div className="game-news-detail-copy">
          <span className="section-label">{payload.category || 'Comm-Link'}</span>
          <h2>{payload.title}</h2>
          <p>{payload.excerpt}</p>
          <p className="news-translation-disclaimer">Contenido traducido automaticamente. Puede contener errores, frases imprecisas o perder contexto; usa la fuente oficial como referencia definitiva.</p>
          <div className="game-news-detail-meta">
            <time>{payload.publishedLabel || 'Fecha no disponible'}</time>
            <span>{payload.translationMode || 'Traduccion automatica'}</span>
          </div>
          <div className="game-news-detail-actions">
            <a className="action-btn primary-action" href={payload.url} target="_blank" rel="noreferrer">Fuente oficial</a>
            <a className="action-btn" href={routes.gameNews} onClick={(event) => routeClick(event, routes.gameNews, navigate)}>Noticias</a>
          </div>
        </div>
        {payload.image ? <img className="game-news-detail-cover" src={highQualityNewsImage(payload.image)} alt="" loading="eager" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = fallbackNewsImage(event.currentTarget.src); }} /> : null}
      </article>

      <section className="game-news-detail-layout">
        <article className="panel game-news-article">
          <span className="section-label">Resumen traducido</span>
          <h3>Contenido de la comunicacion</h3>
          {(payload.paragraphs || []).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </article>

        <aside className="panel game-news-side">
          <span className="section-label">Medios</span>
          <h3>Imagenes y videos detectados</h3>
          <p>El sistema extrae automaticamente medios publicos de la comunicacion y los muestra aqui cuando estan disponibles.</p>
          <strong>{media.length} imagenes</strong>
          <strong>{payload.videos?.length || 0} videos</strong>
        </aside>
      </section>

      {media.length ? (
        <section className="game-news-media-grid" aria-label="Imagenes de la noticia">
          {media.map((image) => <img key={image} src={highQualityNewsImage(image)} alt="" loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = fallbackNewsImage(event.currentTarget.src); }} />)}
        </section>
      ) : null}

      {payload.videos?.length ? (
        <section className="game-news-video-grid" aria-label="Videos de la noticia">
          {payload.videos.map((video) => <iframe key={video} src={video} title="Video de noticia" loading="lazy" allowFullScreen />)}
        </section>
      ) : null}
    </main>
  );
}
