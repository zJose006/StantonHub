import React, { useEffect, useMemo, useState } from 'react';
import { routes } from './config/routes.js';
import { Header } from './components/layout/Header.jsx';
import { Footer } from './components/layout/Footer.jsx';
import { Home } from './pages/Home.jsx';
import { ContentPage } from './pages/ContentPage.jsx';
import { ShipsPage } from './pages/ShipsPage.jsx';
import { ShipDetailPage } from './pages/ShipDetailPage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { EditorPage } from './pages/EditorPage.jsx';
import { AdminPage } from './pages/AdminPage.jsx';
import { loadState } from './services/api.js';
import { getCurrentPage, getShipIdentifier, normalizeRoute } from './utils/navigation.js';

/** Estado inicial mientras el backend responde. */
const defaultState = { users: [], sessionUserId: null, interactions: { votes: {}, comments: {} }, content: { forum: [], guides: [], news: [] } };

/** Orquesta routing, estado global y composicion de paginas. */
export function App() {
  const [page, setPage] = useState(getCurrentPage());
  const [state, setState] = useState(defaultState);
  const [stateError, setStateError] = useState('');

  useEffect(() => {
    const cleanPath = normalizeRoute(window.location.pathname);
    if (cleanPath !== window.location.pathname) { window.history.replaceState(null, '', cleanPath + window.location.search); setPage(getCurrentPage()); }
    const onPopState = () => setPage(getCurrentPage());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => { loadState().then(setState).catch((error) => setStateError(error.message)); }, []);

  const currentUser = useMemo(() => state.users.find((user) => user.id === state.sessionUserId) || null, [state]);

  /** Cambia de ruta dentro del SPA sin recargar documento. */
  function navigate(path) { window.history.pushState(null, '', path.replace(/\.html(?=\?|$)/, '')); setPage(getCurrentPage()); }

  return <><Header page={page} navigate={navigate} currentUser={currentUser} />{page === 'home' && <Home navigate={navigate} />}{['forum','guides','news'].includes(page) && <ContentPage section={page} state={state} setState={setState} currentUser={currentUser} navigate={navigate} stateError={stateError} />}{page === 'ships' && <ShipsPage currentUser={currentUser} navigate={navigate} />}{page === 'ship-detail' && <ShipDetailPage identifier={getShipIdentifier()} navigate={navigate} />}{page === 'profile' && <ProfilePage state={state} setState={setState} currentUser={currentUser} navigate={navigate} stateError={stateError} />}{(page === 'login' || page === 'register') && <LoginPage />}{page === 'editor' && <EditorPage setState={setState} navigate={navigate} />}{page === 'admin' && <AdminPage currentUser={currentUser} navigate={navigate} />}<Footer navigate={navigate} /></>;
}
