import React from 'react';
import { routes } from '../../config/routes.js';
import { routeClick } from '../../utils/navigation.js';

/** Texto principal del hero segun la pagina actual. */
export function HeroContent({ page, navigate }) {
  const content = {
    home: ['Bienvenido a Stanton Hub', 'Catalogo tecnico, componentes y noticias para preparar tu hangar.'],
    forum: ['Base de operaciones', 'Publicaciones de usuarios sobre rutas, consejos y actividad reciente.'],
    guides: ['Guias de pilotos', 'Manuales y preparacion creados por la comunidad.'],
    news: ['Intel de comunidad', 'Avisos, eventos y novedades publicadas por usuarios.'],
    'game-news': ['Noticias del verso', 'Ultimas comunicaciones oficiales sobre Star Citizen.'],
    'game-news-detail': ['Comunicacion del verso', 'Noticia traducida, imagenes y material extraido automaticamente.'],
    ships: ['Naves y vehiculos del verso', 'Catalogo UEX con precios, filtros, fabricantes y detalles tecnicos.'],
    'ship-compare': ['Comparador de naves', 'Enfrenta dos fichas tecnicas, puntuacion operativa, precios y capacidades.'],
    'ship-detail': ['Ficha tecnica de nave', 'Datos locales, precios, hardpoints y combate.'],
    components: ['Componentes del verso', 'Catalogo de armas, escudos, quantum, propulsion y sistemas instalables.'],
    'component-detail': ['Ficha tecnica de componente', 'Datos de uso, clase, tamano, grado y naves relacionadas.'],
    'mining-materials': ['Materiales de mineria', 'Rutas, calidades esperadas y consejos para extraer recursos del verso.'],
    profile: ['Perfil de piloto', 'Identidad, acceso y actividad de tu cuenta.'],
    login: ['Acceso de piloto', 'Inicia sesion para publicar contenido.'],
    register: ['Acceso de piloto', 'Crea o recupera tu cuenta usando Discord.'],
    editor: ['Editor de publicaciones', 'Crea contenido para operaciones, guias o intel.'],
    admin: ['Administracion', 'Control de roles, publicaciones, capturas y sincronizacion UEX.']
  }[page] || ['Stanton Hub', 'Operaciones del verso'];
  return (
    <div className={`hero-content hero-content-${page}`}>
      <Breadcrumb page={page} navigate={navigate} />
      <h1>{content[0]}</h1>
      <p>{content[1]}</p>
    </div>
  );
}

function Breadcrumb({ page, navigate }) {
  const current = {
    home: 'Inicio',
    forum: 'Foro',
    guides: 'Guias',
    news: 'Intel',
    'game-news': 'Noticias',
    'game-news-detail': 'Detalle noticia',
    ships: 'Naves',
    'ship-compare': 'Comparador',
    'ship-detail': 'Detalle',
    components: 'Componentes',
    'component-detail': 'Detalle componente',
    'mining-materials': 'Materiales',
    profile: 'Perfil',
    login: 'Login',
    register: 'Registro',
    editor: 'Editor',
    admin: 'Admin'
  }[page] || 'Operacion';

  const items = page === 'ship-detail'
    ? [[routes.home, 'Stanton Hub'], [routes.ships, 'Naves'], ['', 'Detalle']]
    : page === 'ship-compare'
      ? [[routes.home, 'Stanton Hub'], [routes.ships, 'Naves'], ['', 'Comparador']]
    : page === 'component-detail'
      ? [[routes.home, 'Stanton Hub'], [routes.components, 'Componentes'], ['', 'Detalle']]
    : page === 'mining-materials'
      ? [[routes.home, 'Stanton Hub'], [routes.ships, 'Naves y componentes'], ['', 'Materiales']]
    : page === 'game-news-detail'
      ? [[routes.home, 'Stanton Hub'], [routes.gameNews, 'Noticias'], ['', 'Detalle']]
    : page === 'game-news'
      ? [[routes.home, 'Stanton Hub'], ['', 'Noticias']]
    : page === 'home'
      ? [['', 'Stanton Hub']]
      : [[routes.home, 'Stanton Hub'], ['', current]];

  return (
    <nav className="breadcrumb-trail" aria-label="Ruta de navegacion">
      {items.map(([path, label], index) => path
        ? <a key={label} href={path} onClick={(event) => routeClick(event, path, navigate)}>{label}</a>
        : <span key={`${label}-${index}`}>{label}</span>)}
    </nav>
  );
}
