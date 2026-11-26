// Ventanilla de canje: check the redemption code, reveal the prize with its shine, claim it, share it.
(() => {
  const root = document.getElementById('app');
  const CFG = JSON.parse(root.dataset.cfg);
  const A = CFG.assets;
  const API = CFG.api;
  const MM_PT = 25.4 / 72;
  const CSS_FONTS = { archivo: 'MPArchivo', atkinson: 'MPAtkinson', 'atkinson-regular': 'MPAtkinsonR', doto: 'MPDoto' };
  const S = { step: CFG.closed ? 'closed' : 'code', code: '', card: null, taken: false, photoCheck: true, delivery: [], photos: {}, previews: {}, img: null, result: null, err: '', busy: false };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const pad = (n, t) => String(n).padStart(String(t).length, '0');
  const num = (c) => `${pad(c.n, c.total)}/${c.total}`;

  const fontsReady = Promise.all(
    [
      ['MPArchivo', 'archivo-display.ttf'],
      ['MPAtkinson', 'atkinson-700.ttf'],
      ['MPAtkinsonR', 'atkinson-400.ttf'],
      ['MPDoto', 'doto-900.ttf']
    ].map(([fam, file]) =>
      new FontFace(fam, `url(${A}/${file})`)
        .load()
        .then((f) => document.fonts.add(f))
        .catch(() => null)
    )
  );
  const loadImg = (src) =>
    new Promise((ok, no) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = no;
      i.src = src;
    });

  async function post(action, data, headers = {}) {
    const isBlob = data instanceof Blob;
    const r = await fetch(`${API}/${action}`, {
      method: 'POST',
      headers: isBlob ? headers : { 'Content-Type': 'application/json', ...headers },
      body: isBlob ? data : JSON.stringify(data),
      credentials: 'same-origin'
    });
    const j = await r.json().catch(() => ({ error: 'Algo falló. Intenta otra vez.' }));
    return { status: r.status, ...j };
  }

  // ---------- the card, drawn like the printed one (front) ----------
  function fieldText(f, c) {
    const vars = { name: c.name || '', variant: c.variant || '', n: pad(c.n, c.total), total: String(c.total), code: '', edition: c.edition || '' };
    let t = f.key === 'number' ? (f.text || 'N° {n}/{total}').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : f.key === 'text' ? (f.text || '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : vars[f.key] || '';
    return f.upper ? t.toLocaleUpperCase('es') : t;
  }

  async function renderCard(c) {
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
        const img = await loadImg(`${A}/art/${c.art.file}`);
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
    // plain card (no art yet)
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

  // ---------- shine that follows the finger / mouse / phone tilt ----------
  function attachShine(el) {
    const set = (x, y) => {
      el.classList.remove('idle');
      el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
      el.style.setProperty('--ry', `${((x - 0.5) * 22).toFixed(2)}deg`);
      el.style.setProperty('--rx', `${((0.5 - y) * 22).toFixed(2)}deg`);
    };
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      set(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)));
    });
    el.addEventListener('pointerleave', () => {
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
      el.classList.add('idle');
    });
    const onTilt = (e) => {
      if (e.gamma == null) return;
      set(Math.min(1, Math.max(0, 0.5 + e.gamma / 50)), Math.min(1, Math.max(0, 0.5 + (e.beta - 40) / 50)));
    };
    window.addEventListener('deviceorientation', onTilt);
    return () => window.removeEventListener('deviceorientation', onTilt);
  }

  function holoHtml(c, { stamp = '', flip = false } = {}) {
    const ar = (c.card.trimW / c.card.trimH).toFixed(4);
    return `<div class="holo idle fx-${esc(c.effect || 'holo')}${flip ? ' flip' : ''}" style="--ar:${ar}" id="holo"><img id="card-img" alt="${esc(c.name)}, ${esc(c.variant)} ${num(c)}" src="${S.img || ''}"><div class="shine"></div><div class="sparkle"></div><div class="glare"></div>${stamp}</div>`;
  }

  // ---------- views ----------
  function render() {
    const head = `${CFG.preview ? '<div class="preview">VISTA PREVIA DEL PANEL · los canjes no se guardan</div>' : ''}<header class="top"><div class="in"><a href="/"><img src="/img/logo-white.png" alt="Chacalde"></a><span>Mystery Pack · Ventanilla de canje</span></div></header>`;
    let body = '';
    if (S.step === 'closed') {
      body = `<section class="hero"><div><p class="lbl">Mystery Pack</p><h1 class="display">La ventanilla<br>cerró.</h1><p class="lead">La campaña de canje terminó. Gracias a todos los que reclamaron su premio.</p></div><div class="stage"><div class="pack">CERRADO</div></div></section>`;
    } else if (S.step === 'code') {
      body = `<section class="hero"><div><p class="lbl">Mystery Pack · Redemption Card</p><h1 class="display">Canjea<br>tu premio.</h1>
<p class="lead">Escribe el código que viene en el reverso de tu Redemption Card. Si escaneaste el QR, ya está puesto.</p>
<form class="codebox" id="code-form" autocomplete="off"><input id="code" name="code" inputmode="text" autocapitalize="characters" spellcheck="false" maxlength="24" placeholder="MP26-XX-XXXX-XXXX" value="${esc(S.code)}" aria-label="Código de canje">
<button class="btn wide" type="submit"${S.busy ? ' disabled' : ''}>${S.busy ? 'Revisando…' : 'Revisar código'}</button>${S.err ? `<p class="err" role="alert">${esc(S.err)}</p>` : ''}</form>
<p class="note">Sin letras que se confunden: no hay O, I ni L, ni 0 ni 1.</p></div>
<div class="stage"><div class="pack">TU<br>CARTA<br>AQUÍ</div></div></section>`;
    } else if (S.step === 'reveal') {
      const c = S.card;
      body = `<section class="hero"><div class="stage">${holoHtml(c, { flip: true, stamp: S.taken ? '<div class="stamp gray">YA CANJEADA</div>' : '' })}<button class="btn line motion" id="motion" type="button" hidden>Mover el brillo con el teléfono</button></div>
<div class="prize" style="text-align:left"><p class="lbl">${S.taken ? 'Este código ya se usó' : '¡Felicidades! Te ganaste'}</p><h2 class="display">${esc(c.name || 'Tu premio')}</h2>
<p class="meta"><span class="sw" style="background:${esc(c.color)}"></span>${esc((c.variant || '').toUpperCase())} · N° ${num(c)}</p>
${S.taken ? '<p class="lead">Este premio ya fue reclamado. Si crees que es un error, escríbenos con una foto de tu tarjeta.</p><button class="btn line" id="again" type="button" style="margin-top:20px">Probar otro código</button>' : `<p class="lead">Es una carta única de tu Mystery Pack. Reclámala y te contactamos para entregártela.</p><button class="btn wide" id="go-form" type="button" style="margin-top:22px">Reclamar mi premio</button>`}</div></section>`;
    } else if (S.step === 'form') {
      const c = S.card;
      const ph = (side, title, hint) => `<label class="ph${S.photos[side] ? ' ok' : ''}">${S.previews[side] ? `<img src="${S.previews[side]}" alt="">` : `<span><b>${title}</b>${hint}</span>`}<input type="file" accept="image/*" capture="environment" data-photo="${side}"></label>`;
      const needsAddress = (S.form?.delivery || S.delivery[0] || '').toLowerCase().includes('env');
      body = `<section class="two"><div class="stage">${holoHtml(c)}<p class="meta" style="font:900 18px Doto,monospace"><span class="sw" style="background:${esc(c.color)}"></span>${esc(c.name)} · ${num(c)}</p></div>
<div><p class="lbl">Último paso</p><h2 class="display" style="font-size:clamp(36px,6vw,56px)">¿A quién se lo entregamos?</h2>
<form id="claim" style="margin-top:22px">
<label class="f">Nombre completo<input name="name" required maxlength="80" autocomplete="name" value="${esc(S.form?.name || '')}"></label>
<label class="f">WhatsApp<input name="phone" required maxlength="30" inputmode="tel" autocomplete="tel" placeholder="+507 6000-0000" value="${esc(S.form?.phone || '')}"></label>
<label class="f">Correo (opcional)<input name="email" type="email" maxlength="120" autocomplete="email" value="${esc(S.form?.email || '')}"></label>
<label class="f">Entrega<select name="delivery">${S.delivery.map((d) => `<option${d === S.form?.delivery ? ' selected' : ''}>${esc(d)}</option>`).join('')}</select></label>
${needsAddress ? `<label class="f">Dirección y referencias<textarea name="address" maxlength="300">${esc(S.form?.address || '')}</textarea></label>` : ''}
${S.photoCheck ? `<div><p class="lbl" style="margin:6px 0 10px">Fotos de tu Redemption Card</p><div class="photos">${ph('front', 'Frente', 'Toca para tomar la foto')}${ph('back', 'Reverso', 'Donde se ve el código')}</div><p class="note">Con esto confirmamos que la tarjeta física es tuya.</p></div>` : ''}
<label class="consent"><input type="checkbox" name="consent" required${S.form?.consent ? ' checked' : ''}> Acepto que usen estos datos solo para entregarme el premio. Se borran 90 días después de la entrega.</label>
${S.err ? `<p class="err" role="alert">${esc(S.err)}</p>` : ''}
<button class="btn wide" type="submit"${S.busy ? ' disabled' : ''}>${S.busy ? 'Enviando…' : 'Canjear ahora'}</button></form></div></section>`;
    } else if (S.step === 'done') {
      const c = S.card;
      body = `<section class="two"><div class="stage">${holoHtml(c, { stamp: '<div class="stamp">CANJEADO</div>' })}</div>
<div><p class="lbl">Canje registrado</p><p class="ticket">${esc(S.result.no)}</p><h2 class="display" style="font-size:clamp(34px,6vw,54px);margin-top:10px">¡Es tuyo!</h2>
<p class="lead">Te escribimos por WhatsApp para coordinar la entrega de <b>${esc(c.name)}</b> (${esc(c.variant)} · N° ${num(c)}). Guarda este número de canje.</p>
<div class="share" style="margin-top:26px"><p class="lbl" style="margin:0">Presúmelo</p><canvas id="story" width="1080" height="1920" aria-label="Historia para compartir"></canvas>
<div class="row"><button class="btn" id="share-story" type="button">Compartir historia</button><button class="btn line" id="dl-story" type="button">Descargar</button><button class="btn line" id="dl-post" type="button">Post 4:5</button></div></div></div></section>`;
    }
    root.innerHTML = `${head}<main>${body}</main>`;
    wire();
  }

  let detach = null;
  function wire() {
    if (detach) detach();
    detach = null;
    const holo = document.getElementById('holo');
    if (holo) {
      detach = attachShine(holo);
      const m = document.getElementById('motion');
      if (m && typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        m.hidden = false;
        m.addEventListener('click', async () => {
          try {
            await DeviceOrientationEvent.requestPermission();
          } catch {
            /* declined */
          }
          m.hidden = true;
        });
      }
    }
    const cf = document.getElementById('code-form');
    if (cf) {
      cf.addEventListener('submit', (e) => {
        e.preventDefault();
        check(document.getElementById('code').value);
      });
      if (!S.code) document.getElementById('code').focus();
    }
    const go = document.getElementById('go-form');
    if (go) go.addEventListener('click', () => ((S.step = 'form'), (S.err = ''), render(), window.scrollTo(0, 0)));
    const again = document.getElementById('again');
    if (again) again.addEventListener('click', () => ((S.step = 'code'), (S.code = ''), (S.err = ''), render()));
    const form = document.getElementById('claim');
    if (form) {
      const keep = () => {
        const fd = new FormData(form);
        S.form = { name: fd.get('name'), phone: fd.get('phone'), email: fd.get('email'), delivery: fd.get('delivery'), address: fd.get('address') || S.form?.address || '', consent: fd.get('consent') === 'on' };
      };
      form.addEventListener('input', keep);
      form.addEventListener('change', (e) => {
        keep();
        if (e.target.name === 'delivery') render();
        if (e.target.dataset.photo) photo(e.target.dataset.photo, e.target.files[0]);
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        keep();
        claim();
      });
    }
    if (S.step === 'done') drawShare('story');
  }

  async function check(input) {
    S.code = String(input || '').trim();
    if (!S.code) return;
    S.busy = true;
    S.err = '';
    render();
    const r = await post('check', { code: S.code });
    S.busy = false;
    if (r.status === 200 || r.status === 409) {
      S.card = r.card;
      S.taken = r.status === 409;
      S.photoCheck = r.photoCheck !== false;
      S.delivery = r.delivery || ['Retiro en persona'];
      S.img = (await renderCard(r.card)).toDataURL('image/jpeg', 0.92);
      S.step = 'reveal';
    } else {
      S.err = r.error || 'No pudimos revisar el código.';
    }
    render();
  }

  async function photo(side, file) {
    if (!file) return;
    S.err = '';
    try {
      const bmp = await createImageBitmap(file);
      const s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * s);
      c.height = Math.round(bmp.height * s);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.85));
      S.previews[side] = URL.createObjectURL(blob);
      render();
      const r = await post('photo', blob, { 'Content-Type': 'image/jpeg', 'X-Code': S.code });
      if (r.status !== 200) throw new Error(r.error);
      S.photos[side] = r.photo;
    } catch (e) {
      delete S.previews[side];
      S.err = e.message || 'No pudimos subir la foto. Prueba otra vez.';
    }
    render();
  }

  async function claim() {
    S.busy = true;
    S.err = '';
    render();
    const r = await post('claim', { code: S.code, ...S.form, photos: S.photos });
    S.busy = false;
    if (r.status === 200) {
      S.result = r;
      S.step = 'done';
      window.scrollTo(0, 0);
    } else {
      S.err = r.error || 'No se pudo registrar. Intenta otra vez.';
    }
    render();
  }

  // ---------- share pictures ----------
  async function drawShare(kind, target) {
    await fontsReady;
    const c = S.card;
    const W = 1080;
    const H = kind === 'story' ? 1920 : 1350;
    const cv = target || document.getElementById('story');
    if (!cv) return null;
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d');
    g.fillStyle = '#0a0a0a';
    g.fillRect(0, 0, W, H);
    const [logo, card] = await Promise.all([loadImg('/img/logo-white.png'), loadImg(S.img)]);
    g.drawImage(logo, 72, 80, (logo.width / logo.height) * 64, 64);
    g.font = '900 28px MPDoto';
    g.fillStyle = '#fff';
    g.textAlign = 'right';
    g.fillText(`N° ${S.result.no}`, W - 72, 124);
    g.textAlign = 'left';
    g.font = '700 26px MPAtkinson';
    if ('letterSpacing' in g) g.letterSpacing = '5px';
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillText('MYSTERY PACK · REDEMPTION', 72, kind === 'story' ? 236 : 210);
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    g.fillStyle = '#fff';
    g.font = `${kind === 'story' ? 150 : 118}px MPArchivo`;
    g.fillText('¡CANJEADO!', 64, kind === 'story' ? 380 : 330);
    // the card, tilted, with a frozen shine
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
    const r = cw * 0.045;
    g.beginPath();
    g.roundRect(-cw / 2, -ch / 2, cw, ch, r);
    g.fillStyle = '#111';
    g.fill();
    g.shadowColor = 'transparent';
    g.clip();
    g.drawImage(card, -cw / 2, -ch / 2, cw, ch);
    const fx = c.effect || 'holo';
    if (fx !== 'none') {
      const grad = g.createLinearGradient(-cw / 2, -ch / 2, cw / 2, ch / 2);
      const stops = fx === 'super' || fx === 'oneofone' ? ['rgba(255,244,184,0)', 'rgba(255,210,63,0.45)', 'rgba(176,122,18,0.25)', 'rgba(255,241,166,0)'] : ['rgba(255,79,216,0)', 'rgba(255,79,216,0.35)', 'rgba(79,248,255,0.35)', 'rgba(255,246,79,0)'];
      stops.forEach((s, i) => grad.addColorStop([0.25, 0.42, 0.56, 0.72][i], s));
      g.globalCompositeOperation = 'screen';
      g.fillStyle = grad;
      g.fillRect(-cw / 2, -ch / 2, cw, ch);
      g.globalCompositeOperation = 'source-over';
    }
    g.restore();
    // stamp
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
    // prize line + foot
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

  async function shareOrDownload(kind, forceDownload) {
    const cv = await drawShare(kind, document.createElement('canvas'));
    const blob = await new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.92));
    const name = `chacalde-canje-${S.result.no}-${kind === 'story' ? 'historia' : 'post'}.jpg`;
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

  root.addEventListener('click', (e) => {
    const id = e.target.closest('button')?.id;
    if (id === 'share-story') shareOrDownload('story');
    if (id === 'dl-story') shareOrDownload('story', true);
    if (id === 'dl-post') shareOrDownload('post', true);
  });

  // start: a QR opens /canje#CODE (the code never reaches server logs)
  const fromHash = decodeURIComponent(location.hash.slice(1));
  if (fromHash && S.step === 'code') {
    history.replaceState(null, '', location.pathname);
    S.code = fromHash;
    render();
    check(fromHash);
  } else render();
})();
