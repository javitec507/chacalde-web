// chacalde.com — static site + anonymous counters + /admin panel. No dependencies.
import http from 'node:http';
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, extname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, gzipSync, constants as zc } from 'node:zlib';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Metrics, EVENTS, dayKey, lastDays } from './metrics.mjs';
import { renderDashboard, renderDisabled, renderLogin, toCsv, RANGES } from './admin.mjs';

const PORT = Number(process.env.PORT || 80);
const DIST = process.env.DIST_DIR || fileURLToPath(new URL('../dist', import.meta.url));
const DATA = process.env.DATA_DIR || '/data';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_ENABLED = ADMIN_PASSWORD.length >= 12;
const SESSION_DAYS = 7;
// In production the admin only answers on HTTPS at this origin (never on Coolify's http test URL).
const ADMIN_ORIGIN = process.env.ADMIN_ORIGIN || 'https://chacalde.com';
const PROD = process.env.NODE_ENV === 'production';

// ---------- static files, loaded into memory once ----------
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.pdf': 'application/pdf',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};
const COMPRESS = new Set(['.html', '.js', '.css', '.json', '.svg', '.ttf', '.pdf', '.txt', '.xml']);
const LONG_CACHE = new Set(['.jpg', '.jpeg', '.png', '.svg', '.woff2', '.ttf', '.pdf', '.ico', '.mp3']);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = new Map();
for (const abs of walk(DIST)) {
  const url = `/${relative(DIST, abs).split(sep).join('/')}`;
  const ext = extname(abs).toLowerCase();
  const buf = readFileSync(abs);
  const f = {
    buf,
    type: TYPES[ext] || 'application/octet-stream',
    etag: `"${createHash('sha1').update(buf).digest('hex').slice(0, 20)}"`,
    cache: url.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : LONG_CACHE.has(ext) ? 'public, max-age=2592000' : 'no-cache'
  };
  if (COMPRESS.has(ext) && buf.length > 1024) {
    f.gz = gzipSync(buf, { level: 9 });
    f.br = brotliCompressSync(buf, { params: { [zc.BROTLI_PARAM_QUALITY]: 9 } });
  }
  files.set(url, f);
}
const INDEX = files.get('/index.html');
if (!INDEX) throw new Error(`No index.html in ${DIST}`);

// Security headers for the public site (security audit, 17 nov 2026: findings 1–4).
// The CSP was tested against the whole flow: note, photos, PDF, print (blob: iframe), ZIP and counters.
const PUBLIC_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};
// The admin is locked down: no scripts, no framing, no caching, no indexing.
const ADMIN_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000',
  'Content-Security-Policy':
    "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow'
};

function send(res, status, body = '', headers = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': buf.length, ...headers });
  res.end(res.req.method === 'HEAD' ? undefined : buf);
}

function serveFile(req, res, f) {
  const headers = { ...PUBLIC_HEADERS, 'Content-Type': f.type, 'Cache-Control': f.cache, ETag: f.etag, Vary: 'Accept-Encoding' };
  if (req.headers['if-none-match'] === f.etag) {
    res.writeHead(304, headers);
    return res.end();
  }
  const ae = String(req.headers['accept-encoding'] || '');
  let body = f.buf;
  if (f.br && /\bbr\b/.test(ae)) {
    body = f.br;
    headers['Content-Encoding'] = 'br';
  } else if (f.gz && /\bgzip\b/.test(ae)) {
    body = f.gz;
    headers['Content-Encoding'] = 'gzip';
  }
  headers['Content-Length'] = body.length;
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
}

function serveStatic(req, res, path) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD', ...PUBLIC_HEADERS });
  const f = files.get(path === '/' ? '/index.html' : path);
  if (f) return serveFile(req, res, f);
  // Missing build files and folders are a real 404; any other path is the app (SPA fallback).
  if (/^\/(assets|img|fonts|scenes)(\/|$)/.test(path) || /\.[a-z0-9]{2,8}$/i.test(path)) return send(res, 404, 'Not Found', PUBLIC_HEADERS);
  return serveFile(req, res, INDEX);
}

// ---------- request helpers ----------
function readBody(req, limit) {
  return new Promise((resolve) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        // Too big: stop keeping it, drain the rest (cut off past 1 MB) and let the caller answer 413.
        if (size > 1_048_576) req.destroy();
        resolve(null);
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => resolve(null));
  });
}

function clientIp(req) {
  const real = req.headers['x-real-ip'];
  if (real) return String(real).trim();
  const xff = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
  return xff[xff.length - 1] || req.socket.remoteAddress || '';
}

// Requests from our own pages only (blocks other sites from posting counts or logins).
function sameSite(req) {
  const site = req.headers['sec-fetch-site'];
  if (site && site !== 'same-origin') return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

// ---------- anonymous counters ----------
const metrics = new Metrics(join(DATA, 'metrics.json'));
const SALT = randomBytes(32); // per process, never stored: client keys can't be reversed
const clients = new Map(); // key -> { visitAt, win: { type: [count, since] } }
const WINDOW = 10 * 60_000;
const PER_TYPE = 20;

function clientKey(req) {
  return createHash('sha256').update(SALT).update(clientIp(req)).update('|').update(String(req.headers['user-agent'] || '')).digest('base64url');
}

function allow(key, type, now = Date.now()) {
  let c = clients.get(key);
  if (!c) clients.set(key, (c = { seen: now, visitAt: 0, win: {} }));
  c.seen = now;
  if (type === 'visit') {
    if (now - c.visitAt < 30 * 60_000) return false;
    c.visitAt = now;
    return true;
  }
  const w = c.win[type];
  if (!w || now - w[1] > WINDOW) {
    c.win[type] = [1, now];
    return true;
  }
  if (w[0] >= PER_TYPE) return false;
  w[0] += 1;
  return true;
}

setInterval(() => {
  const cut = Date.now() - 60 * 60_000;
  for (const [k, c] of clients) if (c.seen < cut) clients.delete(k);
  for (const [k, a] of logins) if (a.since < Date.now() - LOGIN_WINDOW) logins.delete(k);
}, 10 * 60_000).unref();

async function handleEvent(req, res) {
  const h = { 'Cache-Control': 'no-store', ...PUBLIC_HEADERS };
  if (req.method !== 'POST') return send(res, 405, 'Method Not Allowed', { Allow: 'POST', ...h });
  if (!sameSite(req)) return send(res, 403, 'Forbidden', h);
  const body = await readBody(req, 64);
  if (body === null) return send(res, 413, 'Too Large', { ...h, Connection: 'close' });
  const type = body.trim();
  if (!EVENTS.includes(type)) return send(res, 400, 'Bad Request', h);
  if (allow(clientKey(req), type)) metrics.add(type);
  res.writeHead(204, h);
  res.end();
}

// ---------- admin auth ----------
function sessionKey() {
  let salt;
  const file = join(DATA, 'session.key');
  try {
    salt = readFileSync(file);
    if (salt.length < 32) throw new Error('short');
  } catch {
    salt = randomBytes(32);
    try {
      mkdirSync(DATA, { recursive: true });
      writeFileSync(file, salt, { mode: 0o600 });
    } catch {
      /* not persistent: sessions end on restart */
    }
  }
  return createHmac('sha256', salt).update(`chacalde-admin:${ADMIN_PASSWORD}`).digest();
}
const SESSION_KEY = ADMIN_ENABLED ? sessionKey() : null;
const COOKIE = 'chx_admin';

const sign = (exp) => createHmac('sha256', SESSION_KEY).update(`admin:${exp}`).digest('base64url');

function equal(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function isAdmin(req) {
  if (!ADMIN_ENABLED) return false;
  const m = String(req.headers.cookie || '').match(/(?:^|;\s*)chx_admin=([0-9]+)\.([A-Za-z0-9_-]+)/);
  if (!m) return false;
  const exp = Number(m[1]);
  return exp > Date.now() && equal(m[2], sign(exp));
}

function passwordOk(input) {
  const a = createHash('sha256').update(String(input)).digest();
  const b = createHash('sha256').update(ADMIN_PASSWORD).digest();
  return timingSafeEqual(a, b);
}

const LOGIN_WINDOW = 15 * 60_000;
const LOGIN_MAX = 5;
const logins = new Map(); // ip -> { fails, since }

async function handleAdmin(req, res, url, path) {
  const h = ADMIN_HEADERS;
  if (PROD && (req.headers['x-forwarded-proto'] !== 'https' || `https://${req.headers.host}` !== ADMIN_ORIGIN)) {
    return send(res, 308, '', { ...h, Location: `${ADMIN_ORIGIN}/admin` });
  }
  if (!ADMIN_ENABLED) return send(res, 503, renderDisabled(), { ...h, 'Content-Type': 'text/html; charset=utf-8' });
  const html = (status, body, extra = {}) => send(res, status, body, { ...h, 'Content-Type': 'text/html; charset=utf-8', ...extra });

  if (path === '/admin/login') {
    if (req.method !== 'POST') return send(res, 303, '', { ...h, Location: '/admin' });
    if (!sameSite(req)) return send(res, 403, 'Forbidden', h);
    const ip = clientIp(req);
    const now = Date.now();
    let a = logins.get(ip);
    if (!a || now - a.since > LOGIN_WINDOW) logins.set(ip, (a = { fails: 0, since: now }));
    if (a.fails >= LOGIN_MAX) return html(429, renderLogin({ error: 'Demasiados intentos. Espera 15 minutos.' }), { 'Retry-After': '900' });
    const body = await readBody(req, 2048);
    const pw = body === null ? '' : new URLSearchParams(body).get('password') || '';
    if (!passwordOk(pw)) {
      a.fails += 1;
      await new Promise((r) => setTimeout(r, 700));
      return html(401, renderLogin({ error: 'Contraseña incorrecta.' }));
    }
    logins.delete(ip);
    const exp = now + SESSION_DAYS * 86_400_000;
    return send(res, 303, '', {
      ...h,
      Location: '/admin',
      'Set-Cookie': `${COOKIE}=${exp}.${sign(exp)}; Path=/admin; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; Secure; SameSite=Strict`
    });
  }

  if (path === '/admin/logout') {
    if (req.method !== 'POST' || !sameSite(req)) return send(res, 303, '', { ...h, Location: '/admin' });
    return send(res, 303, '', { ...h, Location: '/admin', 'Set-Cookie': `${COOKIE}=; Path=/admin; Max-Age=0; HttpOnly; Secure; SameSite=Strict` });
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed', { ...h, Allow: 'GET, HEAD' });
  if (!isAdmin(req)) return html(200, renderLogin());

  if (path === '/admin/export.csv') {
    return send(res, 200, toCsv(metrics), {
      ...h,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="chacalde-metricas-${dayKey()}.csv"`
    });
  }
  if (path !== '/admin' && path !== '/admin/') return send(res, 404, 'Not Found', h);

  const d = Number(url.searchParams.get('d'));
  const range = RANGES[d] ? d : 30;
  const summary = metrics.summary(lastDays(range));
  const warning = metrics.saved ? metrics.error : `${metrics.error}. Los datos solo están en memoria y se pierden al reiniciar: revisa el almacenamiento persistente /data en Coolify.`;
  return html(200, renderDashboard({ summary, range, today: dayKey(), warning }));
}

// ---------- server ----------
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let path;
    try {
      path = decodeURIComponent(url.pathname);
    } catch {
      return send(res, 400, 'Bad Request', PUBLIC_HEADERS);
    }
    if (path.includes('\0') || path.split('/').includes('..')) return send(res, 400, 'Bad Request', PUBLIC_HEADERS);
    if (path === '/healthz') return send(res, 200, 'ok', { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    if (path === '/api/e') return await handleEvent(req, res);
    if (path === '/admin' || path.startsWith('/admin/')) return await handleAdmin(req, res, url, path);
    return serveStatic(req, res, path);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, 'Internal Server Error');
    else res.end();
  }
});
server.headersTimeout = 15_000;
server.requestTimeout = 30_000;
server.keepAliveTimeout = 65_000;

server.listen(PORT, () => {
  console.log(`chacalde-web on :${PORT} · ${files.size} files · data in ${DATA} · admin ${ADMIN_ENABLED ? 'on' : 'off (set ADMIN_PASSWORD, 12+ chars)'}`);
});

function shutdown() {
  metrics.flush();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
