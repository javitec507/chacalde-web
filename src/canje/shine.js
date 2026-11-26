import { useEffect } from 'react';

// Shine + tilt that follow the finger, the mouse or the phone's tilt (CSS vars --mx --my --rx --ry on the element).
export function useShine(ref, { tilt = 22 } = {}) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const set = (x, y) => {
      el.classList.remove('idle');
      el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
      el.style.setProperty('--ry', `${((x - 0.5) * tilt).toFixed(2)}deg`);
      el.style.setProperty('--rx', `${((0.5 - y) * tilt).toFixed(2)}deg`);
    };
    const clamp = (v) => Math.min(1, Math.max(0, v));
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      set(clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height));
    };
    const onLeave = () => {
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
      el.classList.add('idle');
    };
    const onTilt = (e) => {
      if (e.gamma == null) return;
      set(clamp(0.5 + e.gamma / 50), clamp(0.5 + (e.beta - 40) / 50));
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    window.addEventListener('deviceorientation', onTilt);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('deviceorientation', onTilt);
    };
  }, [ref, tilt]);
}

// iOS asks before sharing the phone's tilt; other phones just send it.
export const needsMotionPermission = () => typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';
export async function askMotion() {
  try {
    await DeviceOrientationEvent.requestPermission();
  } catch {
    /* declined */
  }
}
