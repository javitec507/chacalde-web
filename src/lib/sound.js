// Sounds for the waiting room: pen and stamp, photo click, and the counter calling your number.
// Browsers only allow sound after a tap or key press, so nothing plays until then. The voice reads
// the turn number digit by digit; it never says the name. The only thing kept is the mute choice.
// On iPhone it plays like a video (also with the silent switch on); the header button mutes it.
import sfxUrl from '../assets/sfx/sfx.mp3?url';
import vozUrl from '../assets/sfx/voz.mp3?url';

// [start, length] in seconds inside each sprite file.
const SFX = { chime: [0, 2.02], stamp: [2.17, 0.42], pen: [2.74, 0.94], shutter: [3.83, 0.26], tick: [4.24, 0.045] };
const VOZ = {
  turno: [0, 1.007],
  0: [1.157, 0.918],
  1: [2.225, 0.884],
  2: [3.259, 0.848],
  3: [4.257, 0.884],
  4: [5.291, 0.999],
  5: [6.44, 1.069],
  6: [7.659, 0.929],
  7: [8.738, 0.988],
  8: [9.876, 0.953],
  9: [10.979, 0.953],
  retirar: [12.082, 1.522]
};
const LEVEL = { chime: 0.5, stamp: 0.95, pen: 0.55, shutter: 0.5, tick: 0.3, voz: 1 };
const KEY = 'chacalde:sonido';
const LATE_MS = 700; // a sound that would start later than this after it was asked for is skipped

let ctx = null;
let out = null;
const sheets = {};
const buffers = {};
const live = new Set();
const subs = new Set();
let muted = readMuted();

function readMuted() {
  try {
    return localStorage.getItem(KEY) === 'off';
  } catch {
    return false;
  }
}

function load(name, url) {
  if (!sheets[name]) {
    sheets[name] = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`sound ${r.status}`);
        return r.arrayBuffer();
      })
      .then((b) => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej)))
      .then((buf) => (buffers[name] = buf))
      .catch(() => {
        delete sheets[name];
        return null;
      });
  }
  return sheets[name];
}

/** Wake the audio (must run inside a tap or key press) and fetch the sounds. */
export function unlock() {
  if (typeof window === 'undefined' || muted) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  // iPhone: web sounds follow the silent switch unless the page asks for "playback" (iOS 17+).
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
    out.gain.value = 1;
    out.connect(ctx.destination);
  }
  if (ctx.state !== 'running') {
    // Older iPhones: a silent blip inside the tap fully wakes the audio.
    const s = ctx.createBufferSource();
    s.buffer = ctx.createBuffer(1, 1, 22050);
    s.connect(out);
    s.start(0);
    ctx.resume().catch(() => {});
  }
  load('sfx', sfxUrl);
  load('voz', vozUrl);
}

// Stay listening: iPhone pauses the audio when you leave for Instagram or WhatsApp to share,
// and the next tap (or coming back) wakes it again.
const GESTURES = ['pointerdown', 'touchend', 'keydown', 'click'];
function onGesture() {
  if (!ctx || ctx.state !== 'running' || !sheets.sfx || !sheets.voz) unlock();
}
if (typeof window !== 'undefined') {
  GESTURES.forEach((e) => window.addEventListener(e, onGesture, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAll();
    else if (ctx && !muted && ctx.state !== 'running') ctx.resume().catch(() => {});
  });
}

const canPlay = () => Boolean(ctx && out && ctx.state === 'running' && !muted && !document.hidden);

function start(sheet, [offset, length], { at = 0, gain = 1, rate = 1 } = {}) {
  const buf = buffers[sheet];
  if (!buf) return at;
  const s = ctx.createBufferSource();
  s.buffer = buf;
  s.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = gain;
  s.connect(g);
  g.connect(out);
  const t = Math.max(ctx.currentTime, at);
  s.start(t, offset, length);
  live.add(s);
  s.onended = () => live.delete(s);
  return t + length / rate;
}

// Run now if the sounds are in; if they are still arriving, run only if they arrive soon.
function whenLoaded(names, fn, maxWait = LATE_MS) {
  if (!ctx || muted) return;
  if (names.every((n) => buffers[n])) {
    if (canPlay()) fn();
    return;
  }
  const asked = performance.now();
  Promise.all(names.map((n) => sheets[n])).then(() => {
    if (performance.now() - asked <= maxWait && names.every((n) => buffers[n]) && canPlay()) fn();
  });
}

/** Play one effect: chime, stamp, pen, shutter or tick. */
export function play(name, { delay = 0, gain = 1, rate = 1 } = {}) {
  whenLoaded(['sfx'], () => start('sfx', SFX[name], { at: ctx.currentTime + delay, gain: LEVEL[name] * gain, rate }));
}

/** Ding-dong, then the loudspeaker: "Turno 4-7-2-8-1-5. Pase a retirar." Digits only. */
export function announce(turno, { delay = 0 } = {}) {
  const digits = String(turno).replace(/\D/g, '').slice(0, 8).split('');
  if (!digits.length) return;
  whenLoaded(
    ['sfx', 'voz'],
    () => {
      const v = LEVEL.voz;
      let t = ctx.currentTime + delay;
      start('sfx', SFX.chime, { at: t, gain: LEVEL.chime });
      t += 1.25;
      t = start('voz', VOZ.turno, { at: t, gain: v }) - 0.12;
      for (const d of digits) t = start('voz', VOZ[d], { at: t, gain: v }) - 0.24;
      start('voz', VOZ.retirar, { at: t + 0.22, gain: v });
    },
    2500
  );
}

/** Silence everything that is playing or scheduled. */
export function stopAll() {
  live.forEach((s) => {
    try {
      s.stop();
    } catch {
      /* already stopped */
    }
  });
  live.clear();
}

export const isMuted = () => muted;
export function subscribe(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
export function setMuted(next) {
  muted = Boolean(next);
  try {
    if (muted) localStorage.setItem(KEY, 'off');
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: the choice lasts for this visit */
  }
  if (muted) {
    stopAll();
    // Let go of the audio so the phone's own music can play again.
    if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
  } else unlock();
  subs.forEach((fn) => fn());
}
