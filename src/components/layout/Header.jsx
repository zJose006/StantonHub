import React, { useEffect, useState } from 'react';
import { routes } from '../../config/routes.js';
import { routeClick } from '../../utils/navigation.js';
import { can } from '../../utils/permissions.js';
import { initials } from '../../utils/format.js';
import { DiscordIcon } from '../icons/DiscordIcon.jsx';
import { HeroContent } from './HeroContent.jsx';

/** Cabecera global: menu principal, acceso Discord y menu de cuenta. */
export function Header({ page, navigate, currentUser }) {
  const [openMenu, setOpenMenu] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const close = (event) => {
      if (!event.target.closest('.nav-group')) setOpenMenu('');
      if (!event.target.closest('.hero-topbar')) setMobileNavOpen(false);
    };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  function closeMobileNav() {
    setOpenMenu('');
    setMobileNavOpen(false);
  }

  function toggleMenu(name, isOpen) {
    setOpenMenu(isOpen ? '' : name);
    if (name === 'Cuenta') setMobileNavOpen(false);
  }

  const link = (path, label, className = 'page-btn', active = false) => (
    <a className={`${className} ${active ? 'active' : ''}`} href={path} onClick={(event) => { routeClick(event, path, navigate); closeMobileNav(); }}>
      {className.includes('discord-login-link') && <DiscordIcon />}
      <span>{label}</span>
    </a>
  );
  const accountNav = currentUser ? (
    <NavGroup name="Cuenta" active={page === 'profile' || page === 'editor' || page === 'admin'} openMenu={openMenu} setOpenMenu={toggleMenu} triggerContent={<UserBadge user={currentUser} />}>
      <MenuItem path={routes.profile} title="Mi perfil" text="Identidad, acceso y actividad de tu cuenta." navigate={navigate} closeMobileNav={closeMobileNav} />
      {can(currentUser, 'admin.access') && <MenuItem path={routes.admin} title="Administracion" text="Usuarios, roles, publicaciones, capturas y UEX." navigate={navigate} closeMobileNav={closeMobileNav} />}
    </NavGroup>
  ) : (
    <div className="auth-nav-links">{link(routes.login, 'Iniciar sesion', 'discord-login-link')}</div>
  );

  return (
    <header className={`hero hero-compact hero-page-${page}`}>
      <div className={`hero-topbar ${mobileNavOpen ? 'mobile-drawer-active' : ''}`}>
        <button className={`mobile-nav-toggle ${mobileNavOpen ? 'is-open' : ''}`} type="button" aria-expanded={mobileNavOpen} aria-label="Abrir menu" onClick={(event) => { event.stopPropagation(); setOpenMenu(''); setMobileNavOpen((open) => !open); }}>
          <span className="mobile-nav-toggle-line" aria-hidden="true" />
          <span className="mobile-nav-toggle-arrow" aria-hidden="true" />
        </button>
        <a className="home-button" href={routes.home} onClick={(event) => { routeClick(event, routes.home, navigate); closeMobileNav(); }} aria-label="Inicio">
          <span className="home-icon" aria-hidden="true"><img src="/assets/stanton-hub-logo.png" alt="" /></span>
          <span className="brand-copy"><strong className="flow-text">Stanton Hub</strong><small>Herramientas de pilotos</small></span>
        </a>
        <div className={`header-nav-panel ${mobileNavOpen ? 'is-open' : ''}`}>
          <div className="mobile-drawer-head">
            <button className="mobile-drawer-close" type="button" aria-label="Cerrar menu" onClick={closeMobileNav}>x</button>
            <a className="mobile-drawer-brand" href={routes.home} onClick={(event) => { routeClick(event, routes.home, navigate); closeMobileNav(); }}>
              <span className="home-icon" aria-hidden="true"><img src="/assets/stanton-hub-logo.png" alt="" /></span>
              <span className="brand-copy"><strong className="flow-text">Stanton Hub</strong><small>Herramientas de pilotos</small></span>
            </a>
          </div>
          <a className="mobile-home-link" href={routes.home} onClick={(event) => { routeClick(event, routes.home, navigate); closeMobileNav(); }}>Inicio</a>
          <nav className="site-nav" aria-label="Navegacion principal">
            <NavGroup name="Naves y Componentes" active={page === 'ships' || page === 'ship-detail' || page === 'components' || page === 'component-detail'} openMenu={openMenu} setOpenMenu={toggleMenu}>
              <MenuItem path={routes.ships} title="Naves" text="Catalogo con precios, filtros y detalles tecnicos." navigate={navigate} closeMobileNav={closeMobileNav} />
              <MenuItem path={routes.components} title="Componentes" text="Armas, escudos, quantum y sistemas instalables." navigate={navigate} closeMobileNav={closeMobileNav} />
            </NavGroup>
            {link(routes.gameNews, 'Noticias', 'page-btn', page === 'game-news' || page === 'game-news-detail')}
          </nav>
        </div>
        <div className="header-account-slot">{accountNav}</div>
      </div>
      <HeroContent page={page} navigate={navigate} />
    </header>
  );
}

/** Grupo desplegable del header. */
function NavGroup({ name, active, openMenu, setOpenMenu, triggerContent, children }) {
  const isOpen = openMenu === name;
  const introText = { 'Naves y Componentes': 'Catalogos tecnicos del verso', Cuenta: 'Perfil y acceso de piloto' }[name] || 'Secciones de Stanton Hub';
  return (
    <div className={`nav-group ${triggerContent ? 'account-nav' : ''} ${isOpen ? 'is-open' : ''}`}>
      <button className={`nav-trigger ${active ? 'active' : ''}`} type="button" aria-expanded={isOpen} aria-label={triggerContent ? name : undefined} title={triggerContent ? name : undefined} onClick={(event) => { event.stopPropagation(); setOpenMenu(name, isOpen); }}>
        {triggerContent || name}
      </button>
      <div className="nav-menu" hidden={!isOpen}>
        <div className="nav-menu-intro"><strong>{name}</strong><span>{introText}</span></div>
        {children}
      </div>
    </div>
  );
}

/** Resumen visual del usuario dentro del menu de cuenta. */
function UserBadge({ user }) {
  return <span className="user-badge"><span className="user-badge-avatar">{user.discordAvatar ? <img src={user.discordAvatar} width="34" height="34" alt="" /> : initials(user.username)}</span></span>;
}

/** Enlace enriquecido dentro de un desplegable. */
function MenuItem({ path, title, text, navigate, closeMobileNav }) {
  return <a className="nav-menu-item" href={path} onClick={(event) => { routeClick(event, path, navigate); closeMobileNav?.(); }}><strong>{title}</strong><span>{text}</span></a>;
}
