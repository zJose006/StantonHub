import React, { useEffect, useMemo, useState } from 'react';
import { routes } from './config/routes.js';
import { Header } from './components/layout/Header.jsx';
import { Footer } from './components/layout/Footer.jsx';
import { Home } from './pages/Home.jsx';
import { ContentPage } from './pages/ContentPage.jsx';
import { ShipsPage } from './pages/ShipsPage.jsx';
import { ShipDetailPage } from './pages/ShipDetailPage.jsx';
import { ShipComparePage } from './pages/ShipComparePage.jsx';
import { ComponentsPage } from './pages/ComponentsPage.jsx';
import { ComponentDetailPage } from './pages/ComponentDetailPage.jsx';
import { MiningMaterialsPage } from './pages/MiningMaterialsPage.jsx';
import { BlueprintFinderPage } from './pages/BlueprintFinderPage.jsx';
import { OperationTimersPage } from './pages/OperationTimersPage.jsx';
import { CommunityToolsPage } from './pages/CommunityToolsPage.jsx';
import { GameNewsPage } from './pages/GameNewsPage.jsx';
import { GameNewsDetailPage } from './pages/GameNewsDetailPage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { EditorPage } from './pages/EditorPage.jsx';
import { AdminPage } from './pages/AdminPage.jsx';
import { loadState } from './services/api.js';
import { getComponentIdentifier, getCurrentPage, getGameNewsIdentifier, getShipIdentifier, normalizeRoute } from './utils/navigation.js';

/** Estado inicial mientras el backend responde. */
const defaultState = { users: [], sessionUserId: null, interactions: { votes: {}, comments: {} }, content: { forum: [], guides: [], news: [] } };
const pageTitles = {
  home: 'Inicio',
  forum: 'Operaciones',
  guides: 'Guias',
  news: 'Intel',
  'game-news': 'Noticias',
  'game-news-detail': 'Detalle de noticia',
  ships: 'Naves',
  'ship-compare': 'Comparador de naves',
  'ship-detail': 'Detalle de nave',
  components: 'Componentes',
  'component-detail': 'Detalle de componente',
  'mining-materials': 'Materiales de mineria',
  'blueprint-finder': 'Blueprint Finder',
  'operation-timers': 'Temporizadores',
  'community-tools': 'Herramientas',
  profile: 'Perfil',
  login: 'Login',
  register: 'Registro',
  editor: 'Editor',
  admin: 'Administracion'
};

/** Orquesta routing, estado global y composicion de paginas. */
export function App() {
  const [page, setPage] = useState(getCurrentPage());
  const [state, setState] = useState(defaultState);
  const [stateError, setStateError] = useState('');

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    const cleanPath = normalizeRoute(window.location.pathname);
    if (cleanPath !== window.location.pathname) { window.history.replaceState(null, '', cleanPath + window.location.search); setPage(getCurrentPage()); }
    const onPopState = () => setPage(getCurrentPage());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => { loadState().then(setState).catch((error) => setStateError(error.message)); }, []);

  useEffect(() => {
    const suffix = pageTitles[page] || 'Stanton Hub';
    document.title = suffix === 'Inicio' ? 'Stanton Hub - Inicio' : `Stanton Hub - ${suffix}`;
  }, [page]);

  const currentUser = useMemo(() => state.users.find((user) => user.id === state.sessionUserId) || null, [state]);

  /** Cambia de ruta dentro del SPA sin recargar documento. */
  function navigate(path) {
    const cleanPath = path.replace(/\.html(?=\?|$)/, '');
    window.history.pushState(null, '', cleanPath);
    setPage(getCurrentPage());
    if (cleanPath.startsWith(routes.ship + '/') || cleanPath.startsWith(routes.components + '/') || cleanPath.startsWith(routes.gameNews + '/')) {
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
    }
  }

  return <><Header page={page} navigate={navigate} currentUser={currentUser} />{page === 'home' && <Home navigate={navigate} />}{['forum','guides','news'].includes(page) && <ContentPage section={page} state={state} setState={setState} currentUser={currentUser} navigate={navigate} stateError={stateError} />}{page === 'game-news' && <GameNewsPage navigate={navigate} />}{page === 'game-news-detail' && <GameNewsDetailPage identifier={getGameNewsIdentifier()} navigate={navigate} />}{page === 'ships' && <ShipsPage currentUser={currentUser} navigate={navigate} />}{page === 'ship-compare' && <ShipComparePage navigate={navigate} />}{page === 'ship-detail' && <ShipDetailPage identifier={getShipIdentifier()} navigate={navigate} />}{page === 'components' && <ComponentsPage navigate={navigate} />}{page === 'component-detail' && <ComponentDetailPage identifier={getComponentIdentifier()} navigate={navigate} />}{page === 'mining-materials' && <MiningMaterialsPage />}{page === 'blueprint-finder' && <BlueprintFinderPage />}{page === 'operation-timers' && <OperationTimersPage />}{page === 'community-tools' && <CommunityToolsPage navigate={navigate} />}{page === 'profile' && <ProfilePage state={state} setState={setState} currentUser={currentUser} navigate={navigate} stateError={stateError} />}{(page === 'login' || page === 'register') && <LoginPage />}{page === 'editor' && <EditorPage setState={setState} navigate={navigate} />}{page === 'admin' && <AdminPage currentUser={currentUser} navigate={navigate} />}<Footer navigate={navigate} /></>;
}
