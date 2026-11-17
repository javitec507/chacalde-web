import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import JSZip from 'jszip';
import SCENES from '../data/scenes.json';
import { homography, drawWarped } from './homography.js';
import { NAME_BOX, nameFontSize, nameBaseline, slug } from './name.js';

import { PHOTOS } from '../data/photos.js';
export { PHOTOS };

const INK = '#161616';
const CERT_W = SCENES.cert.width;
const CERT_H = SCENES.cert.height;

const imgCache = new Map();
function loadImage(src) {
  if (!imgCache.has(src)) {
    imgCache.set(
      src,
      new Promise((resolve, reject) => {
        const im = new Image();
        im.decoding = 'async';
        im.onload = () => resolve(im);
        im.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
        im.src = src;
      })
    );
  }
  return imgCache.get(src);
}

async function fontsReady() {
  if (!document.fonts) return;
  await Promise.all([
    document.fonts.load('700 20px "Atkinson Hyperlegible Next"'),
    document.fonts.load('italic 900 100px "Archivo"'),
    document.fonts.load('900 30px "Doto"')
  ]);
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toBlob(c, type = 'image/jpeg', q = 0.9) {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo exportar la imagen'))), type, q)
  );
}

// The name, drawn alone at high resolution, covering the name box of the certificate.
function nameLayer(name) {
  const S = 5;
  const ox = NAME_BOX.left - 12;
  const oy = NAME_BOX.line - 26;
  const w = NAME_BOX.width + 24;
  const h = 34;
  const c = canvas(Math.round(w * S), Math.round(h * S));
  const g = c.getContext('2d');
  const size = nameFontSize(name);
  g.scale(S, S);
  g.fillStyle = INK;
  g.font = `700 ${size}px "Atkinson Hyperlegible Next"`;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillText(name, NAME_BOX.left + NAME_BOX.width / 2 - ox, nameBaseline(size) - oy);
  return { c, ox, oy, S };
}

async function scenePhoto(scene, name, layer) {
  const base = await loadImage(`/scenes/${scene.id}.jpg`);
  const W = SCENES.width;
  const Hh = SCENES.height;
  const out = canvas(W, Hh);
  const g = out.getContext('2d');
  g.drawImage(base, 0, 0, W, Hh);
  if (name) {
    const H = homography(
      [
        [0, 0],
        [CERT_W, 0],
        [CERT_W, CERT_H],
        [0, CERT_H]
      ],
      scene.quad
    );
    const ink = canvas(W, Hh);
    const ig = ink.getContext('2d');
    ig.imageSmoothingQuality = 'high';
    drawWarped(ig, layer.c, H, { ox: layer.ox, oy: layer.oy, scale: layer.S, cols: 28, rows: 3 });
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = 0.94;
    g.filter = 'blur(0.35px)';
    g.drawImage(ink, 0, 0);
    g.restore();
  }
  return out;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

async function storyFrom(post, turno) {
  const [logo, icon] = await Promise.all([loadImage('/img/logo-white.png'), loadImage('/img/icon.png')]);
  const c = canvas(1080, 1920);
  const g = c.getContext('2d');
  g.fillStyle = '#0A0A0A';
  g.fillRect(0, 0, 1080, 1920);

  const lh = 72;
  g.drawImage(logo, 72, 96, (logo.width / logo.height) * lh, lh);

  // ticket chip
  g.font = '900 28px "Doto"';
  const label = `№ ${turno}`;
  const tw = g.measureText(label).width;
  const cw = tw + 22 + 14 + 40;
  const cx = 1008 - cw;
  roundRect(g, cx, 108, cw, 50, 6);
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
  g.fillText(label, cx + 46, 134);

  // headline, one line across
  const text = 'HASTA NUEVO AVISO.';
  if ('fontStretch' in g) g.fontStretch = 'condensed';
  g.textBaseline = 'alphabetic';
  g.font = 'italic 900 100px "Archivo"';
  const w100 = g.measureText(text).width;
  const size = Math.min(130, (100 * 930) / w100);
  g.font = `italic 900 ${size}px "Archivo"`;
  g.fillText(text, 72, 196 + size * 0.8);
  if ('fontStretch' in g) g.fontStretch = 'normal';

  g.drawImage(post, 0, 316, 1080, 1350);

  g.save();
  g.translate(1080 - 56 - 95, 1500 + 99);
  g.rotate((8 * Math.PI) / 180);
  g.shadowColor = 'rgba(0,0,0,0.5)';
  g.shadowBlur = 18;
  g.shadowOffsetY = 10;
  g.drawImage(icon, -95, -99, 190, (icon.height / icon.width) * 190);
  g.restore();

  // cross + url
  g.fillStyle = '#FFFFFF';
  const x0 = 72, y0 = 1712;
  const k = 30 / 24;
  g.beginPath();
  [[9, 2], [15, 2], [15, 9], [22, 9], [22, 15], [15, 15], [15, 22], [9, 22], [9, 15], [2, 15], [2, 9], [9, 9]].forEach(([x, y], i) =>
    i ? g.lineTo(x0 + x * k, y0 + y * k) : g.moveTo(x0 + x * k, y0 + y * k)
  );
  g.closePath();
  g.fill();
  g.font = '700 38px "Atkinson Hyperlegible Next"';
  g.textBaseline = 'middle';
  g.fillText('Saca el tuyo en chacalde.com', x0 + 46, y0 + 16);
  return c;
}

export async function makePdf(name) {
  const [tpl, fontBytes] = await Promise.all([
    fetch('/template.pdf').then((r) => r.arrayBuffer()),
    fetch('/fonts/atkinson-700.ttf').then((r) => r.arrayBuffer())
  ]);
  const pdf = await PDFDocument.load(tpl);
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  const page = pdf.getPage(0);
  const px = 0.75; // CSS px -> pt
  const sizePx = nameFontSize(name);
  const size = sizePx * px;
  let w = font.widthOfTextAtSize(name, size);
  const cx = (NAME_BOX.left + NAME_BOX.width / 2) * px;
  page.drawText(name, {
    x: cx - w / 2,
    y: (CERT_H - nameBaseline(sizePx)) * px,
    size,
    font,
    color: rgb(0.086, 0.086, 0.086)
  });
  pdf.setTitle(`Certificado de No Incapacidad · ${name}`);
  pdf.setAuthor('Disque Consultorios Chacalde');
  pdf.setSubject('Contenido de humor. No es válido para ningún trámite.');
  pdf.setProducer('chacalde.com');
  pdf.setCreator('chacalde.com');
  const bytes = await pdf.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

// Everything the result page offers, built in the browser.
export async function generateAll(name, turno, onProgress = () => {}) {
  await fontsReady();
  const layer = nameLayer(name);
  const items = [];
  let done = 0;
  const total = SCENES.scenes.length * 2 + 1;
  for (const scene of SCENES.scenes) {
    const meta = PHOTOS.find((p) => p.id === scene.id);
    const post = await scenePhoto(scene, name, layer);
    const postBlob = await toBlob(post, 'image/jpeg', 0.9);
    onProgress(++done / total);
    const story = await storyFrom(post, turno);
    const storyBlob = await toBlob(story, 'image/jpeg', 0.9);
    onProgress(++done / total);
    items.push({ ...meta, post: postBlob, story: storyBlob });
  }
  const pdf = await makePdf(name);
  onProgress(1);
  return { name, turno, pdf, items, base: `chacalde-${slug(name)}` };
}

export async function makeZip(result) {
  const zip = new JSZip();
  zip.file(`${result.base}-certificado.pdf`, result.pdf);
  result.items.forEach((it, i) => {
    zip.file(`post/${i + 1}-${it.id}.jpg`, it.post);
    zip.file(`historia/${i + 1}-${it.id}.jpg`, it.story);
  });
  return zip.generateAsync({ type: 'blob' });
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function shareFiles(files, text) {
  if (navigator.canShare && navigator.canShare({ files })) {
    await navigator.share({ files, text });
    return true;
  }
  return false;
}
