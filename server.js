import http from 'node:http';
import dns from 'node:dns';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
dns.setDefaultResultOrder('ipv4first');

const port = Number(globalThis.STANTON_PORT || (typeof process !== 'undefined' ? process.env.PORT : 0)) || 4173;
const env = typeof process !== 'undefined' ? process.env : {};
const databaseName = env.DB_NAME || 'stanton_hub';
const execFileAsync = promisify(execFile);

const dbConfig = {
  host: env.DB_HOST || '127.0.0.1',
  port: Number(env.DB_PORT || 3306),
  user: env.DB_USER || 'root',
  password: env.DB_PASSWORD || ''
};

const mysqlBinary = env.MYSQL_BIN || 'C:\\Program Files\\MySQL\\MySQL Workbench 8.0 CE\\mysql.exe';
const uexToken = env.UEX_TOKEN || globalThis.UEX_TOKEN || '';
const uexClientVersion = env.UEX_CLIENT_VERSION || globalThis.UEX_CLIENT_VERSION || '';
const uexApiHosts = ['https://api.uexcorp.space/2.0', 'https://api.uexcorp.uk/2.0'];
const vehiclesCache = {
  loadedAt: 0,
  payload: null
};

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.sql': 'text/plain; charset=utf-8'
};

async function initializeDatabase() {
  await runSql(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`, null);
  await runSql(`
    CREATE TABLE IF NOT EXISTS users (
      id CHAR(36) PRIMARY KEY,
      username VARCHAR(32) NOT NULL,
      email VARCHAR(120) NOT NULL UNIQUE,
      role VARCHAR(40) NOT NULL DEFAULT 'Farmeo',
      password_hash VARCHAR(255) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_users_username (username)
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS content_items (
      id CHAR(36) PRIMARY KEY,
      section ENUM('forum', 'guides', 'news') NOT NULL,
      title VARCHAR(140) NOT NULL,
      content TEXT NOT NULL,
      content_html MEDIUMTEXT NULL,
      author_user_id CHAR(36) NULL,
      author_name VARCHAR(80) NOT NULL DEFAULT 'Stanton Hub',
      published_label VARCHAR(80) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_content_author
        FOREIGN KEY (author_user_id) REFERENCES users(id)
        ON DELETE SET NULL,
      INDEX idx_content_section_created (section, created_at),
      INDEX idx_content_author (author_user_id)
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS content_images (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      content_id CHAR(36) NOT NULL,
      image_name VARCHAR(180) NOT NULL,
      image_src MEDIUMTEXT NOT NULL,
      sort_order INT UNSIGNED NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_images_content
        FOREIGN KEY (content_id) REFERENCES content_items(id)
        ON DELETE CASCADE,
      INDEX idx_images_content (content_id, sort_order)
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS votes (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      content_id CHAR(36) NOT NULL,
      voter_key VARCHAR(120) NOT NULL,
      vote_value TINYINT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_votes_content
        FOREIGN KEY (content_id) REFERENCES content_items(id)
        ON DELETE CASCADE,
      CONSTRAINT chk_vote_value CHECK (vote_value IN (-1, 1)),
      UNIQUE KEY uq_vote_content_voter (content_id, voter_key),
      INDEX idx_votes_content (content_id)
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS comments (
      id CHAR(36) PRIMARY KEY,
      content_id CHAR(36) NOT NULL,
      author_user_id CHAR(36) NULL,
      author_name VARCHAR(80) NOT NULL DEFAULT 'Modo pruebas',
      comment_text VARCHAR(500) NOT NULL,
      published_label VARCHAR(80) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_comments_content
        FOREIGN KEY (content_id) REFERENCES content_items(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_comments_author
        FOREIGN KEY (author_user_id) REFERENCES users(id)
        ON DELETE SET NULL,
      INDEX idx_comments_content_created (content_id, created_at)
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key VARCHAR(80) PRIMARY KEY,
      setting_value VARCHAR(255) NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;

    INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES
      ('session_user_id', ''),
      ('test_bypass', '0');
  `);
}

function sql(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

async function runSql(statement, database = databaseName) {
  return runMysql(statement, database, false);
}

async function runMysql(statement, database = databaseName, includeHeaders = false) {
  const args = [
    '--host', dbConfig.host,
    '--port', String(dbConfig.port),
    '--user', dbConfig.user,
    '--default-character-set=utf8mb4',
    '--batch',
    '--raw'
  ];

  if (!includeHeaders) args.push('--skip-column-names');
  if (dbConfig.password) args.push(`--password=${dbConfig.password}`);
  if (database) args.push(database);
  args.push('--execute', statement);

  const { stdout } = await execFileAsync(mysqlBinary, args, {
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024
  });
  return stdout.trim();
}

async function queryRows(statement) {
  const output = await runMysql(statement, databaseName, true);
  if (!output) return [];
  const lines = output.split(/\r?\n/);
  const headers = lines.shift().split('\t');
  return lines.filter(Boolean).map((line) => {
    const values = line.split('\t');
    return Object.fromEntries(headers.map((header, index) => [header, values[index] === 'NULL' ? null : values[index]]));
  });
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
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

async function fetchUexResource(resource) {
  if (!uexToken) {
    throw new Error('Falta configurar UEX_TOKEN antes de arrancar el servidor.');
  }

  let lastError = null;
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'StantonHub/1.0'
  };

  if (uexToken) headers.Authorization = `Bearer ${uexToken}`;
  if (uexClientVersion) headers['X-Client-Version'] = uexClientVersion;

  for (const host of uexApiHosts) {
    try {
      const response = await fetch(`${host}/${resource}/`, {
        headers
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        lastError = new Error(`UEX ${resource} responded ${response.status}${text ? `: ${text.slice(0, 160)}` : ''}`);
        continue;
      }

      const payload = await response.json();
      return Array.isArray(payload.data) ? payload.data : [];
    } catch (error) {
      lastError = error;
    }
  }

  const reason = lastError?.cause?.code || lastError?.code || lastError?.message || 'error desconocido';
  throw new Error(`No se pudo conectar con UEX para cargar ${resource}. Detalle: ${reason}`);
}

function lowestPrice(rows, field) {
  return rows
    .map((row) => Number(row[field] || 0))
    .filter((price) => price > 0)
    .sort((a, b) => a - b)[0] || null;
}

function normalizeVehicle(vehicle, pledgePrices, purchasePrices, rentalPrices) {
  const id = Number(vehicle.id);
  const pledge = pledgePrices.find((price) => Number(price.id_vehicle) === id) || {};
  const purchases = purchasePrices.filter((price) => Number(price.id_vehicle) === id);
  const rentals = rentalPrices.filter((price) => Number(price.id_vehicle) === id);
  const tags = [
    ['Cargo', vehicle.is_cargo],
    ['Combate', vehicle.is_military || vehicle.is_bomber],
    ['Exploracion', vehicle.is_exploration],
    ['Mineria', vehicle.is_mining],
    ['Medica', vehicle.is_medical],
    ['Salvage', vehicle.is_salvage],
    ['Carreras', vehicle.is_racing],
    ['Starter', vehicle.is_starter],
    ['Industrial', vehicle.is_industrial],
    ['Terrestre', vehicle.is_ground_vehicle],
    ['Nave', vehicle.is_spaceship]
  ].filter(([, enabled]) => Number(enabled) === 1).map(([tag]) => tag);

  return {
    id,
    name: vehicle.name_full || vehicle.name,
    shortName: vehicle.name,
    manufacturer: vehicle.company_name || 'Fabricante desconocido',
    crew: vehicle.crew || 'N/D',
    scu: Number(vehicle.scu || 0),
    mass: Number(vehicle.mass || 0),
    width: Number(vehicle.width || 0),
    height: Number(vehicle.height || 0),
    length: Number(vehicle.length || 0),
    padType: vehicle.pad_type || 'N/D',
    gameVersion: vehicle.game_version || '',
    photo: vehicle.url_photo || '',
    storeUrl: vehicle.url_store || '',
    tags,
    pledge: {
      price: Number(pledge.price || 0) || null,
      warbond: Number(pledge.price_warbond || 0) || null,
      currency: pledge.currency || 'USD',
      onSale: Number(pledge.on_sale || 0) === 1
    },
    purchase: {
      price: lowestPrice(purchases, 'price_buy'),
      locations: [...new Set(purchases.map((price) => price.terminal_name).filter(Boolean))].slice(0, 4)
    },
    rental: {
      price: lowestPrice(rentals, 'price_rent'),
      locations: [...new Set(rentals.map((price) => price.terminal_name).filter(Boolean))].slice(0, 4)
    },
    flags: {
      concept: Number(vehicle.is_concept || 0) === 1,
      quantum: Number(vehicle.is_quantum_capable || 0) === 1,
      spaceship: Number(vehicle.is_spaceship || 0) === 1,
      ground: Number(vehicle.is_ground_vehicle || 0) === 1
    }
  };
}

async function readVehicles() {
  const maxAge = 1000 * 60 * 60;
  if (vehiclesCache.payload && Date.now() - vehiclesCache.loadedAt < maxAge) {
    return vehiclesCache.payload;
  }

  const [vehicles, pledgePrices, purchasePrices, rentalPrices] = await Promise.all([
    fetchUexResource('vehicles'),
    fetchUexResource('vehicles_prices'),
    fetchUexResource('vehicles_purchases_prices_all'),
    fetchUexResource('vehicles_rentals_prices_all')
  ]);

  const normalized = vehicles
    .filter((vehicle) => Number(vehicle.is_addon || 0) !== 1)
    .map((vehicle) => normalizeVehicle(vehicle, pledgePrices, purchasePrices, rentalPrices))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const payload = {
    source: 'UEX Corp API 2.0',
    loadedAt: new Date().toISOString(),
    count: normalized.length,
    vehicles: normalized
  };

  vehiclesCache.loadedAt = Date.now();
  vehiclesCache.payload = payload;
  return payload;
}

async function getSetting(key) {
  const rows = await queryRows(`SELECT setting_value FROM app_settings WHERE setting_key = ${sql(key)}`);
  return rows[0]?.setting_value || '';
}

async function setSetting(key, value) {
  await runSql(
    `INSERT INTO app_settings (setting_key, setting_value)
     VALUES (${sql(key)}, ${sql(value)})
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`
  );
}

async function getCurrentUser() {
  const sessionUserId = await getSetting('session_user_id');
  if (!sessionUserId) return null;
  const rows = await queryRows(`
    SELECT id, username, email, role, password_hash, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
    FROM users
    WHERE id = ${sql(sessionUserId)}
  `);
  return rows[0] || null;
}

function serializeUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    password: user.password_hash,
    createdAt: user.created_at ? formatDate(user.created_at.replace(' ', 'T')) : ''
  };
}

async function readState() {
  const users = await queryRows(`
    SELECT id, username, email, role, password_hash, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
    FROM users
    ORDER BY created_at ASC
  `);
  const contentRows = await queryRows(`
    SELECT id, section, title, content, COALESCE(content_html, '') AS content_html, author_user_id, author_name, published_label,
      DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
    FROM content_items
    ORDER BY created_at ASC
  `);
  const imageRows = await queryRows(`
    SELECT content_id, image_name, image_src, sort_order
    FROM content_images
    ORDER BY sort_order ASC, id ASC
  `);
  const voteRows = await queryRows(`
    SELECT content_id,
      SUM(CASE WHEN vote_value = 1 THEN 1 ELSE 0 END) AS up,
      SUM(CASE WHEN vote_value = -1 THEN 1 ELSE 0 END) AS down
    FROM votes
    GROUP BY content_id
  `);
  const commentRows = await queryRows(`
    SELECT id, content_id, author_name, comment_text, published_label, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
    FROM comments
    ORDER BY created_at ASC
  `);
  const sessionUserId = await getSetting('session_user_id');
  const testBypass = (await getSetting('test_bypass')) === '1';

  const imagesByContent = imageRows.reduce((groups, image) => {
    groups[image.content_id] ||= [];
    groups[image.content_id].push({ name: image.image_name, src: image.image_src });
    return groups;
  }, {});

  const content = { forum: [], guides: [], news: [] };
  for (const item of contentRows) {
    content[item.section].push({
      id: item.id,
      title: item.title,
      content: item.content,
      contentHtml: item.content_html || '',
      images: imagesByContent[item.id] || [],
      author: item.author_name,
      date: item.published_label || formatDate(item.created_at.replace(' ', 'T'))
    });
  }

  const votes = {};
  for (const vote of voteRows) {
    votes[vote.content_id] = {
      up: Number(vote.up || 0),
      down: Number(vote.down || 0)
    };
  }

  const comments = {};
  for (const comment of commentRows) {
    comments[comment.content_id] ||= [];
    comments[comment.content_id].push({
      id: comment.id,
      author: comment.author_name,
      text: comment.comment_text,
      date: comment.published_label || formatDate(comment.created_at.replace(' ', 'T'))
    });
  }

  return {
    users: users.map(serializeUser),
    sessionUserId: sessionUserId || null,
    testBypass,
    content,
    interactions: { votes, comments }
  };
}

async function handleApi(request, response, pathname) {
  if (request.method === 'GET' && pathname === '/api/vehicles') {
    sendJson(response, 200, await readVehicles());
    return;
  }

  if (request.method === 'GET' && pathname === '/api/state') {
    sendJson(response, 200, await readState());
    return;
  }

  if (request.method === 'POST' && pathname === '/api/register') {
    const body = await readBody(request);
    const id = crypto.randomUUID();
    const email = String(body.email || '').trim().toLowerCase();
    const username = String(body.username || '').trim();
    const role = String(body.role || 'Farmeo').trim();
    const password = String(body.password || '');

    if (!email || !username || !password) {
      sendJson(response, 400, { error: 'Email, username y contraseña son obligatorios.' });
      return;
    }

    try {
      await runSql(
        `INSERT INTO users (id, username, email, role, password_hash)
         VALUES (${sql(id)}, ${sql(username)}, ${sql(email)}, ${sql(role)}, ${sql(password)})`
      );
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        sendJson(response, 409, { error: 'Ese email ya está registrado.' });
        return;
      }
      throw error;
    }

    await setSetting('session_user_id', id);
    sendJson(response, 201, await readState());
    return;
  }

  if (request.method === 'POST' && pathname === '/api/login') {
    const body = await readBody(request);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const rows = await queryRows(`SELECT id FROM users WHERE email = ${sql(email)} AND password_hash = ${sql(password)}`);

    if (!rows[0]) {
      sendJson(response, 401, { error: 'No se encontró una cuenta con esos datos.' });
      return;
    }

    await setSetting('session_user_id', rows[0].id);
    sendJson(response, 200, await readState());
    return;
  }

  if (request.method === 'POST' && pathname === '/api/logout') {
    await setSetting('session_user_id', '');
    sendJson(response, 200, await readState());
    return;
  }

  if (request.method === 'POST' && pathname === '/api/bypass') {
    const body = await readBody(request);
    await setSetting('test_bypass', body.enabled ? '1' : '0');
    sendJson(response, 200, await readState());
    return;
  }

  if (request.method === 'POST' && pathname === '/api/content') {
    const body = await readBody(request);
    const section = String(body.section || '');
    const title = String(body.title || '').trim();
    const content = String(body.content || '').trim();
    const contentHtml = String(body.contentHtml || '').trim();
    const images = Array.isArray(body.images) ? body.images.slice(0, 8) : [];
    const currentUser = await getCurrentUser();
    const testBypass = (await getSetting('test_bypass')) === '1';

    if (!['forum', 'guides', 'news'].includes(section) || !title || (!content && !contentHtml)) {
      sendJson(response, 400, { error: 'Contenido incompleto.' });
      return;
    }

    if (!currentUser && !testBypass) {
      sendJson(response, 403, { error: 'Necesitas iniciar sesión para publicar.' });
      return;
    }

    const id = crypto.randomUUID();
    const cleanContent = content || contentHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const authorName = currentUser ? currentUser.username : 'Modo pruebas';
    const publishedLabel = formatDate(new Date());

    await runSql(
      `INSERT INTO content_items
       (id, section, title, content, content_html, author_user_id, author_name, published_label)
       VALUES (${sql(id)}, ${sql(section)}, ${sql(title)}, ${sql(cleanContent)}, ${sql(contentHtml)}, ${sql(currentUser?.id || null)}, ${sql(authorName)}, ${sql(publishedLabel)})`
    );

    for (const [index, image] of images.entries()) {
      await runSql(
        `INSERT INTO content_images (content_id, image_name, image_src, sort_order)
         VALUES (${sql(id)}, ${sql(String(image.name || title).slice(0, 180))}, ${sql(String(image.src || ''))}, ${Number(index)})`
      );
    }

    sendJson(response, 201, await readState());
    return;
  }

  if (request.method === 'POST' && pathname === '/api/vote') {
    const body = await readBody(request);
    const postId = String(body.postId || '');
    const vote = Number(body.vote);
    const currentUser = await getCurrentUser();
    const testBypass = (await getSetting('test_bypass')) === '1';

    if (!postId || ![-1, 1].includes(vote)) {
      sendJson(response, 400, { error: 'Voto invalido.' });
      return;
    }

    if (!currentUser && !testBypass) {
      sendJson(response, 403, { error: 'Necesitas iniciar sesion para votar.' });
      return;
    }

    const voterKey = currentUser ? currentUser.id : 'test-bypass';
    const existing = await queryRows(`SELECT vote_value FROM votes WHERE content_id = ${sql(postId)} AND voter_key = ${sql(voterKey)}`);

    if (Number(existing[0]?.vote_value) === vote) {
      await runSql(`DELETE FROM votes WHERE content_id = ${sql(postId)} AND voter_key = ${sql(voterKey)}`);
    } else {
      await runSql(
        `INSERT INTO votes (content_id, voter_key, vote_value)
         VALUES (${sql(postId)}, ${sql(voterKey)}, ${Number(vote)})
         ON DUPLICATE KEY UPDATE vote_value = VALUES(vote_value)`
      );
    }

    sendJson(response, 200, await readState());
    return;
  }

  if (request.method === 'POST' && pathname === '/api/comment') {
    const body = await readBody(request);
    const postId = String(body.postId || '');
    const text = String(body.text || '').trim();
    const currentUser = await getCurrentUser();
    const testBypass = (await getSetting('test_bypass')) === '1';

    if (!postId || !text) {
      sendJson(response, 400, { error: 'Comentario incompleto.' });
      return;
    }

    if (!currentUser && !testBypass) {
      sendJson(response, 403, { error: 'Necesitas iniciar sesion para comentar.' });
      return;
    }

    await runSql(
      `INSERT INTO comments
       (id, content_id, author_user_id, author_name, comment_text, published_label)
       VALUES (${sql(crypto.randomUUID())}, ${sql(postId)}, ${sql(currentUser?.id || null)}, ${sql(currentUser ? currentUser.username : 'Modo pruebas')}, ${sql(text)}, ${sql(formatDate(new Date()))})`
    );

    sendJson(response, 201, await readState());
    return;
  }

  sendJson(response, 404, { error: 'Ruta no encontrada.' });
}

async function serveStatic(response, pathname) {
  const requestedPath = pathname === '/' ? '/pages/index.html' : pathname;
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

await initializeDatabase();

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
  console.log(`Stanton Hub disponible en http://127.0.0.1:${port}/pages/index.html`);
});
