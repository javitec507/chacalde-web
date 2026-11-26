// Mystery Pack console: campaign switch, variants, numbered cards, card designs (drag & drop) and print files.
(() => {
  const root = document.getElementById('app');
  const CFG = JSON.parse(root.dataset.cfg);
  const B = CFG.base;
  const P = window.MPPDF;
  const EFFECTS = { holo: 'Holo (arcoíris)', reverse: 'Reverse holo', refractor: 'Refractor (prisma)', super: 'Super refractor (oro)', oneofone: '1 de 1 (negro y oro)', none: 'Sin brillo' };
  const FONTS = { archivo: 'Archivo display', atkinson: 'Atkinson negrita', 'atkinson-regular': 'Atkinson regular', doto: 'Doto (LED)' };
  const PROTECTORS = ['One-Touch magnético 35pt', 'One-Touch magnético 55pt', 'Toploader + funda', 'Card saver + funda', 'Funda suave'];

  let S = null;
  const ui = { tab: 'campana', variantId: null, vform: null, designId: null, d: null, dirty: false, side: 'front', field: null, sample: null, confirm: null, codes: {}, edits: {}, pre: {}, busy: '' };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const $ = (s, el = root) => el.querySelector(s);
  const $$ = (s, el = root) => [...el.querySelectorAll(s)];
  const setup = () => S.settings.card;
  const bleedW = () => setup().trimW + 2 * setup().bleed;
  const bleedH = () => setup().trimH + 2 * setup().bleed;
  const variants = () => Object.values(S.variants).sort((a, b) => (a.created < b.created ? -1 : 1));
  const designs = () => Object.values(S.designs).sort((a, b) => (a.created < b.created ? -1 : 1));
  const cardsOf = (vid) => S.cards.filter((c) => c.variantId === vid).sort((a, b) => a.n - b.n);
  const designFor = (card) => S.designs[card.designId] || S.designs[(S.variants[card.variantId] || {}).designId] || S.designs[S.settings.defaultDesign] || null;
  const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

  const toasts = document.createElement('div');
  toasts.className = 'toasts';
  document.body.appendChild(toasts);
  function toast(msg, bad = false) {
    const t = document.createElement('div');
    t.className = `toast${bad ? ' bad' : ''}`;
    t.setAttribute('role', bad ? 'alert' : 'status');
    t.textContent = msg;
    toasts.appendChild(t);
    while (toasts.children.length > 3) toasts.firstChild.remove();
    setTimeout(() => t.remove(), bad ? 6000 : 3200);
  }

  async function api(action, data) {
    const r = await fetch(`${B}/mp/api/${action}`, {
      method: data === undefined ? 'GET' : 'POST',
      headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data),
      credentials: 'same-origin'
    });
    if (r.status === 401) {
      location.href = B;
      throw new Error('Sesión vencida');
    }
    const j = await r.json().catch(() => ({ error: `Error ${r.status}` }));
    if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
    if (j.settings) S = j;
    return j;
  }

  async function act(fn, ok) {
    try {
      await fn();
      if (ok) toast(ok);
      render();
    } catch (e) {
      toast(e.message, true);
    }
  }

  function download(bytes, name, type) {
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  }

  // ---------- card data used to print ----------
  function ctxFor(card, code) {
    const v = S.variants[card.variantId] || {};
    const full = code || `${S.settings.edition.code}-${v.abbr || 'XX'}-••••-${card.last4 || '••••'}`;
    return { name: card.name, variant: v.name, n: card.n, total: v.total, code: full, edition: S.settings.edition.name, url: `${location.origin}/canje#${full}` };
  }
  function sampleCtx() {
    const card = S.cards.find((c) => c.id === ui.sample) || S.cards[0];
    if (!card) return { name: 'Nombre del premio', variant: 'Holo', n: 3, total: 25, code: `${S.settings.edition.code}-HL-K7Q4-9XWD`, edition: S.settings.edition.name, url: `${location.origin}/canje#${S.settings.edition.code}-HL-K7Q4-9XWD` };
    const code = (ui.codes[card.variantId] || {})[card.id];
    return { ...ctxFor(card, code), name: card.name || 'Nombre del premio' };
  }
  async function loadCodes(variantId) {
    if (ui.codes[variantId]) return ui.codes[variantId];
    const { codes } = await api('codes', { variantId, purpose: 'preview' });
    ui.codes[variantId] = Object.fromEntries(codes.map((c) => [c.id, c.code]));
    return ui.codes[variantId];
  }

  // ---------- preflight ----------
  function sideIssues(side, label, out) {
    const st = setup();
    if (side.file && side.px && side.px.w) {
      const dpi = Math.min(side.px.w / (bleedW() / 25.4), side.px.h / (bleedH() / 25.4));
      const ar = side.px.w / side.px.h;
      const want = bleedW() / bleedH();
      const diff = Math.abs(ar - want) / want;
      if (dpi < 200) out.push(['bad', `${label}: resolución baja (${Math.round(dpi)} dpi; mínimo 300). Súbela más grande.`]);
      else if (dpi < 300) out.push(['warn', `${label}: ${Math.round(dpi)} dpi (ideal 300 o más).`]);
      if (diff > 0.02) out.push(['warn', `${label}: la proporción no coincide con la carta + sangrado; se recorta un ${Math.round(diff * 100)}%.`]);
    }
    for (const f of side.fields) {
      const L = P.LABELS[f.key];
      if (f.key === 'qr') {
        const s = Math.min(f.w, f.h);
        if (s < 10) out.push(['bad', `${label}: el QR mide ${s.toFixed(1)} mm (mínimo 12, ideal 15+).`]);
        else if (s < 15) out.push(['warn', `${label}: el QR mide ${s.toFixed(1)} mm (ideal 15 o más).`]);
      }
      if (f.x < st.safe || f.y < st.safe || f.x + f.w > st.trimW - st.safe || f.y + f.h > st.trimH - st.safe) out.push(['warn', `${label}: "${L}" se sale de la zona segura (${st.safe} mm del corte).`]);
    }
  }

  function preflight(v) {
    const out = [];
    const cards = cardsOf(v.id);
    const used = new Map();
    for (const c of cards) {
      const d = designFor(c);
      if (!d) {
        out.push(['bad', `N° ${P.pad(c.n, v.total)} no tiene diseño asignado.`]);
        continue;
      }
      if (!used.has(d.id)) used.set(d.id, []);
      used.get(d.id).push(c);
    }
    for (const [did, list] of used) {
      const d = S.designs[did];
      const name = `Diseño "${d.name}"`;
      if (!d.sides.front.file) out.push(['bad', `${name}: falta el arte del frente.`]);
      if (!d.sides.back.file) out.push(['warn', `${name}: sin arte de reverso (se imprime solo con los campos del reverso o solo frente).`]);
      sideIssues(d.sides.front, `${name} · frente`, out);
      sideIssues(d.sides.back, `${name} · reverso`, out);
      const all = [...d.sides.front.fields, ...d.sides.back.fields];
      if (!all.some((f) => f.key === 'code' || f.key === 'qr')) out.push(['bad', `${name}: la carta no lleva código ni QR de canje.`]);
      if (!all.some((f) => f.key === 'number')) out.push(['warn', `${name}: no lleva numeración.`]);
      const nameFields = all.filter((f) => f.key === 'name' || (f.key === 'text' && /\{name\}/.test(f.text)));
      if (nameFields.length) {
        const empty = list.filter((c) => !c.name.trim());
        if (empty.length) out.push(['bad', `Faltan nombres en ${empty.length} carta(s): N° ${empty.slice(0, 8).map((c) => P.pad(c.n, v.total)).join(', ')}${empty.length > 8 ? '…' : ''}.`]);
        for (const f of nameFields) {
          const m = P.measureCss(f.font);
          const long = list.filter((c) => c.name && P.fitSize(f, P.fieldText(f, ctxFor(c)), m).size < Math.max(5, f.size * 0.55));
          if (long.length) out.push(['warn', `${long.length} nombre(s) se achican mucho para caber: N° ${long.slice(0, 6).map((c) => P.pad(c.n, v.total)).join(', ')}. Considera nombres más cortos o una caja más ancha.`]);
        }
      }
    }
    if (!out.length) out.push(['ok', 'Todo listo para imprenta.']);
    ui.pre[v.id] = out;
    return out;
  }
  const level = (issues) => (issues.some((i) => i[0] === 'bad') ? 'bad' : issues.some((i) => i[0] === 'warn') ? 'warn' : 'ok');

  // ---------- layout ----------
  function render() {
    const tabs = [
      ['campana', 'Campaña'],
      ['variantes', 'Variantes y cartas'],
      ['disenos', 'Diseños'],
      ['imprenta', 'Imprenta']
    ];
    const st = S.settings.campaign.state;
    root.innerHTML = `<header class="top"><div class="in"><a class="brand" href="${B}"><img src="/img/logo-white.png" alt="Chacalde"><span>Mystery Pack · Redemption Cards</span></a>
<span class="pill ${st === 'on' ? 'ok' : st === 'off' ? 'warn' : ''}">Campaña ${st === 'on' ? 'activa' : st === 'off' ? 'apagada' : 'cerrada'}</span>
<nav><span class="note" style="margin:0;align-self:center">${esc(CFG.user)}${CFG.owner ? ' · dueño' : ''}</span><a class="btn" href="${B}">← Panel</a></nav></div></header>
<div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-act="tab" data-k="${k}" aria-selected="${ui.tab === k}">${l}</button>`).join('')}</div>
<main id="main"></main>`;
    const main = $('#main');
    if (ui.tab === 'campana') main.innerHTML = viewCampaign();
    if (ui.tab === 'variantes') main.innerHTML = viewVariants();
    if (ui.tab === 'disenos') {
      main.innerHTML = viewDesigns();
      mountEditor();
    }
    if (ui.tab === 'imprenta') main.innerHTML = viewPrint();
  }

  // ---------- campaign ----------
  function viewCampaign() {
    const s = S.settings;
    const st = s.campaign.state;
    const named = S.cards.filter((c) => c.name.trim()).length;
    const label = { off: 'APAGADA', on: 'ACTIVA', closed: 'CERRADA' }[st];
    const explain = {
      off: 'Ningún código se puede canjear, aunque alguien lo tenga en la mano (imprenta, empaque…). La página de canje no existe para el público.',
      on: 'Los códigos ya se pueden canjear en chacalde.com/canje (hasta el vencimiento de la edición).',
      closed: 'La campaña terminó: ningún código se puede canjear.'
    }[st];
    let buttons = '';
    if (!CFG.owner) buttons = '<p class="note">Solo el dueño puede encender o apagar la campaña.</p>';
    else if (ui.confirm) {
      const what = { on: 'ENCENDER: desde ese momento los códigos impresos se pueden canjear.', off: 'APAGAR: los códigos dejan de funcionar hasta que la vuelvas a encender.', closed: 'CERRAR: la campaña termina y nadie más puede canjear.' }[ui.confirm];
      buttons = `<p style="margin:14px 0 10px;font-weight:700">¿Seguro que quieres ${esc(what)}</p><div class="row"><button class="btn primary" data-act="camp-yes">Sí, confirmar</button><button class="btn" data-act="camp-no">Cancelar</button></div>`;
    } else {
      buttons = `<div class="row" style="margin-top:14px">${st !== 'on' ? '<button class="btn primary" data-act="camp" data-s="on">Encender campaña</button>' : ''}${st === 'on' ? '<button class="btn" data-act="camp" data-s="off">Apagar</button>' : ''}${st !== 'closed' ? '<button class="btn danger" data-act="camp" data-s="closed">Cerrar campaña</button>' : ''}${st === 'closed' ? '<button class="btn" data-act="camp" data-s="off">Reabrir (apagada)</button>' : ''}</div>`;
    }
    const e = s.edition;
    const c = s.card;
    return `<section class="card"><p class="lbl">Estado de la campaña</p><div class="led ${st}">${label}</div><p class="note" style="max-width:70ch;font-size:14px">${esc(explain)}${s.campaign.changedAt ? ` · Último cambio: ${esc(new Date(s.campaign.changedAt).toLocaleString('es-PA'))} por ${esc(s.campaign.changedBy)}` : ''}</p>${buttons}
<div class="stats"><div><p class="lbl">Variantes</p><b>${variants().length}</b></div><div><p class="lbl">Cartas</p><b>${S.cards.length}</b></div><div><p class="lbl">Con nombre</p><b>${named}</b></div><div><p class="lbl">Canjeadas</p><b>${S.cards.filter((x) => x.status !== 'available' && x.status !== 'void').length}</b></div></div></section>
<section class="card"><h2 class="display">Edición y medida de la carta</h2><p class="note">Todo se calcula con esto: posiciones, PDFs y revisión. Medida estándar de carta: 63.5 × 88.9 mm (2.5 × 3.5 in).</p>
<div class="row"><div class="f w1"><label>Código</label><input id="e-code" value="${esc(e.code)}" maxlength="8"></div><div class="f w3"><label>Nombre de la edición</label><input id="e-name" value="${esc(e.name)}" maxlength="60"></div><div class="f w2"><label>Vence</label><input id="e-exp" type="date" value="${esc(e.expires)}"></div></div>
<div class="row" style="margin-top:12px"><div class="f w1"><label>Ancho (mm)</label><input id="c-w" type="number" step="0.1" value="${c.trimW}"></div><div class="f w1"><label>Alto (mm)</label><input id="c-h" type="number" step="0.1" value="${c.trimH}"></div><div class="f w1"><label>Sangrado</label><input id="c-b" type="number" step="0.5" value="${c.bleed}"></div><div class="f w1"><label>Zona segura</label><input id="c-s" type="number" step="0.5" value="${c.safe}"></div>
<div class="f w2"><label>Diseño por defecto</label><select id="c-dd"><option value="">—</option>${designs().map((d) => `<option value="${d.id}"${d.id === s.defaultDesign ? ' selected' : ''}>${esc(d.name)}</option>`).join('')}</select></div>
<label class="check"><input id="c-m" type="checkbox"${c.marks ? ' checked' : ''}> Marcas de corte</label><label class="check"><input id="c-pc" type="checkbox"${s.photoCheck ? ' checked' : ''}> Pedir foto de la tarjeta al canjear</label>
<button class="btn primary" data-act="save-settings">Guardar</button></div></section>
<section class="card"><h2 class="display">Bitácora</h2><div class="tablewrap" style="max-height:340px"><table><tbody>${S.audit.map((a) => `<tr><td style="white-space:nowrap;color:var(--muted)">${esc(new Date(a.at).toLocaleString('es-PA'))}</td><td>${esc(a.by)}</td><td>${esc(a.what)}</td></tr>`).join('') || '<tr><td>Sin movimientos todavía.</td></tr>'}</tbody></table></div></section>`;
  }

  // ---------- variants & cards ----------
  function viewVariants() {
    const list = variants();
    if (!ui.variantId && list[0]) ui.variantId = list[0].id;
    const sel = S.variants[ui.variantId];
    const f = ui.vform;
    const items = list
      .map((v) => {
        const cs = cardsOf(v.id);
        return `<button class="vitem" data-act="pick-v" data-id="${v.id}" aria-current="${v.id === ui.variantId}"><span class="sw" style="background:${esc(v.color)}"></span><span><b>${esc(v.name)} <span class="pill">${esc(v.abbr)}</span></b><small>${cs.length} cartas · ${cs.filter((c) => c.name.trim()).length} con nombre · ${esc(EFFECTS[v.effect] || '')}</small></span></button>`;
      })
      .join('');
    const form = f
      ? `<section class="card"><h2 class="display">${f.id ? 'Editar variante' : 'Nueva variante'}</h2>
<div class="row"><div class="f grow"><label>Nombre</label><input id="v-name" value="${esc(f.name)}" placeholder="Holo, Refractor, Super Refractor…" maxlength="50"></div><div class="f w1"><label>Abreviatura</label><input id="v-abbr" value="${esc(f.abbr)}" placeholder="HL" maxlength="3"></div></div>
<div class="row" style="margin-top:10px"><div class="f"><label>Color</label><input id="v-color" type="color" value="${esc(f.color)}"></div><div class="f grow"><label>Brillo en la web</label><select id="v-effect">${Object.entries(EFFECTS).map(([k, l]) => `<option value="${k}"${k === f.effect ? ' selected' : ''}>${l}</option>`).join('')}</select></div><div class="f w1"><label>Tiraje</label><input id="v-total" type="number" min="1" max="5000" value="${f.total}"></div></div>
<div class="row" style="margin-top:10px"><div class="f grow"><label>Acabado de imprenta</label><input id="v-finish" value="${esc(f.finish)}" placeholder="Foil holográfico, cartulina refractora…" maxlength="80"></div></div>
<div class="row" style="margin-top:10px"><div class="f grow"><label>Protector para entregar</label><input id="v-prot" list="prot" value="${esc(f.protector)}" maxlength="60"><datalist id="prot">${PROTECTORS.map((p) => `<option value="${esc(p)}">`).join('')}</datalist></div></div>
<div class="row" style="margin-top:10px"><div class="f grow"><label>Diseño de la variante</label><select id="v-design"><option value="">Usar el diseño por defecto</option>${designs().map((d) => `<option value="${d.id}"${d.id === f.designId ? ' selected' : ''}>${esc(d.name)}</option>`).join('')}</select></div></div>
<p class="note" style="margin-top:12px">Al guardar, el sistema crea las cartas numeradas del 1 al tiraje, cada una con su código único (${esc(S.settings.edition.code)}-${esc(f.abbr || 'XX')}-XXXX-XXXX).</p>
<div class="row">${f.confirmShrink ? '<p class="note" style="color:var(--warn)">Esta variante ya se exportó: guardar baja el tiraje y anula los números de arriba.</p>' : ''}<button class="btn primary" data-act="save-v">Guardar variante</button><button class="btn" data-act="cancel-v">Cancelar</button>${f.id ? '<button class="btn danger" data-act="del-v">Borrar</button>' : ''}</div></section>`
      : '';
    let cardsHtml = '<section class="card"><p class="note">Crea tu primera variante para generar sus cartas.</p></section>';
    if (sel && !f) {
      const cs = cardsOf(sel.id);
      const codes = ui.codes[sel.id];
      const rows = cs
        .map((c) => {
          const e = ui.edits[c.id] || {};
          const name = 'name' in e ? e.name : c.name;
          const loc = 'location' in e ? e.location : c.location;
          const dsel = 'designId' in e ? e.designId : c.designId;
          return `<tr><td class="n">${P.pad(c.n, sel.total)}/${sel.total}</td><td><input data-edit="name" data-id="${c.id}" value="${esc(name)}" placeholder="Nombre del premio" maxlength="80"></td>
<td><input data-edit="location" data-id="${c.id}" value="${esc(loc)}" placeholder="Caja A · 12" maxlength="40"></td>
<td><select data-edit="designId" data-id="${c.id}"><option value="">De la variante</option>${designs().map((d) => `<option value="${d.id}"${d.id === dsel ? ' selected' : ''}>${esc(d.name)}</option>`).join('')}</select></td>
<td style="font-family:Doto,monospace;font-weight:900;white-space:nowrap">${esc(codes ? codes[c.id] : `${S.settings.edition.code}-${sel.abbr}-••••-${c.last4}`)}</td>
<td><span class="pill${c.status === 'available' ? '' : ' ok'}">${esc({ available: 'Sin canjear', claimed: 'Canjeada', approved: 'Aprobada', prepared: 'Preparada', delivered: 'Entregada', void: 'Anulada' }[c.status] || c.status)}</span></td>
<td><button class="btn sm" data-act="pdf-card" data-id="${c.id}">PDF</button></td></tr>`;
        })
        .join('');
      const dirty = Object.keys(ui.edits).length;
      cardsHtml = `<section class="card"><div class="row" style="justify-content:space-between;align-items:center"><div><h2 class="display">${esc(sel.name)} <span class="pill">${esc(sel.abbr)}</span></h2><p class="note">${cs.length} cartas · ${esc(EFFECTS[sel.effect] || '')} · ${esc(sel.finish || 'sin acabado definido')} · ${esc(sel.protector || 'sin protector definido')}</p></div>
<div class="row"><button class="btn" data-act="edit-v">Editar variante</button><button class="btn" data-act="show-codes">${codes ? 'Ocultar códigos' : 'Mostrar códigos'}</button><button class="btn" data-act="paste">Pegar nombres</button><button class="btn primary" data-act="save-cards"${dirty ? '' : ' disabled'}>Guardar cambios${dirty ? ` (${dirty})` : ''}</button></div></div>
${ui.paste ? `<div class="f" style="margin:6px 0 14px"><label>Un nombre por línea, en orden desde el N° 1</label><textarea id="paste-box" placeholder="Nombre del premio 1&#10;Nombre del premio 2"></textarea><div class="row" style="margin-top:8px"><button class="btn primary" data-act="paste-apply">Poner nombres</button><button class="btn" data-act="paste">Cerrar</button></div></div>` : ''}
<div class="tablewrap"><table><thead><tr><th>N°</th><th>Nombre del premio</th><th>Ubicación</th><th>Diseño</th><th>Código</th><th>Estado</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
    }
    return `<div class="grid2"><div><section class="card"><div class="row" style="justify-content:space-between"><h2 class="display">Variantes</h2><button class="btn primary sm" data-act="new-v">+ Nueva</button></div><p class="note">Tú defines cuántas y de qué tipo.</p><div class="vlist">${items || '<p class="note">Todavía no hay variantes.</p>'}</div></section></div><div>${form}${cardsHtml}</div></div>`;
  }

  // ---------- designs (editor) ----------
  function viewDesigns() {
    const list = designs();
    if (!ui.d && ui.designId && S.designs[ui.designId]) ui.d = clone(S.designs[ui.designId]);
    if (!ui.d && list[0]) {
      ui.designId = list[0].id;
      ui.d = clone(list[0]);
    }
    const items = list.map((d) => `<button class="btn${d.id === ui.designId ? ' on' : ''}" data-act="pick-d" data-id="${d.id}">${esc(d.name)}${d.id === S.settings.defaultDesign ? ' ★' : ''}</button>`).join('');
    const head = `<section class="card"><div class="row" style="justify-content:space-between;align-items:center"><div class="row">${items}<button class="btn primary" data-act="new-d">+ Nuevo diseño</button></div></div><p class="note" style="margin:10px 0 0">★ = diseño por defecto. Cada variante puede usar el suyo, y cada carta también.</p></section>`;
    if (!ui.d) return `${head}<section class="card"><p class="note">Crea un diseño y sube el arte del frente y del reverso.</p></section>`;
    const d = ui.d;
    const side = d.sides[ui.side];
    const sample = S.cards.length
      ? `<div class="f grow"><label>Vista previa con</label><select id="sample">${variants()
          .map((v) => cardsOf(v.id).map((c) => `<option value="${c.id}"${c.id === (ui.sample || S.cards[0].id) ? ' selected' : ''}>${esc(v.abbr)} ${P.pad(c.n, v.total)}/${v.total} · ${esc(c.name || 'sin nombre')}</option>`).join(''))
          .join('')}</select></div>`
      : '';
    let info = '<p class="note">Sin arte todavía.</p>';
    if (side.file && side.px) {
      const dpi = Math.min(side.px.w / (bleedW() / 25.4), side.px.h / (bleedH() / 25.4));
      const want = bleedW() / bleedH();
      const diff = Math.abs(side.px.w / side.px.h - want) / want;
      info = `<p class="note">${side.px.w} × ${side.px.h} px · <span class="pill ${dpi >= 300 ? 'ok' : dpi >= 200 ? 'warn' : 'bad'}">${Math.round(dpi)} dpi</span> ${diff > 0.02 ? `<span class="pill warn">se recorta ${Math.round(diff * 100)}%</span>` : '<span class="pill ok">proporción OK</span>'}</p>`;
    }
    const need = `Ideal: ${Math.ceil((bleedW() / 25.4) * 300)} × ${Math.ceil((bleedH() / 25.4) * 300)} px o más (carta + sangrado a 300 dpi).`;
    return `${head}<section class="card"><div class="row" style="justify-content:space-between;align-items:flex-end"><div class="f w3"><label>Nombre del diseño</label><input id="d-name" value="${esc(d.name)}" maxlength="60"></div>
<div class="row"><button class="btn" data-act="default-d"${d.id === S.settings.defaultDesign ? ' disabled' : ''}>Usar por defecto</button><button class="btn danger" data-act="del-d">Borrar</button><button class="btn primary" data-act="save-d">${ui.dirty ? 'Guardar diseño •' : 'Guardado'}</button></div></div></section>
<section class="card ed"><div><div class="sidebtns"><button class="btn${ui.side === 'front' ? ' on' : ''}" data-act="side" data-s="front">Frente</button><button class="btn${ui.side === 'back' ? ' on' : ''}" data-act="side" data-s="back">Reverso</button>
<label class="btn" style="margin-left:auto">Subir arte (PNG o JPG)<input id="art" type="file" accept="image/png,image/jpeg,image/webp" hidden></label>${side.file ? '<button class="btn danger sm" data-act="clear-art" style="height:38px">Quitar arte</button>' : ''}</div>
${info}<p class="note" style="margin-top:-8px">${need}</p>
<div class="stagewrap"><div class="stage" id="stage"></div></div>
<div class="legend"><span><i></i>Corte</span><span><i class="s"></i>Zona segura</span><span>Lo que queda fuera del corte es sangrado.</span><span>Flechas del teclado: mover 0.5 mm (Shift: 2 mm).</span></div></div>
<div><div class="row">${sample}</div><p class="lbl" style="margin-top:16px">Agregar campo</p><div class="palette">${Object.entries(P.LABELS).map(([k, l]) => `<button class="btn sm" data-act="add-f" data-k="${k}">+ ${l}</button>`).join('')}</div>
<div class="flist">${side.fields.map((f) => `<button class="btn sm${f.id === ui.field ? ' on' : ''}" data-act="pick-f" data-id="${f.id}">${esc(P.LABELS[f.key])}${f.key === 'text' && f.text ? ` · ${esc(f.text.slice(0, 18))}` : ''}</button>`).join('') || '<p class="note">Sin campos en este lado.</p>'}</div>
<div id="props"></div></div></section>`;
  }

  const DEFAULTS = {
    name: { font: 'archivo', size: 16, h: 9, upper: true },
    variant: { font: 'atkinson', size: 9, h: 5, upper: true, tracking: 0.15 },
    number: { font: 'doto', size: 11, h: 6, text: 'N° {n}/{total}' },
    code: { font: 'doto', size: 11, h: 6 },
    qr: { w: 18, h: 18 },
    edition: { font: 'atkinson', size: 8, h: 5, upper: true, tracking: 0.2 },
    text: { font: 'atkinson', size: 9, h: 5, text: 'Texto' }
  };

  function addField(key) {
    const st = setup();
    const count = ui.d.sides[ui.side].fields.length;
    const base = { id: `f_${Math.random().toString(36).slice(2, 8)}`, key, x: st.safe + 2, y: st.safe + 6 + (count % 6) * 11, w: st.trimW - 2 * (st.safe + 2), h: 8, font: 'atkinson', size: 10, color: '#111111', align: 'center', upper: false, tracking: 0, text: '', ...DEFAULTS[key] };
    if (key === 'qr') {
      base.x = (st.trimW - base.w) / 2;
      base.y = st.trimH - st.safe - base.h - 4;
    }
    ui.d.sides[ui.side].fields.push(base);
    ui.field = base.id;
    ui.dirty = true;
  }

  function mountEditor() {
    const stage = $('#stage');
    if (!stage || !ui.d) return;
    const side = ui.d.sides[ui.side];
    const maxW = Math.min(560, ($('.stagewrap').clientWidth || 600) - 48);
    const k = Math.min(maxW / bleedW(), 640 / bleedH());
    const W = bleedW() * k;
    const H = bleedH() * k;
    const st = setup();
    stage.style.width = `${W}px`;
    stage.style.height = `${H}px`;
    const art = side.preview || side.file;
    stage.innerHTML = `${art ? `<img class="art" src="${B}/mp/file/${art}" alt="">` : '<div class="empty">Sube el arte de este lado.<br>Debe cubrir la carta + sangrado.</div>'}
<div class="trim" style="left:${st.bleed * k}px;top:${st.bleed * k}px;width:${st.trimW * k}px;height:${st.trimH * k}px"></div>
<div class="safe" style="left:${(st.bleed + st.safe) * k}px;top:${(st.bleed + st.safe) * k}px;width:${(st.trimW - 2 * st.safe) * k}px;height:${(st.trimH - 2 * st.safe) * k}px"></div>
<svg class="ink" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"></svg>
${side.fields.map((f) => `<div class="fbox${f.id === ui.field ? ' sel' : ''}" data-f="${f.id}"><span class="tag">${esc(P.LABELS[f.key])}</span><span class="rz"></span></div>`).join('')}`;
    const ctx = sampleCtx();
    const svg = $('svg.ink', stage);
    const ns = 'http://www.w3.org/2000/svg';
    const ox = st.bleed;
    function paint() {
      svg.textContent = '';
      for (const f of side.fields) {
        const box = $(`.fbox[data-f="${f.id}"]`, stage);
        if (box) Object.assign(box.style, { left: `${(ox + f.x) * k}px`, top: `${(ox + f.y) * k}px`, width: `${f.w * k}px`, height: `${f.h * k}px` });
        if (f.key === 'qr') {
          const text = P.fieldText(f, ctx);
          if (!text) continue;
          const m = P.qrMatrix(text);
          const size = Math.min(f.w, f.h);
          const quiet = 2;
          const mod = size / (m.length + 2 * quiet);
          const x0 = ox + f.x + (f.w - size) / 2;
          const y0 = ox + f.y + (f.h - size) / 2;
          const bg = document.createElementNS(ns, 'rect');
          Object.entries({ x: x0 * k, y: y0 * k, width: size * k, height: size * k, fill: P.isLight(f.color) ? '#000' : '#fff' }).forEach(([a, v]) => bg.setAttribute(a, v));
          svg.appendChild(bg);
          let d = '';
          for (let r = 0; r < m.length; r += 1) for (let c = 0; c < m.length; c += 1) if (m[r][c]) d += `M${((x0 + (c + quiet) * mod) * k).toFixed(2)} ${((y0 + (r + quiet) * mod) * k).toFixed(2)}h${(mod * k).toFixed(2)}v${(mod * k).toFixed(2)}h-${(mod * k).toFixed(2)}z`;
          const p = document.createElementNS(ns, 'path');
          p.setAttribute('d', d);
          p.setAttribute('fill', f.color);
          svg.appendChild(p);
          continue;
        }
        const text = P.fieldText(f, ctx);
        if (!text) continue;
        const { size } = P.fitSize(f, text, P.measureCss(f.font));
        const t = document.createElementNS(ns, 'text');
        const x = ox + f.x + (f.align === 'center' ? f.w / 2 : f.align === 'right' ? f.w : 0);
        const baseline = ox + f.y + f.h / 2 + P.CAP * size * P.PT_MM;
        const px = size * P.PT_MM * k;
        Object.entries({ x: x * k, y: baseline * k, fill: f.color, 'font-family': P.CSS_FONTS[f.font], 'font-weight': f.font === 'atkinson' ? 700 : 400, 'font-size': px, 'text-anchor': { left: 'start', center: 'middle', right: 'end' }[f.align], 'letter-spacing': f.tracking * px }).forEach(([a, v]) => t.setAttribute(a, v));
        t.textContent = text;
        svg.appendChild(t);
      }
    }
    paint();
    renderProps(paint);
    ui.paint = () => {
      paint();
      syncProps();
    };

    // drag & resize
    let drag = null;
    stage.addEventListener('pointerdown', (e) => {
      const box = e.target.closest('.fbox');
      if (!box) return;
      const f = side.fields.find((x) => x.id === box.dataset.f);
      if (ui.field !== f.id) {
        ui.field = f.id;
        $$('.fbox', stage).forEach((b) => b.classList.toggle('sel', b === box));
        $$('.flist .btn').forEach((b) => b.classList.toggle('on', b.dataset.id === f.id));
        renderProps(paint);
      }
      drag = { f, mode: e.target.classList.contains('rz') ? 'size' : 'move', sx: e.clientX, sy: e.clientY, x: f.x, y: f.y, w: f.w, h: f.h };
      box.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    stage.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = (e.clientX - drag.sx) / k;
      const dy = (e.clientY - drag.sy) / k;
      const snap = (v) => Math.round(v * 2) / 2;
      if (drag.mode === 'move') {
        drag.f.x = snap(drag.x + dx);
        drag.f.y = snap(drag.y + dy);
      } else {
        drag.f.w = Math.max(3, snap(drag.w + dx));
        drag.f.h = Math.max(3, snap(drag.h + dy));
        if (drag.f.key === 'qr') drag.f.h = drag.f.w;
      }
      ui.dirty = true;
      paint();
      syncProps();
    });
    const end = () => {
      if (drag) {
        drag = null;
        markDirty();
      }
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
  }

  function markDirty() {
    const b = $('[data-act="save-d"]');
    if (b) b.textContent = ui.dirty ? 'Guardar diseño •' : 'Guardado';
  }

  function syncProps() {
    const f = ui.d && ui.d.sides[ui.side].fields.find((x) => x.id === ui.field);
    if (!f) return;
    for (const k of ['x', 'y', 'w', 'h']) {
      const el = $(`#p-${k}`);
      if (el && document.activeElement !== el) el.value = f[k];
    }
  }

  function renderProps(paint) {
    const box = $('#props');
    if (!box) return;
    const f = ui.d.sides[ui.side].fields.find((x) => x.id === ui.field);
    if (!f) {
      box.innerHTML = '<p class="note">Selecciona un campo en la carta para moverlo o editarlo.</p>';
      return;
    }
    const isQr = f.key === 'qr';
    box.innerHTML = `<p class="lbl" style="margin-top:12px">${esc(P.LABELS[f.key])}</p>
<div class="row"><div class="f w1"><label>X (mm)</label><input id="p-x" type="number" step="0.5" value="${f.x}"></div><div class="f w1"><label>Y (mm)</label><input id="p-y" type="number" step="0.5" value="${f.y}"></div></div>
<div class="row" style="margin-top:8px"><div class="f w1"><label>Ancho</label><input id="p-w" type="number" step="0.5" value="${f.w}"></div><div class="f w1"><label>Alto</label><input id="p-h" type="number" step="0.5" value="${f.h}"></div></div>
${isQr ? '<p class="note" style="margin-top:8px">El QR abre chacalde.com/canje con el código de esa carta. Se imprime con fondo de contraste.</p>' : `<div class="row" style="margin-top:8px"><div class="f grow"><label>Fuente</label><select id="p-font">${Object.entries(FONTS).map(([k, l]) => `<option value="${k}"${k === f.font ? ' selected' : ''}>${l}</option>`).join('')}</select></div><div class="f w1"><label>Tamaño (pt)</label><input id="p-size" type="number" step="0.5" value="${f.size}"></div></div>
<div class="row" style="margin-top:8px"><div class="f w2"><label>Alineación</label><select id="p-align">${[['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']].map(([k, l]) => `<option value="${k}"${k === f.align ? ' selected' : ''}>${l}</option>`).join('')}</select></div><div class="f w1"><label>Espaciado</label><input id="p-tr" type="number" step="0.02" value="${f.tracking}"></div></div>
<div class="row" style="margin-top:8px"><label class="check"><input id="p-up" type="checkbox"${f.upper ? ' checked' : ''}> MAYÚSCULAS</label></div>`}
<div class="row" style="margin-top:8px"><div class="f"><label>Color</label><input id="p-color" type="color" value="${f.color}"></div></div>
${f.key === 'number' || f.key === 'text' ? `<div class="f" style="margin-top:8px"><label>${f.key === 'number' ? 'Formato' : 'Texto'} · variables: {name} {variant} {n} {total} {code} {edition}</label><input id="p-text" value="${esc(f.text)}" maxlength="160"></div>` : ''}
<div class="row" style="margin-top:12px"><button class="btn danger sm" data-act="del-f">Quitar campo</button></div>`;
    const bind = (id, key, cast) => {
      const el = $(`#${id}`);
      if (!el) return;
      el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' || el.type === 'color' ? 'change' : 'input', () => {
        f[key] = el.type === 'checkbox' ? el.checked : cast ? cast(el.value) : el.value;
        if (key === 'w' && f.key === 'qr') f.h = f.w;
        ui.dirty = true;
        markDirty();
        paint();
        if (key === 'w' && f.key === 'qr') syncProps();
      });
    };
    const n = (v) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : 0);
    bind('p-x', 'x', n);
    bind('p-y', 'y', n);
    bind('p-w', 'w', n);
    bind('p-h', 'h', n);
    bind('p-font', 'font');
    bind('p-size', 'size', n);
    bind('p-align', 'align');
    bind('p-tr', 'tracking', n);
    bind('p-up', 'upper');
    bind('p-color', 'color');
    bind('p-text', 'text');
  }

  async function uploadArt(file) {
    const st = setup();
    ui.busy = 'Subiendo arte…';
    toast('Subiendo arte…');
    const bmp = await createImageBitmap(file);
    let original = file;
    let type = file.type;
    if (type === 'image/webp') {
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      c.getContext('2d').drawImage(bmp, 0, 0);
      original = await c.convertToBlob({ type: 'image/png' });
      type = 'image/png';
    }
    const scale = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
    const pc = new OffscreenCanvas(Math.round(bmp.width * scale), Math.round(bmp.height * scale));
    pc.getContext('2d').drawImage(bmp, 0, 0, pc.width, pc.height);
    const preview = await pc.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
    const up = async (blob, t) => {
      const r = await fetch(`${B}/mp/api/file`, { method: 'POST', headers: { 'Content-Type': t }, body: blob, credentials: 'same-origin' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'No se pudo subir');
      return j.file;
    };
    const side = ui.d.sides[ui.side];
    side.file = await up(original, type);
    side.preview = await up(preview, 'image/jpeg');
    side.px = { w: bmp.width, h: bmp.height };
    ui.dirty = true;
    ui.busy = '';
    const dpi = Math.min(bmp.width / (bleedW() / 25.4), bmp.height / (bleedH() / 25.4));
    toast(`Arte cargado: ${bmp.width} × ${bmp.height} px (${Math.round(dpi)} dpi a ${st.trimW} × ${st.trimH} mm + sangrado). Guarda el diseño.`);
  }

  // ---------- print ----------
  function viewPrint() {
    const list = variants();
    const rows = list
      .map((v) => {
        const issues = ui.pre[v.id] || preflight(v);
        const lv = level(issues);
        const cs = cardsOf(v.id);
        const ds = [...new Set(cs.map((c) => (designFor(c) || {}).name).filter(Boolean))];
        return `<section class="card"><div class="row" style="justify-content:space-between;align-items:flex-start"><div class="row" style="align-items:center"><span class="sw" style="background:${esc(v.color)}"></span><div><h2 class="display" style="font-size:24px">${esc(v.name)} <span class="pill">${esc(v.abbr)}</span></h2><p class="note" style="margin:2px 0 0">${cs.length} cartas · diseño: ${esc(ds.join(', ') || '—')} · ${esc(v.finish || 'acabado sin definir')}</p></div></div>
<div class="row"><span class="pill ${lv}">${lv === 'ok' ? 'Listo' : lv === 'warn' ? 'Con advertencias' : 'Con errores'}</span><button class="btn sm" data-act="check" data-id="${v.id}">Revisar</button><button class="btn sm" data-act="csv" data-id="${v.id}">Listado CSV</button><button class="btn sm primary" data-act="print" data-id="${v.id}"${lv === 'bad' ? ' disabled' : ''}>PDF tiro y retiro</button></div></div>
<ul class="issues">${issues.map(([l, m]) => `<li class="${l}">${l === 'ok' ? '✓' : l === 'warn' ? '▲' : '✕'} ${esc(m)}</li>`).join('')}</ul></section>`;
      })
      .join('');
    const ex = S.exports.map((e) => `<tr><td style="white-space:nowrap;color:var(--muted)">${esc(new Date(e.at).toLocaleString('es-PA'))}</td><td>${esc(e.by)}</td><td>${esc(e.variant)}</td><td>${e.count} cartas</td></tr>`).join('');
    return `<section class="card"><div class="row" style="justify-content:space-between;align-items:center"><div><h2 class="display">Imprenta</h2><p class="note">Un PDF por variante: frente y reverso alternados (tiro y retiro), a tamaño final con sangrado${S.settings.card.marks ? ' y marcas de corte' : ''}. Textos y QR en vectores.</p></div>
<div class="row"><button class="btn" data-act="spec">Ficha técnica (PDF)</button></div></div>${ui.busy ? `<p class="note" style="color:#fff">${esc(ui.busy)}</p>` : ''}</section>${rows || '<section class="card"><p class="note">Crea variantes y diseños primero.</p></section>'}
<section class="card"><h2 class="display">Exportaciones</h2><p class="note">Cada PDF de imprenta queda registrado.</p><div class="tablewrap"><table><tbody>${ex || '<tr><td>Ninguna todavía.</td></tr>'}</tbody></table></div></section>`;
  }

  async function printVariant(v, onlyCard) {
    const cs = cardsOf(v.id).filter((c) => !onlyCard || c.id === onlyCard);
    const { codes } = await api('codes', { variantId: v.id, purpose: onlyCard ? 'preview' : 'print' });
    const byId = Object.fromEntries(codes.map((c) => [c.id, c.code]));
    const jobs = cs.map((c) => ({ card: ctxFor(c, byId[c.id]), design: designFor(c) })).filter((j) => j.design);
    if (!jobs.length) throw new Error('No hay cartas con diseño para imprimir.');
    const e = S.settings.edition;
    const name = onlyCard ? `${e.code}_${v.abbr}_${P.pad(cs[0].n, v.total)}-${v.total}_${slug(cs[0].name || 'carta')}.pdf` : `${e.code}_${v.abbr}_${slug(v.name)}_tiro-retiro.pdf`;
    const bytes = await P.buildPrint({
      base: B,
      setup: S.settings.card,
      jobs,
      title: `${e.name} · ${v.name}`,
      onProgress: (p) => {
        ui.busy = `Generando ${name}… ${Math.round(p * 100)}%`;
        const n = $('.note[style*="color:#fff"]');
        if (n) n.textContent = ui.busy;
      }
    });
    download(bytes, name, 'application/pdf');
    if (!onlyCard) {
      const s = await api('state');
      S = s;
    }
    ui.busy = '';
  }

  function csvFor(v) {
    const cs = cardsOf(v.id);
    const lines = [['numero', 'variante', 'abreviatura', 'nombre', 'ultimos4', 'paginas_pdf', 'ubicacion'].join(',')];
    const hasBack = (c) => {
      const d = designFor(c);
      return d && (d.sides.back.file || d.sides.back.fields.length);
    };
    let page = 1;
    for (const c of cs) {
      const pages = hasBack(c) ? `${page}-${page + 1}` : `${page}`;
      page += hasBack(c) ? 2 : 1;
      lines.push([`${P.pad(c.n, v.total)}/${v.total}`, v.name, v.abbr, c.name, c.last4, pages, c.location].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','));
    }
    return `﻿${lines.join('\n')}\n`;
  }

  // ---------- events ----------
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const a = t.dataset.act;
    const id = t.dataset.id;
    switch (a) {
      case 'tab':
        if (ui.tab === 'disenos' && ui.dirty && !window.confirm('Hay cambios sin guardar en el diseño. ¿Salir igual?')) return;
        if (ui.tab === 'disenos' && ui.dirty) {
          ui.d = null;
          ui.dirty = false;
        }
        ui.tab = t.dataset.k;
        ui.confirm = null;
        if (ui.tab === 'imprenta') ui.pre = {};
        return render();
      case 'camp':
        ui.confirm = t.dataset.s;
        return render();
      case 'camp-no':
        ui.confirm = null;
        return render();
      case 'camp-yes': {
        const s = ui.confirm;
        ui.confirm = null;
        return act(() => api('campaign', { state: s }), s === 'on' ? 'Campaña encendida.' : s === 'off' ? 'Campaña apagada.' : 'Campaña cerrada.');
      }
      case 'save-settings':
        return act(
          () =>
            api('settings', {
              edition: { code: $('#e-code').value, name: $('#e-name').value, expires: $('#e-exp').value },
              card: { trimW: $('#c-w').value, trimH: $('#c-h').value, bleed: $('#c-b').value, safe: $('#c-s').value, marks: $('#c-m').checked },
              defaultDesign: $('#c-dd').value || null,
              photoCheck: $('#c-pc').checked
            }),
          'Ajustes guardados.'
        );
      case 'pick-v':
        ui.variantId = id;
        ui.vform = null;
        ui.edits = {};
        ui.paste = false;
        return render();
      case 'new-v':
        ui.vform = { name: '', abbr: '', color: '#c9c9c9', effect: 'holo', total: 10, protector: PROTECTORS[0], finish: '', designId: '' };
        return render();
      case 'edit-v':
        ui.vform = { ...S.variants[ui.variantId] };
        return render();
      case 'cancel-v':
        ui.vform = null;
        return render();
      case 'save-v': {
        const f = ui.vform;
        const data = { ...f, name: $('#v-name').value, abbr: $('#v-abbr').value, color: $('#v-color').value, effect: $('#v-effect').value, total: $('#v-total').value, finish: $('#v-finish').value, protector: $('#v-prot').value, designId: $('#v-design').value };
        return act(async () => {
          try {
            const r = await api('variant', data);
            ui.variantId = r.saved;
            ui.vform = null;
            ui.codes = {};
          } catch (err) {
            if (/Confirma/.test(err.message)) {
              ui.vform = { ...data, confirmShrink: true };
            }
            throw err;
          }
        }, 'Variante guardada.');
      }
      case 'del-v':
        if (!window.confirm('¿Borrar esta variante y todas sus cartas sin canjear?')) return;
        return act(async () => {
          await api('variant-delete', { id: ui.vform.id });
          ui.vform = null;
          ui.variantId = null;
        }, 'Variante borrada.');
      case 'show-codes':
        if (ui.codes[ui.variantId]) {
          delete ui.codes[ui.variantId];
          return render();
        }
        return act(() => loadCodes(ui.variantId));
      case 'paste':
        ui.paste = !ui.paste;
        return render();
      case 'paste-apply': {
        const names = $('#paste-box').value.split(/\r?\n/).map((s) => s.trim());
        while (names.length && !names[names.length - 1]) names.pop();
        cardsOf(ui.variantId).forEach((c, i) => {
          if (i < names.length) ui.edits[c.id] = { ...(ui.edits[c.id] || {}), name: names[i] };
        });
        ui.paste = false;
        render();
        return toast(`${Math.min(names.length, cardsOf(ui.variantId).length)} nombres puestos. Revisa y dale a Guardar cambios.`);
      }
      case 'save-cards':
        return act(async () => {
          await api('cards', { cards: Object.entries(ui.edits).map(([cid, e]) => ({ id: cid, ...e })) });
          ui.edits = {};
        }, 'Cartas guardadas.');
      case 'pdf-card': {
        const c = S.cards.find((x) => x.id === id);
        return act(() => printVariant(S.variants[c.variantId], id), 'PDF listo.');
      }
      case 'pick-d':
        if (ui.dirty && !window.confirm('Hay cambios sin guardar en el diseño. ¿Cambiar igual?')) return;
        ui.designId = id;
        ui.d = clone(S.designs[id]);
        ui.dirty = false;
        ui.field = null;
        return render();
      case 'new-d':
        if (ui.dirty && !window.confirm('Hay cambios sin guardar en el diseño. ¿Crear otro igual?')) return;
        return act(async () => {
          const r = await api('design', { name: `Diseño ${designs().length + 1}`, sides: { front: { fields: [] }, back: { fields: [] } } });
          ui.designId = r.saved;
          ui.d = clone(S.designs[r.saved]);
          ui.dirty = false;
          ui.field = null;
          ui.side = 'front';
        }, 'Diseño creado. Sube el arte del frente.');
      case 'save-d':
        ui.d.name = $('#d-name').value;
        return act(async () => {
          const r = await api('design', ui.d);
          ui.designId = r.saved;
          ui.d = clone(S.designs[r.saved]);
          ui.dirty = false;
          ui.pre = {};
        }, 'Diseño guardado.');
      case 'del-d':
        if (!window.confirm('¿Borrar este diseño?')) return;
        return act(async () => {
          await api('design-delete', { id: ui.d.id });
          ui.d = null;
          ui.designId = null;
          ui.dirty = false;
        }, 'Diseño borrado.');
      case 'default-d':
        return act(() => api('settings', { defaultDesign: ui.d.id }), 'Diseño por defecto actualizado.');
      case 'side':
        ui.side = t.dataset.s;
        ui.field = null;
        return render();
      case 'clear-art': {
        const s = ui.d.sides[ui.side];
        s.file = null;
        s.preview = null;
        s.px = null;
        ui.dirty = true;
        return render();
      }
      case 'add-f':
        addField(t.dataset.k);
        return render();
      case 'pick-f':
        ui.field = id;
        return render();
      case 'del-f': {
        const s = ui.d.sides[ui.side];
        s.fields = s.fields.filter((f) => f.id !== ui.field);
        ui.field = null;
        ui.dirty = true;
        return render();
      }
      case 'check':
        preflight(S.variants[id]);
        return render();
      case 'csv': {
        const v = S.variants[id];
        return download(csvFor(v), `${S.settings.edition.code}_${v.abbr}_${slug(v.name)}_listado.csv`, 'text/csv');
      }
      case 'print': {
        const v = S.variants[id];
        ui.busy = `Generando PDF de ${v.name}…`;
        render();
        return act(() => printVariant(v), 'PDF de imprenta listo.');
      }
      case 'spec':
        return act(async () => {
          const rows = variants().map((v) => ({ ...v, file: `${S.settings.edition.code}_${v.abbr}_${slug(v.name)}_tiro-retiro.pdf` }));
          const bytes = await P.buildSpec({ base: B, setup: S.settings.card, edition: S.settings.edition, rows, files: rows.map((r) => r.file), generated: new Date().toLocaleDateString('es-PA') });
          download(bytes, `${S.settings.edition.code}_ficha-tecnica.pdf`, 'application/pdf');
        }, 'Ficha técnica lista.');
      default:
    }
  });

  root.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.edit) {
      ui.edits[el.dataset.id] = { ...(ui.edits[el.dataset.id] || {}), [el.dataset.edit]: el.value };
      const b = $('[data-act="save-cards"]');
      if (b) {
        b.disabled = false;
        b.textContent = `Guardar cambios (${Object.keys(ui.edits).length})`;
      }
    }
    if (el.id === 'd-name' && ui.d) {
      ui.d.name = el.value;
      ui.dirty = true;
      markDirty();
    }
  });
  root.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.edit) el.dispatchEvent(new Event('input', { bubbles: true }));
    if (el.id === 'sample') {
      ui.sample = el.value;
      const c = S.cards.find((x) => x.id === el.value);
      return act(() => loadCodes(c.variantId));
    }
    if (el.id === 'art' && el.files[0]) {
      act(() => uploadArt(el.files[0]));
    }
  });
  document.addEventListener('keydown', (e) => {
    if (ui.tab !== 'disenos' || !ui.d || !ui.field) return;
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const f = ui.d.sides[ui.side].fields.find((x) => x.id === ui.field);
    if (!f) return;
    const step = e.shiftKey ? 2 : 0.5;
    const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!mv) return;
    e.preventDefault();
    f.x += mv[0];
    f.y += mv[1];
    ui.dirty = true;
    if (ui.paint) ui.paint();
    markDirty();
  });
  window.addEventListener('beforeunload', (e) => {
    if (ui.dirty) e.preventDefault();
  });

  // ---------- start ----------
  Promise.all(Object.values(P.CSS_FONTS).map((f) => document.fonts.load(`700 40px ${f}`).catch(() => null)))
    .then(() => api('state'))
    .then(() => {
      if (S.cards[0]) ui.sample = S.cards[0].id;
      render();
    })
    .catch((e) => {
      root.innerHTML = `<p class="boot">No se pudo cargar: ${esc(e.message)}</p>`;
    });
})();
