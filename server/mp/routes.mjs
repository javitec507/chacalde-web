// Panel routes for the Mystery Pack console (under the secret admin path) — /<ADMIN_PATH>/mp/...
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
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
  'doto-900.ttf': ['fonts/doto-900.ttf', 'font/ttf']
};
const IMAGE_TYPES = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };
const FILE_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

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

export function createMp({ dataDir, base, send, sameSite, headers }) {
  const mp = new MysteryPack(join(dataDir, 'mp'));
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
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><meta name="referrer" content="same-origin"><title>Mystery Pack · Panel Chacalde</title><link rel="icon" type="image/png" href="/favicon.png"><link rel="stylesheet" href="${base}/mp/static/console.css"></head>
<body><div id="app" data-cfg="${JSON.stringify(cfg).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}"><p class="boot">Cargando…</p></div>
<script src="${base}/mp/static/qrcode.js"></script><script src="${base}/mp/static/pdf-lib.min.js"></script><script src="${base}/mp/static/fontkit.umd.min.js"></script><script src="${base}/mp/static/pdf.js"></script><script src="${base}/mp/static/console.js"></script></body></html>`;
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
    async handle(req, res, sub, me) {
      // sub: "/mp", "/mp/static/x", "/mp/file/x", "/mp/api/x"
      if (sub === '/mp' || sub === '/mp/') {
        return send(res, 200, consoleHtml(me), { ...headers, 'Content-Security-Policy': CONSOLE_CSP, 'Content-Type': 'text/html; charset=utf-8' });
      }
      if (sub.startsWith('/mp/static/')) {
        const name = sub.slice('/mp/static/'.length);
        const a = STATIC[name] && asset(name);
        if (!a) return send(res, 404, 'Not Found', headers);
        return send(res, 200, a.buf, { ...headers, 'Content-Type': a.type, 'Cache-Control': 'private, max-age=300' });
      }
      if (sub.startsWith('/mp/file/')) {
        const name = sub.slice('/mp/file/'.length);
        if (!/^[a-f0-9]{24}\.(png|jpg|webp)$/.test(name)) return send(res, 404, 'Not Found', headers);
        const p = join(mp.files, name);
        if (!existsSync(p)) return send(res, 404, 'Not Found', headers);
        return send(res, 200, readFileSync(p), { ...headers, 'Content-Type': FILE_TYPES[extname(name)], 'Cache-Control': 'private, max-age=31536000, immutable' });
      }
      if (!sub.startsWith('/mp/api/')) return send(res, 404, 'Not Found', headers);
      const action = sub.slice('/mp/api/'.length);
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
