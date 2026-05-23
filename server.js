import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
dns.setDefaultResultOrder('ipv4first');
loadLocalEnv();

const clientDistDir = path.join(rootDir, 'dist');
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
const uexApiHosts = ['https://api.uexcorp.uk/2.0', 'https://api.uexcorp.space/2.0'];
const discordClientId = env.DISCORD_CLIENT_ID || '';
const discordClientSecret = env.DISCORD_CLIENT_SECRET || '';
const discordRedirectUri = env.DISCORD_REDIRECT_URI || `http://127.0.0.1:${port}/api/auth/discord/callback`;
const appRoutes = {
  login: '/pages/login',
  profile: '/pages/perfil'
};
const vehiclesCache = {
  loadedAt: 0,
  payload: null
};
let databaseReady = false;
let databaseStartupError = null;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.sql': 'text/plain; charset=utf-8'
};

function loadLocalEnv() {
  if (typeof process === 'undefined') return;

  try {
    const envPath = path.join(rootDir, '.env');
    const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) continue;

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();

      if (!key || process.env[key] !== undefined) continue;

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`No se pudo leer .env: ${error.message}`);
    }
  }
}

async function initializeDatabase() {
  await runSql(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`, null);
  await runSql(`
    CREATE TABLE IF NOT EXISTS users (
      id CHAR(36) PRIMARY KEY,
      username VARCHAR(32) NOT NULL,
      email VARCHAR(120) NOT NULL UNIQUE,
      role VARCHAR(40) NOT NULL DEFAULT 'Farmeo',
      password_hash VARCHAR(255) NOT NULL,
      discord_id VARCHAR(32) NULL UNIQUE,
      discord_avatar VARCHAR(160) NULL,
      auth_provider VARCHAR(32) NOT NULL DEFAULT 'local',
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

    CREATE TABLE IF NOT EXISTS uex_vehicle_cache (
      id INT UNSIGNED PRIMARY KEY,
      name VARCHAR(180) NOT NULL,
      manufacturer VARCHAR(120) NOT NULL,
      pad_type VARCHAR(40) NULL,
      length_m DECIMAL(10,2) NOT NULL DEFAULT 0,
      scu INT UNSIGNED NOT NULL DEFAULT 0,
      pledge_price INT UNSIGNED NULL,
      purchase_price INT UNSIGNED NULL,
      rental_price INT UNSIGNED NULL,
      is_concept TINYINT(1) NOT NULL DEFAULT 0,
      vehicle_json MEDIUMTEXT NOT NULL,
      raw_vehicle_json MEDIUMTEXT NULL,
      pledge_json MEDIUMTEXT NULL,
      purchase_json MEDIUMTEXT NULL,
      rental_json MEDIUMTEXT NULL,
      synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_uex_vehicle_name (name),
      INDEX idx_uex_vehicle_size (length_m, is_concept),
      INDEX idx_uex_vehicle_manufacturer (manufacturer)
    ) ENGINE=InnoDB;

    INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES
      ('session_user_id', ''),
      ('test_bypass', '0'),
      ('discord_oauth_state', ''),
      ('vehicles_synced_at', '');
  `);

  await ensureColumn('users', 'discord_id', 'VARCHAR(32) NULL UNIQUE');
  await ensureColumn('users', 'discord_avatar', 'VARCHAR(160) NULL');
  await ensureColumn('users', 'auth_provider', "VARCHAR(32) NOT NULL DEFAULT 'local'");
}

async function ensureColumn(table, column, definition) {
  const rows = await queryRows(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = ${sql(databaseName)}
      AND TABLE_NAME = ${sql(table)}
      AND COLUMN_NAME = ${sql(column)}
  `);

  if (!rows.length) {
    await runSql(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  }
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

  if (statement.length > 24000) {
    return runMysqlFromStdin(args, statement);
  }

  args.push('--execute', statement);

  const { stdout } = await execFileAsync(mysqlBinary, args, {
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024
  });
  return stdout.trim();
}

function runMysqlFromStdin(args, statement) {
  return new Promise((resolve, reject) => {
    const child = spawn(mysqlBinary, args, {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }

      const error = new Error(stderr.trim() || `MySQL termino con codigo ${code}`);
      error.code = code;
      reject(error);
    });

    child.stdin.end(`${statement}\n`);
  });
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
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': 'http://127.0.0.1:4173',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  response.end(JSON.stringify(payload));
}

function redirect(response, location) {
  response.writeHead(302, { Location: location });
  response.end();
}

function normalizeExternalUrl(value, fallbackOrigin = 'https://uexcorp.space') {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const candidate = raw.startsWith('//')
    ? `https:${raw}`
    : raw.startsWith('/')
      ? `${fallbackOrigin}${raw}`
      : /^(media|images|www)\./i.test(raw)
        ? `https://${raw}`
        : raw;

  try {
    return new URL(candidate, fallbackOrigin).toString();
  } catch {
    return '';
  }
}

function isAllowedImageUrl(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

async function fetchUexResource(resource) {
  let lastError = null;
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'StantonHub/1.0'
  };

  if (uexToken) headers.Authorization = `Bearer ${uexToken}`;
  if (uexClientVersion) headers['X-Client-Version'] = uexClientVersion;

  for (const host of uexApiHosts) {
    const url = `${host}/${resource}/`;

    try {
      return await fetchUexJson(url, headers, resource);
    } catch (error) {
      lastError = error;
    }
  }

  const reason = lastError?.cause?.code || lastError?.code || lastError?.message || 'error desconocido';
  throw new Error(`No se pudo conectar con UEX para cargar ${resource}. Detalle: ${reason}`);
}

async function fetchUexJson(url, headers, resource) {
  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`UEX ${resource} respondio ${response.status}${text ? `: ${text.slice(0, 160)}` : ''}`);
    }

    const payload = await response.json();
    return Array.isArray(payload.data) ? payload.data : [];
  } catch (error) {
    if (!['EACCES', 'ECONNRESET', 'ETIMEDOUT', 'ENETUNREACH'].includes(error?.cause?.code)) {
      throw error;
    }

    return fetchUexJsonWithHttps(url, headers, resource);
  }
}

function fetchUexJsonWithHttps(url, headers, resource) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      family: 4,
      headers,
      timeout: 20000
    }, (response) => {
      let body = '';

      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`UEX ${resource} respondio ${response.statusCode}${body ? `: ${body.slice(0, 160)}` : ''}`));
          return;
        }

        try {
          const payload = JSON.parse(body);
          resolve(Array.isArray(payload.data) ? payload.data : []);
        } catch (error) {
          reject(new Error(`UEX ${resource} devolvio JSON invalido: ${error.message}`));
        }
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error(`Tiempo agotado conectando con UEX para ${resource}.`));
    });
    request.on('error', reject);
    request.end();
  });
}

async function proxyShipImage(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const targetUrl = normalizeExternalUrl(requestUrl.searchParams.get('url'));

  if (!targetUrl || !isAllowedImageUrl(targetUrl)) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Imagen no valida');
    return;
  }

  const imageResponse = await fetch(targetUrl, {
    headers: {
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      Referer: 'https://robertsspaceindustries.com/',
      'User-Agent': 'Mozilla/5.0 StantonHub/1.0'
    }
  });

  if (!imageResponse.ok) {
    response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('No se pudo cargar la imagen');
    return;
  }

  const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  response.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=86400'
  });
  response.end(buffer);
}

async function proxyWikiShipImage(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const title = String(requestUrl.searchParams.get('title') || '').trim();

  if (!title) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Titulo no valido');
    return;
  }

  const imageUrl = await findWikiImageUrl(title);
  if (!imageUrl) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Imagen no encontrada');
    return;
  }

  const imageResponse = await fetch(imageUrl, {
    headers: {
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      Referer: 'https://starcitizen.tools/',
      'User-Agent': 'Mozilla/5.0 StantonHub/1.0'
    }
  });

  if (!imageResponse.ok) {
    response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('No se pudo cargar la imagen de wiki');
    return;
  }

  const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  response.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=86400'
  });
  response.end(buffer);
}

async function findWikiImageUrl(title) {
  const direct = await fetchWikiPageImage(title);
  if (direct) return direct;

  const searchUrl = new URL('https://starcitizen.tools/api.php');
  searchUrl.search = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: title,
    srlimit: '1',
    format: 'json'
  }).toString();

  const searchResponse = await fetch(searchUrl, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 StantonHub/1.0'
    }
  });

  if (!searchResponse.ok) return '';

  const searchPayload = await searchResponse.json();
  const pageTitle = searchPayload.query?.search?.[0]?.title;
  return pageTitle ? fetchWikiPageImage(pageTitle) : '';
}

async function fetchWikiPageImage(title) {
  const url = new URL('https://starcitizen.tools/api.php');
  url.search = new URLSearchParams({
    action: 'query',
    titles: title,
    prop: 'pageimages',
    pithumbsize: '900',
    format: 'json'
  }).toString();

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 StantonHub/1.0'
    }
  });

  if (!response.ok) return '';

  const payload = await response.json();
  const pages = Object.values(payload.query?.pages || {});
  return pages.find((page) => page.thumbnail?.source)?.thumbnail?.source || '';
}

function lowestPrice(rows, field) {
  return rows
    .map((row) => Number(row[field] || 0))
    .filter((price) => price > 0)
    .sort((a, b) => a - b)[0] || null;
}

function normalizeVehicle(vehicle, pledgePrices, purchasePrices, rentalPrices) {
  const id = Number(vehicle.id);
  const photo = normalizeExternalUrl(vehicle.url_photo);
  const storeUrl = normalizeExternalUrl(vehicle.url_store, 'https://robertsspaceindustries.com');
  const name = vehicle.name_full || vehicle.name;
  const wikiImageCandidates = [...new Set([name, vehicle.name].filter(Boolean))]
    .map((title) => `/api/wiki-ship-image?title=${encodeURIComponent(title)}`);
  const wikiImageProxy = wikiImageCandidates[0] || '';
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
    photo,
    photoProxy: photo ? `/api/ship-image?url=${encodeURIComponent(photo)}` : '',
    wikiImageProxy,
    imageCandidates: [...wikiImageCandidates, photo ? `/api/ship-image?url=${encodeURIComponent(photo)}` : '', photo].filter(Boolean),
    storeUrl,
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

async function buildVehiclesPayloadFromUex() {
  const [vehiclesResult, pledgeResult, purchaseResult, rentalResult] = await Promise.allSettled([
    fetchUexResource('vehicles'),
    fetchUexResource('vehicles_prices'),
    fetchUexResource('vehicles_purchases_prices_all'),
    fetchUexResource('vehicles_rentals_prices_all')
  ]);

  if (vehiclesResult.status === 'rejected') {
    throw vehiclesResult.reason;
  }

  const vehicles = vehiclesResult.value;
  const pledgePrices = pledgeResult.status === 'fulfilled' ? pledgeResult.value : [];
  const purchasePrices = purchaseResult.status === 'fulfilled' ? purchaseResult.value : [];
  const rentalPrices = rentalResult.status === 'fulfilled' ? rentalResult.value : [];
  const warnings = [pledgeResult, purchaseResult, rentalResult]
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason.message);

  const normalized = vehicles
    .filter((vehicle) => Number(vehicle.is_addon || 0) !== 1)
    .map((vehicle) => normalizeVehicle(vehicle, pledgePrices, purchasePrices, rentalPrices))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const rawById = new Map(vehicles.map((vehicle) => [Number(vehicle.id), vehicle]));
  const pledgeById = new Map(pledgePrices.map((price) => [Number(price.id_vehicle), price]));
  const purchasesById = groupByVehicleId(purchasePrices);
  const rentalsById = groupByVehicleId(rentalPrices);

  return {
    source: 'UEX Corp API 2.0',
    loadedAt: new Date().toISOString(),
    count: normalized.length,
    warnings,
    vehicles: normalized,
    raw: {
      vehicles: rawById,
      pledgePrices: pledgeById,
      purchasePrices: purchasesById,
      rentalPrices: rentalsById
    }
  };
}

function groupByVehicleId(rows) {
  return rows.reduce((groups, row) => {
    const id = Number(row.id_vehicle);
    if (!id) return groups;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(row);
    return groups;
  }, new Map());
}

async function saveVehiclesToDatabase(payload) {
  const syncedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const chunks = [];
  const rows = payload.vehicles.map((vehicle) => {
    const id = Number(vehicle.id);
    return [
      id,
      sql(vehicle.name),
      sql(vehicle.manufacturer),
      sql(vehicle.padType),
      Number(vehicle.length || 0),
      Number(vehicle.scu || 0),
      vehicle.pledge?.price ? Number(vehicle.pledge.price) : 'NULL',
      vehicle.purchase?.price ? Number(vehicle.purchase.price) : 'NULL',
      vehicle.rental?.price ? Number(vehicle.rental.price) : 'NULL',
      vehicle.flags?.concept ? 1 : 0,
      sql(JSON.stringify(vehicle)),
      sql(JSON.stringify(payload.raw.vehicles.get(id) || {})),
      sql(JSON.stringify(payload.raw.pledgePrices.get(id) || {})),
      sql(JSON.stringify(payload.raw.purchasePrices.get(id) || [])),
      sql(JSON.stringify(payload.raw.rentalPrices.get(id) || [])),
      sql(syncedAt)
    ];
  });

  for (let index = 0; index < rows.length; index += 25) {
    chunks.push(rows.slice(index, index + 25));
  }

  for (const chunk of chunks) {
    await runSql(`
      INSERT INTO uex_vehicle_cache (
        id, name, manufacturer, pad_type, length_m, scu, pledge_price, purchase_price, rental_price,
        is_concept, vehicle_json, raw_vehicle_json, pledge_json, purchase_json, rental_json, synced_at
      ) VALUES
        ${chunk.map((row) => `(${row.join(', ')})`).join(',\n        ')}
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        manufacturer = VALUES(manufacturer),
        pad_type = VALUES(pad_type),
        length_m = VALUES(length_m),
        scu = VALUES(scu),
        pledge_price = VALUES(pledge_price),
        purchase_price = VALUES(purchase_price),
        rental_price = VALUES(rental_price),
        is_concept = VALUES(is_concept),
        vehicle_json = VALUES(vehicle_json),
        raw_vehicle_json = VALUES(raw_vehicle_json),
        pledge_json = VALUES(pledge_json),
        purchase_json = VALUES(purchase_json),
        rental_json = VALUES(rental_json),
        synced_at = VALUES(synced_at)
    `);
  }

  if (payload.vehicles.length) {
    await runSql(`DELETE FROM uex_vehicle_cache WHERE id NOT IN (${payload.vehicles.map((vehicle) => Number(vehicle.id)).join(', ')})`);
  }

  await setSetting('vehicles_synced_at', syncedAt);
  vehiclesCache.loadedAt = 0;
  vehiclesCache.payload = null;
}

async function readVehiclesFromDatabase() {
  const rows = await queryRows(`
    SELECT vehicle_json, DATE_FORMAT(synced_at, '%Y-%m-%d %H:%i:%s') AS synced_at
    FROM uex_vehicle_cache
    ORDER BY is_concept ASC, length_m DESC, name ASC
  `);

  if (!rows.length) return null;

  const vehicles = rows.map((row) => JSON.parse(row.vehicle_json));
  const loadedAt = rows[0]?.synced_at
    ? new Date(rows[0].synced_at.replace(' ', 'T')).toISOString()
    : new Date().toISOString();

  return {
    source: 'Base de datos local',
    loadedAt,
    count: vehicles.length,
    warnings: [],
    vehicles
  };
}

async function countVehiclesInDatabase() {
  const rows = await queryRows('SELECT COUNT(*) AS total FROM uex_vehicle_cache');
  return Number(rows[0]?.total || 0);
}

async function syncVehiclesFromUex() {
  const payload = await buildVehiclesPayloadFromUex();
  await saveVehiclesToDatabase(payload);
  const localPayload = await readVehiclesFromDatabase();
  return {
    ...localPayload,
    source: 'Base de datos local, sincronizada desde UEX',
    warnings: payload.warnings
  };
}

async function readVehicles({ forceSync = false } = {}) {
  const maxAge = 1000 * 60 * 10;
  if (!forceSync && vehiclesCache.payload && Date.now() - vehiclesCache.loadedAt < maxAge) {
    return vehiclesCache.payload;
  }

  let payload = forceSync ? null : await readVehiclesFromDatabase();

  if (!payload) {
    payload = await syncVehiclesFromUex();
  }

  vehiclesCache.loadedAt = Date.now();
  vehiclesCache.payload = payload;
  return payload;
}

async function primeVehiclesDatabase() {
  try {
    const total = await countVehiclesInDatabase();
    if (total > 0) {
      console.log(`Catalogo de naves listo en MySQL: ${total} registros.`);
      return;
    }

    console.log('Catalogo de naves vacio. Sincronizando UEX con MySQL...');
    const payload = await syncVehiclesFromUex();
    console.log(`Catalogo de naves sincronizado en MySQL: ${payload.count} registros.`);
  } catch (error) {
    console.warn(`No se pudo sincronizar el catalogo de naves: ${error.message}`);
  }
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
    SELECT id, username, email, role, password_hash, COALESCE(discord_id, '') AS discord_id,
      COALESCE(discord_avatar, '') AS discord_avatar, COALESCE(auth_provider, 'local') AS auth_provider,
      DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
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
    provider: user.auth_provider || 'local',
    discordAvatar: user.discord_avatar || '',
    createdAt: user.created_at ? formatDate(user.created_at.replace(' ', 'T')) : ''
  };
}

function discordAvatarUrl(user) {
  if (!user.avatar) return '';
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
}

async function fetchDiscordToken(code) {
  const body = new URLSearchParams({
    client_id: discordClientId,
    client_secret: discordClientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: discordRedirectUri
  });

  const response = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Discord no pudo validar el acceso${text ? `: ${text.slice(0, 120)}` : ''}`);
  }

  return response.json();
}

async function fetchDiscordUser(accessToken) {
  const response = await fetch('https://discord.com/api/users/@me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Discord no devolvio el perfil del usuario.');
  }

  return response.json();
}

async function loginWithDiscordUser(discordUser) {
  const discordId = String(discordUser.id || '');
  const email = String(discordUser.email || `${discordId}@discord.local`).trim().toLowerCase();
  const username = String(discordUser.global_name || discordUser.username || `Discord ${discordId.slice(-4)}`).trim().slice(0, 32);
  const avatar = discordAvatarUrl(discordUser);
  const rows = await queryRows(`
    SELECT id
    FROM users
    WHERE discord_id = ${sql(discordId)} OR email = ${sql(email)}
    LIMIT 1
  `);

  if (rows[0]) {
    await runSql(`
      UPDATE users
      SET username = ${sql(username)},
          email = ${sql(email)},
          discord_id = ${sql(discordId)},
          discord_avatar = ${sql(avatar)},
          auth_provider = 'discord'
      WHERE id = ${sql(rows[0].id)}
    `);
    await setSetting('session_user_id', rows[0].id);
    return rows[0].id;
  }

  const id = crypto.randomUUID();
  await runSql(`
    INSERT INTO users (id, username, email, role, password_hash, discord_id, discord_avatar, auth_provider)
    VALUES (${sql(id)}, ${sql(username)}, ${sql(email)}, 'Discord', 'discord-oauth', ${sql(discordId)}, ${sql(avatar)}, 'discord')
  `);
  await setSetting('session_user_id', id);
  return id;
}

async function readState() {
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
  const currentUser = sessionUserId ? await getCurrentUser() : null;
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
    users: currentUser ? [serializeUser(currentUser)] : [],
    sessionUserId: sessionUserId || null,
    testBypass,
    content,
    interactions: { votes, comments }
  };
}

async function handleApi(request, response, pathname) {
  if (request.method === 'GET' && pathname === '/api/auth/discord') {
    if (!discordClientId || !discordClientSecret) {
      redirect(response, `${appRoutes.login}?error=discord_config`);
      return;
    }

    const state = crypto.randomBytes(18).toString('hex');
    await setSetting('discord_oauth_state', state);
    const url = new URL('https://discord.com/oauth2/authorize');
    url.search = new URLSearchParams({
      client_id: discordClientId,
      response_type: 'code',
      redirect_uri: discordRedirectUri,
      scope: 'identify email',
      state
    }).toString();
    redirect(response, url.toString());
    return;
  }

  if (request.method === 'GET' && pathname === '/api/auth/discord/callback') {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    const code = String(requestUrl.searchParams.get('code') || '');
    const state = String(requestUrl.searchParams.get('state') || '');
    const expectedState = await getSetting('discord_oauth_state');
    await setSetting('discord_oauth_state', '');

    if (!code || !state || state !== expectedState) {
      redirect(response, `${appRoutes.login}?error=discord_state`);
      return;
    }

    try {
      const token = await fetchDiscordToken(code);
      const discordUser = await fetchDiscordUser(token.access_token);
      await loginWithDiscordUser(discordUser);
      redirect(response, appRoutes.profile);
    } catch (error) {
      console.warn(`Login Discord fallido: ${error.message}`);
      redirect(response, `${appRoutes.login}?error=discord_login`);
    }
    return;
  }

  if (request.method === 'GET' && pathname === '/api/vehicles') {
    sendJson(response, 200, await readVehicles());
    return;
  }

  if (request.method === 'POST' && pathname === '/api/vehicles/sync') {
    sendJson(response, 200, await readVehicles({ forceSync: true }));
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
  const hasReactBuild = await fileExists(path.join(clientDistDir, 'index.html'));
  const staticRoot = hasReactBuild ? clientDistDir : rootDir;
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  let filePath = path.resolve(staticRoot, `.${decodeURIComponent(requestedPath)}`);

  if (!filePath.startsWith(staticRoot)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
    response.end(content);
  } catch (error) {
    if (hasReactBuild && error.code === 'ENOENT') {
      filePath = path.join(clientDistDir, 'index.html');
      const content = await fs.readFile(filePath);
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(content);
      return;
    }

    response.writeHead(404);
    response.end('Not found');
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

try {
  await initializeDatabase();
  databaseReady = true;
} catch (error) {
  databaseStartupError = error;
  console.warn(`MySQL no esta disponible: ${error.message}`);
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Origin': 'http://127.0.0.1:4173',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      response.end();
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname.startsWith('/api/')) {
      if (request.method === 'GET' && url.pathname === '/api/ship-image') {
        await proxyShipImage(request, response);
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/wiki-ship-image') {
        await proxyWikiShipImage(request, response);
        return;
      }

      if (!databaseReady) {
        sendJson(response, 503, {
          error: `MySQL no esta disponible. Enciende MySQL y reinicia npm run dev. Detalle: ${databaseStartupError?.message || 'conexion no disponible'}`
        });
        return;
      }

      await handleApi(request, response, url.pathname);
      return;
    }

    await serveStatic(response, url.pathname);
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Stanton Hub disponible en http://127.0.0.1:${port}/pages/index`);
  if (!databaseReady) {
    console.log('Aviso: la web esta abierta, pero MySQL debe estar encendido para login, perfil y publicaciones.');
  } else {
    primeVehiclesDatabase();
  }
});
