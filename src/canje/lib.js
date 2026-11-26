// Mystery Pack · canje: API calls, the card drawn like the printed one, and the share pictures.
export const pad = (n, t) => String(n).padStart(String(t).length, '0');
export const num = (c) => `${pad(c.n, c.total)}/${c.total}`;
const dmy = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.split('-').reverse().join('/') : '');

const MM_PT = 25.4 / 72;
const CSS_FONTS = { archivo: 'MPArchivo', atkinson: 'MPAtkinson', 'atkinson-regular': 'MPAtkinsonR', doto: 'MPDoto' };

let fontsReady = Promise.resolve();
export function loadFonts(assets) {
  fontsReady = Promise.all(
    [
      ['MPArchivo', 'archivo-display.ttf'],
      ['MPAtkinson', 'atkinson-700.ttf'],
      ['MPAtkinsonR', 'atkinson-400.ttf'],
      ['MPDoto', 'doto-900.ttf']
    ].map(([fam, file]) =>
      new FontFace(fam, `url(${assets}/${file})`)
        .load()
        .then((f) => document.fonts.add(f))
        .catch(() => null)
    )
  );
  return fontsReady;
}

export const loadImg = (src) =>
  new Promise((ok, no) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = no;
    i.src = src;
  });

export async function post(api, action, data, headers = {}) {
  const isBlob = data instanceof Blob;
  const r = await fetch(`${api}/${action}`, {
    method: 'POST',
    headers: isBlob ? headers : { 'Content-Type': 'application/json', ...headers },
    body: isBlob ? data : JSON.stringify(data),
    credentials: 'same-origin'
  });
  const j = await r.json().catch(() => ({ error: 'Algo falló. Intenta otra vez.' }));
  return { status: r.status, ...j };
}

function fieldText(f, c) {
  const vars = { name: c.name || '', variant: c.variant || '', n: pad(c.n, c.total), total: String(c.total), code: '', edition: c.edition || '', expires: dmy(c.expires) };
  const fill = (t) => t.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  const t = f.key === 'number' ? fill(f.text || 'N° {n}/{total}') : f.key === 'text' ? fill(f.text || '') : vars[f.key] || '';
  return f.upper ? t.toLocaleUpperCase('es') : t;
}

/** The prize card's front (art + printed fields, never the code), as a canvas. */
export async function renderCard(c, assets) {
  await fontsReady;
  const st = c.card;
  const W = 900;
  const k = W / st.trimW;
  const H = Math.round(st.trimH * k);
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  if (c.art) {
    try {
      const img = await loadImg(`${assets}/art/${c.art.file}`);
      const bw = (st.trimW + 2 * st.bleed) * k;
      const bh = (st.trimH + 2 * st.bleed) * k;
      const s = Math.max(bw / img.width, bh / img.height);
      const w = img.width * s;
      const h = img.height * s;
      g.drawImage(img, -st.bleed * k + (bw - w) / 2, -st.bleed * k + (bh - h) / 2, w, h);
      for (const f of c.art.fields) {
        const text = fieldText(f, c);
        if (!text) continue;
        const font = (px) => `${f.font === 'atkinson' ? '700 ' : ''}${px}px ${CSS_FONTS[f.font] || 'MPAtkinson'}`;
        let size = f.size;
        const width = (sz) => {
          g.font = font(sz * MM_PT * k);
          return g.measureText(text).width + Math.max(0, text.length - 1) * f.tracking * sz * MM_PT * k;
        };
        while (size > 4 && width(size) > f.w * k) size -= 0.25;
        const px = size * MM_PT * k;
        g.font = font(px);
        if ('letterSpacing' in g) g.letterSpacing = `${f.tracking * px}px`;
        g.fillStyle = f.color;
        g.textAlign = { left: 'left', center: 'center', right: 'right' }[f.align];
        g.textBaseline = 'alphabetic';
        const x = (f.x + (f.align === 'center' ? f.w / 2 : f.align === 'right' ? f.w : 0)) * k;
        g.fillText(text, x, (f.y + f.h / 2) * k + 0.35 * px);
        if ('letterSpacing' in g) g.letterSpacing = '0px';
      }
      return cv;
    } catch {
      /* fall back to the plain card */
    }
  }
  if (c.test) {
    // test code with no design uploaded yet: the landing's sample card
    try {
      const img = await loadImg(`${assets}/hero-front.jpg`);
      g.fillStyle = '#fff';
      g.fillRect(0, 0, W, H);
      const s = Math.min(W / img.width, H / img.height);
      g.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
      return cv;
    } catch {
      /* plain card */
    }
  }
  g.fillStyle = '#0d0d0d';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = c.color;
  g.lineWidth = 18;
  g.strokeRect(30, 30, W - 60, H - 60);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.font = '64px MPArchivo';
  g.fillText('MYSTERY PACK', W / 2, 200);
  g.font = '700 40px MPAtkinson';
  g.fillStyle = c.color;
  g.fillText((c.variant || '').toUpperCase(), W / 2, H / 2 - 40);
  g.fillStyle = '#fff';
  let size = 80;
  g.font = `${size}px MPArchivo`;
  while (size > 30 && g.measureText((c.name || '').toUpperCase()).width > W - 140) g.font = `${(size -= 2)}px MPArchivo`;
  g.fillText((c.name || '').toUpperCase(), W / 2, H / 2 + 60);
  g.font = '90px MPDoto';
  g.fillText(num(c), W / 2, H - 160);
  return cv;
}

/** "¡CANJEADO!" picture for stories (9:16) or posts (4:5). Never shows the code. */
export async function drawShare(cv, { kind, card: c, img, no }) {
  await fontsReady;
  const W = 1080;
  const H = kind === 'story' ? 1920 : 1350;
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#0a0a0a';
  g.fillRect(0, 0, W, H);
  const [logo, card] = await Promise.all([loadImg('/img/logo-white.png'), loadImg(img)]);
  g.drawImage(logo, 72, 80, (logo.width / logo.height) * 64, 64);
  g.font = '900 28px MPDoto';
  g.fillStyle = '#fff';
  g.textAlign = 'right';
  g.fillText(`N° ${no}`, W - 72, 124);
  g.textAlign = 'left';
  g.font = '700 26px MPAtkinson';
  if ('letterSpacing' in g) g.letterSpacing = '5px';
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fillText('MYSTERY PACK · REDEMPTION', 72, kind === 'story' ? 236 : 210);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  g.fillStyle = '#fff';
  g.font = `${kind === 'story' ? 150 : 118}px MPArchivo`;
  g.fillText('¡CANJEADO!', 64, kind === 'story' ? 380 : 330);
  const ch = kind === 'story' ? 1060 : 720;
  const cw = ch * (card.width / card.height);
  const cx = W / 2;
  const cy = kind === 'story' ? 1010 : 790;
  g.save();
  g.translate(cx, cy);
  g.rotate((-4 * Math.PI) / 180);
  g.shadowColor = 'rgba(0,0,0,0.7)';
  g.shadowBlur = 50;
  g.shadowOffsetY = 24;
  g.beginPath();
  g.roundRect(-cw / 2, -ch / 2, cw, ch, cw * 0.045);
  g.fillStyle = '#111';
  g.fill();
  g.shadowColor = 'transparent';
  g.clip();
  g.drawImage(card, -cw / 2, -ch / 2, cw, ch);
  const fx = c.effect || 'holo';
  if (fx !== 'none') {
    // foil the way it prints: multiply tints the white areas, black stays black
    const grad = g.createLinearGradient(-cw / 2, -ch / 2, cw / 2, ch / 2);
    const gold = fx === 'super' || fx === 'oneofone';
    const stops = gold ? ['#e9c977', '#fff3c4', '#d4a63a', '#fff6d6', '#c9971f', '#f7e2a0'] : ['#d4d9df', '#ffb3e2', '#b3efff', '#fff7b3', '#d6c2ff', '#eef1f4'];
    stops.forEach((s, i) => grad.addColorStop(i / (stops.length - 1), s));
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = 0.85;
    g.fillStyle = grad;
    g.fillRect(-cw / 2, -ch / 2, cw, ch);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }
  g.restore();
  g.save();
  g.translate(cx + cw * 0.22, cy + ch * 0.3);
  g.rotate((-12 * Math.PI) / 180);
  g.font = `${kind === 'story' ? 92 : 70}px MPArchivo`;
  const sw = g.measureText('CANJEADO').width + 56;
  const sh = kind === 'story' ? 120 : 94;
  g.lineWidth = 10;
  g.strokeStyle = '#ff3b3b';
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.beginPath();
  g.roundRect(-sw / 2, -sh / 2, sw, sh, 14);
  g.fill();
  g.stroke();
  g.fillStyle = '#ff3b3b';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('CANJEADO', 0, 6);
  g.restore();
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  const y0 = kind === 'story' ? 1650 : 1218;
  let size = kind === 'story' ? 76 : 58;
  g.font = `${size}px MPArchivo`;
  const nm = (c.name || '').toUpperCase();
  while (size > 34 && g.measureText(nm).width > W - 144) g.font = `${(size -= 2)}px MPArchivo`;
  g.fillStyle = '#fff';
  g.fillText(nm, 72, y0);
  g.font = '900 34px MPDoto';
  g.fillStyle = c.color;
  g.fillRect(72, y0 + 30, 22, 22);
  g.fillStyle = '#fff';
  g.fillText(`${(c.variant || '').toUpperCase()} · N° ${num(c)}`, 110, y0 + 54);
  if (kind === 'story') {
    g.font = '700 36px MPAtkinson';
    g.fillText('+ Canjeado en chacalde.com', 72, H - 90);
  }
  return cv;
}

export async function shareOrDownload({ kind, card, img, no }, forceDownload) {
  const cv = await drawShare(document.createElement('canvas'), { kind, card, img, no });
  const blob = await new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.92));
  const name = `chacalde-canje-${no}-${kind === 'story' ? 'historia' : 'post'}.jpg`;
  const file = new File([blob], name, { type: 'image/jpeg' });
  if (!forceDownload && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Photo from the phone camera → 1600 px JPEG. */
export async function shrinkPhoto(file) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.85));
}
