import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/styles.css';

const defaultState = {
  users: [],
  sessionUserId: null,
  testBypass: false,
  interactions: { votes: {}, comments: {} },
  content: { forum: [], guides: [], news: [] }
};

const routes = {
  home: '/pages/index',
  forum: '/pages/forum',
  guides: '/pages/guias',
  news: '/pages/noticias',
  ships: '/pages/naves',
  profile: '/pages/perfil',
  login: '/pages/login',
  register: '/pages/registro',
  editor: '/pages/editor'
};

const legacyRouteMap = {
  '/index.html': routes.home,
  '/pages/index.html': routes.home,
  '/pages/forum.html': routes.forum,
  '/pages/guias.html': routes.guides,
  '/pages/noticias.html': routes.news,
  '/pages/naves.html': routes.ships,
  '/pages/perfil.html': routes.profile,
  '/pages/login.html': routes.login,
  '/pages/registro.html': routes.register,
  '/pages/editor.html': routes.editor
};

const pageMap = {
  '/': 'home',
  [routes.home]: 'home',
  [routes.forum]: 'forum',
  [routes.guides]: 'guides',
  [routes.news]: 'news',
  [routes.ships]: 'ships',
  [routes.profile]: 'profile',
  [routes.login]: 'login',
  [routes.register]: 'register',
  [routes.editor]: 'editor'
};

const sectionLabels = {
  forum: 'Base de operaciones',
  guides: 'Guias',
  news: 'Intel'
};

const editorLabels = {
  forum: 'mensaje de foro',
  guides: 'guia',
  news: 'intel'
};
const apiBaseUrl = '';

function App() {
  const [page, setPage] = useState(getCurrentPage());
  const [state, setState] = useState(defaultState);
  const [stateError, setStateError] = useState('');

  useEffect(() => {
    const cleanPath = normalizeRoute(window.location.pathname);
    if (cleanPath !== window.location.pathname) {
      window.history.replaceState(null, '', `${cleanPath}${window.location.search}`);
      setPage(getCurrentPage());
    }

    const onPopState = () => setPage(getCurrentPage());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    loadState().then(setState).catch((error) => setStateError(error.message));
  }, []);

  const currentUser = useMemo(
    () => state.users.find((user) => user.id === state.sessionUserId) || null,
    [state]
  );

  function navigate(path) {
    window.history.pushState(null, '', path.replace(/\.html(?=\?|$)/, ''));
    setPage(getCurrentPage());
  }

  return (
    <>
      <Header page={page} navigate={navigate} currentUser={currentUser} />
      {page === 'home' && <Home navigate={navigate} />}
      {['forum', 'guides', 'news'].includes(page) && (
        <ContentPage
          section={page}
          state={state}
          setState={setState}
          currentUser={currentUser}
          navigate={navigate}
          stateError={stateError}
        />
      )}
      {page === 'ships' && <ShipsPage />}
      {page === 'profile' && (
        <ProfilePage
          state={state}
          setState={setState}
          currentUser={currentUser}
          navigate={navigate}
          stateError={stateError}
        />
      )}
      {page === 'login' && <LoginPage setState={setState} navigate={navigate} />}
      {page === 'register' && <RegisterPage setState={setState} navigate={navigate} />}
      {page === 'editor' && <EditorPage setState={setState} navigate={navigate} />}
      <Footer navigate={navigate} />
    </>
  );
}

function getCurrentPage() {
  return pageMap[normalizeRoute(window.location.pathname)] || 'home';
}

function normalizeRoute(path) {
  return legacyRouteMap[path] || path.replace(/\.html$/, '');
}

async function requestJson(url, options = {}) {
  const response = await fetch(`${apiBaseUrl}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'No se pudo completar la accion.');
  return payload;
}

function loadState() {
  return requestJson('/api/state');
}

function Header({ page, navigate, currentUser }) {
  const [openMenu, setOpenMenu] = useState('');

  useEffect(() => {
    const close = (event) => {
      if (!event.target.closest('.nav-group')) setOpenMenu('');
    };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const link = (path, label, className = 'page-btn') => (
    <a className={className} href={path} onClick={(event) => routeClick(event, path, navigate)}>
      {label}
    </a>
  );

  return (
    <header className="hero hero-compact">
      <div className="hero-topbar">
        <a className="home-button" href={routes.home} onClick={(event) => routeClick(event, routes.home, navigate)} aria-label="Inicio">
          <span className="home-icon" aria-hidden="true">SC</span>
          Stanton Hub
        </a>
        <nav className="site-nav" aria-label="Navegacion principal">
          {link(routes.home, 'Inicio')}
          <NavGroup name="Operaciones" active={page === 'forum'} openMenu={openMenu} setOpenMenu={setOpenMenu}>
            <MenuItem path={routes.forum} title="Base de operaciones" text="Consejos destacados, rutas aUEC y actividad reciente." navigate={navigate} />
          </NavGroup>
          <NavGroup name="Biblioteca" active={page === 'guides' || page === 'ships'} openMenu={openMenu} setOpenMenu={setOpenMenu}>
            <MenuItem path={routes.guides} title="Guias" text="Manuales, preparacion y mecanicas explicadas." navigate={navigate} />
            <MenuItem path={routes.ships} title="Naves" text="Catalogo con precios, filtros y detalles tecnicos." navigate={navigate} />
          </NavGroup>
          <NavGroup name="Comunidad" active={page === 'news'} openMenu={openMenu} setOpenMenu={setOpenMenu}>
            <MenuItem path={routes.news} title="Intel" text="Novedades, eventos y oportunidades del verso." navigate={navigate} />
          </NavGroup>
        </nav>
        {currentUser ? (
          <NavGroup name="Cuenta" active={page === 'profile' || page === 'editor'} openMenu={openMenu} setOpenMenu={setOpenMenu} triggerContent={<UserBadge user={currentUser} />}>
            <MenuItem path={routes.profile} title="Mi perfil" text="Identidad, acceso y actividad de tu cuenta." navigate={navigate} />
            <MenuItem path={`${routes.editor}?type=forum`} title="Crear publicacion" text="Publica consejos, guias o intel desde el editor." navigate={navigate} />
          </NavGroup>
        ) : (
          <div className="auth-nav-links">
            {link(routes.login, 'Iniciar sesion', 'profile-link')}
            {link(routes.register, 'Registrarse', 'profile-link')}
          </div>
        )}
      </div>
      <HeroContent page={page} />
    </header>
  );
}

function NavGroup({ name, active, openMenu, setOpenMenu, triggerContent, children }) {
  const isOpen = openMenu === name;
  const introText = {
    Biblioteca: 'Guias y preparacion de vuelo',
    Operaciones: 'Rutas, farmeo y actividad del hub',
    Cuenta: 'Perfil, editor y acceso de piloto',
    Comunidad: 'Intel y actividad de la comunidad'
  }[name] || 'Secciones de Stanton Hub';

  return (
    <div className={`nav-group ${isOpen ? 'is-open' : ''}`}>
      <button className={`nav-trigger ${active ? 'active' : ''}`} type="button" aria-expanded={isOpen} onClick={(event) => {
        event.stopPropagation();
        setOpenMenu(isOpen ? '' : name);
      }}>
        {triggerContent || name}
      </button>
      <div className="nav-menu" hidden={!isOpen}>
        <div className="nav-menu-intro">
          <strong>{name}</strong>
          <span>{introText}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function UserBadge({ user }) {
  return (
    <span className="user-badge">
      <span className="user-badge-avatar">
        {user.discordAvatar ? <img src={user.discordAvatar} alt="" /> : initials(user.username)}
      </span>
      <span>{user.username}</span>
    </span>
  );
}

function MenuItem({ path, title, text, navigate }) {
  return (
    <a className="nav-menu-item" href={path} onClick={(event) => routeClick(event, path, navigate)}>
      <strong>{title}</strong>
      <span>{text}</span>
    </a>
  );
}

function HeroContent({ page }) {
  const content = {
    home: ['Bienvenido a Stanton Hub', 'Tu punto de acceso para operaciones, guias, intel y catalogo de naves.'],
    forum: ['Base de operaciones', 'Publicaciones de usuarios sobre rutas, consejos y actividad reciente.'],
    guides: ['Guias de pilotos', 'Manuales y preparacion creados por la comunidad.'],
    news: ['Intel de comunidad', 'Avisos, eventos y novedades publicadas por usuarios.'],
    ships: ['Naves y vehiculos del verso', 'Catalogo UEX con precios, filtros, fabricantes y detalles tecnicos.'],
    profile: ['Perfil de piloto', 'Identidad, acceso y actividad de tu cuenta.'],
    login: ['Acceso de piloto', 'Inicia sesion para publicar contenido.'],
    register: ['Crear perfil', 'Registra tu identificador y prepara tu acceso.'],
    editor: ['Editor de publicaciones', 'Crea contenido para operaciones, guias o intel.']
  }[page] || ['Stanton Hub', 'Operaciones del verso'];

  return (
    <div className="hero-content">
      <span className="eyebrow">React app</span>
      <h1>{content[0]}</h1>
      <p>{content[1]}</p>
    </div>
  );
}

function Home({ navigate }) {
  const cards = [
    [routes.forum, 'Operaciones', 'Base de operaciones', 'Rutas de farmeo, consejos de pilotos, avisos tacticos y comentarios de la comunidad.'],
    [routes.guides, 'Biblioteca', 'Guias', 'Manuales, preparacion de vuelo y explicaciones de mecanicas para consultar antes de salir.'],
    [routes.ships, 'Catalogo UEX', 'Naves', 'Listado filtrable de vehiculos con fabricante, tamano, carga, precios de compra, alquiler y pledge.'],
    [routes.news, 'Comunidad', 'Intel', 'Novedades, eventos y oportunidades publicadas por usuarios del hub.'],
    [routes.profile, 'Acceso', 'Perfil', 'Panel de cuenta, modo pruebas, metricas de aportes y acceso rapido al editor.']
  ];
  const workflow = [
    ['Consulta', 'Revisa naves, guias e intel antes de preparar una ruta o comprar un vehiculo.'],
    ['Publica', 'Crea rutas, guias o avisos desde el editor con texto enriquecido e imagenes.'],
    ['Participa', 'Vota y comenta publicaciones para mantener vivo el conocimiento de la comunidad.']
  ];

  return (
    <main className="container home-shell">
      <section className="welcome-panel panel">
        <div className="welcome-copy">
          <span className="section-label">Centro de mando</span>
          <h2>Bienvenido a Stanton Hub</h2>
          <p>
            Un espacio para organizar informacion util de Star Citizen: rutas, guias,
            catalogo de naves, avisos de comunidad y publicaciones creadas por usuarios.
            La web empieza limpia y crece con el contenido que aporte cada piloto.
          </p>
        </div>
        <div className="home-highlight-grid">
          {workflow.map(([title, text]) => (
            <article className="home-highlight" key={title}>
              <strong>{title}</strong>
              <p>{text}</p>
            </article>
          ))}
        </div>
        <section className="home-sections" aria-label="Apartados principales">
          {cards.map(([path, label, title, text]) => (
          <a key={path} className="section-card" href={path} onClick={(event) => routeClick(event, path, navigate)}>
            <span>{label}</span>
            <strong>{title}</strong>
            <p>{text}</p>
          </a>
        ))}
        </section>
      </section>
    </main>
  );
}

function Footer({ navigate }) {
  const footerLinks = [
    [routes.home, 'Inicio'],
    [routes.forum, 'Operaciones'],
    [routes.guides, 'Guias'],
    [routes.ships, 'Naves'],
    [routes.news, 'Intel'],
    [routes.profile, 'Perfil']
  ];

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <section>
          <span className="footer-mark">Stanton Hub</span>
          <p>
            Hub comunitario para organizar publicaciones, guias, catalogo de naves
            y recursos de Star Citizen. La informacion final de contacto y enlaces
            oficiales se completara mas adelante.
          </p>
        </section>
        <nav aria-label="Enlaces del pie de pagina">
          {footerLinks.map(([path, label]) => (
            <a key={path} href={path} onClick={(event) => routeClick(event, path, navigate)}>{label}</a>
          ))}
        </nav>
        <section>
          <span className="footer-title">Pendiente</span>
          <p>Zona reservada para Discord, normas, enlaces externos, creditos y avisos legales.</p>
        </section>
      </div>
    </footer>
  );
}

function ContentPage({ section, state, setState, currentUser, navigate, stateError }) {
  const items = [...(state.content?.[section] || [])].reverse();
  const canPublish = Boolean(currentUser) || state.testBypass;

  async function vote(postId, value) {
    setState(await requestJson('/api/vote', {
      method: 'POST',
      body: JSON.stringify({ postId, vote: value })
    }));
  }

  async function comment(postId, text) {
    setState(await requestJson('/api/comment', {
      method: 'POST',
      body: JSON.stringify({ postId, text })
    }));
  }

  return (
    <main className="container">
      <section className="page-heading">
        <div>
          <span className="section-label">{sectionLabels[section]}</span>
          <h2>{sectionLabels[section]}</h2>
        </div>
        <a className="action-btn primary-action" href={`${routes.editor}?type=${section}`} onClick={(event) => {
          if (!canPublish) return routeClick(event, routes.login, navigate);
          routeClick(event, `${routes.editor}?type=${section}`, navigate);
        }}>
          Publicar
        </a>
      </section>
      {stateError && <section className="ships-status">{stateError}</section>}
      {!items.length ? (
        <div className="empty-state">
          <strong>No hay publicaciones todavia</strong>
          <p>Cuando un usuario publique contenido, aparecera aqui.</p>
        </div>
      ) : (
        <section className="post-list">
          {items.map((item) => (
            <PostCard
              key={item.id}
              item={item}
              votes={state.interactions?.votes?.[item.id] || { up: 0, down: 0 }}
              comments={state.interactions?.comments?.[item.id] || []}
              onVote={vote}
              onComment={comment}
            />
          ))}
        </section>
      )}
    </main>
  );
}

function PostCard({ item, votes, comments, onVote, onComment }) {
  const [commentText, setCommentText] = useState('');
  return (
    <article className="post-card">
      <h3>{item.title}</h3>
      {item.contentHtml ? <div className="post-body" dangerouslySetInnerHTML={{ __html: item.contentHtml }} /> : <p>{item.content}</p>}
      {!!item.images?.length && (
        <div className="post-gallery">
          {item.images.map((image) => <img key={image.src} src={image.src} alt={image.name || item.title} />)}
        </div>
      )}
      <div className="post-footer">
        <span>{item.author || 'Stanton Hub'}</span>
        <span>{item.date}</span>
      </div>
      <div className="post-interactions">
        <div className="vote-controls" aria-label="Votos">
          <button type="button" onClick={() => onVote(item.id, 1)}>+ {votes.up || 0}</button>
          <button type="button" onClick={() => onVote(item.id, -1)}>- {votes.down || 0}</button>
        </div>
        <details className="comments-panel">
          <summary>{comments.length} comentarios</summary>
          <div className="comment-list">
            {comments.length ? comments.map((comment) => (
              <article className="comment-item" key={comment.id}>
                <strong>{comment.author}</strong>
                <p>{comment.text}</p>
                <span>{comment.date}</span>
              </article>
            )) : <p className="empty-comments">Sin comentarios todavia.</p>}
          </div>
          <form className="comment-form" onSubmit={(event) => {
            event.preventDefault();
            if (!commentText.trim()) return;
            onComment(item.id, commentText.trim()).then(() => setCommentText(''));
          }}>
            <input type="text" value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Anadir comentario" maxLength="240" required />
            <button type="submit">Comentar</button>
          </form>
        </details>
      </div>
    </article>
  );
}

function ShipsPage() {
  const [ships, setShips] = useState([]);
  const [status, setStatus] = useState('Cargando catalogo local...');
  const [syncing, setSyncing] = useState(false);
  const [filters, setFilters] = useState({ search: '', manufacturer: '', type: '', role: '', sort: 'size' });

  useEffect(() => {
    requestJson('/api/vehicles')
      .then((payload) => {
        setShips(payload.vehicles || []);
        setStatus(payload.warnings?.length ? `Naves cargadas desde ${payload.source}. Algunos precios no estan disponibles temporalmente.` : `Datos cargados desde ${payload.source}.`);
      })
      .catch((error) => {
        setStatus(error.message.includes('EACCES')
          ? 'No se pudo acceder a UEX desde este entorno. Abre la web con npm run dev desde tu terminal local.'
          : `No se pudo cargar el catalogo local: ${error.message}`);
      });
  }, []);

  async function syncVehicles() {
    setSyncing(true);
    setStatus('Sincronizando UEX con la base de datos local...');
    try {
      const payload = await requestJson('/api/vehicles/sync', { method: 'POST' });
      setShips(payload.vehicles || []);
      setStatus(payload.warnings?.length
        ? `Base de datos actualizada desde UEX. Algunos precios no estan disponibles temporalmente.`
        : `Base de datos actualizada desde UEX.`);
    } catch (error) {
      setStatus(`No se pudo sincronizar UEX: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  }

  const manufacturers = uniqueSorted(ships.map((ship) => ship.manufacturer).filter(Boolean));
  const roles = uniqueSorted(ships.flatMap((ship) => ship.tags || []));
  const visibleShips = sortShips(ships.filter((ship) => shipMatches(ship, filters)), filters.sort);

  return (
    <main className="container ships-shell">
      <section className="ships-toolbar panel">
        <div className="ships-toolbar-header">
          <div>
            <span className="section-label">Busqueda</span>
            <h2>Filtra el catalogo</h2>
            <p>{status}</p>
          </div>
          <div className="ships-toolbar-actions">
            <span className="ships-count">{ships.length ? `${visibleShips.length} / ${ships.length}` : 'Cargando...'}</span>
            <button className="action-btn" type="button" onClick={syncVehicles} disabled={syncing}>
              {syncing ? 'Sincronizando...' : 'Sincronizar UEX'}
            </button>
          </div>
        </div>
        <div className="ships-controls">
          <ShipInput label="Buscar" value={filters.search} onChange={(value) => setFilters({ ...filters, search: value })} />
          <ShipSelect label="Fabricante" value={filters.manufacturer} values={manufacturers} onChange={(value) => setFilters({ ...filters, manufacturer: value })} />
          <ShipSelect label="Tipo" value={filters.type} values={[['spaceship', 'Naves'], ['ground', 'Terrestres'], ['quantum', 'Quantum'], ['concept', 'Concept']]} onChange={(value) => setFilters({ ...filters, type: value })} />
          <ShipSelect label="Rol" value={filters.role} values={roles} onChange={(value) => setFilters({ ...filters, role: value })} />
          <ShipSelect label="Orden" value={filters.sort} values={[['size', 'Tamano'], ['name', 'Nombre'], ['pledge', 'Precio pledge'], ['purchase', 'Compra in-game'], ['rental', 'Alquiler'], ['cargo', 'SCU']]} onChange={(value) => setFilters({ ...filters, sort: value })} />
        </div>
      </section>
      <section className={`ships-status ${visibleShips.length ? 'hidden' : ''}`}>{visibleShips.length ? '' : status}</section>
      <section className="ships-grid">
        {visibleShips.map((ship) => <ShipCard key={ship.id} ship={ship} />)}
      </section>
    </main>
  );
}

function ShipInput({ label, value, onChange }) {
  return (
    <label>
      {label}
      <input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Nombre, fabricante, rol..." />
    </label>
  );
}

function ShipSelect({ label, value, values, onChange }) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Todos</option>
        {values.map((item) => {
          const optionValue = Array.isArray(item) ? item[0] : item;
          const optionLabel = Array.isArray(item) ? item[1] : item;
          return <option key={optionValue} value={optionValue}>{optionLabel}</option>;
        })}
      </select>
    </label>
  );
}

function ShipCard({ ship }) {
  const [imageIndex, setImageIndex] = useState(0);
  const rawImages = ship.imageCandidates?.length ? ship.imageCandidates : [ship.photoProxy, ship.photo, ship.wikiImageProxy].filter(Boolean);
  const images = rawImages.map((image) => image.startsWith('/api/') ? `${apiBaseUrl}${image}` : image);
  const currentImage = images[imageIndex];

  return (
    <article className="ship-card">
      <div className="ship-image">
        {currentImage ? (
          <img src={currentImage} alt={ship.name} loading="lazy" onError={() => setImageIndex((index) => index + 1)} />
        ) : <div className="ship-image-placeholder">SC</div>}
      </div>
      <div className="ship-card-body">
        <div className="ship-title-row">
          <div>
            <span>{ship.manufacturer}</span>
            <h3>{ship.name}</h3>
          </div>
          <strong>{ship.padType}</strong>
        </div>
        <div className="ship-tags">{ship.tags?.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>) || <span>Sin rol</span>}</div>
        <dl className="ship-specs">
          <div><dt>Pledge</dt><dd>{money(ship.pledge?.price, ship.pledge?.currency || 'USD')}</dd></div>
          <div><dt>Compra</dt><dd>{money(ship.purchase?.price)}</dd></div>
          <div><dt>Alquiler</dt><dd>{money(ship.rental?.price)}</dd></div>
          <div><dt>Carga</dt><dd>{ship.scu ? `${ship.scu} SCU` : 'N/D'}</dd></div>
          <div><dt>Tripulacion</dt><dd>{ship.crew}</dd></div>
          <div><dt>Longitud</dt><dd>{meters(ship.length)}</dd></div>
        </dl>
        <div className="ship-locations">
          <strong>Compra:</strong>
          <span>{ship.purchase?.locations?.length ? ship.purchase.locations.join(', ') : 'Sin terminal conocido'}</span>
        </div>
        <div className="ship-locations">
          <strong>Alquiler:</strong>
          <span>{ship.rental?.locations?.length ? ship.rental.locations.join(', ') : 'Sin terminal conocido'}</span>
        </div>
        {ship.storeUrl && <a className="ship-link" href={ship.storeUrl} target="_blank" rel="noreferrer">Ver en RSI</a>}
      </div>
    </article>
  );
}

function ProfilePage({ state, setState, currentUser, navigate, stateError }) {
  const bypassEnabled = Boolean(state.testBypass);
  const userGuides = currentUser ? state.content.guides.filter((item) => item.author === currentUser.username).length : 0;
  const userIntel = currentUser ? state.content.news.filter((item) => item.author === currentUser.username).length : 0;
  const userPosts = currentUser ? Object.values(state.content).flat().filter((item) => item.author === currentUser.username).length : 0;

  async function updateBypass(enabled) {
    setState(await requestJson('/api/bypass', {
      method: 'POST',
      body: JSON.stringify({ enabled })
    }));
  }

  async function logout() {
    setState(await requestJson('/api/logout', { method: 'POST' }));
  }

  return (
    <main className="container profile-shell">
      {stateError && <section className="ships-status">{stateError}</section>}
      <section className="profile-identity-panel">
        <div className="profile-identity-main">
          <div className="profile-avatar profile-avatar-command">
            {currentUser?.discordAvatar
              ? <img src={currentUser.discordAvatar} alt={currentUser.username} />
              : currentUser ? initials(currentUser.username) : bypassEnabled ? 'QA' : 'SC'}
          </div>
          <div>
            <span className="section-label">{currentUser?.role || (bypassEnabled ? 'Acceso temporal' : 'Piloto sin identificar')}</span>
            <h2>{currentUser?.username || (bypassEnabled ? 'Modo pruebas' : 'Invitado')}</h2>
            <p>{currentUser ? 'Publicacion habilitada para rutas, guias e intel.' : 'Inicia sesion para publicar guias, rutas y ayudas.'}</p>
          </div>
        </div>
        <dl className="profile-dossier">
          <div>
            <dt>Email</dt>
            <dd>{currentUser?.email || 'No disponible'}</dd>
          </div>
          <div>
            <dt>Alta</dt>
            <dd>{currentUser?.createdAt || 'Sin registro'}</dd>
          </div>
          <div>
            <dt>Acceso</dt>
            <dd>{currentUser ? 'Publicacion habilitada' : bypassEnabled ? 'Modo pruebas' : 'Lectura'}</dd>
          </div>
        </dl>
        <div className="profile-actions profile-command-actions">
          {currentUser ? (
            <>
              <a className="action-btn primary-action" href={`${routes.editor}?type=forum`} onClick={(event) => routeClick(event, `${routes.editor}?type=forum`, navigate)}>Publicar</a>
              <button className="action-btn" type="button" onClick={logout}>Cerrar sesion</button>
            </>
          ) : (
            <>
              <a className="action-btn primary-action" href={routes.login} onClick={(event) => routeClick(event, routes.login, navigate)}>Iniciar sesion</a>
              <a className="action-btn" href={routes.register} onClick={(event) => routeClick(event, routes.register, navigate)}>Crear cuenta</a>
            </>
          )}
        </div>
      </section>
      <section className="profile-ops-panel">
        <div className="profile-section-header">
          <span className="section-label">Actividad</span>
          <h2>Resumen operativo</h2>
        </div>
        <section className={`profile-metrics ${currentUser ? '' : 'empty-metrics'}`}>
          {currentUser ? (
            <>
              <Metric value={currentUser.role} label="Rol" />
              <Metric value={userGuides} label="Mis guias" />
              <Metric value={userIntel} label="Mi intel" />
              <Metric value={userPosts} label="Aportes" />
            </>
          ) : (
            <div className="profile-note">
              <strong>Historial no disponible</strong>
              <span>Inicia sesion o crea una cuenta para ver tus guias, intel y aportes publicados.</span>
            </div>
          )}
        </section>
        <div className="profile-briefing-grid">
          <article className="profile-briefing">
            <span>Operaciones</span>
            <strong>Rutas y consejos</strong>
            <p>Publica rutas de farmeo, avisos y recomendaciones para otros pilotos.</p>
          </article>
          <article className="profile-briefing">
            <span>Biblioteca</span>
            <strong>Guias</strong>
            <p>Centraliza aprendizaje, mecanicas y preparacion de vuelo.</p>
          </article>
        </div>
        <label className="test-toggle profile-test-toggle">
          <input type="checkbox" checked={bypassEnabled} onChange={(event) => updateBypass(event.target.checked)} />
          Activar modo pruebas para publicar sin cuenta
        </label>
      </section>
    </main>
  );
}

function Metric({ value, label }) {
  return (
    <div className="metric">
      <span>{value}</span>
      <strong>{label}</strong>
    </div>
  );
}

function LoginPage({ setState, navigate }) {
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get('error');
    const messages = {
      discord_config: 'Falta configurar Discord en el servidor.',
      discord_state: 'Discord devolvio una sesion no valida. Intentalo de nuevo.',
      discord_login: 'No se pudo completar el login con Discord.'
    };

    if (messages[error]) {
      setMessage(messages[error]);
      setIsError(true);
    }
  }, []);

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      setState(await requestJson('/api/login', {
        method: 'POST',
        body: JSON.stringify({
          email: form.get('email').trim().toLowerCase(),
          password: form.get('password')
        })
      }));
      navigate(routes.profile);
    } catch (error) {
      setMessage(error.message);
      setIsError(true);
    }
  }

  return (
    <AuthShell title="Iniciar sesion" message={message} isError={isError}>
      <a className="action-btn primary-action discord-action" href="/api/auth/discord">Entrar con Discord</a>
      <div className="auth-separator"><span>o con cuenta local</span></div>
      <form className="auth-form" onSubmit={submit}>
        <label>Email<input name="email" type="email" required /></label>
        <label>Password<input name="password" type="password" required /></label>
        <button className="action-btn primary-action" type="submit">Entrar</button>
      </form>
    </AuthShell>
  );
}

function RegisterPage({ setState, navigate }) {
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      setState(await requestJson('/api/register', {
        method: 'POST',
        body: JSON.stringify({
          username: form.get('username').trim(),
          email: form.get('email').trim().toLowerCase(),
          role: form.get('role'),
          password: form.get('password')
        })
      }));
      navigate(routes.profile);
    } catch (error) {
      setMessage(error.message);
      setIsError(true);
    }
  }

  return (
    <AuthShell title="Crear cuenta" message={message} isError={isError}>
      <form className="auth-form" onSubmit={submit}>
        <label>Callsign<input name="username" required /></label>
        <label>Email<input name="email" type="email" required /></label>
        <label>Rol<select name="role"><option>Farmeo</option><option>Combate</option><option>Exploracion</option><option>Comercio</option></select></label>
        <label>Password<input name="password" type="password" minLength="4" required /></label>
        <button className="action-btn primary-action" type="submit">Crear perfil</button>
      </form>
    </AuthShell>
  );
}

function AuthShell({ title, message, isError, children }) {
  return (
    <main className="container auth-shell">
      <section className="auth-card panel">
        <span className="section-label">Acceso</span>
        <h2>{title}</h2>
        {children}
        {message && <p className={`auth-message ${isError ? 'error' : ''}`}>{message}</p>}
      </section>
    </main>
  );
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
    reader.readAsDataURL(file);
  });
}

function sanitizeEditorHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const allowedTags = new Set(['B', 'I', 'U', 'S', 'STRIKE', 'STRONG', 'EM', 'P', 'BR', 'UL', 'OL', 'LI', 'H2', 'H3', 'BLOCKQUOTE', 'A', 'SPAN', 'DIV']);
  const allowedStyleProperties = new Set(['color', 'text-align']);

  template.content.querySelectorAll('*').forEach((node) => {
    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(...node.childNodes);
      return;
    }

    [...node.attributes].forEach((attribute) => {
      if (node.tagName === 'A' && attribute.name === 'href') {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
        return;
      }

      if (attribute.name === 'style') {
        const safeStyles = attribute.value
          .split(';')
          .map((style) => style.trim())
          .filter(Boolean)
          .filter((style) => allowedStyleProperties.has(style.split(':')[0].trim().toLowerCase()));

        if (safeStyles.length) {
          node.setAttribute('style', safeStyles.join('; '));
        } else {
          node.removeAttribute('style');
        }
        return;
      }

      node.removeAttribute(attribute.name);
    });
  });

  return template.innerHTML.trim();
}

function EditorPage({ setState, navigate }) {
  const params = new URLSearchParams(window.location.search);
  const initialSection = ['forum', 'guides', 'news'].includes(params.get('type')) ? params.get('type') : 'forum';
  const [section, setSection] = useState(initialSection);
  const [title, setTitle] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [textColor, setTextColor] = useState('#d8f6ff');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const richEditorRef = useRef(null);
  const imageInputRef = useRef(null);

  function runEditorCommand(command, value = null) {
    richEditorRef.current?.focus();
    document.execCommand(command, false, value);
  }

  async function addImages(files) {
    const remainingSlots = Math.max(0, 8 - selectedImages.length);
    const nextFiles = [...files].slice(0, remainingSlots);
    const images = await Promise.all(nextFiles.map(async (file) => ({
      name: file.name,
      src: await readFileAsDataUrl(file)
    })));
    setSelectedImages((current) => [...current, ...images].slice(0, 8));
    if (imageInputRef.current) imageInputRef.current.value = '';
  }

  function removeImage(index) {
    setSelectedImages((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  async function submit(event) {
    event.preventDefault();
    const contentHtml = sanitizeEditorHtml(richEditorRef.current?.innerHTML || '');
    const textContent = richEditorRef.current?.innerText.trim() || '';

    if (!title.trim() || !textContent) {
      setMessage('Anade un titulo y contenido antes de publicar.');
      setIsError(true);
      return;
    }

    try {
      await requestJson('/api/content', {
        method: 'POST',
        body: JSON.stringify({
          section,
          title: title.trim(),
          content: textContent,
          contentHtml,
          images: selectedImages
        })
      });
      setState(await loadState());
      const target = { forum: routes.forum, guides: routes.guides, news: routes.news }[section];
      navigate(target);
    } catch (error) {
      setMessage(error.message);
      setIsError(true);
    }
  }

  return (
    <main className="container editor-shell">
      <section className="editor-panel panel">
        <span className="section-label">Editor</span>
        <h2>{section === 'guides' ? 'Nueva' : 'Nuevo'} {editorLabels[section]}</h2>
        <form className="editor-form" onSubmit={submit}>
          <div className="editor-field-section">
            <label>Seccion
              <select value={section} onChange={(event) => setSection(event.target.value)}>
                <option value="forum">Foro</option>
                <option value="guides">Guias</option>
                <option value="news">Intel</option>
              </select>
            </label>
          </div>
          <label className="editor-field">Titulo
            <input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>
          <div className="editor-field">
            <span>Contenido</span>
            <div className="editor-toolbar" aria-label="Herramientas de formato">
              <button type="button" onClick={() => runEditorCommand('bold')}>B</button>
              <button type="button" onClick={() => runEditorCommand('italic')}>I</button>
              <button type="button" onClick={() => runEditorCommand('underline')}>U</button>
              <button type="button" onClick={() => runEditorCommand('insertUnorderedList')}>Lista</button>
              <button type="button" onClick={() => runEditorCommand('formatBlock', 'H2')}>H2</button>
              <button type="button" onClick={() => runEditorCommand('formatBlock', 'BLOCKQUOTE')}>Cita</button>
              <button type="button" onClick={() => {
                const url = window.prompt('URL del enlace');
                if (url) runEditorCommand('createLink', url);
              }}>Link</button>
              <label className="color-tool">Color
                <input type="color" value={textColor} onChange={(event) => {
                  setTextColor(event.target.value);
                  runEditorCommand('foreColor', event.target.value);
                }} />
              </label>
            </div>
            <div className="rich-editor" ref={richEditorRef} contentEditable suppressContentEditableWarning />
          </div>
          <div className="editor-field">
            <span>Imagenes</span>
            <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={(event) => addImages(event.target.files)} />
            <div className="image-preview">
              {selectedImages.map((image, index) => (
                <figure className="preview-image" key={`${image.name}-${index}`}>
                  <img src={image.src} alt={image.name} />
                  <figcaption>{image.name}</figcaption>
                  <button type="button" onClick={() => removeImage(index)}>Quitar</button>
                </figure>
              ))}
            </div>
          </div>
          <button className="action-btn primary-action" type="submit">Publicar</button>
        </form>
        {message && <p className={`auth-message ${isError ? 'error' : ''}`}>{message}</p>}
      </section>
    </main>
  );
}

function routeClick(event, path, navigate) {
  event.preventDefault();
  navigate(path);
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'SC';
}

function money(value, currency = 'aUEC') {
  if (!value) return 'N/D';
  return `${new Intl.NumberFormat('es-ES').format(Math.round(value))} ${currency}`;
}

function meters(value) {
  if (!value) return 'N/D';
  return `${Number(value).toLocaleString('es-ES')} m`;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'es'));
}

function shipMatches(ship, filters) {
  const query = filters.search.trim().toLowerCase();
  const haystack = [ship.name, ship.shortName, ship.manufacturer, ship.tags?.join(' ')].join(' ').toLowerCase();
  return (!query || haystack.includes(query))
    && (!filters.manufacturer || ship.manufacturer === filters.manufacturer)
    && (!filters.role || ship.tags?.includes(filters.role))
    && (!filters.type || Boolean(ship.flags?.[filters.type]));
}

function sortShips(ships, mode) {
  const sorted = [...ships];
  const conceptLast = (a, b) => Number(Boolean(a.flags?.concept)) - Number(Boolean(b.flags?.concept));
  const withConceptsLast = (comparator) => sorted.sort((a, b) => conceptLast(a, b) || comparator(a, b));
  const ascendingPrice = (selector) => withConceptsLast((a, b) => (selector(a) || Number.MAX_SAFE_INTEGER) - (selector(b) || Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, 'es'));
  const sizeRank = (ship) => {
    const normalizedSize = String(ship.padType || '').trim().toUpperCase();
    const knownSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    const rank = knownSizes.indexOf(normalizedSize);
    return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
  };

  if (mode === 'pledge') return ascendingPrice((ship) => ship.pledge?.price);
  if (mode === 'purchase') return ascendingPrice((ship) => ship.purchase?.price);
  if (mode === 'rental') return ascendingPrice((ship) => ship.rental?.price);
  if (mode === 'cargo') return withConceptsLast((a, b) => b.scu - a.scu || b.length - a.length || a.name.localeCompare(b.name, 'es'));
  if (mode === 'name') return withConceptsLast((a, b) => a.name.localeCompare(b.name, 'es'));
  return withConceptsLast((a, b) => sizeRank(a) - sizeRank(b) || a.length - b.length || a.scu - b.scu || a.name.localeCompare(b.name, 'es'));
}

createRoot(document.getElementById('root')).render(<App />);
