import React from 'react';

/** Texto principal del hero segun la pagina actual. */
export function HeroContent({ page }) {
  const content = {
    home: ['Bienvenido a Stanton Hub', 'Tu punto de acceso para operaciones, guias, intel y catalogo de naves.'],
    forum: ['Base de operaciones', 'Publicaciones de usuarios sobre rutas, consejos y actividad reciente.'],
    guides: ['Guias de pilotos', 'Manuales y preparacion creados por la comunidad.'],
    news: ['Intel de comunidad', 'Avisos, eventos y novedades publicadas por usuarios.'],
    ships: ['Naves y vehiculos del verso', 'Catalogo UEX con precios, filtros, fabricantes y detalles tecnicos.'],
    'ship-detail': ['Ficha tecnica de nave', 'Datos locales, precios, hardpoints y combate.'],
    profile: ['Perfil de piloto', 'Identidad, acceso y actividad de tu cuenta.'],
    login: ['Acceso de piloto', 'Inicia sesion para publicar contenido.'],
    register: ['Acceso de piloto', 'Crea o recupera tu cuenta usando Discord.'],
    editor: ['Editor de publicaciones', 'Crea contenido para operaciones, guias o intel.'],
    admin: ['Administracion', 'Control de roles, publicaciones, capturas y sincronizacion UEX.']
  }[page] || ['Stanton Hub', 'Operaciones del verso'];
  return <div className="hero-content"><span className="eyebrow">React app</span><h1>{content[0]}</h1><p>{content[1]}</p></div>;
}
