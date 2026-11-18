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
  const base = await loadImage(`/scenes/${scene.id}-v3.jpg`);
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

// ---------- Big patient name (posts + stories) ----------
const DISPLAY = (size) => `italic 900 condensed ${size}px "Archivo"`;
const LABEL = 'DISQUE PACIENTE';

function upper(name) {
  return name.toLocaleUpperCase('es');
}

function setSpacing(g, v) {
  if ('letterSpacing' in g) g.letterSpacing = v;
}

// Fit the name on one line (or two, if one would be too small) inside maxW.
function fitName(g, text, maxW, maxSize, minOne, minSize) {
  g.font = DISPLAY(100);
  const w100 = g.measureText(text).width || 1;
  const one = Math.min(maxSize, (100 * maxW) / w100);
  const spaces = [...text.matchAll(/ /g)].map((m) => m.index);
  if (one >= minOne || !spaces.length || minOne === undefined) {
    return { lines: [text], size: Math.max(minSize, one) };
  }
  let best = null;
  for (const i of spaces) {
    const a = text.slice(0, i);
    const b = text.slice(i + 1);
    const wa = g.measureText(a).width;
    const wb = g.measureText(b).width;
    const wMax = Math.max(wa, wb);
    if (!best || wMax < best.wMax) best = { lines: [a, b], wMax };
  }
  const two = Math.min(maxSize * 0.86, (100 * maxW) / best.wMax);
  return two > one ? { lines: best.lines, size: Math.max(minSize, two) } : { lines: [text], size: Math.max(minSize, one) };
}

function drawLabel(g, text, x, y, color, size = 24, align = 'left') {
  g.save();
  g.font = `700 ${size}px "Atkinson Hyperlegible Next"`;
  setSpacing(g, `${Math.round(size * 0.18)}px`);
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = 'alphabetic';
  g.fillText(text, x, y);
  g.restore();
}

// Post 4:5 — dark strip at the foot of the photo with the patient's name, big.
function postFrom(photo, name) {
  const W = photo.width;
  const H = photo.height;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  g.drawImage(photo, 0, 0);
  const grad = g.createLinearGradient(0, H - 330, 0, H);
  grad.addColorStop(0, 'rgba(10,10,10,0)');
  grad.addColorStop(0.45, 'rgba(10,10,10,0.72)');
  grad.addColorStop(1, 'rgba(10,10,10,0.94)');
  g.fillStyle = grad;
  g.fillRect(0, H - 330, W, 330);

  const text = upper(name);
  const maxW = W - 144;
  g.save();
  const { size } = fitName(g, text, maxW, 104, undefined, 40);
  const base = H - 64;
  g.font = DISPLAY(size);
  g.fillStyle = '#FFFFFF';
  g.textBaseline = 'alphabetic';
  g.fillText(text, 72, base, maxW);
  g.restore();

  const labelY = base - size * 0.76 - 24;
  drawLabel(g, LABEL, 72, labelY, 'rgba(255,255,255,0.62)', 24);
  drawLabel(g, 'CHACALDE.COM', W - 72, labelY, 'rgba(255,255,255,0.62)', 24, 'right');
  return c;
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

async function storyFrom(photo, name, turno) {
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

  // the patient's name is the headline
  drawLabel(g, LABEL, 72, 232, 'rgba(255,255,255,0.55)', 26);
  const text = upper(name);
  g.save();
  const { lines, size } = fitName(g, text, 936, 132, 84, 44);
  g.font = DISPLAY(size);
  g.fillStyle = '#FFFFFF';
  g.textBaseline = 'alphabetic';
  let y = 258 + size * 0.74;
  lines.forEach((ln, i) => {
    if (i) y += size * 0.92;
    g.fillText(ln, 72, y, 936);
  });
  g.restore();

  const postY = Math.round(Math.min(470, y + 40));
  g.drawImage(photo, 0, postY, 1080, 1350);

  g.save();
  g.translate(1080 - 56 - 95, postY + 1350 - 67);
  g.rotate((8 * Math.PI) / 180);
  g.shadowColor = 'rgba(0,0,0,0.5)';
  g.shadowBlur = 18;
  g.shadowOffsetY = 10;
  g.drawImage(icon, -95, -99, 190, (icon.height / icon.width) * 190);
  g.restore();

  // cross + url
  g.fillStyle = '#FFFFFF';
  const x0 = 72, y0 = postY + 1350 + 46;
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
    fetch('/certificado-v3.pdf').then((r) => r.arrayBuffer()),
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
    const photo = await scenePhoto(scene, name, layer);
    const post = postFrom(photo, name);
    const postBlob = await toBlob(post, 'image/jpeg', 0.9);
    onProgress(++done / total);
    const story = await storyFrom(photo, name, turno);
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
    await navigator.share(text ? { files, text } : { files });
    return true;
  }
  return false;
}
