import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(rootDir, 'Datos', 'data.json');
const interactionsPath = path.join(rootDir, 'Datos', 'interactions.json');
const port = Number(globalThis.STANTON_PORT || (typeof process !== 'undefined' ? process.env.PORT : 0)) || 4173;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

const defaultData = {
  users: [],
  sessionUserId: null,
  testBypass: false,
  content: {
    forum: [
      {
        title: 'Ruta inicial para generar aUEC',
        content: 'Comparte rutas de farmeo, contratos recomendados y consejos para optimizar cada salida en el verso.',
        author: 'Stanton Hub',
        date: '22 may 2026, 12:00'
      }
    ],
    guides: [
      {
        title: 'Guía básica de preparación',
        content: 'Prepara nave, equipamiento, combustible y destino antes de iniciar misiones o rutas comerciales.',
        author: 'Stanton Hub',
        date: '22 may 2026, 12:00'
      }
    ],
    news: [
      {
        title: 'Intel reciente del verso',
        content: 'Registra cambios, eventos y oportunidades que puedan afectar al farmeo, comercio o progreso.',
        author: 'Stanton Hub',
        date: '22 may 2026, 12:00'
      }
    ]
  }
};

async function readData() {
  try {
    const raw = await fs.readFile(dataPath, 'utf8');
    return { ...defaultData, ...JSON.parse(raw) };
  } catch {
    await writeData(defaultData);
    return structuredClone(defaultData);
  }
}

async function writeData(data) {
  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  await fs.writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function readInteractions() {
  try {
    const raw = await fs.readFile(interactionsPath, 'utf8');
    return { votes: {}, comments: {}, ...JSON.parse(raw) };
  } catch {
    const defaultInteractions = { votes: {}, comments: {} };
    await writeInteractions(defaultInteractions);
    return defaultInteractions;
  }
}

async function writeInteractions(interactions) {
  await fs.mkdir(path.dirname(interactionsPath), { recursive: true });
  await fs.writeFile(interactionsPath, `${JSON.stringify(interactions, null, 2)}\n`, 'utf8');
}

function ensureContentIds(data) {
  let changed = false;

  for (const section of Object.keys(data.content)) {
    data.content[section] = data.content[section].map((item) => {
      if (item.id) return item;
      changed = true;
      return {
        id: crypto.randomUUID(),
        contentHtml: '',
        images: [],
        ...item
      };
    });
  }

  return changed;
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
  }
  return body ? JSON.parse(body) : {};
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function getCurrentUser(data) {
  return data.users.find((user) => user.id === data.sessionUserId) || null;
}

async function handleApi(request, response, pathname) {
  const data = await readData();
  const idsChanged = ensureContentIds(data);

  if (idsChanged) {
    await writeData(data);
  }

  if (request.method === 'GET' && pathname === '/api/state') {
    const interactions = await readInteractions();
    sendJson(response, 200, { ...data, interactions });
    return;
  }

  if (request.method === 'POST' && pathname === '/api/register') {
    const body = await readBody(request);
    const email = String(body.email || '').trim().toLowerCase();
    const username = String(body.username || '').trim();
    const role = String(body.role || 'Farmeo').trim();
    const password = String(body.password || '');

    if (!email || !username || !password) {
      sendJson(response, 400, { error: 'Email, username y contraseña son obligatorios.' });
      return;
    }

    if (data.users.some((user) => user.email === email)) {
      sendJson(response, 409, { error: 'Ese email ya está registrado.' });
      return;
    }

    const user = {
      id: crypto.randomUUID(),
      username,
      email,
      role,
      password,
      createdAt: new Date().toLocaleString('es-ES')
    };

    data.users.push(user);
    data.sessionUserId = user.id;
    await writeData(data);
    sendJson(response, 201, data);
    return;
  }

  if (request.method === 'POST' && pathname === '/api/login') {
    const body = await readBody(request);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const user = data.users.find((item) => item.email === email && item.password === password);

    if (!user) {
      sendJson(response, 401, { error: 'No se encontró una cuenta con esos datos.' });
      return;
    }

    data.sessionUserId = user.id;
    await writeData(data);
    sendJson(response, 200, data);
    return;
  }

  if (request.method === 'POST' && pathname === '/api/logout') {
    data.sessionUserId = null;
    await writeData(data);
    sendJson(response, 200, data);
    return;
  }

  if (request.method === 'POST' && pathname === '/api/bypass') {
    const body = await readBody(request);
    data.testBypass = Boolean(body.enabled);
    await writeData(data);
    sendJson(response, 200, data);
    return;
  }

  if (request.method === 'POST' && pathname === '/api/content') {
    const body = await readBody(request);
    const section = String(body.section || '');
    const title = String(body.title || '').trim();
    const content = String(body.content || '').trim();
    const contentHtml = String(body.contentHtml || '').trim();
    const images = Array.isArray(body.images) ? body.images.slice(0, 8) : [];
    const currentUser = getCurrentUser(data);

    if (!['forum', 'guides', 'news'].includes(section) || !title || (!content && !contentHtml)) {
      sendJson(response, 400, { error: 'Contenido incompleto.' });
      return;
    }

    if (!currentUser && !data.testBypass) {
      sendJson(response, 403, { error: 'Necesitas iniciar sesión para publicar.' });
      return;
    }

    data.content[section].push({
      id: crypto.randomUUID(),
      title,
      content: content || contentHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      contentHtml,
      images,
      author: currentUser ? currentUser.username : 'Modo pruebas',
      date: new Date().toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
    });

    await writeData(data);
    const interactions = await readInteractions();
    sendJson(response, 201, { ...data, interactions });
    return;
  }

  if (request.method === 'POST' && pathname === '/api/vote') {
    const body = await readBody(request);
    const postId = String(body.postId || '');
    const vote = Number(body.vote);
    const currentUser = getCurrentUser(data);

    if (!postId || ![-1, 1].includes(vote)) {
      sendJson(response, 400, { error: 'Voto invalido.' });
      return;
    }

    if (!currentUser && !data.testBypass) {
      sendJson(response, 403, { error: 'Necesitas iniciar sesion para votar.' });
      return;
    }

    const interactions = await readInteractions();
    interactions.votes[postId] ||= { up: 0, down: 0, voters: {} };
    const voterId = currentUser ? currentUser.id : 'test-bypass';
    const previousVote = interactions.votes[postId].voters[voterId];

    if (previousVote === vote) {
      if (vote === 1) interactions.votes[postId].up -= 1;
      if (vote === -1) interactions.votes[postId].down -= 1;
      delete interactions.votes[postId].voters[voterId];
    } else {
      if (previousVote === 1) interactions.votes[postId].up -= 1;
      if (previousVote === -1) interactions.votes[postId].down -= 1;
      if (vote === 1) interactions.votes[postId].up += 1;
      if (vote === -1) interactions.votes[postId].down += 1;
      interactions.votes[postId].voters[voterId] = vote;
    }

    await writeInteractions(interactions);
    sendJson(response, 200, { ...data, interactions });
    return;
  }

  if (request.method === 'POST' && pathname === '/api/comment') {
    const body = await readBody(request);
    const postId = String(body.postId || '');
    const text = String(body.text || '').trim();
    const currentUser = getCurrentUser(data);

    if (!postId || !text) {
      sendJson(response, 400, { error: 'Comentario incompleto.' });
      return;
    }

    if (!currentUser && !data.testBypass) {
      sendJson(response, 403, { error: 'Necesitas iniciar sesion para comentar.' });
      return;
    }

    const interactions = await readInteractions();
    interactions.comments[postId] ||= [];
    interactions.comments[postId].push({
      id: crypto.randomUUID(),
      author: currentUser ? currentUser.username : 'Modo pruebas',
      text,
      date: new Date().toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
    });

    await writeInteractions(interactions);
    sendJson(response, 201, { ...data, interactions });
    return;
  }

  sendJson(response, 404, { error: 'Ruta no encontrada.' });
}

async function serveStatic(response, pathname) {
  const requestedPath = pathname === '/' ? '/Paginas/index.html' : pathname;
  const filePath = path.resolve(rootDir, `.${decodeURIComponent(requestedPath)}`);

  if (!filePath.startsWith(rootDir)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname.startsWith('/api/')) {
      await handleApi(request, response, url.pathname);
      return;
    }

    await serveStatic(response, url.pathname);
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Stanton Hub disponible en http://127.0.0.1:${port}/Paginas/index.html`);
});
