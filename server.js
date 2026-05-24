import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
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
const starCitizenWikiApiBase = 'https://api.star-citizen.wiki/api';
const eurExchangeRateApiBase = 'https://api.frankfurter.dev/v1/latest';
const discordClientId = env.DISCORD_CLIENT_ID || '';
const discordClientSecret = env.DISCORD_CLIENT_SECRET || '';
const discordRedirectUri = env.DISCORD_REDIRECT_URI || `http://127.0.0.1:${port}/api/auth/discord/callback`;
const appRoutes = {
  login: '/pages/login',
  profile: '/pages/perfil'
};
const sessionCookieName = 'stanton_session';
const oauthStateCookieName = 'stanton_oauth_state';
const sessionMaxAgeSeconds = 60 * 60 * 24 * 14;
const oauthStateMaxAgeSeconds = 60 * 10;
const roleDefinitions = [
  {
    key: 'recluta',
    label: 'Recluta',
    level: 10,
    permissions: ['content.vote', 'content.comment']
  },
  {
    key: 'piloto',
    label: 'Piloto',
    level: 20,
    permissions: ['content.vote', 'content.comment', 'content.publish']
  },
  {
    key: 'especialista',
    label: 'Especialista',
    level: 30,
    permissions: ['content.vote', 'content.comment', 'content.publish', 'content.publish.guides', 'content.upload.images']
  },
  {
    key: 'oficial',
    label: 'Oficial',
    level: 40,
    permissions: ['content.vote', 'content.comment', 'content.publish', 'content.publish.guides', 'content.upload.images', 'content.moderate', 'images.delete']
  },
  {
    key: 'comandante',
    label: 'Comandante',
    level: 50,
    permissions: ['content.vote', 'content.comment', 'content.publish', 'content.publish.guides', 'content.upload.images', 'content.moderate', 'images.delete', 'users.manage']
  },
  {
    key: 'administrador',
    label: 'Administrador',
    level: 60,
    permissions: ['content.vote', 'content.comment', 'content.publish', 'content.publish.guides', 'content.upload.images', 'content.moderate', 'images.delete', 'users.manage', 'users.manage.admins', 'ships.sync', 'admin.access']
  }
];
const roleByKey = new Map(roleDefinitions.map((role) => [role.key, role]));
const roleAliases = new Map([
  ['farmeo', 'piloto'],
  ['combate', 'piloto'],
  ['exploracion', 'piloto'],
  ['comercio', 'piloto'],
  ['discord', 'piloto'],
  ['admin', 'administrador']
]);
const vehiclesCache = {
  loadedAt: 0,
  payload: null
};
let databaseReady = false;
let databaseStartupError = null;
const eurRateCache = {
  loadedAt: 0,
  rates: new Map([['EUR', 1]])
};

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
      discord_avatar_hash VARCHAR(80) NULL,
      discord_avatar VARCHAR(160) NULL,
      auth_provider VARCHAR(32) NOT NULL DEFAULT 'local',
      last_login_at DATETIME NULL,
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
      author_name VARCHAR(80) NOT NULL DEFAULT 'Stanton Hub',
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

    CREATE TABLE IF NOT EXISTS user_sessions (
      token_hash CHAR(64) PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_sessions_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
      INDEX idx_sessions_user (user_id),
      INDEX idx_sessions_expires (expires_at)
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
      wiki_vehicle_json MEDIUMTEXT NULL,
      combat_json MEDIUMTEXT NULL,
      pledge_json MEDIUMTEXT NULL,
      purchase_json MEDIUMTEXT NULL,
      rental_json MEDIUMTEXT NULL,
      synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      details_synced_at DATETIME NULL,
      INDEX idx_uex_vehicle_name (name),
      INDEX idx_uex_vehicle_size (length_m, is_concept),
      INDEX idx_uex_vehicle_manufacturer (manufacturer)
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS api_sync_runs (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      source VARCHAR(80) NOT NULL,
      status VARCHAR(24) NOT NULL,
      message VARCHAR(500) NULL,
      started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at DATETIME NULL,
      INDEX idx_api_sync_source_started (source, started_at)
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS uex_api_cache (
      resource VARCHAR(80) NOT NULL,
      resource_row_id VARCHAR(80) NOT NULL,
      vehicle_id INT UNSIGNED NULL,
      payload_json LONGTEXT NOT NULL,
      synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (resource, resource_row_id),
      INDEX idx_uex_api_cache_vehicle (vehicle_id),
      INDEX idx_uex_api_cache_synced (synced_at)
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS star_citizen_wiki_vehicle_cache (
      vehicle_id INT UNSIGNED PRIMARY KEY,
      wiki_uuid VARCHAR(80) NULL,
      name VARCHAR(180) NOT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'missing',
      error_message VARCHAR(500) NULL,
      payload_json LONGTEXT NULL,
      synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_wiki_vehicle_uuid (wiki_uuid),
      INDEX idx_wiki_vehicle_name (name)
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS vehicle_combat_cache (
      vehicle_id INT UNSIGNED PRIMARY KEY,
      payload_json LONGTEXT NOT NULL,
      synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;

    INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES
      ('vehicles_synced_at', '');
  `);

  await ensureColumn('users', 'discord_id', 'VARCHAR(32) NULL UNIQUE');
  await ensureColumn('users', 'discord_avatar_hash', 'VARCHAR(80) NULL');
  await ensureColumn('users', 'discord_avatar', 'VARCHAR(160) NULL');
  await ensureColumn('users', 'auth_provider', "VARCHAR(32) NOT NULL DEFAULT 'local'");
  await ensureColumn('users', 'last_login_at', 'DATETIME NULL');
  await ensureColumn('uex_vehicle_cache', 'wiki_vehicle_json', 'MEDIUMTEXT NULL');
  await ensureColumn('uex_vehicle_cache', 'combat_json', 'MEDIUMTEXT NULL');
  await ensureColumn('uex_vehicle_cache', 'details_synced_at', 'DATETIME NULL');
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

function encodeDbJson(value) {
  const json = JSON.stringify(value ?? {});
  const compressed = zlib.gzipSync(json).toString('base64');
  return JSON.stringify({ encoding: 'gzip+base64', data: compressed });
}

function decodeDbJson(value, fallback) {
  const parsed = safeJson(value, null);
  if (parsed?.encoding === 'gzip+base64' && parsed.data) {
    try {
      return JSON.parse(zlib.gunzipSync(Buffer.from(parsed.data, 'base64')).toString('utf8'));
    } catch {
      return fallback;
    }
  }

  return parsed ?? fallback;
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

function normalizeRoleKey(role) {
  const raw = String(role || '').trim().toLowerCase();
  const key = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
  return roleByKey.has(key) ? key : roleAliases.get(key) || 'piloto';
}

function getRole(role) {
  return roleByKey.get(normalizeRoleKey(role)) || roleByKey.get('piloto');
}

function userPermissions(user) {
  return getRole(user?.role).permissions;
}

function hasPermission(user, permission) {
  return userPermissions(user).includes(permission);
}

function publicRole(role) {
  const definition = getRole(role);
  return {
    key: definition.key,
    label: definition.label,
    level: definition.level,
    permissions: definition.permissions
  };
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
  }
  return body ? JSON.parse(body) : {};
}

function sendJson(response, status, payload, extraHeaders = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': 'http://127.0.0.1:4173',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...extraHeaders
  });
  response.end(JSON.stringify(payload));
}

function redirect(response, location, extraHeaders = {}) {
  response.writeHead(302, { Location: location, ...extraHeaders });
  response.end();
}

function parseCookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie || '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf('=');
        const key = separator === -1 ? part : part.slice(0, separator);
        const value = separator === -1 ? '' : part.slice(separator + 1);
        return [key, decodeURIComponent(value)];
      })
  );
}

function cookieHeader(name, value, options = {}) {
  const pieces = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (options.maxAge !== undefined) pieces.push(`Max-Age=${Number(options.maxAge)}`);
  if (options.expires) pieces.push(`Expires=${options.expires.toUTCString()}`);
  return pieces.join('; ');
}

function clearCookieHeader(name) {
  return cookieHeader(name, '', { maxAge: 0, expires: new Date(0) });
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

async function createUserSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  await runSql(`
    INSERT INTO user_sessions (token_hash, user_id, expires_at)
    VALUES (${sql(tokenHash)}, ${sql(userId)}, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ${sessionMaxAgeSeconds} SECOND))
  `);
  return token;
}

async function destroyUserSession(token) {
  if (!token) return;
  await runSql(`DELETE FROM user_sessions WHERE token_hash = ${sql(hashToken(token))}`);
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
      Referer: new URL(targetUrl).origin + '/',
      'User-Agent': 'Mozilla/5.0 StantonHub/1.0'
    }
  });

  if (!imageResponse.ok) {
    response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('No se pudo cargar la imagen');
    return;
  }

  const contentType = normalizeImageContentType(targetUrl, imageResponse.headers.get('content-type'));
  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  response.writeHead(200, {
    'Content-Type': contentType,
    'Content-Disposition': 'inline',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'public, max-age=86400'
  });
  response.end(buffer);
}

function normalizeImageContentType(url, contentType = '') {
  const lowerType = String(contentType || '').toLowerCase();
  if (lowerType.startsWith('image/')) return contentType.split(';')[0];
  const pathname = new URL(url).pathname.toLowerCase();
  if (pathname.endsWith('.png')) return 'image/png';
  if (pathname.endsWith('.webp')) return 'image/webp';
  if (pathname.endsWith('.gif')) return 'image/gif';
  if (pathname.endsWith('.svg')) return 'image/svg+xml';
  return 'image/jpeg';
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

async function fetchStarCitizenWikiJson(pathname, params = {}) {
  const url = new URL(`${starCitizenWikiApiBase}${pathname}`);
  url.search = new URLSearchParams(params).toString();

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 StantonHub/1.0'
    }
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Star Citizen Wiki respondio ${response.status}${text ? `: ${text.slice(0, 140)}` : ''}`);
  }

  return response.json();
}

async function fetchStarCitizenWikiHtml(pathname) {
  const url = new URL(`https://api.star-citizen.wiki${pathname}`);
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'Mozilla/5.0 StantonHub/1.0'
    }
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Star Citizen Wiki HTML respondio ${response.status}${text ? `: ${text.slice(0, 120)}` : ''}`);
  }

  return response.text();
}

function wikiData(payload) {
  return payload?.data ?? payload;
}

function asArray(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function wikiVehicleSlug(wikiVehicle) {
  const className = textValue(wikiVehicle?.class_name || wikiVehicle?.className);
  if (className) return className.toLowerCase().replace(/_/g, '-').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  return textValue(wikiVehicle?.slug || wikiVehicle?.name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function fetchWikiVehiclesList() {
  return asArray(wikiData(await fetchStarCitizenWikiJson('/vehicles')));
}

async function fetchWikiVehicleDetail(vehicle, wikiVehicles = []) {
  const normalizedNames = [vehicle.name, vehicle.shortName].filter(Boolean).map(normalizeComparableName);
  const listMatch = wikiVehicles.find((item) => {
    const itemName = normalizeComparableName(textValue(item.name || item.name_full));
    return normalizedNames.includes(itemName);
  });
  if (listMatch) {
    const detail = await fetchWikiVehicleDetailByKnownIds(listMatch);
    return mergeWikiVehicleData(listMatch, detail);
  }

  const rawUuid = String(vehicle.raw?.uuid || '').trim();
  const normalizedUuid = String(vehicle.uuid || '').trim();
  const candidates = [
    rawUuid,
    normalizedUuid,
    vehicle.name,
    vehicle.shortName
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (/^[0-9a-f-]{30,}$/i.test(candidate)) {
      try {
        return wikiData(await fetchStarCitizenWikiJson(`/vehicles/${encodeURIComponent(candidate)}`));
      } catch {
        // The public API sometimes lacks direct UUID matches for older records.
      }
    }
  }

  for (const name of [vehicle.name, vehicle.shortName].filter(Boolean)) {
    try {
      const searchPayload = await fetchStarCitizenWikiJson('/vehicles', { 'filter[name]': name });
      const matches = asArray(wikiData(searchPayload));
      const normalizedName = normalizeComparableName(name);
      const match = matches.find((item) => normalizeComparableName(textValue(item.name)) === normalizedName) || matches[0];
      if (!match) continue;
      const uuid = match.uuid || match.id;
      if (!uuid) return match;
      return wikiData(await fetchStarCitizenWikiJson(`/vehicles/${encodeURIComponent(uuid)}`));
    } catch {
      // Keep the UEX vehicle even when Wiki does not expose the matching record.
    }
  }

  return null;
}

async function fetchWikiVehicleDetailByKnownIds(wikiVehicle) {
  const candidates = [
    textValue(wikiVehicle?.uuid),
    textValue(wikiVehicle?.id),
    textValue(wikiVehicle?.class_name)
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return wikiData(await fetchStarCitizenWikiJson(`/vehicles/${encodeURIComponent(candidate)}`));
    } catch {
      // Keep the /vehicles list row as the fallback source when detail lookups fail.
    }
  }

  return null;
}

function mergeWikiVehicleData(listVehicle, detailVehicle) {
  if (!detailVehicle || typeof detailVehicle !== 'object') return listVehicle;
  return {
    ...listVehicle,
    ...detailVehicle,
    weaponry: detailVehicle.weaponry || listVehicle?.weaponry,
    loadout: detailVehicle.loadout || listVehicle?.loadout,
    hardpoints: detailVehicle.hardpoints || listVehicle?.hardpoints,
    parts: detailVehicle.parts || listVehicle?.parts,
    components: detailVehicle.components || listVehicle?.components
  };
}

function normalizeComparableName(value) {
  return textValue(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function textValue(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return textValue(value.find(Boolean), fallback);
  if (typeof value === 'object') {
    return textValue(
      value.en_EN ?? value.en_US ?? value.en ?? value.name ?? value.label ?? value.value ?? Object.values(value).find((item) => typeof item === 'string'),
      fallback
    );
  }
  return fallback;
}

function normalizeCurrency(value) {
  return textValue(value, 'EUR').trim().toUpperCase() || 'EUR';
}

async function getCurrencyRateToEur(currency) {
  const normalized = normalizeCurrency(currency);
  if (normalized === 'EUR') return 1;
  if (eurRateCache.rates.has(normalized) && Date.now() - eurRateCache.loadedAt < 1000 * 60 * 60 * 6) {
    return eurRateCache.rates.get(normalized);
  }

  const url = new URL(eurExchangeRateApiBase);
  url.search = new URLSearchParams({ base: normalized, symbols: 'EUR' }).toString();
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 StantonHub/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`No se pudo convertir ${normalized} a EUR (${response.status})`);
  }

  const payload = await response.json();
  const rate = Number(payload?.rates?.EUR || 0);
  if (!rate) throw new Error(`No hay tasa EUR disponible para ${normalized}`);
  eurRateCache.loadedAt = Date.now();
  eurRateCache.rates.set(normalized, rate);
  return rate;
}

async function buildCurrencyRatesToEur(currencies) {
  const rates = new Map([['EUR', 1]]);
  for (const currency of [...new Set(currencies.map(normalizeCurrency))]) {
    try {
      rates.set(currency, await getCurrencyRateToEur(currency));
    } catch {
      rates.set(currency, currency === 'USD' ? 0.92 : 1);
    }
  }
  return rates;
}

function convertMoneyToEur(value, currency, rates = new Map([['EUR', 1]])) {
  const amount = Number(value || 0);
  if (!amount) return null;
  const normalized = normalizeCurrency(currency);
  const rate = rates.get(normalized) || (normalized === 'EUR' ? 1 : 1);
  return Math.round(amount * rate);
}

function collectVehicleWeapons(node, weapons = [], pathLabel = '') {
  if (!node || typeof node !== 'object') return weapons;

  const item = node.item && typeof node.item === 'object' ? node.item : node;
  const weapon = item.vehicle_weapon;
  if (weapon?.damage && (item.type === 'WeaponGun' || weapon.damage.alpha_total || weapon.damage.sustained_60s)) {
    weapons.push({
      name: item.name || node.name || 'Arma sin nombre',
      size: Number(item.size || node.size || 0) || null,
      type: item.type || node.type || 'WeaponGun',
      className: item.class_name || node.class_name || '',
      mount: node.name || pathLabel || '',
      damage: {
        sustained60s: Number(weapon.damage.sustained_60s || 0),
        burst: Number(weapon.damage.burst || 0),
        alphaTotal: Number(weapon.damage.alpha_total || 0),
        maximum: Number(weapon.damage.maximum || 0),
        alpha: {
          physical: Number(weapon.damage.alpha?.physical || 0),
          energy: Number(weapon.damage.alpha?.energy || 0),
          distortion: Number(weapon.damage.alpha?.distortion || 0)
        }
      },
      rpm: Number(weapon.rpm || 0) || null,
      range: Number(item.ammunition?.range || 0) || null
    });
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'item') continue;
    if (Array.isArray(value)) {
      for (const child of value) collectVehicleWeapons(child, weapons, node.name || pathLabel);
    } else if (value && typeof value === 'object') {
      collectVehicleWeapons(value, weapons, node.name || pathLabel);
    }
  }

  return weapons;
}

function combatSummaryFromWeapons(weapons, source = 'Star Citizen Wiki API') {
  const totals = weapons.reduce((summary, weapon) => ({
    sustained60s: summary.sustained60s + weapon.damage.sustained60s,
    burst: summary.burst + weapon.damage.burst,
    alphaTotal: summary.alphaTotal + weapon.damage.alphaTotal,
    maximum: summary.maximum + weapon.damage.maximum,
    physicalAlpha: summary.physicalAlpha + weapon.damage.alpha.physical,
    energyAlpha: summary.energyAlpha + weapon.damage.alpha.energy,
    distortionAlpha: summary.distortionAlpha + weapon.damage.alpha.distortion
  }), { sustained60s: 0, burst: 0, alphaTotal: 0, maximum: 0, physicalAlpha: 0, energyAlpha: 0, distortionAlpha: 0 });

  return {
    source,
    available: weapons.length > 0,
    weaponCount: weapons.length,
    totals,
    weapons,
    weaponGroups: groupWeaponsByCategory(weapons)
  };
}

function buildCombatSummary(wikiVehicle) {
  const weaponryWeapons = collectWikiWeaponry(wikiVehicle);
  if (weaponryWeapons.length) {
    return combatSummaryFromWeapons(weaponryWeapons);
  }

  const weapons = collectVehicleWeapons(wikiVehicle);
  return combatSummaryFromWeapons(weapons);
}

function collectWikiWeaponry(wikiVehicle) {
  const weaponry = wikiVehicle?.weaponry;
  if (!weaponry || typeof weaponry !== 'object') return [];

  const defaultGunSize = Number(wikiVehicle?.power_pools?.WeaponGun?.size || 0) || null;
  const weapons = [];
  const pushWeapon = (weapon, index, sourceLabel, fallbackSize = defaultGunSize) => {
    if (!weapon || typeof weapon !== 'object') return;
    const alpha = Number(weapon.alpha || weapon.alpha_total || weapon.damage?.alpha_total || weapon.damage?.total || 0);
    const sustained = Number(weapon.sustained_dps || weapon.sustained_60s || weapon.damage?.sustained_60s || 0);
    const dps = Number(weapon.dps || weapon.damage?.dps || 0);
    if (!alpha && !sustained && !dps) return;
    weapons.push({
      name: textValue(weapon.name, `${sourceLabel} ${index + 1}`),
      size: Number(weapon.size || weapon.category || fallbackSize || 0) || null,
      type: textValue(weapon.type, sourceLabel),
      className: textValue(weapon.class_name),
      mount: sourceLabel,
      damage: {
        sustained60s: sustained || dps,
        burst: dps,
        alphaTotal: alpha,
        maximum: Math.max(alpha, sustained, dps),
        alpha: {
          physical: Number(weapon.damage?.physical || 0),
          energy: Number(weapon.damage?.energy || 0),
          distortion: Number(weapon.damage?.distortion || 0)
        }
      },
      rpm: Number(weapon.rpm || 0) || null,
      range: Number(weapon.range || 0) || null
    });
  };

  for (const sectionKey of ['fixed_weapons', 'turrets', 'remote_turrets', 'manned_turrets']) {
    const section = weaponry[sectionKey];
    const sectionWeapons = asArray(section?.weapons);
    sectionWeapons.forEach((weapon, index) => pushWeapon(weapon, index, textValue(section?.label, sectionKey.replace(/_/g, ' ')), section?.size || defaultGunSize));
  }

  if (weaponry.missiles?.count) {
    const totalDamage = Number(weaponry.missiles.damage?.total || weaponry.total_missile_damage || 0);
    weapons.push({
      name: 'Misiles',
      size: Number(weaponry.missiles.size || 0) || null,
      type: 'Missile',
      className: 'Missile',
      mount: 'Misiles',
      damage: {
        sustained60s: 0,
        burst: totalDamage,
        alphaTotal: totalDamage,
        maximum: totalDamage,
        alpha: {
          physical: Number(weaponry.missiles.damage?.physical || 0),
          energy: Number(weaponry.missiles.damage?.energy || 0),
          distortion: Number(weaponry.missiles.damage?.distortion || 0)
        }
      },
      rpm: null,
      range: null,
      countOverride: Number(weaponry.missiles.count || 0)
    });
  }

  return weapons;
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&alpha;/gi, 'α')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function htmlToTextLines(html) {
  return decodeHtmlEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(h[1-6]|p|div|li|tr|td|th|section|article|button|a)>/gi, '\n')
    .replace(/<[^>]+>/g, '\n')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function parseCompactNumber(value) {
  let raw = String(value || '').replace(/\u00a0/g, ' ').trim();
  if (!raw) return 0;

  const multiplier = /[kK]\s*$/.test(raw) ? 1000 : /[mM]\s*$/.test(raw) ? 1000000 : 1;
  raw = raw.replace(/[kKmM]\s*$/, '').replace(/\s+/g, '');
  if (raw.includes('.') && raw.includes(',')) raw = raw.replace(/,/g, '');
  if (!raw.includes('.') && raw.includes(',')) raw = raw.replace(',', '.');
  raw = raw.replace(/[^0-9.-]/g, '');

  const number = Number(raw);
  return Number.isFinite(number) ? number * multiplier : 0;
}

function parseNumberBeforeUnit(line, unitPattern) {
  const matches = [...String(line || '').matchAll(new RegExp(`([0-9][0-9\\s.,]*\\s*[kKmM]?)\\s*(?:${unitPattern})`, 'gi'))];
  if (!matches.length) return 0;
  return parseCompactNumber(matches[matches.length - 1][1]);
}

function isDetailedWeaponSection(label) {
  return /^(Weapons|Manned Turrets|Remote Turrets|PDC Turrets)$/i.test(label);
}

function isIgnoredWeaponLine(line) {
  return /^(DPS|Sustained DPS|Alpha|Item Size Info Stat|No matching items found|Loading.|Loading...|View all|Results are a work in progress|Equippable|Find on|MSRP|Count|Total Damage)$/i.test(line)
    || /^Equippable /i.test(line)
    || /^Results are /i.test(line)
    || /^[0-9]+(?:[.,][0-9]+)?$/.test(line);
}

function parseWikiVehiclePageCombat(html, slug = '') {
  const lines = htmlToTextLines(html);
  const weapons = [];
  let section = '';
  let currentSize = null;
  let pending = null;

  const finalizePending = () => {
    if (!pending) return;
    const hasDamage = pending.damage.sustained60s || pending.damage.burst || pending.damage.alphaTotal || pending.damage.maximum;
    if (hasDamage) weapons.push(pending);
    pending = null;
  };

  const startPending = (name) => {
    if (!currentSize || !isDetailedWeaponSection(section)) return;
    finalizePending();
    pending = {
      name: textValue(name, `${section} S${currentSize}`),
      size: currentSize,
      type: section.includes('Turret') ? 'Turret weapon' : 'WeaponGun',
      className: '',
      mount: section,
      damage: {
        sustained60s: 0,
        burst: 0,
        alphaTotal: 0,
        maximum: 0,
        alpha: {
          physical: 0,
          energy: 0,
          distortion: 0
        }
      },
      rpm: null,
      range: null
    };
  };

  for (const line of lines) {
    const sectionMatch = line.match(/^(Pilot Weapons|Turrets|Missiles|Weapons|Manned Turrets|Remote Turrets|PDC Turrets)\s*(\d+)?$/i);
    if (sectionMatch) {
      finalizePending();
      section = sectionMatch[1];
      currentSize = null;
      continue;
    }

    const sizeMatch = line.match(/^S\s*(\d+)$/i);
    if (sizeMatch) {
      currentSize = Number(sizeMatch[1]);
      continue;
    }

    if (!isDetailedWeaponSection(section)) continue;

    const dps = parseNumberBeforeUnit(line, 'DPS');
    if (dps) {
      if (!pending) startPending(`${section} S${currentSize || 'N/D'}`);
      if (pending) {
        pending.damage.sustained60s = dps;
        pending.damage.burst = dps;
        pending.damage.maximum = Math.max(pending.damage.maximum, dps);
      }
      continue;
    }

    const alpha = parseNumberBeforeUnit(line, 'α|alpha');
    if (alpha) {
      if (!pending) startPending(`${section} S${currentSize || 'N/D'}`);
      if (pending) {
        pending.damage.alphaTotal = alpha;
        pending.damage.alpha.energy = alpha;
        pending.damage.maximum = Math.max(pending.damage.maximum, alpha);
        finalizePending();
      }
      continue;
    }

    if (currentSize && !isIgnoredWeaponLine(line) && !line.startsWith('S ')) {
      startPending(line.replace(/\s+View all$/i, ''));
    }
  }

  finalizePending();

  const uniqueWeapons = [];
  const seen = new Set();
  for (const weapon of weapons) {
    const key = [weapon.mount, weapon.size, weapon.name, weapon.damage.sustained60s, weapon.damage.alphaTotal].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueWeapons.push(weapon);
  }

  return combatSummaryFromWeapons(uniqueWeapons, slug ? `Star Citizen Wiki detalle (${slug})` : 'Star Citizen Wiki detalle');
}

async function fetchWikiVehicleDetailedCombat(wikiVehicle) {
  const slug = wikiVehicleSlug(wikiVehicle);
  if (!slug) return null;
  const html = await fetchStarCitizenWikiHtml(`/vehicles/${encodeURIComponent(slug)}`);
  const combat = parseWikiVehiclePageCombat(html, slug);
  return combat.weaponCount ? combat : null;
}

function collectVehicleModules(node, modules = [], pathLabel = '') {
  if (!node || typeof node !== 'object') return modules;

  const item = node.item && typeof node.item === 'object' ? node.item : node;
  const name = textValue(item.name || node.name);
  const type = textValue(item.type || node.type || item.class_name || node.class_name);
  const className = textValue(item.class_name || node.class_name);
  const moduleSignal = [type, className, pathLabel].join(' ');
  const isModule = /(PowerPlant|Cooler|Shield|ShieldGenerator|QuantumDrive|JumpDrive|Fuel|Radar|Scanner|Computer|Avionic|LifeSupport|Battery|Capacitor|Thruster|MissileRack|Utility|Turret|Weapon|Module)/i.test(moduleSignal);

  if (name && isModule) {
    modules.push({
      name,
      type: type || className || 'Modulo',
      className,
      size: Number(item.size || node.size || item.item_size || node.item_size || 0) || null,
      grade: textValue(item.grade || node.grade),
      mount: textValue(node.name || pathLabel),
      category: normalizeModuleCategory(type || className || pathLabel)
    });
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'item') continue;
    if (Array.isArray(value)) {
      for (const child of value) collectVehicleModules(child, modules, node.name || key || pathLabel);
    } else if (value && typeof value === 'object') {
      collectVehicleModules(value, modules, node.name || key || pathLabel);
    }
  }

  return modules;
}

function normalizeModuleCategory(value) {
  const raw = textValue(value, 'Modulo');
  if (/shield/i.test(raw)) return 'Escudos';
  if (/power/i.test(raw)) return 'Plantas de energia';
  if (/cooler/i.test(raw)) return 'Refrigeracion';
  if (/quantum|jump/i.test(raw)) return 'Quantum';
  if (/radar|scanner/i.test(raw)) return 'Sensores';
  if (/fuel/i.test(raw)) return 'Combustible';
  if (/computer|avionic/i.test(raw)) return 'Computadores';
  if (/thruster/i.test(raw)) return 'Propulsion';
  if (/missile/i.test(raw)) return 'Misiles';
  if (/turret/i.test(raw)) return 'Torretas';
  if (/weapon/i.test(raw)) return 'Armas';
  return raw.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function buildModulesSummary(wikiVehicle) {
  const modules = collectVehicleModules(wikiVehicle);
  const groups = new Map();

  for (const module of modules) {
    const key = `${module.category}|${module.size || 'N/D'}`;
    if (!groups.has(key)) {
      groups.set(key, {
        category: module.category,
        size: module.size || 'N/D',
        count: 0,
        examples: []
      });
    }

    const group = groups.get(key);
    group.count += 1;
    if (group.examples.length < 4) group.examples.push(module.name);
  }

  return {
    source: 'Star Citizen Wiki API /vehicles',
    total: modules.length,
    groups: [...groups.values()].sort((a, b) => `${a.category}${a.size}`.localeCompare(`${b.category}${b.size}`, 'es')),
    items: modules
  };
}

function weaponCategory(weapon) {
  return Number(weapon?.size || 0) || null;
}

function weaponDamageValue(weapon, field) {
  return Number(weapon?.damage?.[field] || 0);
}

function groupWeaponsByCategory(weapons) {
  const groups = new Map();

  for (const weapon of weapons) {
    const category = weaponCategory(weapon) || 'N/D';
    const key = String(category);
    if (!groups.has(key)) {
      groups.set(key, {
        category,
        label: category === 'N/D' ? 'Categoria N/D' : `Categoria ${category}`,
        count: 0,
        examples: [],
        damagePerWeapon: { sustained60s: 0, burst: 0, alphaTotal: 0, maximum: 0 },
        damageTotal: { sustained60s: 0, burst: 0, alphaTotal: 0, maximum: 0 }
      });
    }

    const group = groups.get(key);
    group.count += Number(weapon.countOverride || 1);
    if (group.examples.length < 3) group.examples.push(textValue(weapon.name, 'Arma sin nombre'));
    for (const field of Object.keys(group.damageTotal)) {
      const damage = weaponDamageValue(weapon, field);
      group.damageTotal[field] += damage;
      group.damagePerWeapon[field] = Math.max(group.damagePerWeapon[field], damage);
    }
  }

  return [...groups.values()].sort((a, b) => {
    if (a.category === 'N/D') return 1;
    if (b.category === 'N/D') return -1;
    return Number(a.category) - Number(b.category);
  });
}

function compactWikiVehicle(wikiVehicle) {
  if (!wikiVehicle || typeof wikiVehicle !== 'object') return {};
  return {
    uuid: textValue(wikiVehicle.uuid),
    name: textValue(wikiVehicle.name),
    className: textValue(wikiVehicle.class_name),
    gameVersion: textValue(wikiVehicle.game_version || wikiVehicle.version),
    health: Number(wikiVehicle.health || 0) || null,
    armor: Number(wikiVehicle.armor?.health || 0) || null,
    shieldHp: Number(wikiVehicle.shield?.hp || 0) || null,
    manufacturer: textValue(wikiVehicle.manufacturer?.name || wikiVehicle.manufacturer)
  };
}

function collectImageUrls(node, urls = []) {
  if (!node || typeof node !== 'object') return urls;

  for (const [key, value] of Object.entries(node)) {
    if (typeof value === 'string') {
      const isImageKey = /image|photo|thumbnail|media|picture|url/i.test(key);
      const isImageUrl = /^https?:\/\/.+\.(png|jpe?g|webp)(\?.*)?$/i.test(value);
      if (isImageKey && isImageUrl) urls.push(value);
    } else if (Array.isArray(value)) {
      for (const child of value) collectImageUrls(child, urls);
    } else if (value && typeof value === 'object') {
      collectImageUrls(value, urls);
    }
  }

  return [...new Set(urls)];
}

function proxiedImageUrl(url) {
  return url ? `/api/ship-image?url=${encodeURIComponent(url)}` : '';
}

async function enrichVehiclesWithWikiData(vehicles, wikiVehicles = []) {
  const warnings = [];
  const enriched = [];

  for (const vehicle of vehicles) {
    try {
      const wikiVehicle = await fetchWikiVehicleDetail(vehicle, wikiVehicles);
      let combat = wikiVehicle
        ? buildCombatSummary(wikiVehicle)
        : { source: 'Star Citizen Wiki API', available: false, weaponCount: 0, totals: {}, weapons: [] };
      if (wikiVehicle && (combat.weaponCount <= 2 || (!combat.totals?.alphaTotal && !combat.totals?.sustained60s))) {
        try {
          const detailedCombat = await fetchWikiVehicleDetailedCombat(wikiVehicle);
          if (detailedCombat && detailedCombat.weaponCount > combat.weaponCount) {
            combat = detailedCombat;
          }
        } catch (error) {
          warnings.push(`${vehicle.name} detalle Wiki: ${error.message}`);
        }
      }
      const wikiImages = collectImageUrls(wikiVehicle);
      enriched.push({
        vehicle: {
          ...vehicle,
          wiki: {
    uuid: textValue(wikiVehicle?.uuid),
    apiUrl: textValue(wikiVehicle?.uuid) ? `${starCitizenWikiApiBase}/vehicles/${encodeURIComponent(textValue(wikiVehicle.uuid))}` : '',
    gameVersion: textValue(wikiVehicle?.game_version || wikiVehicle?.version),
            health: Number(wikiVehicle?.health || 0) || null,
            armor: Number(wikiVehicle?.armor?.health || 0) || null,
            shieldHp: Number(wikiVehicle?.shield?.hp || 0) || null
          },
          combat,
          wikiImageProxy: wikiImages[0] || vehicle.wikiImageProxy || '',
          imageCandidates: [
            ...(vehicle.photo ? [proxiedImageUrl(vehicle.photo), vehicle.photo] : []),
            ...wikiImages.flatMap((url) => [proxiedImageUrl(url), url])
          ].filter(Boolean)
        },
        wikiVehicle,
        combat
      });
    } catch (error) {
      warnings.push(`${vehicle.name}: ${error.message}`);
      const combat = { source: 'Star Citizen Wiki API', available: false, weaponCount: 0, totals: {}, weapons: [] };
      enriched.push({ vehicle: { ...vehicle, combat }, wikiVehicle: null, combat });
    }
  }

  return { vehicles: enriched.map((entry) => entry.vehicle), details: enriched, warnings };
}

function stableWikiVehicleId(wikiVehicle) {
  const seed = textValue(wikiVehicle.uuid || wikiVehicle.id || wikiVehicle.name, crypto.randomUUID());
  const hash = crypto.createHash('sha1').update(seed).digest();
  return 900000000 + (hash.readUInt32BE(0) % 99999999);
}

function firstNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return 0;
}

function wikiManufacturerName(wikiVehicle) {
  const manufacturer = wikiVehicle.manufacturer || wikiVehicle.company || wikiVehicle.manufacturers?.[0];
  return textValue(manufacturer?.name || manufacturer, 'Fabricante desconocido');
}

function wikiCrewLabel(wikiVehicle) {
  const crew = wikiVehicle.crew || {};
  const min = firstNumber(crew.min, crew.minimum, wikiVehicle.crew_min);
  const max = firstNumber(crew.max, crew.maximum, wikiVehicle.crew_max);
  if (min && max && min !== max) return `${min}-${max}`;
  return textValue(min || max || wikiVehicle.crew, 'N/D');
}

function isDisplayableWikiVehicle(wikiVehicle) {
  const name = textValue(wikiVehicle?.name || wikiVehicle?.name_full).trim();
  if (!name) return false;
  const text = [wikiVehicle.type, wikiVehicle.class_name, wikiVehicle.size, wikiVehicle.production_status].map((value) => textValue(value)).join(' ').toLowerCase();
  const hasVehicleSignal = /ship|vehicle|snub|capital|large|medium|small|ground|spaceship/i.test(text)
    || wikiVehicle.is_spaceship === true
    || wikiVehicle.is_vehicle === true;
  const length = firstNumber(wikiVehicle.length, wikiVehicle.dimensions?.length, wikiVehicle.dimension?.length);
  return hasVehicleSignal && length > 0;
}

function normalizeWikiVehicle(wikiVehicle) {
  const imageUrls = collectImageUrls(wikiVehicle);
  const length = firstNumber(wikiVehicle.length, wikiVehicle.dimensions?.length, wikiVehicle.dimension?.length);
  const width = firstNumber(wikiVehicle.width, wikiVehicle.beam, wikiVehicle.dimensions?.beam, wikiVehicle.dimensions?.width, wikiVehicle.dimension?.width);
  const height = firstNumber(wikiVehicle.height, wikiVehicle.dimensions?.height, wikiVehicle.dimension?.height);
  const combat = buildCombatSummary(wikiVehicle);

  return {
    id: stableWikiVehicleId(wikiVehicle),
    uuid: textValue(wikiVehicle.uuid || wikiVehicle.id),
    name: textValue(wikiVehicle.name || wikiVehicle.name_full, 'Nave sin nombre'),
    shortName: textValue(wikiVehicle.name || wikiVehicle.name_full, 'Nave sin nombre'),
    manufacturer: wikiManufacturerName(wikiVehicle),
    crew: wikiCrewLabel(wikiVehicle),
    scu: firstNumber(wikiVehicle.cargo_capacity, wikiVehicle.cargo, wikiVehicle.scu),
    mass: firstNumber(wikiVehicle.mass, wikiVehicle.mass_kg),
    width,
    height,
    length,
    padType: textValue(wikiVehicle.size || wikiVehicle.pad_type, 'N/D'),
    gameVersion: textValue(wikiVehicle.game_version || wikiVehicle.version),
    photo: imageUrls[0] || '',
    photoProxy: proxiedImageUrl(imageUrls[0]),
    wikiImageProxy: imageUrls[0] || '',
    imageCandidates: imageUrls.flatMap((url) => [proxiedImageUrl(url), url]).filter(Boolean),
    storeUrl: '',
    tags: ['Nave', 'Wiki'].filter(Boolean),
    pledge: { price: null, warbond: null, currency: 'USD', onSale: false },
    purchase: { price: null, locations: [] },
    rental: { price: null, locations: [] },
    wiki: {
      uuid: textValue(wikiVehicle.uuid || wikiVehicle.id),
      apiUrl: textValue(wikiVehicle.uuid) ? `${starCitizenWikiApiBase}/vehicles/${encodeURIComponent(textValue(wikiVehicle.uuid))}` : '',
      gameVersion: textValue(wikiVehicle.game_version || wikiVehicle.version),
      health: Number(wikiVehicle.health || 0) || null,
      armor: Number(wikiVehicle.armor?.health || 0) || null,
      shieldHp: Number(wikiVehicle.shield?.hp || 0) || null
    },
    combat,
    flags: {
      addon: false,
      docking: false,
      loadingDock: false,
      concept: /concept/i.test(textValue(wikiVehicle.production_status || wikiVehicle.status)),
      quantum: true,
      spaceship: true,
      ground: /ground|vehicle/i.test(textValue(wikiVehicle.type || wikiVehicle.class_name)) && !/ship|spaceship/i.test(textValue(wikiVehicle.type || wikiVehicle.class_name)),
      wikiSupplement: true
    }
  };
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
    uuid: vehicle.uuid || '',
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
    photoProxy: proxiedImageUrl(photo),
    wikiImageProxy: '',
    imageCandidates: [proxiedImageUrl(photo), photo].filter(Boolean),
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
      addon: Number(vehicle.is_addon || 0) === 1,
      docking: Number(vehicle.is_docking || 0) === 1,
      loadingDock: Number(vehicle.is_loading_dock || 0) === 1,
      concept: Number(vehicle.is_concept || 0) === 1,
      quantum: Number(vehicle.is_quantum_capable || 0) === 1,
      spaceship: Number(vehicle.is_spaceship || 0) === 1,
      ground: Number(vehicle.is_ground_vehicle || 0) === 1
    }
  };
}

function isDisplayableUexVehicle(vehicle) {
  const isVehicle = Number(vehicle.is_spaceship || 0) === 1 || Number(vehicle.is_ground_vehicle || 0) === 1;
  const isExcludedObject = [
    vehicle.is_addon,
    vehicle.is_docking,
    vehicle.is_loading_dock
  ].some((value) => Number(value || 0) === 1);
  const hasPhysicalSize = Number(vehicle.length || 0) > 0 && Number(vehicle.width || 0) > 0;
  return isVehicle && !isExcludedObject && hasPhysicalSize;
}

function isDisplayableCachedVehicle(vehicle) {
  const raw = vehicle.raw || {};
  if (Object.keys(raw).length) return isDisplayableUexVehicle(raw);

  const isVehicle = Boolean(vehicle.flags?.spaceship || vehicle.flags?.ground);
  const isExcludedObject = Boolean(vehicle.flags?.addon || vehicle.flags?.docking || vehicle.flags?.loadingDock);
  return isVehicle && !isExcludedObject && Number(vehicle.length || 0) > 0;
}

async function buildVehiclesPayloadFromUex({ enrichDetails = true } = {}) {
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
  let wikiVehicles = [];

  if (enrichDetails) {
    try {
      wikiVehicles = await fetchWikiVehiclesList();
    } catch (error) {
      warnings.push(`Star Citizen Wiki: ${error.message}`);
    }
  }

  let normalized = vehicles
    .filter(isDisplayableUexVehicle)
    .map((vehicle) => normalizeVehicle(vehicle, pledgePrices, purchasePrices, rentalPrices))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const rawById = new Map(vehicles.map((vehicle) => [Number(vehicle.id), vehicle]));
  const enrichment = enrichDetails
    ? await enrichVehiclesWithWikiData(normalized, wikiVehicles)
    : { vehicles: normalized, details: normalized.map((vehicle) => ({ vehicle, wikiVehicle: null, combat: vehicle.combat || {} })), warnings: [] };
  normalized = enrichment.vehicles;
  const existingNames = new Set(normalized.flatMap((vehicle) => [vehicle.name, vehicle.shortName].filter(Boolean).map(normalizeComparableName)));
  const supplementalDetails = [];

  for (const wikiVehicle of wikiVehicles) {
    const wikiName = normalizeComparableName(textValue(wikiVehicle.name || wikiVehicle.name_full));
    if (!wikiName || existingNames.has(wikiName) || !isDisplayableWikiVehicle(wikiVehicle)) continue;
    const vehicle = normalizeWikiVehicle(wikiVehicle);
    normalized.push(vehicle);
    existingNames.add(wikiName);
    supplementalDetails.push({ vehicle, wikiVehicle, combat: vehicle.combat || {} });
  }

  normalized.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const allDetails = [...enrichment.details, ...supplementalDetails];

  const pledgeById = new Map(pledgePrices.map((price) => [Number(price.id_vehicle), price]));
  const purchasesById = groupByVehicleId(purchasePrices);
  const rentalsById = groupByVehicleId(rentalPrices);

  return {
    source: 'UEX Corp API 2.0',
    loadedAt: new Date().toISOString(),
    count: normalized.length,
    warnings: [...warnings, ...enrichment.warnings],
    vehicles: normalized,
    raw: {
      vehiclesRows: vehicles,
      pledgePricesRows: pledgePrices,
      purchasePricesRows: purchasePrices,
      rentalPricesRows: rentalPrices,
      wikiVehiclesRows: wikiVehicles,
      vehicles: new Map([...rawById, ...supplementalDetails.map((entry) => [Number(entry.vehicle.id), {}])]),
      wikiVehicles: new Map(allDetails.map((entry) => [Number(entry.vehicle.id), entry.wikiVehicle || {}])),
      combat: new Map(allDetails.map((entry) => [Number(entry.vehicle.id), entry.combat || {}])),
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

async function recordApiSyncRun(source, status, message = '') {
  await runSql(`
    INSERT INTO api_sync_runs (source, status, message, finished_at)
    VALUES (${sql(source)}, ${sql(status)}, ${sql(String(message || '').slice(0, 500))}, CURRENT_TIMESTAMP)
  `);
}

function uexRowIdentifier(row, fallbackIndex) {
  if (row?.id || row?.uuid || row?.id_vehicle_terminal) {
    return String(row.id || row.uuid || row.id_vehicle_terminal);
  }

  return crypto
    .createHash('sha1')
    .update(JSON.stringify(row || {}) || String(fallbackIndex))
    .digest('hex');
}

function uexVehicleIdForResource(resource, row) {
  if (resource === 'vehicles') return Number(row?.id || 0) || null;
  return Number(row?.id_vehicle || 0) || null;
}

async function saveUexResourceRows(resource, rows, syncedAt) {
  if (!Array.isArray(rows)) return;
  await runSql(`DELETE FROM uex_api_cache WHERE resource = ${sql(resource)}`);

  if (!rows.length) {
    return;
  }

  for (const [index, row] of rows.entries()) {
    await runSql(`
      INSERT INTO uex_api_cache (resource, resource_row_id, vehicle_id, payload_json, synced_at)
      VALUES (
        ${sql(resource)},
        ${sql(uexRowIdentifier(row, index))},
        ${uexVehicleIdForResource(resource, row) || 'NULL'},
        ${sql(encodeDbJson(row || {}))},
        ${sql(syncedAt)}
      )
      ON DUPLICATE KEY UPDATE
        vehicle_id = VALUES(vehicle_id),
        payload_json = VALUES(payload_json),
        synced_at = VALUES(synced_at)
    `);
  }
}

async function saveExternalApiCaches(payload, syncedAt) {
  const raw = payload.raw || {};
  await saveUexResourceRows('vehicles', raw.vehiclesRows || [], syncedAt);
  await saveUexResourceRows('vehicles_prices', raw.pledgePricesRows || [], syncedAt);
  await saveUexResourceRows('vehicles_purchases_prices_all', raw.purchasePricesRows || [], syncedAt);
  await saveUexResourceRows('vehicles_rentals_prices_all', raw.rentalPricesRows || [], syncedAt);
  await saveUexResourceRows('star_citizen_wiki_vehicles', raw.wikiVehiclesRows || [], syncedAt);

  for (const vehicle of payload.vehicles) {
    const id = Number(vehicle.id);
    const wikiPayload = raw.wikiVehicles?.get(id) || {};
    const combatPayload = raw.combat?.get(id) || vehicle.combat || {};
    const hasWikiPayload = wikiPayload && Object.keys(wikiPayload).length > 0;

    await runSql(`
      INSERT INTO star_citizen_wiki_vehicle_cache
        (vehicle_id, wiki_uuid, name, status, error_message, payload_json, synced_at)
      VALUES
        (${id}, ${sql(wikiPayload.uuid || vehicle.wiki?.uuid || '')}, ${sql(vehicle.name)},
         ${sql(hasWikiPayload ? 'ok' : 'missing')}, NULL,
         ${hasWikiPayload ? sql(encodeDbJson(wikiPayload)) : 'NULL'}, ${sql(syncedAt)})
      ON DUPLICATE KEY UPDATE
        wiki_uuid = VALUES(wiki_uuid),
        name = VALUES(name),
        status = VALUES(status),
        error_message = VALUES(error_message),
        payload_json = VALUES(payload_json),
        synced_at = VALUES(synced_at)
    `);

    await runSql(`
      INSERT INTO vehicle_combat_cache (vehicle_id, payload_json, synced_at)
      VALUES (${id}, ${sql(encodeDbJson(combatPayload || {}))}, ${sql(syncedAt)})
      ON DUPLICATE KEY UPDATE
        payload_json = VALUES(payload_json),
        synced_at = VALUES(synced_at)
    `);
  }
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
      sql(encodeDbJson(vehicle)),
      sql(encodeDbJson(payload.raw.vehicles.get(id) || {})),
      sql(encodeDbJson(compactWikiVehicle(payload.raw.wikiVehicles.get(id)))),
      sql(encodeDbJson(payload.raw.combat.get(id) || vehicle.combat || {})),
      sql(encodeDbJson(payload.raw.pledgePrices.get(id) || {})),
      sql(encodeDbJson(payload.raw.purchasePrices.get(id) || [])),
      sql(encodeDbJson(payload.raw.rentalPrices.get(id) || [])),
      sql(vehicle.combat ? syncedAt : null),
      sql(syncedAt)
    ];
  });

  for (let index = 0; index < rows.length; index += 1) {
    chunks.push(rows.slice(index, index + 1));
  }

  for (const chunk of chunks) {
    await runSql(`
      INSERT INTO uex_vehicle_cache (
        id, name, manufacturer, pad_type, length_m, scu, pledge_price, purchase_price, rental_price,
        is_concept, vehicle_json, raw_vehicle_json, wiki_vehicle_json, combat_json,
        pledge_json, purchase_json, rental_json, details_synced_at, synced_at
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
        wiki_vehicle_json = VALUES(wiki_vehicle_json),
        combat_json = VALUES(combat_json),
        pledge_json = VALUES(pledge_json),
        purchase_json = VALUES(purchase_json),
        rental_json = VALUES(rental_json),
        details_synced_at = VALUES(details_synced_at),
        synced_at = VALUES(synced_at)
    `);
  }

  if (payload.vehicles.length) {
    await runSql(`DELETE FROM uex_vehicle_cache WHERE id NOT IN (${payload.vehicles.map((vehicle) => Number(vehicle.id)).join(', ')})`);
  }

  await setSetting('vehicles_synced_at', syncedAt);
  await saveExternalApiCaches(payload, syncedAt);
  await recordApiSyncRun('vehicles', 'ok', `Sincronizadas ${payload.vehicles.length} naves desde UEX y Wiki.`);
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

  const vehicles = rows
    .map((row) => decodeDbJson(row.vehicle_json, {}))
    .filter(isDisplayableCachedVehicle);
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

async function readVehicleDetailFromDatabase(identifier) {
  const decoded = decodeURIComponent(String(identifier || '')).trim();
  if (!decoded) return null;
  const numericId = Number(decoded.match(/^\d+/)?.[0] || decoded);
  const nameMatch = normalizeComparableName(decoded);
  const where = Number.isFinite(numericId) && numericId > 0
    ? `id = ${numericId}`
    : `LOWER(REPLACE(REPLACE(REPLACE(name, ' ', '-'), '/', '-'), '.', '')) = ${sql(nameMatch.replace(/\s+/g, '-'))}`;
  let rows = await queryRows(`
    SELECT c.id, c.name, c.vehicle_json, c.raw_vehicle_json, c.wiki_vehicle_json, c.combat_json,
           c.pledge_json, c.purchase_json, c.rental_json,
           u.payload_json AS uex_vehicle_api_json,
           wp.payload_json AS wiki_api_json,
           vc.payload_json AS combat_cache_json,
           DATE_FORMAT(c.synced_at, '%Y-%m-%d %H:%i:%s') AS synced_at,
           DATE_FORMAT(c.details_synced_at, '%Y-%m-%d %H:%i:%s') AS details_synced_at,
           DATE_FORMAT(wp.synced_at, '%Y-%m-%d %H:%i:%s') AS wiki_synced_at,
           DATE_FORMAT(vc.synced_at, '%Y-%m-%d %H:%i:%s') AS combat_synced_at
    FROM uex_vehicle_cache c
    LEFT JOIN uex_api_cache u
      ON u.resource = 'vehicles' AND u.vehicle_id = c.id
    LEFT JOIN star_citizen_wiki_vehicle_cache wp
      ON wp.vehicle_id = c.id
    LEFT JOIN vehicle_combat_cache vc
      ON vc.vehicle_id = c.id
    WHERE ${where.replace(/\bid\b/g, 'c.id').replace(/\bname\b/g, 'c.name')}
    LIMIT 1
  `);

  if (!rows.length && !Number.isFinite(numericId)) {
    const allRows = await queryRows(`
      SELECT c.id, c.name, c.vehicle_json, c.raw_vehicle_json, c.wiki_vehicle_json, c.combat_json,
             c.pledge_json, c.purchase_json, c.rental_json,
             u.payload_json AS uex_vehicle_api_json,
             wp.payload_json AS wiki_api_json,
             vc.payload_json AS combat_cache_json,
             DATE_FORMAT(c.synced_at, '%Y-%m-%d %H:%i:%s') AS synced_at,
             DATE_FORMAT(c.details_synced_at, '%Y-%m-%d %H:%i:%s') AS details_synced_at,
             DATE_FORMAT(wp.synced_at, '%Y-%m-%d %H:%i:%s') AS wiki_synced_at,
             DATE_FORMAT(vc.synced_at, '%Y-%m-%d %H:%i:%s') AS combat_synced_at
      FROM uex_vehicle_cache c
      LEFT JOIN uex_api_cache u
        ON u.resource = 'vehicles' AND u.vehicle_id = c.id
      LEFT JOIN star_citizen_wiki_vehicle_cache wp
        ON wp.vehicle_id = c.id
      LEFT JOIN vehicle_combat_cache vc
        ON vc.vehicle_id = c.id
    `);
    rows = allRows.filter((row) => normalizeComparableName(row.name) === nameMatch).slice(0, 1);
  }

  if (!rows.length) return null;

  const row = rows[0];
  const vehicle = decodeDbJson(row.vehicle_json, {});
  const rawVehicle = decodeDbJson(row.uex_vehicle_api_json, decodeDbJson(row.raw_vehicle_json, {}));
  const wiki = decodeDbJson(row.wiki_api_json, decodeDbJson(row.wiki_vehicle_json, {}));
  const combat = decodeDbJson(row.combat_cache_json, decodeDbJson(row.combat_json, vehicle.combat || {}));
  return {
    source: 'Base de datos local',
    syncedAt: row.synced_at || '',
    detailsSyncedAt: row.details_synced_at || row.wiki_synced_at || row.combat_synced_at || '',
    vehicle,
    raw: rawVehicle,
    wiki,
    combat,
    prices: {
      pledge: decodeDbJson(row.pledge_json, {}),
      purchase: decodeDbJson(row.purchase_json, []),
      rental: decodeDbJson(row.rental_json, [])
    },
    curiosity: buildVehicleCuriosity(vehicle, combat)
  };
}

function safeJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function buildVehicleCuriosity(vehicle, combat) {
  const facts = [];
  if (vehicle.length && vehicle.width) {
    const footprint = Math.round(Number(vehicle.length) * Number(vehicle.width));
    facts.push(`Su huella aproximada ocupa ${footprint.toLocaleString('es-ES')} m2 si proyectas largo por ancho.`);
  }
  if (vehicle.scu) facts.push(`Puede mover ${Number(vehicle.scu).toLocaleString('es-ES')} SCU, suficiente para convertir cada viaje en una pequena ruta comercial.`);
  if (combat?.available && combat.weaponCount) facts.push(`Su loadout detectado suma ${combat.weaponCount} armas de hardpoint en los datos de Star Citizen Wiki.`);
  if (vehicle.flags?.concept) facts.push('Figura como concept, asi que conviene tratar sus cifras como una promesa de diseno y no como rendimiento final.');
  if (vehicle.flags?.ground) facts.push('Aunque aparece en el catalogo de vehiculos, su uso principal es terrestre, ideal para comparar por rol y no solo por tamano.');
  return facts[0] || 'No destaca por una cifra extrema concreta, pero eso suele ser buena senal para una nave equilibrada.';
}

async function countVehiclesInDatabase() {
  const rows = await queryRows('SELECT COUNT(*) AS total FROM uex_vehicle_cache');
  return Number(rows[0]?.total || 0);
}

async function syncVehiclesFromUex({ enrichDetails = true } = {}) {
  try {
    const payload = await buildVehiclesPayloadFromUex({ enrichDetails });
    await saveVehiclesToDatabase(payload);
    const localPayload = await readVehiclesFromDatabase();
    return {
      ...localPayload,
      source: 'Base de datos local, sincronizada desde UEX',
      warnings: payload.warnings
    };
  } catch (error) {
    try {
      await recordApiSyncRun('vehicles', 'error', error.message);
    } catch {
      // If MySQL logging fails, keep the original API/database error visible.
    }
    throw error;
  }
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
    const payload = await syncVehiclesFromUex({ enrichDetails: false });
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

async function getCurrentUser(request) {
  const sessionToken = parseCookies(request)[sessionCookieName];
  if (!sessionToken) return null;

  const rows = await queryRows(`
    SELECT u.id, u.username, u.email, u.role, u.password_hash, COALESCE(u.discord_id, '') AS discord_id,
      COALESCE(u.discord_avatar_hash, '') AS discord_avatar_hash, COALESCE(u.discord_avatar, '') AS discord_avatar,
      COALESCE(u.auth_provider, 'local') AS auth_provider,
      DATE_FORMAT(u.last_login_at, '%Y-%m-%d %H:%i:%s') AS last_login_at,
      DATE_FORMAT(u.created_at, '%Y-%m-%d %H:%i:%s') AS created_at
    FROM user_sessions s
    INNER JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${sql(hashToken(sessionToken))}
      AND s.expires_at > CURRENT_TIMESTAMP
    LIMIT 1
  `);
  return rows[0] || null;
}

function serializeUser(user) {
  const role = publicRole(user.role);
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: role.label,
    roleKey: role.key,
    roleLevel: role.level,
    permissions: role.permissions,
    provider: user.auth_provider || 'local',
    discordAvatar: discordAvatarUrl(user),
    lastLoginAt: user.last_login_at ? formatDate(user.last_login_at.replace(' ', 'T')) : '',
    createdAt: user.created_at ? formatDate(user.created_at.replace(' ', 'T')) : ''
  };
}

function discordAvatarUrl(user) {
  const discordId = String(user.discord_id || user.id || '');
  const avatarHash = String(user.avatar || user.discord_avatar_hash || extractDiscordAvatarHash(user.discord_avatar) || '');
  if (!discordId || !avatarHash) return user.discord_avatar || '';

  const extension = avatarHash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.${extension}?size=128`;
}

function extractDiscordAvatarHash(url) {
  const match = String(url || '').match(/\/avatars\/\d+\/([^.?/]+)/);
  return match?.[1] || '';
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
  const avatarHash = String(discordUser.avatar || '');
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
          discord_avatar_hash = ${sql(avatarHash)},
          discord_avatar = ${sql(avatar)},
          auth_provider = 'discord',
          last_login_at = CURRENT_TIMESTAMP
      WHERE id = ${sql(rows[0].id)}
    `);
    return rows[0].id;
  }

  const id = crypto.randomUUID();
  await runSql(`
    INSERT INTO users (id, username, email, role, password_hash, discord_id, discord_avatar_hash, discord_avatar, auth_provider, last_login_at)
    VALUES (${sql(id)}, ${sql(username)}, ${sql(email)}, 'Piloto', 'discord-oauth', ${sql(discordId)}, ${sql(avatarHash)}, ${sql(avatar)}, 'discord', CURRENT_TIMESTAMP)
  `);
  return id;
}

async function readState(request) {
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
  const currentUser = await getCurrentUser(request);

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
    sessionUserId: currentUser?.id || null,
    roles: roleDefinitions.map(({ key, label, level, permissions }) => ({ key, label, level, permissions })),
    content,
    interactions: { votes, comments }
  };
}

async function requireUser(request, response) {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    sendJson(response, 401, { error: 'Necesitas iniciar sesion para hacer esto.' });
    return null;
  }
  return currentUser;
}

async function requirePermission(request, response, permission) {
  const currentUser = await requireUser(request, response);
  if (!currentUser) return null;

  if (!hasPermission(currentUser, permission)) {
    sendJson(response, 403, { error: 'No tienes permisos para realizar esta accion.' });
    return null;
  }

  return currentUser;
}

async function readAdminState() {
  const users = await queryRows(`
    SELECT id, username, email, role, COALESCE(discord_id, '') AS discord_id,
      COALESCE(discord_avatar_hash, '') AS discord_avatar_hash, COALESCE(discord_avatar, '') AS discord_avatar,
      COALESCE(auth_provider, 'local') AS auth_provider,
      DATE_FORMAT(last_login_at, '%Y-%m-%d %H:%i:%s') AS last_login_at,
      DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
    FROM users
    ORDER BY created_at DESC
  `);
  const content = await queryRows(`
    SELECT id, section, title, author_name, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
    FROM content_items
    ORDER BY created_at DESC
  `);
  const images = await queryRows(`
    SELECT ci.id, ci.content_id, ci.image_name, c.title
    FROM content_images ci
    INNER JOIN content_items c ON c.id = ci.content_id
    ORDER BY ci.created_at DESC, ci.id DESC
  `);

  return {
    roles: roleDefinitions.map(({ key, label, level, permissions }) => ({ key, label, level, permissions })),
    users: users.map(serializeUser),
    content: content.map((item) => ({
      id: item.id,
      section: item.section,
      title: item.title,
      author: item.author_name,
      createdAt: item.created_at ? formatDate(item.created_at.replace(' ', 'T')) : ''
    })),
    images: images.map((image) => ({
      id: Number(image.id),
      contentId: image.content_id,
      name: image.image_name,
      title: image.title
    }))
  };
}

async function handleApi(request, response, pathname) {
  if (request.method === 'GET' && pathname === '/api/auth/discord') {
    if (!discordClientId || !discordClientSecret) {
      redirect(response, `${appRoutes.login}?error=discord_config`);
      return;
    }

    const state = crypto.randomBytes(18).toString('hex');
    const url = new URL('https://discord.com/oauth2/authorize');
    url.search = new URLSearchParams({
      client_id: discordClientId,
      response_type: 'code',
      redirect_uri: discordRedirectUri,
      scope: 'identify email',
      state
    }).toString();
    redirect(response, url.toString(), {
      'Set-Cookie': cookieHeader(oauthStateCookieName, state, { maxAge: oauthStateMaxAgeSeconds })
    });
    return;
  }

  if (request.method === 'GET' && pathname === '/api/auth/discord/callback') {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    const code = String(requestUrl.searchParams.get('code') || '');
    const state = String(requestUrl.searchParams.get('state') || '');
    const expectedState = parseCookies(request)[oauthStateCookieName] || '';

    if (!code || !state || state !== expectedState) {
      redirect(response, `${appRoutes.login}?error=discord_state`, {
        'Set-Cookie': clearCookieHeader(oauthStateCookieName)
      });
      return;
    }

    try {
      const token = await fetchDiscordToken(code);
      const discordUser = await fetchDiscordUser(token.access_token);
      const userId = await loginWithDiscordUser(discordUser);
      const sessionToken = await createUserSession(userId);
      redirect(response, appRoutes.profile, {
        'Set-Cookie': [
          cookieHeader(sessionCookieName, sessionToken, { maxAge: sessionMaxAgeSeconds }),
          clearCookieHeader(oauthStateCookieName)
        ]
      });
    } catch (error) {
      console.warn(`Login Discord fallido: ${error.message}`);
      redirect(response, `${appRoutes.login}?error=discord_login`, {
        'Set-Cookie': clearCookieHeader(oauthStateCookieName)
      });
    }
    return;
  }

  if (request.method === 'GET' && pathname === '/api/vehicles') {
    sendJson(response, 200, await readVehicles());
    return;
  }

  if (request.method === 'GET' && pathname.startsWith('/api/vehicles/')) {
    const identifier = pathname.slice('/api/vehicles/'.length);
    const detail = await readVehicleDetailFromDatabase(identifier);
    if (!detail) {
      sendJson(response, 404, { error: 'Nave no encontrada en la base de datos local.' });
      return;
    }
    sendJson(response, 200, detail);
    return;
  }

  if (request.method === 'POST' && pathname === '/api/vehicles/sync') {
    const currentUser = await requirePermission(request, response, 'ships.sync');
    if (!currentUser) return;
    sendJson(response, 200, await readVehicles({ forceSync: true }));
    return;
  }

  if (request.method === 'GET' && pathname === '/api/state') {
    sendJson(response, 200, await readState(request));
    return;
  }

  if (request.method === 'GET' && pathname === '/api/admin/state') {
    const currentUser = await requirePermission(request, response, 'admin.access');
    if (!currentUser) return;
    sendJson(response, 200, await readAdminState());
    return;
  }

  if (request.method === 'PATCH' && pathname.startsWith('/api/admin/users/') && pathname.endsWith('/role')) {
    const currentUser = await requirePermission(request, response, 'users.manage');
    if (!currentUser) return;
    const userId = decodeURIComponent(pathname.split('/')[4] || '');
    const body = await readBody(request);
    const targetRole = getRole(body.role);
    const currentRole = getRole(currentUser.role);

    if (targetRole.key === 'administrador' && !hasPermission(currentUser, 'users.manage.admins')) {
      sendJson(response, 403, { error: 'Solo un Administrador puede asignar el rol Administrador.' });
      return;
    }

    if (targetRole.level >= currentRole.level && !hasPermission(currentUser, 'users.manage.admins')) {
      sendJson(response, 403, { error: 'No puedes asignar un rol igual o superior al tuyo.' });
      return;
    }

    await runSql(`UPDATE users SET role = ${sql(targetRole.label)} WHERE id = ${sql(userId)}`);
    sendJson(response, 200, await readAdminState());
    return;
  }

  if (request.method === 'DELETE' && pathname.startsWith('/api/admin/content/')) {
    const currentUser = await requirePermission(request, response, 'content.moderate');
    if (!currentUser) return;
    const contentId = decodeURIComponent(pathname.split('/')[4] || '');
    await runSql(`DELETE FROM content_items WHERE id = ${sql(contentId)}`);
    sendJson(response, 200, await readAdminState());
    return;
  }

  if (request.method === 'DELETE' && pathname.startsWith('/api/admin/images/')) {
    const currentUser = await requirePermission(request, response, 'images.delete');
    if (!currentUser) return;
    const imageId = Number(pathname.split('/')[4] || 0);
    await runSql(`DELETE FROM content_images WHERE id = ${Number.isFinite(imageId) ? imageId : 0}`);
    sendJson(response, 200, await readAdminState());
    return;
  }

  if (request.method === 'POST' && pathname === '/api/register') {
    sendJson(response, 410, { error: 'El registro local esta desactivado. Usa Discord para acceder.' });
    return;
  }

  if (request.method === 'POST' && pathname === '/api/login') {
    sendJson(response, 410, { error: 'El inicio local esta desactivado. Usa Discord para acceder.' });
    return;
  }

  if (request.method === 'POST' && pathname === '/api/logout') {
    await destroyUserSession(parseCookies(request)[sessionCookieName]);
    sendJson(response, 200, await readState(request), {
      'Set-Cookie': clearCookieHeader(sessionCookieName)
    });
    return;
  }

  if (request.method === 'POST' && pathname === '/api/content') {
    const body = await readBody(request);
    const section = String(body.section || '');
    const title = String(body.title || '').trim();
    const content = String(body.content || '').trim();
    const contentHtml = String(body.contentHtml || '').trim();
    const images = Array.isArray(body.images) ? body.images.slice(0, 8) : [];
    const currentUser = await getCurrentUser(request);

    if (!['forum', 'guides', 'news'].includes(section) || !title || (!content && !contentHtml)) {
      sendJson(response, 400, { error: 'Contenido incompleto.' });
      return;
    }

    if (!currentUser) {
      sendJson(response, 403, { error: 'Necesitas iniciar sesión para publicar.' });
      return;
    }

    if (!hasPermission(currentUser, 'content.publish')) {
      sendJson(response, 403, { error: 'Tu rol no permite publicar contenido.' });
      return;
    }

    if (section === 'guides' && !hasPermission(currentUser, 'content.publish.guides')) {
      sendJson(response, 403, { error: 'Tu rol no permite publicar guias.' });
      return;
    }

    if (images.length && !hasPermission(currentUser, 'content.upload.images')) {
      sendJson(response, 403, { error: 'Tu rol no permite subir capturas.' });
      return;
    }

    const id = crypto.randomUUID();
    const cleanContent = content || contentHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const authorName = currentUser.username;
    const publishedLabel = formatDate(new Date());

    await runSql(
      `INSERT INTO content_items
       (id, section, title, content, content_html, author_user_id, author_name, published_label)
       VALUES (${sql(id)}, ${sql(section)}, ${sql(title)}, ${sql(cleanContent)}, ${sql(contentHtml)}, ${sql(currentUser.id)}, ${sql(authorName)}, ${sql(publishedLabel)})`
    );

    for (const [index, image] of images.entries()) {
      await runSql(
        `INSERT INTO content_images (content_id, image_name, image_src, sort_order)
         VALUES (${sql(id)}, ${sql(String(image.name || title).slice(0, 180))}, ${sql(String(image.src || ''))}, ${Number(index)})`
      );
    }

    sendJson(response, 201, await readState(request));
    return;
  }

  if (request.method === 'POST' && pathname === '/api/vote') {
    const body = await readBody(request);
    const postId = String(body.postId || '');
    const vote = Number(body.vote);
    const currentUser = await getCurrentUser(request);

    if (!postId || ![-1, 1].includes(vote)) {
      sendJson(response, 400, { error: 'Voto invalido.' });
      return;
    }

    if (!currentUser) {
      sendJson(response, 403, { error: 'Necesitas iniciar sesion para votar.' });
      return;
    }

    if (!hasPermission(currentUser, 'content.vote')) {
      sendJson(response, 403, { error: 'Tu rol no permite votar.' });
      return;
    }

    const voterKey = currentUser.id;
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

    sendJson(response, 200, await readState(request));
    return;
  }

  if (request.method === 'POST' && pathname === '/api/comment') {
    const body = await readBody(request);
    const postId = String(body.postId || '');
    const text = String(body.text || '').trim();
    const currentUser = await getCurrentUser(request);

    if (!postId || !text) {
      sendJson(response, 400, { error: 'Comentario incompleto.' });
      return;
    }

    if (!currentUser) {
      sendJson(response, 403, { error: 'Necesitas iniciar sesion para comentar.' });
      return;
    }

    if (!hasPermission(currentUser, 'content.comment')) {
      sendJson(response, 403, { error: 'Tu rol no permite comentar.' });
      return;
    }

    await runSql(
      `INSERT INTO comments
       (id, content_id, author_user_id, author_name, comment_text, published_label)
       VALUES (${sql(crypto.randomUUID())}, ${sql(postId)}, ${sql(currentUser.id)}, ${sql(currentUser.username)}, ${sql(text)}, ${sql(formatDate(new Date()))})`
    );

    sendJson(response, 201, await readState(request));
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
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
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
