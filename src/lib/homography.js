// 3x3 perspective transform from 4 source points to 4 destination points.
export function homography(src, dst) {
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solve(A, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

export function apply(H, x, y) {
  const w = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
}

// CSS matrix3d() for an element of size w x h placed at the origin.
export function cssMatrix3d(w, h, quad) {
  const H = homography(
    [
      [0, 0],
      [w, 0],
      [w, h],
      [0, h]
    ],
    quad
  );
  const m = [H[0], H[3], 0, H[6], H[1], H[4], 0, H[7], 0, 0, 1, 0, H[2], H[5], 0, H[8]];
  return `matrix3d(${m.map((v) => +v.toFixed(8)).join(',')})`;
}

// Draw `img` (whose pixel (sx,sy) maps to cert point (sx/scale + ox, sy/scale + oy))
// through H onto ctx, by splitting it into small affine triangles.
export function drawWarped(ctx, img, H, { ox, oy, scale, cols = 24, rows = 3 }) {
  const W = img.width;
  const Hh = img.height;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x0 = (i / cols) * W;
      const x1 = ((i + 1) / cols) * W;
      const y0 = (j / rows) * Hh;
      const y1 = ((j + 1) / rows) * Hh;
      const P = (x, y) => apply(H, x / scale + ox, y / scale + oy);
      const s = [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1]
      ];
      const d = s.map(([x, y]) => P(x, y));
      tri(ctx, img, s[0], s[1], s[2], d[0], d[1], d[2]);
      tri(ctx, img, s[0], s[2], s[3], d[0], d[2], d[3]);
    }
  }
}

function tri(ctx, img, s0, s1, s2, d0, d1, d2) {
  // expand the destination triangle a little to hide seams
  const cx = (d0[0] + d1[0] + d2[0]) / 3;
  const cy = (d0[1] + d1[1] + d2[1]) / 3;
  const grow = (p) => {
    const dx = p[0] - cx;
    const dy = p[1] - cy;
    const l = Math.hypot(dx, dy) || 1;
    return [p[0] + (dx / l) * 0.7, p[1] + (dy / l) * 0.7];
  };
  const [e0, e1, e2] = [grow(d0), grow(d1), grow(d2)];
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(e0[0], e0[1]);
  ctx.lineTo(e1[0], e1[1]);
  ctx.lineTo(e2[0], e2[1]);
  ctx.closePath();
  ctx.clip();
  // affine: maps s -> d
  const [x0, y0] = s0, [x1, y1] = s1, [x2, y2] = s2;
  const [u0, v0] = d0, [u1, v1] = d1, [u2, v2] = d2;
  const den = x0 * (y2 - y1) - x1 * y2 + x2 * y1 + (x1 - x2) * y0;
  if (Math.abs(den) < 1e-9) {
    ctx.restore();
    return;
  }
  const a = -(y0 * (u2 - u1) - y1 * u2 + y2 * u1 + (y1 - y2) * u0) / den;
  const b = (y1 * v2 + y0 * (v1 - v2) - y2 * v1 + (y2 - y1) * v0) / den;
  const c = (x0 * (u2 - u1) - x1 * u2 + x2 * u1 + (x1 - x2) * u0) / den;
  const d = -(x1 * v2 + x0 * (v1 - v2) - x2 * v1 + (x2 - x1) * v0) / den;
  const e = (x0 * (y2 * u1 - y1 * u2) + y0 * (x1 * u2 - x2 * u1) + (x2 * y1 - x1 * y2) * u0) / den;
  const f = (x0 * (y2 * v1 - y1 * v2) + y0 * (x1 * v2 - x2 * v1) + (x2 * y1 - x1 * y2) * v0) / den;
  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}
