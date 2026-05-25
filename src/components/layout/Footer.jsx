import React from 'react';
import { routes } from '../../config/routes.js';
import { routeClick } from '../../utils/navigation.js';

/** Pie de pagina comun con enlaces basicos y texto institucional. */
export function Footer({ navigate }) {
  const footerLinks = [[routes.home,'Inicio'],[routes.forum,'Operaciones'],[routes.guides,'Guias'],[routes.ships,'Naves'],[routes.components,'Componentes'],[routes.news,'Intel'],[routes.profile,'Perfil']];
  return (
    <footer className="site-footer"><div className="site-footer-inner">
      <section><span className="footer-mark">Stanton Hub</span><p>Hub comunitario para organizar publicaciones, guias, catalogo de naves y recursos de Star Citizen. La informacion final de contacto y enlaces oficiales se completara mas adelante.</p></section>
      <nav aria-label="Enlaces del pie de pagina">{footerLinks.map(([path,label]) => <a key={path} href={path} onClick={(event) => routeClick(event, path, navigate)}>{label}</a>)}</nav>
      <section><span className="footer-title">Pendiente</span><p>Zona reservada para Discord, normas, enlaces externos, creditos y avisos legales.</p></section>
    </div></footer>
  );
}
