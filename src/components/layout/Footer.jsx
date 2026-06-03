import React from 'react';
import { routes } from '../../config/routes.js';
import { routeClick } from '../../utils/navigation.js';

/** Pie de pagina comun con enlaces basicos y texto institucional. */
export function Footer({ navigate }) {
  const footerLinks = [[routes.home,'Inicio'],[routes.ships,'Naves'],[routes.shipCompare,'Comparador'],[routes.components,'Componentes'],[routes.miningMaterials,'Materiales'],[routes.operationTimers,'Temporizadores'],[routes.communityTools,'Herramientas'],[routes.gameNews,'Noticias'],[routes.profile,'Perfil']];
  return (
    <footer className="site-footer"><div className="site-footer-inner">
      <section><span className="footer-mark">Stanton Hub</span><p>Hub tecnico para consultar naves, componentes, noticias y recursos de Star Citizen.</p></section>
      <nav aria-label="Enlaces del pie de pagina">{footerLinks.map(([path,label]) => <a key={path} href={path} onClick={(event) => routeClick(event, path, navigate)}>{label}</a>)}</nav>
      <section><span className="footer-title">Creditos de datos</span><p>Parte de la informacion tecnica se apoya en las APIs publicas de <a href="https://star-citizen.wiki/" target="_blank" rel="noreferrer">Star Citizen Wiki</a> y <a href="https://uexcorp.space/" target="_blank" rel="noreferrer">UEX Corp</a>.</p></section>
      <section><span className="footer-title">Transparencia</span><p>Esta web ha sido generada con asistencia de IA y revisada, adaptada y modificada por una persona.</p></section>
    </div></footer>
  );
}
