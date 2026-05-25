import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const root = resolve('.');
const distDir = join(root, 'dist');
const publishDir = join(root, 'publish-ionos', 'StantonHub');
const indexPath = join(distDir, 'index.html');
const apiOrigin = process.env.STATIC_API_ORIGIN || 'http://127.0.0.1:4173';

function slugify(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'nave';
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || !contentType.includes('application/json')) {
    throw new Error(`${url} no devolvio JSON (${response.status}).`);
  }
  return response.json();
}

async function waitForApi(maxAttempts = 30) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      await fetchJson(`${apiOrigin}/api/vehicles`);
      return true;
    } catch {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 1000));
    }
  }
  return false;
}

async function withLocalApi(task) {
  try {
    await fetchJson(`${apiOrigin}/api/vehicles`);
    return task();
  } catch {
    // Continue by starting the local server below.
  }

  console.log('API local no detectada. Levantando servidor temporal para exportar datos...');
  const server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: new URL(apiOrigin).port || '4173' }
  });

  let serverOutput = '';
  server.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
  server.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });

  try {
    const ready = await waitForApi();
    if (!ready) throw new Error(`La API local no respondio. ${serverOutput.trim()}`);
    return await task();
  } finally {
    server.kill();
  }
}

async function exportStaticApi(targetDir) {
  const staticApiDir = join(targetDir, 'static-api');
  const vehicleDetailsDir = join(staticApiDir, 'vehicles');
  await mkdir(vehicleDetailsDir, { recursive: true });

  const state = await fetchJson(`${apiOrigin}/api/state`);
  await writeFile(join(staticApiDir, 'state.json'), JSON.stringify(state), 'utf8');

  const catalog = await fetchJson(`${apiOrigin}/api/vehicles`);
  catalog.source = catalog.source || 'Snapshot estatico de produccion';
  await writeFile(join(staticApiDir, 'vehicles.json'), JSON.stringify(catalog), 'utf8');

  const vehicles = Array.isArray(catalog.vehicles) ? catalog.vehicles : [];
  let exported = 0;
  const failures = [];

  for (const vehicle of vehicles) {
    const identifier = `${vehicle.id}-${slugify(vehicle.name)}`;
    try {
      const detail = await fetchJson(`${apiOrigin}/api/vehicles/${encodeURIComponent(identifier)}`);
      const content = JSON.stringify(detail);
      await writeFile(join(vehicleDetailsDir, `${identifier}.json`), content, 'utf8');
      await writeFile(join(vehicleDetailsDir, `${vehicle.id}.json`), content, 'utf8');
      exported += 1;
    } catch (error) {
      failures.push(`${identifier}: ${error.message}`);
    }
  }

  await writeFile(
    join(staticApiDir, 'EXPORT_INFO.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), apiOrigin, vehicles: vehicles.length, details: exported, failures }, null, 2),
    'utf8'
  );

  if (failures.length) {
    console.warn(`Aviso: ${failures.length} detalles de nave no pudieron exportarse.`);
  }
}

const indexHtml = await readFile(indexPath, 'utf8');

if (indexHtml.includes('/src/main.jsx') || indexHtml.includes('main.jsx')) {
  throw new Error('El build no es valido para IONOS: index.html sigue apuntando a main.jsx.');
}

await rm(join(root, 'publish-ionos'), { recursive: true, force: true });
await mkdir(publishDir, { recursive: true });
await cp(distDir, publishDir, { recursive: true });

try {
  await withLocalApi(() => exportStaticApi(publishDir));
} catch (error) {
  throw new Error(`No se pudo exportar /static-api. Revisa que MySQL este encendido y que server.js pueda leer la base de datos local. Detalle: ${error.message}`);
}

await writeFile(
  join(root, 'publish-ionos', 'SUBIR_ESTO_A_IONOS.txt'),
  [
    'Sube SOLO el contenido de la carpeta StantonHub al directorio raiz del dominio en IONOS.',
    '',
    'Dentro del hosting deben quedar estos elementos:',
    '- index.html',
    '- .htaccess',
    '- assets/',
    '- static-api/',
    '',
    'No subas estas carpetas al hosting estatico:',
    '- src/',
    '- node_modules/',
    '- public/',
    '- dist/',
    '- data/',
    '- .git/',
    '- .env',
    '',
    'Si ves un error sobre main.jsx, significa que IONOS esta sirviendo el index.html de desarrollo, no este build.',
    'Si la pagina Naves no carga, falta static-api/. Ejecuta npm run build:ionos con MySQL encendido.',
    ''
  ].join('\n'),
  'utf8'
);

console.log('Build para IONOS preparado en publish-ionos/StantonHub');
