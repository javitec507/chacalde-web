// Mystery Pack: redemption cards. Edition, campaign switch, designs, variants, numbered cards and codes.
// One JSON file in /data/mp (written atomically) plus the uploaded art in /data/mp/files.
// Codes: shown in full only to the panel for print exports; looked up by HMAC, stored encrypted.
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomInt } from 'node:crypto';

export const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // 31 symbols: no 0/O, 1/I/L
const RAND = 7; // + 1 check symbol = 8

export const FIELD_KEYS = ['name', 'variant', 'number', 'code', 'qr', 'edition', 'expires', 'text'];
export const FONTS = ['archivo', 'atkinson', 'atkinson-regular', 'doto'];
export const STATES = ['off', 'on', 'closed'];
const CARD_STATUS = ['available', 'claimed', 'approved', 'prepared', 'delivered', 'void'];

const now = () => new Date().toISOString();
const id = (p) => `${p}_${randomBytes(6).toString('base64url')}`;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const str = (v, max = 120) => String(v ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);

function checkSymbol(chars) {
  let sum = 0;
  for (let i = 0; i < chars.length; i += 1) sum += (ALPHABET.indexOf(chars[i]) + 1) * (i + 2);
  return ALPHABET[sum % ALPHABET.length];
}

/** The 8 identifying symbols of anything typed or scanned ("mp26-hl-k7q4 9xwd" → "K7Q49XWD"), or null. */
export function coreOf(input) {
  const s = String(input || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  const core = s.slice(-8);
  if (core.length !== 8 || [...core].some((c) => !ALPHABET.includes(c))) return null;
  return checkSymbol(core.slice(0, RAND)) === core[RAND] ? core : null;
}

export class MysteryPack {
  constructor(dir) {
    this.dir = dir;
    this.file = join(dir, 'db.json');
    this.files = join(dir, 'files');
    mkdirSync(this.files, { recursive: true });
    this.key = this.secret('code.key');
    this.pepper = this.secret('code.pepper');
    this.data = {
      v: 1,
      settings: {
        edition: { code: 'MP26', name: 'Mystery Pack 2026', expires: '2028-12-31' },
        card: { trimW: 63.5, trimH: 88.9, bleed: 3, safe: 3, marks: true },
        campaign: { state: 'off', changedAt: null, changedBy: null },
        defaultDesign: null,
        photoCheck: true,
        delivery: ['Retiro en persona', 'Envío a domicilio (Panamá)']
      },
      designs: {},
      variants: {},
      cards: {},
      claims: {},
      seq: 0,
      exports: [],
      audit: []
    };
    try {
      const raw = JSON.parse(readFileSync(this.file, 'utf8'));
      if (raw && raw.v === 1) this.data = { ...this.data, ...raw, settings: { ...this.data.settings, ...raw.settings } };
      this.data.claims ||= {};
      this.data.seq ||= 0;
    } catch (e) {
      if (e.code !== 'ENOENT') console.error(`mp: no se pudo leer ${this.file}: ${e.message}`);
    }
  }

  secret(name) {
    const f = join(this.dir, name);
    try {
      const b = readFileSync(f);
      if (b.length >= 32) return b.subarray(0, 32);
    } catch {
      /* new */
    }
    const b = randomBytes(32);
    mkdirSync(this.dir, { recursive: true });
    writeFileSync(f, b, { mode: 0o600 });
    return b;
  }

  save() {
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data), { mode: 0o600 });
    renameSync(tmp, this.file);
  }

  log(by, what) {
    this.data.audit.unshift({ at: now(), by, what });
    this.data.audit.length = Math.min(this.data.audit.length, 400);
  }

  // ---------- codes ----------
  hash(core) {
    return createHmac('sha256', this.pepper).update(core).digest('base64url');
  }

  encrypt(text) {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', this.key, iv);
    const ct = Buffer.concat([c.update(text, 'utf8'), c.final()]);
    return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
  }

  decrypt(b64) {
    const b = Buffer.from(b64, 'base64');
    const d = createDecipheriv('aes-256-gcm', this.key, b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
  }

  newCore() {
    const taken = new Set(Object.values(this.data.cards).map((c) => c.codeHash));
    for (;;) {
      let r = '';
      for (let i = 0; i < RAND; i += 1) r += ALPHABET[randomInt(ALPHABET.length)];
      const core = r + checkSymbol(r);
      if (!taken.has(this.hash(core))) return core;
    }
  }

  fullCode(card) {
    const v = this.data.variants[card.variantId];
    const core = this.decrypt(card.codeEnc);
    return `${this.data.settings.edition.code}-${v ? v.abbr : 'XX'}-${core.slice(0, 4)}-${core.slice(4)}`;
  }

  findByCode(input) {
    const core = coreOf(input);
    if (!core) return null;
    const h = this.hash(core);
    return Object.values(this.data.cards).find((c) => c.codeHash === h) || null;
  }

  // ---------- campaign ----------
  campaignOpen(at = new Date()) {
    const s = this.data.settings;
    if (s.campaign.state !== 'on') return false;
    return !s.edition.expires || at <= new Date(`${s.edition.expires}T23:59:59-05:00`);
  }

  setCampaign(state, by) {
    if (!STATES.includes(state)) throw new Error('Estado no válido.');
    const c = this.data.settings.campaign;
    if (c.state === state) return;
    c.state = state;
    c.changedAt = now();
    c.changedBy = by;
    this.log(by, `Campaña: ${state === 'on' ? 'ACTIVADA' : state === 'off' ? 'apagada' : 'cerrada'}`);
    this.save();
  }

  setSettings(input, by) {
    const s = this.data.settings;
    if (input.edition) {
      const code = str(input.edition.code, 8).toUpperCase().replace(/[^0-9A-Z]/g, '');
      if (code.length < 2) throw new Error('El código de edición necesita al menos 2 letras o números.');
      s.edition = { code, name: str(input.edition.name, 60) || s.edition.name, expires: /^\d{4}-\d{2}-\d{2}$/.test(input.edition.expires) ? input.edition.expires : s.edition.expires };
    }
    if (input.card) {
      s.card = {
        trimW: clamp(num(input.card.trimW, 63.5), 20, 300),
        trimH: clamp(num(input.card.trimH, 88.9), 20, 300),
        bleed: clamp(num(input.card.bleed, 3), 0, 10),
        safe: clamp(num(input.card.safe, 3), 0, 20),
        marks: Boolean(input.card.marks)
      };
    }
    if ('defaultDesign' in input) s.defaultDesign = input.defaultDesign && this.data.designs[input.defaultDesign] ? input.defaultDesign : null;
    if ('photoCheck' in input) s.photoCheck = Boolean(input.photoCheck);
    if (Array.isArray(input.delivery)) {
      const list = input.delivery.map((d) => str(d, 60)).filter(Boolean).slice(0, 6);
      if (list.length) s.delivery = list;
    }
    this.log(by, 'Ajustes de la edición');
    this.save();
  }

  // ---------- designs ----------
  cleanField(f) {
    const key = FIELD_KEYS.includes(f.key) ? f.key : 'text';
    return {
      id: str(f.id, 20) || id('f'),
      key,
      x: clamp(num(f.x), -20, 320),
      y: clamp(num(f.y), -20, 320),
      w: clamp(num(f.w, 30), 2, 320),
      h: clamp(num(f.h, 8), 2, 320),
      font: FONTS.includes(f.font) ? f.font : 'atkinson',
      size: clamp(num(f.size, 9), 3, 120),
      color: /^#[0-9a-f]{6}$/i.test(f.color) ? f.color.toLowerCase() : '#111111',
      align: ['left', 'center', 'right'].includes(f.align) ? f.align : 'center',
      upper: Boolean(f.upper),
      tracking: clamp(num(f.tracking), -0.1, 0.6),
      text: str(f.text, 160)
    };
  }

  saveDesign(input, by) {
    const d = input.id && this.data.designs[input.id] ? this.data.designs[input.id] : { id: id('d'), created: now() };
    d.name = str(input.name, 60) || 'Diseño sin nombre';
    d.sides = {};
    for (const side of ['front', 'back']) {
      const s = (input.sides && input.sides[side]) || {};
      const file = s.file && existsSync(join(this.files, s.file)) ? s.file : null;
      d.sides[side] = {
        file,
        preview: s.preview && existsSync(join(this.files, s.preview)) ? s.preview : null,
        px: file ? { w: clamp(num(s.px?.w), 0, 30000), h: clamp(num(s.px?.h), 0, 30000) } : null,
        fields: Array.isArray(s.fields) ? s.fields.slice(0, 30).map((f) => this.cleanField(f)) : []
      };
    }
    d.updated = now();
    this.data.designs[d.id] = d;
    if (!this.data.settings.defaultDesign) this.data.settings.defaultDesign = d.id;
    this.log(by, `Diseño guardado: ${d.name}`);
    this.save();
    return d;
  }

  deleteDesign(designId, by) {
    const d = this.data.designs[designId];
    if (!d) return;
    const used = Object.values(this.data.variants).some((v) => v.designId === designId) || Object.values(this.data.cards).some((c) => c.designId === designId);
    if (used) throw new Error('Ese diseño está en uso por una variante o carta. Cámbialo primero.');
    delete this.data.designs[designId];
    if (this.data.settings.defaultDesign === designId) this.data.settings.defaultDesign = Object.keys(this.data.designs)[0] || null;
    this.log(by, `Diseño borrado: ${d.name}`);
    this.save();
  }

  // ---------- variants and cards ----------
  saveVariant(input, by) {
    const isNew = !(input.id && this.data.variants[input.id]);
    const v = isNew ? { id: id('v'), created: now() } : this.data.variants[input.id];
    const abbr = str(input.abbr, 3).toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (abbr.length < 1) throw new Error('La abreviatura necesita 1 a 3 letras o números (ej. HL).');
    const clash = Object.values(this.data.variants).find((o) => o.id !== v.id && o.abbr === abbr);
    if (clash) throw new Error(`La abreviatura ${abbr} ya la usa "${clash.name}".`);
    const total = clamp(Math.round(num(input.total, 1)), 1, 5000);
    const cards = this.cardsOf(v.id);
    if (!isNew && total < cards.length) {
      const drop = cards.filter((c) => c.n > total);
      if (drop.some((c) => c.status !== 'available')) throw new Error('No se puede bajar el tiraje: hay cartas por encima de ese número que ya se canjearon.');
      if (this.data.exports.some((e) => e.variantId === v.id)) {
        if (!input.confirmShrink) throw new Error('Esa variante ya se exportó a imprenta. Confirma para bajar el tiraje (los números de arriba se anulan).');
      }
      for (const c of drop) delete this.data.cards[c.id];
    }
    v.name = str(input.name, 50) || 'Variante';
    v.abbr = abbr;
    v.color = /^#[0-9a-f]{6}$/i.test(input.color) ? input.color.toLowerCase() : '#c0c0c0';
    v.effect = ['none', 'holo', 'reverse', 'refractor', 'super', 'oneofone'].includes(input.effect) ? input.effect : 'holo';
    v.total = total;
    v.protector = str(input.protector, 60);
    v.finish = str(input.finish, 80);
    v.designId = input.designId && this.data.designs[input.designId] ? input.designId : null;
    v.updated = now();
    this.data.variants[v.id] = v;
    const have = new Set(this.cardsOf(v.id).map((c) => c.n));
    for (let n = 1; n <= total; n += 1) {
      if (have.has(n)) continue;
      const core = this.newCore();
      const cid = id('c');
      this.data.cards[cid] = { id: cid, variantId: v.id, n, name: '', codeHash: this.hash(core), codeEnc: this.encrypt(core), last4: core.slice(4), designId: null, location: '', status: 'available', updated: now() };
    }
    this.log(by, `${isNew ? 'Variante creada' : 'Variante editada'}: ${v.name} (${v.abbr}) · tiraje ${total}`);
    this.save();
    return v;
  }

  deleteVariant(variantId, by) {
    const v = this.data.variants[variantId];
    if (!v) return;
    if (this.cardsOf(variantId).some((c) => c.status !== 'available')) throw new Error('Esa variante tiene cartas canjeadas: no se puede borrar.');
    for (const c of this.cardsOf(variantId)) delete this.data.cards[c.id];
    delete this.data.variants[variantId];
    this.log(by, `Variante borrada: ${v.name}`);
    this.save();
  }

  cardsOf(variantId) {
    return Object.values(this.data.cards)
      .filter((c) => c.variantId === variantId)
      .sort((a, b) => a.n - b.n);
  }

  updateCards(list, by) {
    let n = 0;
    for (const u of Array.isArray(list) ? list.slice(0, 5000) : []) {
      const c = this.data.cards[u.id];
      if (!c) continue;
      if ('name' in u) c.name = str(u.name, 80);
      if ('location' in u) c.location = str(u.location, 40);
      if ('designId' in u) c.designId = u.designId && this.data.designs[u.designId] ? u.designId : null;
      if ('status' in u && CARD_STATUS.includes(u.status)) c.status = u.status;
      c.updated = now();
      n += 1;
    }
    if (n) {
      this.log(by, `Cartas editadas: ${n}`);
      this.save();
    }
    return n;
  }

  /** Full codes of a variant, for the print files. Every call is logged. */
  exportCodes(variantId, by, purpose) {
    const v = this.data.variants[variantId];
    if (!v) throw new Error('Variante no encontrada.');
    const rows = this.cardsOf(variantId).map((c) => ({ id: c.id, n: c.n, code: this.fullCode(c) }));
    if (purpose === 'print') {
      this.data.exports.unshift({ at: now(), by, variantId, variant: v.name, count: rows.length });
      this.data.exports.length = Math.min(this.data.exports.length, 200);
      this.log(by, `Exportó a imprenta: ${v.name} (${rows.length})`);
      this.save();
    }
    return rows;
  }

  // ---------- claims (canjes) ----------
  /** What the public page may show about a card: the prize, never the person who claimed it. */
  publicCard(card) {
    const v = this.data.variants[card.variantId] || {};
    const d = this.data.designs[card.designId] || this.data.designs[v.designId] || this.data.designs[this.data.settings.defaultDesign];
    const front = d && d.sides.front;
    return {
      name: card.name,
      n: card.n,
      total: v.total,
      variant: v.name,
      abbr: v.abbr,
      color: v.color,
      effect: v.effect,
      edition: this.data.settings.edition.name,
      expires: this.data.settings.edition.expires,
      art: front && (front.preview || front.file) ? { file: front.preview || front.file, fields: front.fields.filter((f) => f.key !== 'qr' && f.key !== 'code') } : null,
      card: this.data.settings.card
    };
  }

  artAllowed(file) {
    return Object.values(this.data.designs).some((d) => d.sides.front.preview === file || d.sides.front.file === file);
  }

  /** Registers a claim. dry = preview (nothing is saved). */
  claim(card, info, photos, { dry = false } = {}) {
    if (card.status !== 'available') throw Object.assign(new Error('Este código ya fue canjeado.'), { code: 'taken' });
    const s = this.data.settings;
    const name = str(info.name, 80);
    const phone = str(info.phone, 30).replace(/[^0-9+()\s-]/g, '');
    const email = str(info.email, 120);
    if (name.length < 3) throw new Error('Escribe tu nombre completo.');
    if (phone.replace(/\D/g, '').length < 7) throw new Error('Escribe un número de WhatsApp válido.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Revisa tu correo.');
    const delivery = s.delivery.includes(info.delivery) ? info.delivery : s.delivery[0];
    if (!info.consent) throw new Error('Necesitamos tu permiso para usar estos datos solo para entregarte el premio.');
    if (s.photoCheck && (!photos.front || !photos.back)) throw new Error('Sube la foto del frente y del reverso de tu tarjeta.');
    const no = `C-${String(this.data.seq + 1).padStart(4, '0')}`;
    if (dry) return { no, at: now(), preview: true };
    this.data.seq += 1;
    const id = randomBytes(8).toString('hex');
    this.data.claims[id] = {
      id,
      no,
      cardId: card.id,
      at: now(),
      name,
      phone,
      email,
      delivery,
      address: str(info.address, 300),
      notes: str(info.notes, 300),
      photos: { front: photos.front || null, back: photos.back || null },
      status: 'pending',
      history: [{ at: now(), by: 'público', what: 'Canje registrado' }]
    };
    card.status = 'claimed';
    card.claimId = id;
    card.updated = now();
    this.log('público', `Canje ${no}: ${card.name || 'carta'} (${(this.data.variants[card.variantId] || {}).abbr} ${card.n})`);
    this.save();
    return { no, at: this.data.claims[id].at };
  }

  setClaim(claimId, action, by, note = '') {
    const c = this.data.claims[claimId];
    if (!c) throw new Error('Canje no encontrado.');
    const card = this.data.cards[c.cardId];
    const flow = { approve: ['pending', 'approved'], prepare: ['approved', 'prepared'], deliver: ['prepared', 'delivered'], reject: [null, 'rejected'] };
    const step = flow[action];
    if (!step) throw new Error('Acción no válida.');
    if (step[0] && c.status !== step[0]) throw new Error('Ese paso no corresponde al estado actual del canje.');
    if (action === 'reject' && c.status === 'delivered') throw new Error('Ya fue entregado.');
    c.status = step[1];
    c.history.push({ at: now(), by, what: { approve: 'Aprobado', prepare: 'Preparado para entregar', deliver: 'Entregado', reject: `Rechazado${note ? `: ${str(note, 120)}` : ''}` }[action] });
    if (card) {
      if (action === 'reject') {
        card.status = 'available';
        card.claimId = null;
      } else card.status = step[1] === 'approved' ? 'approved' : step[1];
      card.updated = now();
    }
    if (step[1] === 'delivered') c.deliveredAt = now();
    this.log(by, `Canje ${c.no}: ${c.history[c.history.length - 1].what}`);
    this.save();
    return c;
  }

  /** Personal data and photos leave 90 days after delivery (or rejection). Returns photo files to delete. */
  purge(days = 90) {
    const cut = Date.now() - days * 86_400_000;
    const files = [];
    let n = 0;
    for (const c of Object.values(this.data.claims)) {
      const end = c.deliveredAt || (c.status === 'rejected' ? c.history[c.history.length - 1].at : null);
      if (!end || c.purged || new Date(end).getTime() > cut) continue;
      if (c.photos.front) files.push(c.photos.front);
      if (c.photos.back) files.push(c.photos.back);
      Object.assign(c, { name: '(borrado)', phone: '', email: '', address: '', notes: '', photos: { front: null, back: null }, purged: now() });
      n += 1;
    }
    if (n) {
      this.log('sistema', `Datos personales borrados de ${n} canje(s) (más de ${days} días)`);
      this.save();
    }
    return files;
  }

  /** Everything the console needs, without codes. */
  view() {
    const { settings, designs, variants, exports, audit } = this.data;
    const cards = Object.values(this.data.cards)
      .sort((a, b) => (a.variantId === b.variantId ? a.n - b.n : a.variantId < b.variantId ? -1 : 1))
      .map(({ codeHash, codeEnc, ...c }) => c);
    const claims = Object.values(this.data.claims || {}).sort((a, b) => (a.at < b.at ? 1 : -1));
    return { settings, designs, variants, cards, claims, exports: exports.slice(0, 30), audit: audit.slice(0, 60), open: this.campaignOpen() };
  }
}
