// Mystery Pack sounds. Browsers only allow sound after a tap, so the pack you tap to open wakes the audio.
// Two sources: the site's sprite (chime, stamp, pen, shutter, tick) and a few made on the spot with
// Web Audio (foil rip, whoosh, sparkle, pop, error). On iPhone it plays with the silent switch on too.
// The only thing kept is the mute choice (same key as the certificate site).
const SFX = { chime: [0, 2.02], stamp: [2.17, 0.42], pen: [2.74, 0.94], shutter: [3.83, 0.26], tick: [4.24, 0.045] };
const LEVEL = { chime: 0.45, stamp: 0.95, pen: 0.5, shutter: 0.5, tick: 0.3 };
const KEY = 'chacalde:sonido';

let ctx = null;
let out = null;
let sprite = null;
let spriteUrl = '';
let loading = null;
let noise = null;
let muted = readMuted();
const subs = new Set();

function readMuted() {
  try {
    return localStorage.getItem(KEY) === 'off';
  } catch {
    return false;
  }
}

export function setSpriteUrl(url) {
  spriteUrl = url;
}

/** Wake the audio. Must run inside a tap or key press. */
export function unlock() {
  if (typeof window === 'undefined' || muted) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback';
  } catch {
    /* not supported */
  }
  if (!ctx) {
    try {
      ctx = new AC({ latencyHint: 'interactive' });
    } catch {
      ctx = new AC();
    }
    out = ctx.createGain();
    out.gain.value = 0.9;
    out.connect(ctx.destination);
  }
  if (ctx.state !== 'running') {
    const s = ctx.createBufferSource();
    s.buffer = ctx.createBuffer(1, 1, 22050);
    s.connect(out);
    s.start(0);
    ctx.resume().catch(() => {});
  }
  if (!sprite && !loading && spriteUrl) {
    loading = fetch(spriteUrl)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((b) => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej)))
      .then((buf) => (sprite = buf))
      .catch(() => (loading = null));
  }
}

if (typeof window !== 'undefined') {
  ['pointerdown', 'touchend', 'keydown'].forEach((e) =>
    window.addEventListener(
      e,
      () => {
        if (!ctx || ctx.state !== 'running') unlock();
      },
      { capture: true, passive: true }
    )
  );
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && ctx && !muted && ctx.state !== 'running') ctx.resume().catch(() => {});
  });
}

const ready = () => Boolean(ctx && out && ctx.state === 'running' && !muted && !document.hidden);

function noiseBuffer() {
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
  }
  return noise;
}

function env(g, t, peak, attack, release) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
}

function tone(freq, t, { type = 'sine', peak = 0.2, attack = 0.005, release = 0.5, to = null, detune = 0 } = {}) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + attack + release);
  o.detune.value = detune;
  const g = ctx.createGain();
  env(g, t, peak, attack, release);
  o.connect(g);
  g.connect(out);
  o.start(t);
  o.stop(t + attack + release + 0.05);
}

function hiss(t, { dur = 0.3, peak = 0.3, from = 600, to = 2400, q = 1.2, type = 'bandpass', attack = 0.02 } = {}) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer();
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  env(g, t, peak, attack, dur);
  s.connect(f);
  f.connect(g);
  g.connect(out);
  s.start(t, Math.random() * 0.4);
  s.stop(t + attack + dur + 0.05);
}

const MADE = {
  // foil pack tearing: a run of crackly bursts rising in pitch
  rip(t) {
    for (let i = 0; i < 9; i += 1) hiss(t + i * 0.032 + Math.random() * 0.012, { dur: 0.05 + Math.random() * 0.05, peak: 0.28 + Math.random() * 0.2, from: 1400 + i * 260, to: 3800 + i * 300, q: 2.4, attack: 0.003 });
    hiss(t, { dur: 0.42, peak: 0.12, from: 900, to: 5200, q: 0.7, attack: 0.01 });
  },
  whoosh(t) {
    hiss(t, { dur: 0.34, peak: 0.32, from: 280, to: 2200, q: 1.6, attack: 0.08 });
  },
  sparkle(t) {
    [1568, 2093, 2637, 3136, 3951, 4699].forEach((f, i) => tone(f, t + i * 0.055, { type: 'triangle', peak: 0.07, release: 0.7, detune: (Math.random() - 0.5) * 14 }));
    hiss(t + 0.05, { dur: 0.8, peak: 0.04, from: 6000, to: 9000, q: 0.5, type: 'highpass' });
  },
  pop(t) {
    tone(420, t, { peak: 0.18, release: 0.09, to: 900 });
  },
  error(t) {
    tone(196, t, { type: 'square', peak: 0.05, release: 0.12 });
    tone(165, t + 0.13, { type: 'square', peak: 0.05, release: 0.18 });
  },
  rise(t) {
    tone(220, t, { type: 'sawtooth', peak: 0.03, attack: 0.6, release: 0.25, to: 880 });
    hiss(t, { dur: 0.8, peak: 0.06, from: 400, to: 4000, q: 0.8, attack: 0.6 });
  }
};

/** Play an effect: chime, stamp, pen, shutter, tick (sprite) or rip, whoosh, sparkle, pop, error, rise (made here). */
export function sfx(name, { delay = 0, gain = 1, rate = 1 } = {}) {
  if (!ready()) return;
  const t = ctx.currentTime + delay;
  if (MADE[name]) {
    MADE[name](t);
    return;
  }
  if (!sprite || !SFX[name]) return;
  const [offset, length] = SFX[name];
  const s = ctx.createBufferSource();
  s.buffer = sprite;
  s.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = LEVEL[name] * gain;
  s.connect(g);
  g.connect(out);
  s.start(t, offset, length);
}

export const isMuted = () => muted;
export function setMuted(v) {
  muted = Boolean(v);
  try {
    localStorage.setItem(KEY, muted ? 'off' : 'on');
  } catch {
    /* private mode */
  }
  if (ctx) {
    if (muted) ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
  }
  if (!muted) unlock();
  subs.forEach((f) => f(muted));
}
export function onMute(f) {
  subs.add(f);
  return () => subs.delete(f);
}
