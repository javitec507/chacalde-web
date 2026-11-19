// Draws the 9:16 promo picture (total + fun facts) in the panel, then shares or downloads it.
// Runs only on the panel's "Imagen para compartir" page. Numbers come from the page; nothing is sent anywhere.
(async () => {
  const cv = document.getElementById('story');
  const shareBtn = document.getElementById('share');
  const dlBtn = document.getElementById('download');
  if (!cv) return;
  const S = JSON.parse(cv.dataset.stats);
  const W = 1080;
  const H = 1920;
  const g = cv.getContext('2d');

  const img = (src) =>
    new Promise((ok, no) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => no(new Error(src));
      i.src = src;
    });
  const fonts = document.fonts
    ? Promise.all([
        document.fonts.load('900 100px Doto'),
        document.fonts.load('italic 900 100px Archivo'),
        document.fonts.load('700 30px Atkinson'),
        document.fonts.load('400 30px Atkinson')
      ])
    : Promise.resolve();
  const [logo, icon, scene] = await Promise.all([img('/img/logo-white.png'), img('/img/icon.png'), img('/scenes/cenital-v4.jpg'), fonts]);

  const DISPLAY = (px) => `italic 900 ${px}px Archivo`;
  const spacing = (v) => {
    if ('letterSpacing' in g) g.letterSpacing = v;
  };
  const label = (text, x, y, size, color, align = 'left') => {
    g.save();
    g.font = `700 ${size}px Atkinson`;
    spacing(`${Math.round(size * 0.18)}px`);
    g.fillStyle = color;
    g.textAlign = align;
    g.textBaseline = 'alphabetic';
    g.fillText(text, x, y);
    g.restore();
  };
  const fit = (text, font, maxW, maxSize, minSize = 20) => {
    g.font = font(100);
    const w = g.measureText(text).width || 1;
    return Math.max(minSize, Math.min(maxSize, (100 * maxW) / w));
  };
  const roundRect = (x, y, w, h, r) => {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  };

  // background
  g.fillStyle = '#0A0A0A';
  g.fillRect(0, 0, W, H);

  // logo + "as of" chip
  g.drawImage(logo, 72, 96, (logo.width / logo.height) * 72, 72);
  g.font = '900 28px Doto';
  const chip = `AL ${S.asOf}`;
  const cw = g.measureText(chip).width + 22 + 14 + 40;
  const cx = W - 72 - cw;
  roundRect(cx, 108, cw, 50, 6);
  g.fillStyle = '#141414';
  g.fill();
  g.strokeStyle = '#2A2A2A';
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = '#FFFFFF';
  g.beginPath();
  g.arc(cx + 27, 133, 7, 0, Math.PI * 2);
  g.fill();
  g.textBaseline = 'middle';
  g.fillText(chip, cx + 46, 134);

  // the total, LED style, then the line under it
  label('CERTIFICADOS DE NO INCAPACIDAD', 72, 250, 26, 'rgba(255,255,255,0.55)');
  const numSize = fit(S.total, (px) => `900 ${px}px Doto`, 936, 250, 90);
  g.font = `900 ${numSize}px Doto`;
  g.fillStyle = '#FFFFFF';
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  const numBase = 278 + numSize * 0.78;
  g.fillText(S.total, 66, numBase);
  const lines = ['DISQUE PACIENTES', 'YA TIENEN SU NOTA.'];
  const dSize = Math.min(...lines.map((t) => fit(t, DISPLAY, 936, 96)));
  g.font = DISPLAY(dSize);
  let y = numBase + 26 + dSize * 0.8;
  lines.forEach((t, i) => {
    if (i) y += dSize * 0.92;
    g.fillText(t, 72, y);
  });

  // the certificate on the desk, as a tilted print, with "Tu nombre aquí" on the line
  const top = Math.round(y + 54);
  const photo = document.createElement('canvas');
  photo.width = 1080;
  photo.height = 720;
  const p = photo.getContext('2d');
  p.drawImage(scene, 0, 315, 1080, 720, 0, 0, 1080, 720);
  p.font = '700 22px Atkinson';
  p.fillStyle = 'rgba(22,22,22,0.88)';
  p.textAlign = 'center';
  p.textBaseline = 'alphabetic';
  p.fillText('Tu nombre aquí', -11.5 + 659.5 * 1.3501, 202.3 * 1.3608 + 0.9);
  const pw = 940;
  const ph = Math.round((pw * 720) / 1080);
  g.save();
  g.translate(W / 2, top + ph / 2);
  g.rotate((-2.2 * Math.PI) / 180);
  g.shadowColor = 'rgba(0,0,0,0.6)';
  g.shadowBlur = 30;
  g.shadowOffsetY = 14;
  g.fillStyle = '#F4F1EA';
  g.fillRect(-pw / 2 - 14, -ph / 2 - 14, pw + 28, ph + 28);
  g.shadowColor = 'transparent';
  g.drawImage(photo, -pw / 2, -ph / 2, pw, ph);
  g.restore();
  g.save();
  g.translate(W - 92, top + ph + 22);
  g.rotate((8 * Math.PI) / 180);
  g.shadowColor = 'rgba(0,0,0,0.5)';
  g.shadowBlur = 18;
  g.shadowOffsetY = 10;
  g.drawImage(icon, -75, -78, 150, (icon.height / icon.width) * 150);
  g.restore();

  // fun facts, 2 x 2
  const facts = S.facts.slice(0, 4);
  let fy = top + ph + 92;
  if (facts.length) {
    label('DATOS CURIOSOS DEL CONSULTORIO', 72, fy, 24, 'rgba(255,255,255,0.55)');
    fy += 26;
    const colW = 468;
    facts.forEach((f, i) => {
      const x = 72 + (i % 2) * colW;
      const yy = fy + Math.floor(i / 2) * 150;
      g.strokeStyle = '#2A2A2A';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x, yy);
      g.lineTo(x + colW - 36, yy);
      g.stroke();
      const vs = fit(f.v, (px) => `900 ${px}px Doto`, colW - 40, 64, 30);
      g.font = `900 ${vs}px Doto`;
      g.fillStyle = '#FFFFFF';
      g.textAlign = 'left';
      g.textBaseline = 'alphabetic';
      g.fillText(f.v, x - 4, yy + 18 + vs * 0.8);
      g.font = '700 23px Atkinson';
      g.fillStyle = 'rgba(255,255,255,0.62)';
      g.fillText(f.l.toUpperCase(), x, yy + 122, colW - 40);
    });
  }

  // call to action at the foot
  const x0 = 72;
  const y0 = H - 112;
  const k = 30 / 24;
  g.fillStyle = '#FFFFFF';
  g.beginPath();
  [[9, 2], [15, 2], [15, 9], [22, 9], [22, 15], [15, 15], [15, 22], [9, 22], [9, 15], [2, 15], [2, 9], [9, 9]].forEach(([a, b], i) =>
    i ? g.lineTo(x0 + a * k, y0 + b * k) : g.moveTo(x0 + a * k, y0 + b * k)
  );
  g.closePath();
  g.fill();
  g.font = '700 38px Atkinson';
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.fillText('Saca tu disque incapacidad en chacalde.com', x0 + 46, y0 + 16, W - x0 - 46 - 72);

  // share / download
  const blob = await new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.92));
  const name = cv.dataset.file || 'chacalde.jpg';
  const file = new File([blob], name, { type: 'image/jpeg' });
  const canShare = Boolean(navigator.canShare && navigator.canShare({ files: [file] }));
  const download = () => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
  dlBtn.disabled = false;
  dlBtn.addEventListener('click', download);
  if (canShare) {
    shareBtn.textContent = 'Compartir';
    shareBtn.disabled = false;
    shareBtn.addEventListener('click', async () => {
      try {
        await navigator.share({ files: [file] });
      } catch (e) {
        if (e && e.name !== 'AbortError') download();
      }
    });
  } else {
    shareBtn.remove();
    dlBtn.classList.add('btn--on');
  }
})();
