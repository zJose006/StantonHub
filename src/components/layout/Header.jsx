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

  const link = (path, label, className = 'page-btn') => (
    <a className={className} href={path} onClick={(event) => { routeClick(event, path, navigate); closeMobileNav(); }}>
      {className.includes('discord-login-link') && <DiscordIcon />}
      <span>{label}</span>
    </a>
  );

  return (
    <header className="hero hero-compact">
      <div className="hero-topbar">
        <a className="home-button" href={routes.home} onClick={(event) => routeClick(event, routes.home, navigate)} aria-label="Inicio">
          <span className="home-icon" aria-hidden="true">SC</span>
          Stanton Hub
        </a>
        <button className="mobile-nav-toggle" type="button" aria-expanded={mobileNavOpen} aria-label="Abrir menu" onClick={(event) => { event.stopPropagation(); setMobileNavOpen((open) => !open); }}>
          <span />
          <span />
          <span />
        </button>
        <div className={`header-nav-panel ${mobileNavOpen ? 'is-open' : ''}`}>
          <nav className="site-nav" aria-label="Navegacion principal">
            {link(routes.home, 'Inicio')}
            <NavGroup name="Operaciones" active={page === 'forum'} openMenu={openMenu} setOpenMenu={setOpenMenu}>
              <MenuItem path={routes.forum} title="Base de operaciones" text="Consejos destacados, rutas aUEC y actividad reciente." navigate={navigate} closeMobileNav={closeMobileNav} />
            </NavGroup>
            <NavGroup name="Biblioteca" active={page === 'guides' || page === 'ships'} openMenu={openMenu} setOpenMenu={setOpenMenu}>
              <MenuItem path={routes.guides} title="Guias" text="Manuales, preparacion y mecanicas explicadas." navigate={navigate} closeMobileNav={closeMobileNav} />
              <MenuItem path={routes.ships} title="Naves" text="Catalogo con precios, filtros y detalles tecnicos." navigate={navigate} closeMobileNav={closeMobileNav} />
            </NavGroup>
            <NavGroup name="Comunidad" active={page === 'news'} openMenu={openMenu} setOpenMenu={setOpenMenu}>
              <MenuItem path={routes.news} title="Intel" text="Novedades, eventos y oportunidades del verso." navigate={navigate} closeMobileNav={closeMobileNav} />
            </NavGroup>
          </nav>
          {currentUser ? (
            <NavGroup name="Cuenta" active={page === 'profile' || page === 'editor' || page === 'admin'} openMenu={openMenu} setOpenMenu={setOpenMenu} triggerContent={<UserBadge user={currentUser} />}>
              <MenuItem path={routes.profile} title="Mi perfil" text="Identidad, acceso y actividad de tu cuenta." navigate={navigate} closeMobileNav={closeMobileNav} />
              <MenuItem path={routes.editor + '?type=forum'} title="Crear publicacion" text="Publica consejos, guias o intel desde el editor." navigate={navigate} closeMobileNav={closeMobileNav} />
              {can(currentUser, 'admin.access') && <MenuItem path={routes.admin} title="Administracion" text="Usuarios, roles, publicaciones, capturas y UEX." navigate={navigate} closeMobileNav={closeMobileNav} />}
            </NavGroup>
          ) : (
            <div className="auth-nav-links">{link(routes.login, 'Iniciar sesion', 'discord-login-link')}</div>
          )}
        </div>
      </div>
      <HeroContent page={page} />
    </header>
  );
}

/** Grupo desplegable del header. */
function NavGroup({ name, active, openMenu, setOpenMenu, triggerContent, children }) {
  const isOpen = openMenu === name;
  const introText = { Biblioteca: 'Guias y preparacion de vuelo', Operaciones: 'Rutas, farmeo y actividad del hub', Cuenta: 'Perfil, editor y acceso de piloto', Comunidad: 'Intel y actividad de la comunidad' }[name] || 'Secciones de Stanton Hub';
  return (
    <div className={`nav-group ${isOpen ? 'is-open' : ''}`}>
      <button className={`nav-trigger ${active ? 'active' : ''}`} type="button" aria-expanded={isOpen} onClick={(event) => { event.stopPropagation(); setOpenMenu(isOpen ? '' : name); }}>
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
  return <span className="user-badge"><span className="user-badge-avatar">{user.discordAvatar ? <img src={user.discordAvatar} alt="" /> : initials(user.username)}</span><span>{user.username}</span></span>;
}

/** Enlace enriquecido dentro de un desplegable. */
function MenuItem({ path, title, text, navigate, closeMobileNav }) {
  return <a className="nav-menu-item" href={path} onClick={(event) => { routeClick(event, path, navigate); closeMobileNav?.(); }}><strong>{title}</strong><span>{text}</span></a>;
}
