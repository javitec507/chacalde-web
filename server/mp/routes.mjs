// Mystery Pack: the console on its own secret path (/<MP_PATH>/...) and the public /canje page behind the campaign switch.
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { MysteryPack } from './store.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const STATIC = {
  'console.js': ['console.js', 'text/javascript; charset=utf-8'],
  'console.css': ['console.css', 'text/css; charset=utf-8'],
  'pdf.js': ['pdf.js', 'text/javascript; charset=utf-8'],
  'pdf-lib.min.js': ['vendor/pdf-lib.min.js', 'text/javascript; charset=utf-8'],
  'fontkit.umd.min.js': ['vendor/fontkit.umd.min.js', 'text/javascript; charset=utf-8'],
  'qrcode.js': ['vendor/qrcode.js', 'text/javascript; charset=utf-8'],
  'archivo-display.ttf': ['fonts/archivo-display.ttf', 'font/ttf'],
  'atkinson-700.ttf': ['fonts/atkinson-700.ttf', 'font/ttf'],
  'atkinson-400.ttf': ['fonts/atkinson-400.ttf', 'font/ttf'],
  'doto-900.ttf': ['fonts/doto-900.ttf', 'font/ttf'],
  // the claim page: React build (vite.canje.config.js) + the landing's card art
  'canje.js': ['build/canje.js', 'text/javascript; charset=utf-8'],
  'canje.css': ['build/canje.css', 'text/css; charset=utf-8'],
  'hero-front.jpg': ['canje-assets/hero-front.jpg', 'image/jpeg'],
  'hero-back.jpg': ['canje-assets/hero-back.jpg', 'image/jpeg']
};
const PUBLIC_ASSETS = new Set(['canje.js', 'canje.css', 'hero-front.jpg', 'hero-back.jpg', 'archivo-display.ttf', 'atkinson-700.ttf', 'atkinson-400.ttf', 'doto-900.ttf']);
const IMAGE_TYPES = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };
const FILE_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

export const CANJE_CSP =
  "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";
export const CONSOLE_CSP =
  "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";

function readRaw(req, limit) {
  return new Promise((resolve) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        req.destroy();
        resolve(null);
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', () => resolve(null));
  });
}

export function createMp({ dataDir, base, send, sameSite, headers, publicHeaders, clientIp }) {
  const mp = new MysteryPack(join(dataDir, 'mp'));
  const claimsDir = join(mp.dir, 'claims');
  mkdirSync(claimsDir, { recursive: true });
  // Personal data of old claims goes away by itself (90 days after delivery).
  const purge = () => {
    for (const f of mp.purge(90)) {
      try {
        unlinkSync(join(claimsDir, f));
      } catch {
        /* already gone */
      }
    }
  };
  purge();
  setInterval(purge, 12 * 3600_000).unref();
  // Rate limits for the public page, per client IP.
  const hits = new Map();
  const tooMany = (req, kind, max, windowMs) => {
    const k = `${kind}:${clientIp(req)}`;
    const t = Date.now();
    let h = hits.get(k);
    if (!h || t - h.since > windowMs) hits.set(k, (h = { n: 0, since: t }));
    h.n += 1;
    return h.n > max;
  };
  setInterval(() => {
    const cut = Date.now() - 3600_000;
    for (const [k, h] of hits) if (h.since < cut) hits.delete(k);
  }, 600_000).unref();
  const cache = new Map();
  const asset = (name) => {
    if (!cache.has(name)) {
      const [file, type] = STATIC[name];
      const p = join(HERE, file);
      cache.set(name, existsSync(p) ? { buf: readFileSync(p), type } : null);
    }
    return cache.get(name);
  };
  const json = (res, status, body) =>
    send(res, status, JSON.stringify(body), { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  const fail = (res, e, status = 400) => json(res, status, { error: e.message || String(e) });

  function consoleHtml(me) {
    const cfg = { base, user: me.user, owner: me.owner };
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><meta name="referrer" content="same-origin"><title>Consola · Chacalde Mystery Pack</title><link rel="icon" type="image/png" href="/favicon.png"><link rel="stylesheet" href="${base}/static/console.css"></head>
<body><div id="app" data-cfg="${JSON.stringify(cfg).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}"><p class="boot">Cargando…</p></div>
<script src="${base}/static/qrcode.js"></script><script src="${base}/static/pdf-lib.min.js"></script><script src="${base}/static/fontkit.umd.min.js"></script><script src="${base}/static/pdf.js"></script><script src="${base}/static/console.js"></script></body></html>`;
  }

  function canjeHtml(cfg) {
    const data = JSON.stringify(cfg).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="robots" content="noindex"><meta name="referrer" content="same-origin"><meta name="theme-color" content="#0a0a0a"><title>Canje · Mystery Pack Chacalde</title><link rel="icon" type="image/png" href="/favicon.png"><link rel="stylesheet" href="${cfg.assets}/canje.css"></head>
<body><div id="app" data-cfg="${data}"></div><script src="${cfg.assets}/canje.js"></script></body></html>`;
  }

  // Public claim API (also used, as a dry run, by the panel's preview).
  async function canjeApi(req, res, action, { preview }) {
    const h = { ...publicHeaders, 'Cache-Control': 'no-store' };
    const out = (status, b) => send(res, status, JSON.stringify(b), { ...h, 'Content-Type': 'application/json; charset=utf-8' });
    if (req.method !== 'POST') return send(res, 405, 'Method Not Allowed', { ...h, Allow: 'POST' });
    if (!sameSite(req)) return send(res, 403, 'Forbidden', h);
    const st = mp.data.settings;
    if (!preview && st.campaign.state === 'closed') return out(410, { error: 'La campaña ya terminó.' });
    // The test code: always available, never used up, nothing saved. Public only if the owner allows it.
    const testOk = (code) => mp.isTest(code) && (preview || mp.data.test.public);
    if (action === 'check') {
      if (!preview && tooMany(req, 'check', 20, 10 * 60_000)) return out(429, { error: 'Demasiados intentos. Espera unos minutos y vuelve a probar.' });
      let b;
      try {
        b = await body(req, 4096);
      } catch (e) {
        return out(400, { error: e.message });
      }
      if (testOk(b.code)) return out(200, { card: mp.testCard(), photoCheck: st.photoCheck, delivery: st.delivery, test: true });
      const card = mp.findByCode(b.code);
      if (!card || card.status === 'void') return out(404, { error: 'Ese código no existe. Revisa que esté bien escrito.' });
      if (card.status !== 'available') return out(409, { error: 'Este código ya fue canjeado.', card: mp.publicCard(card) });
      return out(200, { card: mp.publicCard(card), photoCheck: st.photoCheck, delivery: st.delivery });
    }
    if (action === 'photo') {
      if (!preview && tooMany(req, 'photo', 12, 60 * 60_000)) return out(429, { error: 'Demasiadas fotos. Espera un rato.' });
      const test = testOk(req.headers['x-code']);
      const card = test ? null : mp.findByCode(req.headers['x-code']);
      if (!test && (!card || card.status !== 'available')) return out(400, { error: 'Primero revisa un código válido.' });
      if (String(req.headers['content-type'] || '').split(';')[0] !== 'image/jpeg') return out(400, { error: 'La foto debe ser JPG.' });
      const buf = await readRaw(req, 4 * 1024 * 1024);
      if (!buf || buf.length < 1000 || buf[0] !== 0xff || buf[1] !== 0xd8) return out(400, { error: 'No pudimos leer esa foto. Prueba con otra.' });
      if (preview || test) return out(200, { photo: 'preview.jpg' });
      const name = `${randomBytes(12).toString('hex')}.jpg`;
      writeFileSync(join(claimsDir, name), buf, { mode: 0o600 });
      return out(200, { photo: name });
    }
    if (action === 'claim') {
      if (!preview && tooMany(req, 'claim', 6, 60 * 60_000)) return out(429, { error: 'Demasiados intentos. Espera un rato.' });
      let b;
      try {
        b = await body(req, 8192);
      } catch (e) {
        return out(400, { error: e.message });
      }
      if (testOk(b.code)) {
        try {
          return out(200, { ...mp.testClaim(b, { front: b.photos?.front ? 'test' : null, back: b.photos?.back ? 'test' : null }), card: mp.testCard() });
        } catch (e) {
          return out(400, { error: e.message });
        }
      }
      const card = mp.findByCode(b.code);
      if (!card || card.status === 'void') return out(404, { error: 'Ese código no existe.' });
      const ok = (f) => typeof f === 'string' && /^[a-f0-9]{24}\.jpg$/.test(f) && existsSync(join(claimsDir, f));
      const photos = preview ? { front: b.photos?.front ? 'preview' : null, back: b.photos?.back ? 'preview' : null } : { front: ok(b.photos?.front) ? b.photos.front : null, back: ok(b.photos?.back) ? b.photos.back : null };
      try {
        const r = mp.claim(card, b, photos, { dry: preview });
        return out(200, { ...r, card: mp.publicCard(card) });
      } catch (e) {
        return out(e.code === 'taken' ? 409 : 400, { error: e.message });
      }
    }
    return send(res, 404, 'Not Found', h);
  }

  function canjeAsset(res, name, h) {
    if (name.startsWith('art/')) {
      const file = name.slice(4);
      if (!/^[a-f0-9]{24}\.(png|jpg|webp)$/.test(file) || !mp.artAllowed(file) || !existsSync(join(mp.files, file))) return send(res, 404, 'Not Found', h);
      return send(res, 200, readFileSync(join(mp.files, file)), { ...h, 'Content-Type': FILE_TYPES[extname(file)], 'Cache-Control': 'public, max-age=86400' });
    }
    const a = PUBLIC_ASSETS.has(name) && asset(name);
    if (!a) return send(res, 404, 'Not Found', h);
    return send(res, 200, a.buf, { ...h, 'Content-Type': a.type, 'Cache-Control': 'public, max-age=300' });
  }

  async function body(req, limit = 2_000_000) {
    const buf = await readRaw(req, limit);
    if (!buf) throw new Error('Demasiado grande.');
    try {
      return JSON.parse(buf.toString('utf8') || '{}');
    } catch {
      throw new Error('Datos no válidos.');
    }
  }

  return {
    mp,
    /** Public /canje and /api/canje/*: only while the campaign is on (or closed, to say so). Otherwise false = not found. */
    async publicHandle(req, res, path) {
      const st = mp.data.settings.campaign.state;
      if (st === 'off') return false;
      const open = mp.campaignOpen();
      const h = publicHeaders;
      if (path === '/canje' || path === '/canje/') {
        return send(res, 200, canjeHtml({ api: '/api/canje', assets: '/canje/s', preview: false, closed: !open }), { ...h, 'Content-Security-Policy': CANJE_CSP, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      }
      if (path.startsWith('/canje/s/')) return canjeAsset(res, path.slice('/canje/s/'.length), h);
      if (path.startsWith('/api/canje/')) {
        if (!open) return send(res, 410, JSON.stringify({ error: 'La campaña ya terminó.' }), { ...h, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        return canjeApi(req, res, path.slice('/api/canje/'.length), { preview: false });
      }
      return false;
    },
    async handle(req, res, sub, me) {
      // sub (relative to the console's secret path): "/", "/static/x", "/file/x", "/api/x", "/canje" (preview)…
      if (sub === '/') {
        return send(res, 200, consoleHtml(me), { ...headers, 'Content-Security-Policy': CONSOLE_CSP, 'Content-Type': 'text/html; charset=utf-8' });
      }
      if (sub.startsWith('/static/')) {
        const name = sub.slice('/static/'.length);
        const a = STATIC[name] && asset(name);
        if (!a) return send(res, 404, 'Not Found', headers);
        return send(res, 200, a.buf, { ...headers, 'Content-Type': a.type, 'Cache-Control': 'private, max-age=300' });
      }
      if (sub === '/canje') {
        return send(res, 200, canjeHtml({ api: `${base}/canje-api`, assets: `${base}/canje-s`, preview: true, closed: false }), { ...headers, 'Content-Security-Policy': CANJE_CSP, 'Content-Type': 'text/html; charset=utf-8' });
      }
      if (sub.startsWith('/canje-s/')) return canjeAsset(res, sub.slice('/canje-s/'.length), headers);
      if (sub.startsWith('/canje-api/')) return canjeApi(req, res, sub.slice('/canje-api/'.length), { preview: true });
      if (sub.startsWith('/claim-photo/')) {
        const name = sub.slice('/claim-photo/'.length);
        if (!/^[a-f0-9]{24}\.jpg$/.test(name) || !existsSync(join(claimsDir, name))) return send(res, 404, 'Not Found', headers);
        return send(res, 200, readFileSync(join(claimsDir, name)), { ...headers, 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store' });
      }
      if (sub.startsWith('/file/')) {
        const name = sub.slice('/file/'.length);
        if (!/^[a-f0-9]{24}\.(png|jpg|webp)$/.test(name)) return send(res, 404, 'Not Found', headers);
        const p = join(mp.files, name);
        if (!existsSync(p)) return send(res, 404, 'Not Found', headers);
        return send(res, 200, readFileSync(p), { ...headers, 'Content-Type': FILE_TYPES[extname(name)], 'Cache-Control': 'private, max-age=31536000, immutable' });
      }
      if (!sub.startsWith('/api/')) return send(res, 404, 'Not Found', headers);
      const action = sub.slice('/api/'.length);
      if (req.method === 'GET' && action === 'state') return json(res, 200, { ...mp.view(), me });
      if (req.method !== 'POST') return send(res, 405, 'Method Not Allowed', { ...headers, Allow: 'GET, POST' });
      if (!sameSite(req)) return send(res, 403, 'Forbidden', headers);
      const by = me.user;
      try {
        switch (action) {
          case 'file': {
            const ext = IMAGE_TYPES[String(req.headers['content-type'] || '').split(';')[0].trim()];
            if (!ext) throw new Error('Sube PNG, JPG o WEBP.');
            const buf = await readRaw(req, 80 * 1024 * 1024);
            if (!buf || !buf.length) throw new Error('La imagen pesa más de 80 MB o llegó vacía.');
            const name = `${createHash('sha256').update(buf).digest('hex').slice(0, 24)}${ext}`;
            const p = join(mp.files, name);
            if (!existsSync(p)) writeFileSync(p, buf);
            return json(res, 200, { file: name, bytes: statSync(p).size });
          }
          case 'campaign': {
            if (!me.owner) throw new Error('Solo el dueño puede encender o apagar la campaña.');
            const b = await body(req);
            mp.setCampaign(b.state, by);
            break;
          }
          case 'settings':
            mp.setSettings(await body(req), by);
            break;
          case 'test': {
            if (!me.owner) throw new Error('Solo el dueño puede cambiar el código de prueba.');
            const b = await body(req);
            mp.setTest({ public: typeof b.public === 'boolean' ? b.public : undefined, rotate: b.rotate === true }, by);
            break;
          }
          case 'design': {
            const d = mp.saveDesign(await body(req), by);
            return json(res, 200, { ...mp.view(), saved: d.id });
          }
          case 'design-delete':
            mp.deleteDesign((await body(req)).id, by);
            break;
          case 'variant': {
            const v = mp.saveVariant(await body(req), by);
            return json(res, 200, { ...mp.view(), saved: v.id });
          }
          case 'variant-delete':
            mp.deleteVariant((await body(req)).id, by);
            break;
          case 'cards':
            mp.updateCards((await body(req, 5_000_000)).cards, by);
            break;
          case 'claim': {
            const b = await body(req);
            mp.setClaim(b.id, b.action, by, b.note);
            break;
          }
          case 'codes': {
            const b = await body(req);
            return json(res, 200, { codes: mp.exportCodes(b.variantId, by, b.purpose === 'print' ? 'print' : 'preview') });
          }
          default:
            return send(res, 404, 'Not Found', headers);
        }
        return json(res, 200, mp.view());
      } catch (e) {
        return fail(res, e);
      }
    }
  };
}
