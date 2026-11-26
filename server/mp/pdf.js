// Mystery Pack — shared card rendering rules (editor preview + print PDF) and the print files.
// Positions are millimetres from the trim box's top-left corner; sizes are points.
(function () {
  const MM = 72 / 25.4; // pt per mm
  const PT_MM = 25.4 / 72; // mm per pt
  const FONT_FILES = { archivo: 'archivo-display.ttf', atkinson: 'atkinson-700.ttf', 'atkinson-regular': 'atkinson-400.ttf', doto: 'doto-900.ttf' };
  const CSS_FONTS = { archivo: 'MPArchivo', atkinson: 'MPAtkinson', 'atkinson-regular': 'MPAtkinsonR', doto: 'MPDoto' };
  const LABELS = { name: 'Nombre', variant: 'Variante', number: 'Numeración', code: 'Código', qr: 'QR', edition: 'Edición', expires: 'Vence', text: 'Texto' };
  // 2028-12-31 -> 31/12/2028 (what the card prints after "Válido hasta el")
  const dmy = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.split('-').reverse().join('/') : '');
  const CAP = 0.35; // baseline offset from the box centre, in em

  const pad = (n, total) => String(n).padStart(String(total).length, '0');

  /** Text a field prints for one card. ctx: { name, variant, n, total, code, edition, url } */
  function fieldText(f, ctx) {
    const vars = { name: ctx.name || '', variant: ctx.variant || '', n: pad(ctx.n || 0, ctx.total || 0), total: String(ctx.total || 0), code: ctx.code || '', edition: ctx.edition || '', expires: dmy(ctx.expires) };
    let t;
    if (f.key === 'qr') return ctx.url || '';
    if (f.key === 'number') t = (f.text || 'N° {n}/{total}').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
    else if (f.key === 'text') t = (f.text || '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
    else t = vars[f.key] || '';
    return f.upper ? t.toLocaleUpperCase('es') : t;
  }

  /** Largest size (pt) ≤ f.size so the text fits the box width. measure(text, sizePt) → width in pt. */
  function fitSize(f, text, measure) {
    const maxW = f.w * MM;
    let size = f.size;
    const width = (s) => measure(text, s) + Math.max(0, text.length - 1) * f.tracking * s;
    while (size > 4 && width(size) > maxW) size -= 0.25;
    return { size, overflow: width(size) > maxW + 0.5 };
  }

  function qrMatrix(text) {
    const q = window.qrcode(0, 'M');
    q.addData(text);
    q.make();
    const n = q.getModuleCount();
    const m = [];
    for (let r = 0; r < n; r += 1) {
      m.push([]);
      for (let c = 0; c < n; c += 1) m[r].push(q.isDark(r, c));
    }
    return m;
  }

  const hexRgb = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  const isLight = (h) => {
    const [r, g, b] = hexRgb(h);
    return 0.299 * r + 0.587 * g + 0.114 * b > 0.6;
  };

  // ---------- canvas measuring (editor) ----------
  let mctx;
  function measureCss(font) {
    if (!mctx) mctx = document.createElement('canvas').getContext('2d');
    return (text, sizePt) => {
      mctx.font = `${font === 'atkinson' ? '700 ' : ''}100px ${CSS_FONTS[font]}`;
      return (mctx.measureText(text).width / 100) * sizePt;
    };
  }

  // ---------- PDF ----------
  const fileCache = new Map();
  async function fetchBytes(url) {
    if (!fileCache.has(url)) {
      fileCache.set(
        url,
        fetch(url, { credentials: 'same-origin' }).then((r) => {
          if (!r.ok) throw new Error(`No se pudo cargar ${url}`);
          return r.arrayBuffer();
        })
      );
    }
    return fileCache.get(url);
  }

  async function newDoc(base) {
    const { PDFDocument } = window.PDFLib;
    const doc = await PDFDocument.create();
    doc.registerFontkit(window.fontkit);
    const fonts = {};
    for (const [k, file] of Object.entries(FONT_FILES)) fonts[k] = await doc.embedFont(await fetchBytes(`${base}/static/${file}`), { subset: false }); // full fonts: subsetting breaks composite glyphs (Doto)
    return { doc, fonts, images: new Map() };
  }

  async function image(ctx, base, file) {
    if (!ctx.images.has(file)) {
      const bytes = await fetchBytes(`${base}/file/${file}`);
      ctx.images.set(file, file.endsWith('.png') ? await ctx.doc.embedPng(bytes) : await ctx.doc.embedJpg(bytes));
    }
    return ctx.images.get(file);
  }

  /** Draws one side of one card on a new page. */
  async function drawSide(ctx, base, setup, side, card) {
    const { rgb, pushGraphicsState, popGraphicsState, rectangle, clip, endPath, setCharacterSpacing } = window.PDFLib;
    const slug = setup.marks ? 8 : 0;
    const bw = setup.trimW + 2 * setup.bleed;
    const bh = setup.trimH + 2 * setup.bleed;
    const pw = bw + 2 * slug;
    const ph = bh + 2 * slug;
    const page = ctx.doc.addPage([pw * MM, ph * MM]);
    const X = (mm) => mm * MM;
    const Y = (mmFromTop) => (ph - mmFromTop) * MM;
    page.setTrimBox(X(slug + setup.bleed), X(slug + setup.bleed), X(setup.trimW), X(setup.trimH));
    page.setBleedBox(X(slug), X(slug), X(bw), X(bh));
    if (side.file) {
      const img = await image(ctx, base, side.file);
      const s = Math.max((bw * MM) / img.width, (bh * MM) / img.height);
      const w = img.width * s;
      const h = img.height * s;
      page.pushOperators(pushGraphicsState(), rectangle(X(slug), X(slug), X(bw), X(bh)), clip(), endPath());
      page.drawImage(img, { x: X(slug) + (X(bw) - w) / 2, y: X(slug) + (X(bh) - h) / 2, width: w, height: h });
      page.pushOperators(popGraphicsState());
    }
    const ox = slug + setup.bleed;
    const oy = slug + setup.bleed;
    for (const f of side.fields) {
      const [r, g, b] = hexRgb(f.color);
      if (f.key === 'qr') {
        const text = fieldText(f, card);
        if (!text) continue;
        const m = qrMatrix(text);
        const size = Math.min(f.w, f.h);
        const quiet = 2;
        const mod = size / (m.length + 2 * quiet);
        const x0 = ox + f.x + (f.w - size) / 2;
        const y0 = oy + f.y + (f.h - size) / 2;
        const bg = isLight(f.color) ? rgb(0, 0, 0) : rgb(1, 1, 1);
        page.drawRectangle({ x: X(x0), y: Y(y0 + size), width: X(size), height: X(size), color: bg });
        for (let rr = 0; rr < m.length; rr += 1) {
          for (let cc = 0; cc < m.length; cc += 1) {
            if (!m[rr][cc]) continue;
            const mx = x0 + (cc + quiet) * mod;
            const my = y0 + (rr + quiet) * mod;
            page.drawRectangle({ x: X(mx), y: Y(my + mod), width: X(mod) + 0.05, height: X(mod) + 0.05, color: rgb(r, g, b) });
          }
        }
        continue;
      }
      const text = fieldText(f, card);
      if (!text) continue;
      const font = ctx.fonts[f.font] || ctx.fonts.atkinson;
      const { size } = fitSize(f, text, (t, s) => font.widthOfTextAtSize(t, s));
      const tw = font.widthOfTextAtSize(text, size) + Math.max(0, text.length - 1) * f.tracking * size;
      let x = X(ox + f.x);
      if (f.align === 'center') x += (X(f.w) - tw) / 2;
      else if (f.align === 'right') x += X(f.w) - tw;
      const baseline = oy + f.y + f.h / 2 + CAP * size * PT_MM;
      if (f.tracking) page.pushOperators(setCharacterSpacing(f.tracking * size));
      page.drawText(text, { x, y: Y(baseline), size, font, color: rgb(r, g, b) });
      if (f.tracking) page.pushOperators(setCharacterSpacing(0));
    }
    if (setup.marks) {
      const k = rgb(0, 0, 0);
      const t = 0.25;
      const gap = setup.bleed + 1.5;
      const len = 5;
      const xs = [slug + setup.bleed, slug + setup.bleed + setup.trimW];
      const ys = [slug + setup.bleed, slug + setup.bleed + setup.trimH];
      for (const x of xs) {
        for (const y of ys) {
          const dx = x === xs[0] ? -1 : 1;
          const dy = y === ys[0] ? -1 : 1;
          page.drawLine({ start: { x: X(x + dx * gap), y: Y(y) }, end: { x: X(x + dx * (gap + len)), y: Y(y) }, thickness: t, color: k });
          page.drawLine({ start: { x: X(x), y: Y(y + dy * gap) }, end: { x: X(x), y: Y(y + dy * (gap + len)) }, thickness: t, color: k });
        }
      }
    }
    return page;
  }

  /**
   * Print file: for each card, front page then back page (tiro y retiro). jobs: [{ card ctx, design }]
   */
  async function buildPrint({ base, setup, jobs, title, onProgress = () => {} }) {
    const ctx = await newDoc(base);
    ctx.doc.setTitle(title);
    ctx.doc.setCreator('chacalde.com · Mystery Pack');
    ctx.doc.setProducer('chacalde.com');
    let i = 0;
    for (const job of jobs) {
      await drawSide(ctx, base, setup, job.design.sides.front, job.card);
      if (job.design.sides.back && (job.design.sides.back.file || job.design.sides.back.fields.length)) {
        await drawSide(ctx, base, setup, job.design.sides.back, job.card);
      }
      i += 1;
      onProgress(i / jobs.length);
    }
    return ctx.doc.save();
  }

  /** One-page technical sheet for the printer. */
  async function buildSpec({ base, setup, edition, rows, files, generated }) {
    const { rgb } = window.PDFLib;
    const ctx = await newDoc(base);
    ctx.doc.setTitle(`Ficha técnica · ${edition.name}`);
    const page = ctx.doc.addPage([612, 792]);
    const F = ctx.fonts;
    let y = 740;
    const line = (t, { size = 10, font = F['atkinson-regular'], x = 50, color = rgb(0.1, 0.1, 0.1) } = {}) => {
      page.drawText(String(t), { x, y, size, font, color });
    };
    line('FICHA TÉCNICA DE IMPRESIÓN', { size: 22, font: F.archivo });
    y -= 22;
    line(`${edition.name} · Redemption Cards · generado ${generated}`, { size: 11 });
    y -= 30;
    const spec = [
      ['Tamaño final (corte)', `${setup.trimW} × ${setup.trimH} mm`],
      ['Sangrado', `${setup.bleed} mm por lado (archivo: ${(setup.trimW + 2 * setup.bleed).toFixed(1)} × ${(setup.trimH + 2 * setup.bleed).toFixed(1)} mm)`],
      ['Zona segura', `${setup.safe} mm hacia dentro del corte`],
      ['Marcas de corte', setup.marks ? 'Sí, en el margen de cada página' : 'No'],
      ['Impresión', 'Tiro y retiro: páginas impares = frente, pares = reverso. Voltear por el lado largo.'],
      ['Color', 'Archivos en RGB. Si la imprenta trabaja en CMYK, convertir con su perfil.'],
      ['Textos y QR', 'Vectoriales (fuentes incrustadas). Arte de fondo: imagen a resolución original.']
    ];
    for (const [k, v] of spec) {
      line(k, { size: 10, font: F.atkinson });
      line(v, { size: 10, x: 190 });
      y -= 17;
    }
    y -= 14;
    line('VARIANTES', { size: 15, font: F.archivo });
    y -= 20;
    const cols = [50, 150, 200, 250, 380, 470];
    ['Variante', 'Código', 'Tiraje', 'Acabado', 'Protector', 'Archivo'].forEach((h, i) => line(h, { size: 8, font: F.atkinson, x: cols[i], color: rgb(0.4, 0.4, 0.4) }));
    y -= 14;
    let total = 0;
    for (const r of rows) {
      const [cr, cg, cb] = hexRgb(r.color);
      page.drawRectangle({ x: 38, y: y - 2, width: 8, height: 10, color: rgb(cr, cg, cb) });
      line(r.name.slice(0, 18), { size: 9, font: F.atkinson });
      line(r.abbr, { size: 9, x: cols[1] });
      line(String(r.total), { size: 9, x: cols[2] });
      line((r.finish || '—').slice(0, 24), { size: 9, x: cols[3] });
      line((r.protector || '—').slice(0, 18), { size: 9, x: cols[4] });
      line((r.file || '').slice(0, 26), { size: 7, x: cols[5] });
      total += r.total;
      y -= 15;
      if (y < 90) break;
    }
    y -= 8;
    line(`Total de tarjetas: ${total}`, { size: 11, font: F.atkinson });
    y -= 26;
    if (files && files.length) {
      line('Archivos entregados:', { size: 9, font: F.atkinson });
      y -= 13;
      for (const f of files.slice(0, 12)) {
        line(`• ${f}`, { size: 8 });
        y -= 11;
      }
    }
    page.drawText('Los códigos de canje no funcionan hasta que Chacalde active la campaña. No compartir estos archivos.', { x: 50, y: 50, size: 8, font: F['atkinson-regular'], color: rgb(0.35, 0.35, 0.35) });
    return ctx.doc.save();
  }

  /** Delivery slip that travels with the prize. Its QR opens the claim in the panel to mark it delivered. */
  async function buildSlip({ base, claim, card, variant, edition, url }) {
    const { rgb } = window.PDFLib;
    const ctx = await newDoc(base);
    ctx.doc.setTitle(`Comprobante ${claim.no}`);
    const F = ctx.fonts;
    const page = ctx.doc.addPage([396, 612]); // 5.5 x 8.5 in
    const ink = rgb(0.07, 0.07, 0.07);
    const gray = rgb(0.42, 0.42, 0.42);
    let y = 560;
    const t = (s, o = {}) => page.drawText(String(s), { x: o.x ?? 36, y, size: o.size ?? 10, font: o.font ?? F['atkinson-regular'], color: o.color ?? ink });
    t('DISQUE CONSULTORIOS CHACALDE · MYSTERY PACK', { size: 8, font: F.atkinson, color: gray });
    y -= 30;
    t('COMPROBANTE DE ENTREGA', { size: 22, font: F.archivo });
    y -= 40;
    t(claim.no, { size: 30, font: F.doto });
    y -= 20;
    t(new Date(claim.at).toLocaleString('es-PA'), { size: 9, color: gray });
    y -= 28;
    const rows = [
      ['Premio', card.name || '—'],
      ['Variante', `${variant.name || ''} (${variant.abbr || ''})`],
      ['Numeración', card.n ? `${pad(card.n, variant.total)}/${variant.total}` : '—'],
      ['Ubicación', card.location || '—'],
      ['Protector', variant.protector || '—'],
      ['Entregar a', claim.name],
      ['WhatsApp', claim.phone || '—'],
      ['Entrega', claim.delivery || '—'],
      ['Dirección', (claim.address || '—').slice(0, 60)]
    ];
    for (const [k, v] of rows) {
      page.drawLine({ start: { x: 36, y: y + 14 }, end: { x: 360, y: y + 14 }, thickness: 0.4, color: rgb(0.85, 0.85, 0.85) });
      t(k, { size: 9, font: F.atkinson, color: gray });
      t(String(v).slice(0, 52), { size: 10, x: 118 });
      y -= 20;
    }
    const m = qrMatrix(url);
    const size = 96;
    const mod = size / (m.length + 4);
    const x0 = 36;
    const y0 = 70;
    for (let r = 0; r < m.length; r += 1) for (let c = 0; c < m.length; c += 1) if (m[r][c]) page.drawRectangle({ x: x0 + (c + 2) * mod, y: y0 + size - (r + 3) * mod, width: mod + 0.05, height: mod + 0.05, color: ink });
    page.drawText('Escanear desde el panel', { x: 140, y: 150, size: 9, font: F.atkinson, color: ink });
    page.drawText('al entregar.', { x: 140, y: 138, size: 9, font: F['atkinson-regular'], color: ink });
    page.drawLine({ start: { x: 140, y: 96 }, end: { x: 360, y: 96 }, thickness: 0.6, color: ink });
    page.drawText('Recibido por (nombre y firma)', { x: 140, y: 84, size: 8, font: F['atkinson-regular'], color: gray });
    page.drawText(`${edition.name} · chacalde.com`, { x: 36, y: 40, size: 8, font: F['atkinson-regular'], color: gray });
    return ctx.doc.save();
  }

  window.MPPDF = { MM, PT_MM, CAP, LABELS, CSS_FONTS, fieldText, fitSize, qrMatrix, measureCss, isLight, buildPrint, buildSpec, buildSlip, pad };
})();
