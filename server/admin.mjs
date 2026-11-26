// Server-rendered admin pages, under a secret path (ADMIN_PATH). No JavaScript, except the promo-image
// page, which loads one same-origin script to draw the picture.
import { EVENTS } from './metrics.mjs';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const nf = new Intl.NumberFormat('es-PA');
const num = (n) => nf.format(n);
const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1).replace('.0', '')} %` : '—');

const dShort = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dLong = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const dWeek = new Intl.DateTimeFormat('es', { weekday: 'short', timeZone: 'UTC' });
const asDate = (day) => new Date(`${day}T00:00:00Z`);
const shortDay = (day) => dShort.format(asDate(day)).replace('.', '');

export const RANGES = { 7: '7 días', 30: '30 días', 90: '90 días', 365: '1 año' };

const STYLE = `
@font-face{font-family:Archivo;src:url(/fonts/archivo-latin-standard-italic.woff2) format('woff2');font-weight:100 900;font-stretch:62% 125%;font-style:italic}
@font-face{font-family:Atkinson;src:url(/fonts/atkinson-hyperlegible-next-latin-400-normal.woff2) format('woff2');font-weight:400}
@font-face{font-family:Atkinson;src:url(/fonts/atkinson-hyperlegible-next-latin-700-normal.woff2) format('woff2');font-weight:700}
@font-face{font-family:Doto;src:url(/fonts/doto-latin-900-normal.woff2) format('woff2');font-weight:900}
:root{--ink:#0a0a0a;--ink-2:#141414;--line:#262626;--line-2:#333;--muted:#a3a3a3;--dim:#6b6b6b;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--ink);color:#fff;font-family:Atkinson,system-ui,sans-serif;font-size:15px;line-height:1.5;-webkit-font-smoothing:antialiased}
a{color:inherit}
.in{max-width:1180px;margin:0 auto;padding:0 28px}
.display{font-family:Archivo,'Arial Narrow',sans-serif;font-style:italic;font-weight:900;font-stretch:80%;text-transform:uppercase;letter-spacing:-.01em;line-height:.95;margin:0}
.top{border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--ink);z-index:2}
.top .in{display:flex;align-items:center;gap:16px;min-height:64px}
.brand{display:flex;align-items:center;gap:14px;text-decoration:none}
.brand img{height:28px;width:auto;display:block}
.brand span{color:var(--muted);border-left:1px solid var(--line-2);padding-left:14px;font-size:14px}
.top nav{margin-left:auto;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;align-items:center;padding:10px 0}
.who{color:var(--dim);font-size:13px;margin-right:4px}
.btn.btn--on{background:#fff;color:var(--ink);border-color:#fff}
.ok{margin:24px 0 0;padding:14px 16px;border:1px solid #3a7d44;color:#c8f0cf;background:#0d1a10;border-radius:2px}
.secret{display:inline-block;margin-top:10px;padding:12px 16px;background:#fff;color:var(--ink);font:700 28px Atkinson,ui-monospace,monospace;letter-spacing:.08em;user-select:all;border-radius:2px}
.field{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-top:12px}
.field label{display:block;font-size:13px;color:var(--muted);margin-bottom:6px}
.field input{height:40px;min-width:220px;border:1px solid var(--line-2);background:var(--ink);color:#fff;padding:0 12px;font:400 15px Atkinson,system-ui,sans-serif;border-radius:2px}
.inline{display:inline;margin:0}
.btn--danger:hover{background:#ff6b6b;border-color:#ff6b6b;color:var(--ink)}
.share{display:grid;grid-template-columns:minmax(0,380px) minmax(0,1fr);gap:32px;align-items:start;margin:32px 0 48px}
.share canvas{width:100%;height:auto;display:block;border:1px solid var(--line-2);background:#000;border-radius:2px}
.share .actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
.share .actions .btn{height:48px;font-size:16px;padding:0 20px}
.share .actions .btn[disabled]{opacity:.5;cursor:wait}
.share ul{margin:14px 0 0;padding-left:20px;color:var(--muted)}
.share li{margin:6px 0}
.top form{margin:0}
.btn{display:inline-flex;align-items:center;height:38px;padding:0 14px;border:1px solid var(--line-2);background:var(--ink-2);color:#fff;font:700 14px Atkinson,system-ui,sans-serif;text-decoration:none;border-radius:2px;cursor:pointer}
.btn:hover{background:#fff;color:var(--ink)}
.warn{margin:24px 0 0;padding:14px 16px;border:1px solid #ff6b6b;color:#ffb3b3;background:#1a0d0d;border-radius:2px}
.hero{padding:40px 0 28px;display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px 40px;border-bottom:1px solid var(--line)}
.lbl{margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.big{font-family:Doto,ui-monospace,monospace;font-weight:900;font-size:clamp(64px,11vw,128px);line-height:.9;letter-spacing:.04em;margin:0;font-variant-numeric:tabular-nums}
.hero .side{display:flex;gap:28px;padding-bottom:8px}
.hero .side div{min-width:110px}
.hero .side b{display:block;font-family:Doto,ui-monospace,monospace;font-weight:900;font-size:34px;line-height:1}
.since{margin:10px 0 0;color:var(--dim);font-size:13px}
.range{display:flex;gap:6px;margin:26px 0 18px;flex-wrap:wrap;align-items:center}
.range span{color:var(--muted);font-size:13px;margin-right:8px}
.range a{padding:7px 12px;border:1px solid var(--line-2);border-radius:2px;text-decoration:none;font-weight:700;font-size:13px;color:var(--muted)}
.range a[aria-current]{background:#fff;color:var(--ink);border-color:#fff}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:2px;overflow:hidden}
.tile{background:var(--ink-2);padding:18px 18px 16px}
.tile .v{font-size:32px;font-weight:700;line-height:1.1;font-variant-numeric:tabular-nums}
.tile .t{margin:0 0 8px;font-size:13px;color:var(--muted)}
.tile .s{margin:6px 0 0;font-size:12px;color:var(--dim)}
.card{margin-top:28px;border:1px solid var(--line);border-radius:2px;background:var(--ink-2);padding:22px 22px 18px}
.card h2{font-size:26px}
.card .note{margin:6px 0 16px;color:var(--muted);font-size:13px}
.chart{overflow-x:auto}
.chart svg{display:block;width:100%;min-width:620px;height:auto}
.chart .hit:hover+.bar,.chart .slot:hover .bar{fill:#d4d4d4}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:14px}
.tablewrap{overflow-x:auto}
th,td{padding:9px 10px;text-align:right;border-bottom:1px solid var(--line);white-space:nowrap}
th{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:700;position:sticky;top:0;background:var(--ink-2)}
th:first-child,td:first-child{text-align:left}
td.zero{color:var(--dim)}
tr.today td{background:#1c1c1c}
tfoot td{font-weight:700;border-top:1px solid var(--line-2);border-bottom:0}
.foot{margin:28px 0 48px;color:var(--dim);font-size:13px}
@media (max-width:760px){.share{grid-template-columns:1fr;margin-top:20px}.share>div{order:-1}.share canvas{max-width:360px}}
@media (max-width:640px){.in{padding:0 16px}.brand span,.who{display:none}.top .in{flex-wrap:wrap}.top nav{margin-left:0;justify-content:flex-start;padding-top:0}.hero{padding-top:28px}.hero .side{gap:18px}.tile .v{font-size:26px}.card{padding:16px}}
`;

function page({ title, body, refresh = false, script = '' }) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><meta name="referrer" content="same-origin">${
    refresh ? '<meta http-equiv="refresh" content="60">' : ''
  }<title>${esc(title)}</title><link rel="icon" type="image/png" href="/favicon.png"><style>${STYLE}</style></head><body>${body}${
    script ? `<script src="${esc(script)}"></script>` : ''
  }</body></html>`;
}

const brand = (base) =>
  `<a class="brand" href="${base}"><img src="/img/logo-white.png" alt="Chacalde" width="800" height="286"><span>Panel de métricas</span></a>`;

// Top bar: who is in, and what they can open (only the owner manages users).
function topbar(base, me, current) {
  const link = (href, label, key) => `<a class="btn${current === key ? ' btn--on' : ''}" href="${href}"${current === key ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<header class="top"><div class="in">${brand(base)}<nav aria-label="Panel"><span class="who">${esc(me.user)}${me.owner ? ' · dueño' : ''}</span>${link(base, 'Métricas', 'dash')}${link(
    `${base}/compartir`,
    'Imagen para compartir',
    'share'
  )}${me.owner ? link(`${base}/usuarios`, 'Usuarios', 'users') : ''}<a class="btn" href="${base}/export.csv">CSV</a><form method="post" action="${base}/logout"><button class="btn" type="submit">Salir</button></form></nav></div></header>`;
}

export function renderLogin({ base, error = '', user = '', title = 'Entrar · Panel Chacalde', heading = 'Panel de métricas', note = 'Acceso solo para administración.' }) {
  const css = `
.wrap{min-height:100vh;display:grid;place-items:center;padding:24px}
.box{width:100%;max-width:420px;background:#fff;color:var(--ink);padding:32px 30px 26px;border-radius:2px}
.box img{height:30px;width:auto;display:block;margin-bottom:22px;filter:invert(1)}
.box h1{font-size:38px}
.box p{margin:10px 0 0;color:#3d3d3d}
label{display:block;margin-top:22px;font-weight:700}
input{width:100%;height:52px;margin-top:8px;border:2px solid var(--ink);padding:0 14px;font:400 18px Atkinson,system-ui,sans-serif;color:var(--ink);background:#fff;border-radius:0}
input:focus{outline:3px solid var(--ink);outline-offset:3px}
button{margin-top:16px;width:100%;height:54px;border:0;background:var(--ink);color:#fff;font-family:Archivo,'Arial Narrow',sans-serif;font-style:italic;font-weight:900;font-stretch:80%;font-size:21px;text-transform:uppercase;cursor:pointer;border-radius:0}
.err{margin-top:14px;color:#b00020;font-weight:700}`;
  return page({
    title,
    body: `<style>${css}</style><main class="wrap"><form class="box" method="post" action="${base}/login">
<img src="/img/logo-white.png" alt="Chacalde" width="800" height="286">
<h1 class="display">${esc(heading)}</h1>
<p>${esc(note)}</p>
<label for="user">Usuario</label>
<input id="user" name="user" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required ${user ? '' : 'autofocus '}maxlength="24" value="${esc(user)}">
<label for="pw">Contraseña</label>
<input id="pw" name="password" type="password" autocomplete="current-password" required ${user ? 'autofocus ' : ''}maxlength="200">
${error ? `<p class="err" role="alert">${esc(error)}</p>` : ''}
<button type="submit">Entrar</button>
</form></main>`
  });
}

export function renderDisabled() {
  return page({
    title: 'Panel deshabilitado · Chacalde',
    body: `<main class="in" style="padding-top:80px"><h1 class="display" style="font-size:44px">Panel deshabilitado</h1>
<p style="color:var(--muted);max-width:52ch">Falta la contraseña de administración. En Coolify, agrega la variable <b>ADMIN_PASSWORD</b> (mínimo 12 caracteres) a chacalde-web y vuelve a desplegar.</p></main>`
  });
}

// Nice upper bound for an axis: 1, 2, 5 × 10^k.
function niceMax(v) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

// Column chart: one series, thin columns from one baseline, rounded data-end, hover tooltip via <title>.
function columns({ values, labels, titles, every = 1, W = 1000, H = 260 }) {
  const m = { l: 46, r: 8, t: 22, b: 30 };
  const pw = W - m.l - m.r;
  const ph = H - m.t - m.b;
  const n = values.length;
  const max = Math.max(0, ...values);
  const top = niceMax(max);
  const slot = pw / n;
  const bw = Math.max(2, Math.min(24, slot - 4));
  const y = (v) => m.t + ph - (v / top) * ph;
  const ticks = [0, top / 4, top / 2, (3 * top) / 4, top];
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de columnas" xmlns="http://www.w3.org/2000/svg" font-family="Atkinson, system-ui, sans-serif">`;
  for (const t of ticks) {
    const yy = y(t).toFixed(1);
    s += `<line x1="${m.l}" x2="${W - m.r}" y1="${yy}" y2="${yy}" stroke="#262626" stroke-width="1"/>`;
    s += `<text x="${m.l - 10}" y="${yy}" fill="#8a8a8a" font-size="13" text-anchor="end" dominant-baseline="middle">${num(Math.round(t))}</text>`;
  }
  const maxIdx = max > 0 ? values.lastIndexOf(max) : -1;
  values.forEach((v, i) => {
    const cx = m.l + slot * i + slot / 2;
    const x = cx - bw / 2;
    const h = (v / top) * ph;
    s += `<g class="slot"><title>${esc(titles[i])}</title><rect class="hit" x="${(m.l + slot * i).toFixed(1)}" y="${m.t}" width="${slot.toFixed(1)}" height="${ph}" fill="transparent"/>`;
    if (h > 0) {
      const r = Math.min(4, bw / 2, h);
      const yt = m.t + ph - h;
      const yb = m.t + ph;
      s += `<path class="bar" fill="#ffffff" d="M${x.toFixed(1)} ${yb}V${(yt + r).toFixed(1)}Q${x.toFixed(1)} ${yt.toFixed(1)} ${(x + r).toFixed(1)} ${yt.toFixed(1)}H${(x + bw - r).toFixed(1)}Q${(x + bw).toFixed(1)} ${yt.toFixed(1)} ${(x + bw).toFixed(1)} ${(yt + r).toFixed(1)}V${yb}Z"/>`;
    }
    s += '</g>';
    if (i === maxIdx) {
      s += `<text x="${cx.toFixed(1)}" y="${(y(v) - 8).toFixed(1)}" fill="#ffffff" font-size="14" font-weight="700" text-anchor="middle">${num(v)}</text>`;
    }
    if (i % every === 0 || i === n - 1) {
      s += `<text x="${cx.toFixed(1)}" y="${H - 8}" fill="#8a8a8a" font-size="13" text-anchor="middle">${esc(labels[i])}</text>`;
    }
  });
  s += `<line x1="${m.l}" x2="${W - m.r}" y1="${m.t + ph}" y2="${m.t + ph}" stroke="#4a4a4a" stroke-width="1"/>`;
  return `${s}</svg>`;
}

export function renderDashboard({ base, me, summary, range, today, warning }) {
  const { days, total, hoursToday, since } = summary;
  const sum = (e) => days.reduce((a, d) => a + d[e], 0);
  const r = Object.fromEntries(EVENTS.map((e) => [e, sum(e)]));
  const todayRow = days[days.length - 1];
  const last7 = days.slice(-7).reduce((a, d) => a + d.cert, 0);
  const rangeLabel = `últimos ${RANGES[range]}`;

  const every = days.length <= 14 ? 1 : days.length <= 31 ? 3 : days.length <= 90 ? 10 : 30;
  const dayChart = columns({
    values: days.map((d) => d.cert),
    labels: days.map((d) => shortDay(d.day)),
    titles: days.map((d) => `${dWeek.format(asDate(d.day))} ${shortDay(d.day)}: ${num(d.cert)} certificados · ${num(d.visit)} visitas`),
    every
  });
  const hourChart = columns({
    values: hoursToday.map((h) => h.cert),
    labels: hoursToday.map((_, i) => `${i} h`),
    titles: hoursToday.map((h, i) => `${i}:00–${i}:59: ${num(h.cert)} certificados · ${num(h.visit)} visitas`),
    every: 3,
    H: 220
  });

  const td = (n) => `<td${n ? '' : ' class="zero"'}>${num(n)}</td>`;
  const rows = [...days]
    .reverse()
    .map(
      (d) =>
        `<tr${d.day === today ? ' class="today"' : ''}><td>${esc(`${dWeek.format(asDate(d.day))} ${dLong.format(asDate(d.day))}`)}</td>${td(d.visit)}${td(d.cert)}<td>${pct(
          d.cert,
          d.visit
        )}</td>${td(d.pdf)}${td(d.print)}${td(d.photo)}${td(d.zip)}${td(d.share)}</tr>`
    )
    .join('');

  const tabs = Object.entries(RANGES)
    .map(([k, label]) => `<a href="${base}?d=${k}"${Number(k) === range ? ' aria-current="page"' : ''}>${label}</a>`)
    .join('');

  const tile = (t, v, s = '') => `<div class="tile"><p class="t">${t}</p><div class="v">${v}</div>${s ? `<p class="s">${s}</p>` : ''}</div>`;

  const body = `${topbar(base, me, 'dash')}
<main class="in">
${warning ? `<p class="warn" role="alert">${esc(warning)}</p>` : ''}
<section class="hero" aria-label="Resumen">
  <div><p class="lbl">Certificados solicitados · desde el inicio</p><p class="big">${num(total.cert)}</p></div>
  <div class="side"><div><p class="lbl">Hoy</p><b>${num(todayRow.cert)}</b></div><div><p class="lbl">Últimos 7 días</p><b>${num(last7)}</b></div></div>
</section>
<p class="since">${since ? `Datos desde el ${esc(dLong.format(new Date(since)))}` : 'Aún no hay datos'} · hora de Panamá · se actualiza cada minuto</p>
<nav class="range" aria-label="Periodo"><span>Periodo</span>${tabs}</nav>
<section class="tiles" aria-label="Totales del periodo">
${tile('Certificados solicitados', num(r.cert), rangeLabel)}
${tile('Visitas', num(r.visit), 'aperturas de la página')}
${tile('Conversión', pct(r.cert, r.visit), 'certificados ÷ visitas')}
${tile('PDF', num(r.pdf + r.print), `${num(r.pdf)} descargas · ${num(r.print)} impresiones`)}
${tile('Fotos', num(r.photo + r.zip), `${num(r.photo)} sueltas · ${num(r.zip)} ZIP`)}
${tile('Compartidos', num(r.share), 'menú de compartir del teléfono')}
</section>
<section class="card"><h2 class="display">Certificados por día</h2><p class="note">${esc(rangeLabel)} · pasa el cursor sobre una columna para ver el detalle</p><div class="chart">${dayChart}</div></section>
<section class="card"><h2 class="display">Hoy, por hora</h2><p class="note">Certificados solicitados hoy en cada hora (Panamá)</p><div class="chart">${hourChart}</div></section>
<section class="card"><h2 class="display">Detalle por día</h2><p class="note">${esc(rangeLabel)}, el más reciente arriba</p>
<div class="tablewrap"><table><thead><tr><th>Día</th><th>Visitas</th><th>Certificados</th><th>Conversión</th><th>PDF</th><th>Impresiones</th><th>Fotos</th><th>ZIP</th><th>Compartidos</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><td>Total del periodo</td>${td(r.visit)}${td(r.cert)}<td>${pct(r.cert, r.visit)}</td>${td(r.pdf)}${td(r.print)}${td(r.photo)}${td(r.zip)}${td(r.share)}</tr></tfoot></table></div></section>
<p class="foot">Conteo anónimo: no se guardan nombres, direcciones IP ni cookies de los visitantes. Las visitas repetidas de un mismo navegador en 30 minutos cuentan una vez.</p>
</main>`;
  return page({ title: 'Panel · Chacalde', body, refresh: true });
}

export function toCsv(metrics) {
  const days = metrics.allDays();
  const { days: rows } = metrics.summary(days);
  const head = ['dia', 'visitas', 'certificados', 'pdf', 'impresiones', 'fotos', 'zip', 'compartidos'];
  const lines = rows.map((d) => [d.day, d.visit, d.cert, d.pdf, d.print, d.photo, d.zip, d.share].join(','));
  return `${head.join(',')}\n${lines.join('\n')}\n`;
}

// ---------- users (owner only) ----------
export function renderUsers({ base, me, users, owner, notice = '', error = '', reveal = null }) {
  const when = (iso) => (iso ? esc(dLong.format(new Date(iso))) : '—');
  const rows = users.length
    ? users
        .map(
          (u) => `<tr><td><b>${esc(u.name)}</b></td><td>${when(u.created)}</td><td>${when(u.reset)}</td><td style="text-align:right">
<form class="inline" method="post" action="${base}/usuarios"><input type="hidden" name="action" value="reset"><input type="hidden" name="name" value="${esc(u.name)}"><button class="btn" type="submit">Nueva contraseña</button></form>
<form class="inline" method="post" action="${base}/usuarios"><input type="hidden" name="action" value="remove"><input type="hidden" name="name" value="${esc(u.name)}"><button class="btn btn--danger" type="submit">Quitar acceso</button></form></td></tr>`
        )
        .join('')
    : '<tr><td colspan="4" class="zero">Todavía no hay usuarios. Crea el primero arriba.</td></tr>';
  const body = `${topbar(base, me, 'users')}
<main class="in">
${error ? `<p class="warn" role="alert">${esc(error)}</p>` : ''}
${notice ? `<p class="ok" role="status">${esc(notice)}</p>` : ''}
${
  reveal
    ? `<section class="card" aria-label="Contraseña nueva"><h2 class="display">Contraseña de ${esc(reveal.name)}</h2>
<p class="note">Cópiala ahora y mándasela por un canal privado. No se vuelve a mostrar: si se pierde, genera otra.</p>
<p class="lbl" style="margin-top:14px">Usuario</p><div class="secret" style="font-size:22px">${esc(reveal.name)}</div>
<p class="lbl" style="margin-top:16px">Contraseña</p><div class="secret">${esc(reveal.password)}</div></section>`
    : ''
}
<section class="card"><h2 class="display">Crear usuario</h2>
<p class="note">Ve métricas, descarga el CSV y genera la imagen para compartir. No puede crear ni quitar usuarios. El panel genera la contraseña.</p>
<form method="post" action="${base}/usuarios"><input type="hidden" name="action" value="create">
<div class="field"><div><label for="name">Nombre de usuario</label><input id="name" name="name" required maxlength="24" pattern="[a-z0-9][a-z0-9._\\-]{2,23}" placeholder="jefe" autocapitalize="none" spellcheck="false"></div>
<button class="btn" type="submit" style="height:40px">Crear y generar contraseña</button></div>
<p class="note" style="margin:10px 0 0">De 3 a 24 caracteres: minúsculas, números, punto, guion o guion bajo.</p></form></section>
<section class="card"><h2 class="display">Con acceso</h2>
<p class="note">Tú entras como <b>${esc(owner)}</b> (dueño, contraseña de Coolify). "Nueva contraseña" y "Quitar acceso" cierran al instante sus sesiones abiertas.</p>
<div class="tablewrap"><table><thead><tr><th>Usuario</th><th>Creado</th><th>Última contraseña nueva</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></section>
</main>`;
  return page({ title: 'Usuarios · Panel Chacalde', body });
}

// ---------- promo image (9:16) ----------
const hourLabel = (h) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;

export function renderShare({ base, me, facts }) {
  const { total, peakDay, peakHour } = facts;
  const items = [];
  if (peakDay) items.push({ v: num(peakDay.n), l: `Récord en un día · ${shortDay(peakDay.day).toUpperCase()}` });
  if (peakHour) items.push({ v: hourLabel(peakHour.hour), l: 'Hora pico para incapacitarse' });
  if (total.share) items.push({ v: num(total.share), l: 'Veces compartida en redes' });
  if (total.print) items.push({ v: num(total.print), l: 'La imprimieron (¿para qué?)' });
  if (items.length < 4 && total.pdf) items.push({ v: num(total.pdf), l: 'PDF descargados' });
  if (items.length < 4 && total.visit) items.push({ v: num(total.visit), l: 'Visitas al consultorio' });
  const data = {
    total: num(total.cert),
    asOf: dLong.format(asDate(facts.asOf)).replace('.', '').toUpperCase(),
    facts: items.slice(0, 4)
  };
  const list = data.facts.map((f) => `<li><b>${esc(f.v)}</b> · ${esc(f.l)}</li>`).join('');
  const body = `${topbar(base, me, 'share')}
<main class="in"><div class="share">
<canvas id="story" width="1080" height="1920" role="img" aria-label="Imagen 9:16 con el total de certificados y datos curiosos" data-stats="${esc(JSON.stringify(data))}" data-file="chacalde-${esc(facts.asOf)}.jpg"></canvas>
<div><h1 class="display" style="font-size:44px">Imagen para compartir</h1>
<p style="color:var(--muted);max-width:52ch;margin:12px 0 0">Formato historia (9:16), con los números de hoy. Desde el teléfono, "Compartir" abre Instagram o WhatsApp directo; desde la compu se descarga.</p>
<div class="actions"><button class="btn btn--on" id="share" type="button" disabled>Preparando…</button><button class="btn" id="download" type="button" disabled>Descargar</button></div>
<p class="lbl" style="margin-top:28px">Lo que dice</p>
<ul><li><b>${esc(data.total)}</b> · disque pacientes atendidos (total desde el inicio)</li>${list}</ul>
<p class="since">Al ${esc(dLong.format(asDate(facts.asOf)))}. Solo números anónimos: nunca nombres.</p></div>
</div></main>`;
  return page({ title: 'Imagen para compartir · Panel Chacalde', body, script: `${base}/compartir.js` });
}
