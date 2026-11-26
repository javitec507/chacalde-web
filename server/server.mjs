// chacalde.com — static site + anonymous counters + metrics panel on a secret path. No dependencies.
import http from 'node:http';
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, extname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, gzipSync, constants as zc } from 'node:zlib';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Metrics, EVENTS, dayKey, lastDays } from './metrics.mjs';
import { renderDashboard, renderDisabled, renderLogin, renderShare, renderUsers, toCsv, RANGES } from './admin.mjs';
import { Users, NAME_RE, MAX_USERS } from './users.mjs';
import { createMp } from './mp/routes.mjs';

const PORT = Number(process.env.PORT || 80);
const DIST = process.env.DIST_DIR || fileURLToPath(new URL('../dist', import.meta.url));
const DATA = process.env.DATA_DIR || '/data';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
// The panel lives only at ADMIN_PATH (e.g. /sala-x7k2...), never at a guessable address like /admin.
// Without a valid ADMIN_PATH there is no panel at all: every other path is the public site.
const ADMIN_PATH = String(process.env.ADMIN_PATH || '').trim().replace(/\/+$/, '').toLowerCase();
const PATH_OK = /^\/[a-z0-9][a-z0-9-]{9,62}$/.test(ADMIN_PATH);
const BASE = PATH_OK ? ADMIN_PATH : null;
const OWNER = NAME_RE.test(String(process.env.ADMIN_USER || '').trim().toLowerCase()) ? process.env.ADMIN_USER.trim().toLowerCase() : 'admin';
const ADMIN_ENABLED = PATH_OK && ADMIN_PASSWORD.length >= 12;
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
  // same-origin, not no-referrer: with no-referrer the login form is sent with "Origin: null".
  'Referrer-Policy': 'same-origin',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow'
};

// The promo-image page runs one same-origin script (canvas drawing). Nothing else changes.
const SHARE_HEADERS = {
  ...ADMIN_HEADERS,
  'Content-Security-Policy':
    "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
};
const SHARE_JS = readFileSync(fileURLToPath(new URL('./compartir.js', import.meta.url)));

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
  if (site) return site === 'same-origin';
  const origin = req.headers.origin;
  if (!origin) return true;
  if (origin === 'null') return false;
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
const users = new Users(join(DATA, 'users.json'));
// Mystery Pack redemption cards: console under the secret path (public claim page comes later, behind the campaign switch).
const MP = ADMIN_ENABLED ? createMp({ dataDir: DATA, base: BASE, send: (...a) => send(...a), sameSite: (r) => sameSite(r), headers: ADMIN_HEADERS, publicHeaders: PUBLIC_HEADERS, clientIp: (r) => clientIp(r) }) : null;

// Cookie: user~version~expiry~signature. The owner is version 0; other users carry their own version,
// so a new password or removing them ends their open sessions.
const sign = (payload) => createHmac('sha256', SESSION_KEY).update(`panel:${payload}`).digest('base64url');
const cookieFor = (user, ver, exp) => `${user}~${ver}~${exp}~${sign(`${user}~${ver}~${exp}`)}`;

function equal(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// The signed-in user ({ user, owner }) or null.
function whoIs(req) {
  if (!ADMIN_ENABLED) return null;
  const m = String(req.headers.cookie || '').match(/(?:^|;\s*)chx_admin=([a-z0-9._-]{3,24})~([0-9]{1,9})~([0-9]{1,15})~([A-Za-z0-9_-]{43})(?:;|$)/);
  if (!m) return null;
  const [, user, ver, exp, sig] = m;
  if (Number(exp) <= Date.now() || !equal(sig, sign(`${user}~${ver}~${exp}`))) return null;
  if (user === OWNER) return ver === '0' ? { user, owner: true } : null;
  const u = users.get(user);
  return u && String(u.ver) === ver ? { user, owner: false } : null;
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
  const B = BASE;
  if (PROD && (req.headers['x-forwarded-proto'] !== 'https' || `https://${req.headers.host}` !== ADMIN_ORIGIN)) {
    return send(res, 308, '', { ...h, Location: `${ADMIN_ORIGIN}${B}` });
  }
  if (!ADMIN_ENABLED) return send(res, 503, renderDisabled(), { ...h, 'Content-Type': 'text/html; charset=utf-8' });
  const html = (status, body, extra = {}) => send(res, status, body, { ...h, 'Content-Type': 'text/html; charset=utf-8', ...extra });
  const cookie = (value, maxAge) => `${COOKIE}=${value}; Path=${B}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
  const sub = path.slice(B.length) || '/';

  if (sub === '/login') {
    if (req.method !== 'POST') return send(res, 303, '', { ...h, Location: B });
    if (!sameSite(req)) return send(res, 403, 'Forbidden', h);
    const ip = clientIp(req);
    const now = Date.now();
    let a = logins.get(ip);
    if (!a || now - a.since > LOGIN_WINDOW) logins.set(ip, (a = { fails: 0, since: now }));
    if (a.fails >= LOGIN_MAX) return html(429, renderLogin({ base: B, error: 'Demasiados intentos. Espera 15 minutos.' }), { 'Retry-After': '900' });
    const body = await readBody(req, 2048);
    const form = new URLSearchParams(body === null ? '' : body);
    const user = String(form.get('user') || '').trim().toLowerCase().slice(0, 24);
    const pw = form.get('password') || '';
    let ver = null;
    if (user === OWNER) ver = passwordOk(pw) ? 0 : null;
    else if (NAME_RE.test(user)) ver = await users.verify(user, pw);
    if (ver === null) {
      a.fails += 1;
      await new Promise((r) => setTimeout(r, 700));
      return html(401, renderLogin({ base: B, user, error: 'Usuario o contraseña incorrectos.' }));
    }
    logins.delete(ip);
    const exp = now + SESSION_DAYS * 86_400_000;
    return send(res, 303, '', { ...h, Location: B, 'Set-Cookie': cookie(cookieFor(user, ver, exp), SESSION_DAYS * 86400) });
  }

  if (sub === '/logout') {
    if (req.method !== 'POST' || !sameSite(req)) return send(res, 303, '', { ...h, Location: B });
    return send(res, 303, '', { ...h, Location: B, 'Set-Cookie': cookie('', 0) });
  }

  const me = whoIs(req);

  if (sub === '/mp' || sub.startsWith('/mp/')) {
    if (!me) return sub === '/mp' ? send(res, 303, '', { ...h, Location: B }) : send(res, 401, 'Unauthorized', h);
    return MP.handle(req, res, sub, me);
  }

  if (sub === '/usuarios' && req.method === 'POST') {
    if (!me || !me.owner) return send(res, 404, 'Not Found', h);
    if (!sameSite(req)) return send(res, 403, 'Forbidden', h);
    const body = await readBody(req, 2048);
    const form = new URLSearchParams(body === null ? '' : body);
    const action = form.get('action');
    const name = String(form.get('name') || '').trim().toLowerCase();
    const view = (o) => html(200, renderUsers({ base: B, me, owner: OWNER, users: users.list(), ...o }));
    if (!NAME_RE.test(name)) return view({ error: 'Nombre no válido: de 3 a 24 caracteres, minúsculas, números, punto, guion o guion bajo.' });
    try {
      if (action === 'create') {
        if (name === OWNER) return view({ error: `"${name}" es el usuario del dueño. Elige otro nombre.` });
        if (users.get(name)) return view({ error: `Ya existe "${name}". Usa "Nueva contraseña" si la necesita.` });
        if (users.list().length >= MAX_USERS) return view({ error: `Máximo ${MAX_USERS} usuarios.` });
        const password = await users.setPassword(name, { isNew: true });
        return view({ notice: `Usuario "${name}" creado.`, reveal: { name, password } });
      }
      if (action === 'reset') {
        if (!users.get(name)) return view({ error: `No existe "${name}".` });
        const password = await users.setPassword(name, { isNew: false });
        return view({ notice: `Nueva contraseña para "${name}". Su sesión anterior se cerró.`, reveal: { name, password } });
      }
      if (action === 'remove') {
        return view(users.remove(name) ? { notice: `"${name}" ya no tiene acceso.` } : { error: `No existe "${name}".` });
      }
    } catch (e) {
      console.error(e);
      return view({ error: 'No se pudo guardar. Revisa el almacenamiento persistente /data en Coolify.' });
    }
    return view({ error: 'Acción no válida.' });
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed', { ...h, Allow: 'GET, HEAD' });
  if (!me) return sub === '/' ? html(200, renderLogin({ base: B })) : send(res, 303, '', { ...h, Location: B });

  if (sub === '/export.csv') {
    return send(res, 200, toCsv(metrics), {
      ...h,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="chacalde-metricas-${dayKey()}.csv"`
    });
  }
  if (sub === '/compartir') {
    return send(res, 200, renderShare({ base: B, me, facts: metrics.facts() }), { ...SHARE_HEADERS, 'Content-Type': 'text/html; charset=utf-8' });
  }
  if (sub === '/compartir.js') return send(res, 200, SHARE_JS, { ...h, 'Content-Type': 'text/javascript; charset=utf-8' });
  if (sub === '/usuarios') {
    if (!me.owner) return send(res, 404, 'Not Found', h);
    return html(200, renderUsers({ base: B, me, owner: OWNER, users: users.list(), error: users.error || '' }));
  }
  if (sub !== '/') return send(res, 404, 'Not Found', h);

  const d = Number(url.searchParams.get('d'));
  const range = RANGES[d] ? d : 30;
  const summary = metrics.summary(lastDays(range));
  const warning = metrics.saved ? metrics.error : `${metrics.error}. Los datos solo están en memoria y se pierden al reiniciar: revisa el almacenamiento persistente /data en Coolify.`;
  return html(200, renderDashboard({ base: B, me, summary, range, today: dayKey(), warning }));
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
    // Mystery Pack claim page: exists only while the campaign is switched on (or closed, to say so).
    if (MP && (path === '/canje' || path.startsWith('/canje/') || path.startsWith('/api/canje/'))) {
      if ((await MP.publicHandle(req, res, path)) !== false) return;
    }
    if (BASE && (path === BASE || path.startsWith(`${BASE}/`))) return await handleAdmin(req, res, url, path.replace(/\/+$/, '') || '/');
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
  const panel = ADMIN_ENABLED
    ? `panel on (secret path set, owner "${OWNER}", ${users.list().length} extra users)`
    : `panel off (${PATH_OK ? '' : 'set ADMIN_PATH, e.g. /sala- + 10 random letters; '}${ADMIN_PASSWORD.length >= 12 ? '' : 'set ADMIN_PASSWORD, 12+ chars'})`;
  console.log(`chacalde-web on :${PORT} · ${files.size} files · data in ${DATA} · ${panel}`);
});

function shutdown() {
  metrics.flush();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
