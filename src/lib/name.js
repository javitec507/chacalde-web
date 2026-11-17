// Name rules shared by the live certificate, the photos and the PDF.

export const NAME_MAX = 40;

// Name box on the certificate, in certificate px (816 x 528).
export const NAME_BOX = { left: 548, width: 223, line: 205 };

// Letters (any script), combining marks, spaces, apostrophes, dots and hyphens.
export function cleanName(raw) {
  return String(raw ?? '')
    .replace(/[^\p{L}\p{M}\s'’.\-]/gu, '')
    .replace(/\s+/g, ' ')
    .slice(0, NAME_MAX);
}

let measureCtx = null;
function ctx() {
  if (typeof document === 'undefined') return null;
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  return measureCtx;
}

// Largest size (17px max) that fits the name line.
export function nameFontSize(name) {
  const text = String(name || '').trim();
  let size = 17;
  const c = ctx();
  if (!c || !text) return size;
  while (size > 8) {
    c.font = `700 ${size}px "Atkinson Hyperlegible Next"`;
    if (c.measureText(text).width <= NAME_BOX.width - 8) break;
    size -= 0.5;
  }
  return size;
}

// Atkinson Hyperlegible Next uses typo metrics: ascent .984, descent .316 (em).
// With line-height 1 and top = line - size, the baseline sits at line - 0.166 * size.
export function nameBaseline(size) {
  return NAME_BOX.line - 0.166 * size;
}

export function firstName(name) {
  return String(name || '').trim().split(' ')[0] || '';
}

export function slug(name) {
  return (
    String(name || 'paciente')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'paciente'
  );
}
