import React, { useEffect, useState } from 'react';
import { routes } from '../config/routes.js';
import { requestJson } from '../services/api.js';
import { money, meters } from '../utils/format.js';
import { routeClick } from '../utils/navigation.js';

/** Ficha completa de una nave almacenada en MySQL, incluyendo UEX, Wiki y combate. */
export function ShipDetailPage({ identifier, navigate }) {
  const [detail, setDetail] = useState(null);
  const [status, setStatus] = useState('Cargando ficha local...');

  useEffect(() => {
    requestJson('/api/vehicles/' + encodeURIComponent(identifier))
      .then((payload) => { setDetail(payload); setStatus('Ficha cargada desde Base de datos local.'); })
      .catch((error) => setStatus(error.message));
  }, [identifier]);

  if (!detail) {
    return <main className="container single-column"><section className="panel ship-detail-panel"><span className="section-label">Nave</span><h2>Ficha tecnica</h2><p className="auth-message">{status}</p><BackLink navigate={navigate} /></section></main>;
  }

  const { vehicle, raw, wiki, combat, prices, curiosity } = detail;
  const image = vehicle.imageCandidates?.[0] || vehicle.photoProxy || vehicle.wikiImageProxy || vehicle.photo;
  const metrics = [
    ['Fabricante', vehicle.manufacturer],
    ['Tamano de pad', vehicle.padType],
    ['Longitud', meters(vehicle.length)],
    ['Anchura', meters(vehicle.width)],
    ['Altura', meters(vehicle.height)],
    ['Masa', vehicle.mass ? Number(vehicle.mass).toLocaleString('es-ES') + ' kg' : 'N/D'],
    ['Carga', vehicle.scu ? vehicle.scu + ' SCU' : 'N/D'],
    ['Tripulacion', vehicle.crew],
    ['Quantum', vehicle.flags?.quantum ? 'Si' : 'No'],
    ['Estado', vehicle.flags?.concept ? 'Concept' : 'Operativa / catalogada']
  ];

  return (
    <main className="container ship-detail-shell">
      <section className="ship-detail-hero panel">
        <div className="ship-detail-media">{image ? <img src={image} alt={vehicle.name} /> : <span>SC</span>}</div>
        <div className="ship-detail-intro"><span className="section-label">{vehicle.manufacturer}</span><h2>{vehicle.name}</h2><p>{curiosity}</p><div className="ship-detail-actions"><BackLink navigate={navigate} />{vehicle.storeUrl && <a className="action-btn" href={vehicle.storeUrl} target="_blank" rel="noreferrer">RSI Store</a>}</div></div>
      </section>

      <section className="ship-detail-grid">
        <DetailCard title="Resumen UEX" items={metrics} />
        <DetailCard title="Precios" items={[
          ['Pledge', money(vehicle.pledge?.price, vehicle.pledge?.currency || 'USD')],
          ['Warbond', money(vehicle.pledge?.warbond, vehicle.pledge?.currency || 'USD')],
          ['Compra in-game', money(vehicle.purchase?.price)],
          ['Alquiler', money(vehicle.rental?.price)],
          ['Terminales compra', vehicle.purchase?.locations?.join(', ') || 'Sin terminal conocido'],
          ['Terminales alquiler', vehicle.rental?.locations?.join(', ') || 'Sin terminal conocido']
        ]} />
        <DetailCard title="Durabilidad Wiki" items={[
          ['Health', vehicle.wiki?.health || wiki?.health || 'N/D'],
          ['Armadura', vehicle.wiki?.armor || wiki?.armor?.health || 'N/D'],
          ['Escudos', vehicle.wiki?.shieldHp || wiki?.shield?.hp || 'N/D'],
          ['UUID Wiki', vehicle.wiki?.uuid || wiki?.uuid || 'N/D'],
          ['Sync detalles', detail.detailsSyncedAt || 'Pendiente']
        ]} />
        <DetailCard title="Combate detectado" items={[
          ['Disponible', combat?.available ? 'Si' : 'No'],
          ['Armas detectadas', combat?.weaponCount || 0],
          ['Dano sostenido 60s', numberOrMissing(combat?.totals?.sustained60s)],
          ['Burst', numberOrMissing(combat?.totals?.burst)],
          ['Alpha total', numberOrMissing(combat?.totals?.alphaTotal)],
          ['Maximo', numberOrMissing(combat?.totals?.maximum)]
        ]} />
      </section>

      <section className="panel ship-weapons-panel">
        <div className="panel-header"><div><span className="section-label">Hardpoints</span><h2>Armas y dano</h2></div></div>
        {combat?.weapons?.length ? <div className="ship-weapons-list">{combat.weapons.map((weapon, index) => <article className="ship-weapon-row" key={weapon.name + index}><div><strong>{weapon.name}</strong><span>{weapon.mount || weapon.className || 'Montura detectada'} · S{weapon.size || 'N/D'}</span></div><dl><div><dt>Alpha</dt><dd>{numberOrMissing(weapon.damage?.alphaTotal)}</dd></div><div><dt>60s</dt><dd>{numberOrMissing(weapon.damage?.sustained60s)}</dd></div><div><dt>RPM</dt><dd>{weapon.rpm || 'N/D'}</dd></div><div><dt>Rango</dt><dd>{weapon.range ? meters(weapon.range) : 'N/D'}</dd></div></dl></article>)}</div> : <p className="auth-message">No hay armas de hardpoint disponibles para esta nave en la cache local.</p>}
      </section>

      <section className="ship-raw-grid">
        <RawCard title="Datos normalizados" data={vehicle} />
        <RawCard title="UEX raw" data={raw} />
        <RawCard title="Star Citizen Wiki raw" data={wiki} />
        <RawCard title="Precios raw" data={prices} />
      </section>
    </main>
  );
}

function BackLink({ navigate }) {
  return <a className="action-btn primary-action" href={routes.ships} onClick={(event) => routeClick(event, routes.ships, navigate)}>Volver a naves</a>;
}

function DetailCard({ title, items }) {
  return <section className="panel ship-detail-card"><h3>{title}</h3><dl>{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'N/D'}</dd></div>)}</dl></section>;
}

function RawCard({ title, data }) {
  return <section className="panel ship-raw-card"><h3>{title}</h3><pre>{JSON.stringify(data || {}, null, 2)}</pre></section>;
}

function numberOrMissing(value) {
  const number = Number(value || 0);
  return number ? Math.round(number).toLocaleString('es-ES') : 'N/D';
}
