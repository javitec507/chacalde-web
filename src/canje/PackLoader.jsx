import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { sfx, unlock } from './sound.js';

// Crimped edge of a foil pack, as a clip-path polygon (teeth along the top or the bottom).
function crimp(edge, teeth = 18, depth = 5) {
  const pts = [];
  for (let i = 0; i <= teeth * 2; i += 1) {
    const x = (i / (teeth * 2)) * 100;
    const y = i % 2 ? depth : 0;
    pts.push(edge === 'top' ? `${x.toFixed(2)}% ${y}%` : `${x.toFixed(2)}% ${100 - y}%`);
  }
  return edge === 'top' ? `polygon(${pts.join(',')},100% 100%,0% 100%)` : `polygon(0% 0%,100% 0%,${pts.reverse().join(',')})`;
}

const preload = (src) =>
  new Promise((ok) => {
    const i = new Image();
    i.onload = i.onerror = () => ok();
    i.src = src;
  });

/**
 * The welcome: a foil Mystery Pack. Tap it and it tears open (with sound: the tap is what lets the
 * browser play audio), a Redemption Card rises out of it and the journey starts.
 */
export default function PackLoader({ assets, hasCode, onDone }) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState('idle'); // idle → open → out
  const [ready, setReady] = useState(false);
  const top = useMemo(() => crimp('top', 16, 30), []);
  const bottom = useMemo(() => crimp('bottom', 16, 4), []);

  useEffect(() => {
    let alive = true;
    Promise.all([preload(`${assets}/hero-back.jpg`), preload(`${assets}/hero-front.jpg`), document.fonts ? document.fonts.ready : null]).then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [assets]);

  const open = () => {
    if (phase !== 'idle') return;
    unlock();
    setPhase('open');
    if (reduce) {
      setTimeout(onDone, 200);
      return;
    }
    // give the audio a moment to wake inside the tap
    setTimeout(() => sfx('rip'), 30);
    setTimeout(() => sfx('rise'), 380);
    setTimeout(() => sfx('sparkle'), 1000);
    setTimeout(() => setPhase('out'), 1500);
    setTimeout(onDone, 1850);
  };

  useEffect(() => {
    const k = (e) => {
      if (e.key === 'Enter' || e.key === ' ') open();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const opened = phase !== 'idle';
  return (
    <motion.div className={`pk${opened ? ' pk--open' : ''}`} animate={phase === 'out' ? { opacity: 0, scale: 1.08 } : { opacity: 1, scale: 1 }} transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}>
      <motion.div className="pk-rays" aria-hidden="true" animate={{ opacity: opened ? 1 : 0.35, rotate: 360, scale: opened ? 1.25 : 1 }} transition={{ rotate: { duration: 30, repeat: Infinity, ease: 'linear' }, opacity: { duration: 0.6 }, scale: { duration: 0.8 } }} />
      <p className="pk-kicker">
        <img src="/img/logo-white.png" alt="Chacalde" /> <span>Mystery Pack</span>
      </p>
      <motion.button
        type="button"
        className="pk-pack"
        onClick={open}
        aria-label="Abrir el pack"
        initial={reduce ? false : { y: 60, opacity: 0, rotate: -8, scale: 0.9 }}
        animate={opened ? { y: 40, rotate: 0, scale: 0.96, opacity: 1 } : { y: [0, -8, 0], rotate: [-2, 2, -2], opacity: 1, scale: 1 }}
        transition={opened ? { type: 'spring', stiffness: 160, damping: 16 } : { y: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }, rotate: { duration: 4, repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.5 }, scale: { type: 'spring', stiffness: 140, damping: 14 } }}
        whileTap={opened ? undefined : { scale: 0.96 }}
      >
        {/* the card waiting inside */}
        <motion.span className="pk-card" aria-hidden="true" initial={false} animate={opened ? { y: '-58%', opacity: 1 } : { y: '6%', opacity: 0 }} transition={{ delay: opened ? 0.35 : 0, type: 'spring', stiffness: 90, damping: 14 }}>
          <img src={`${assets}/hero-back.jpg`} alt="" draggable="false" />
        </motion.span>
        <span className="pk-body" style={{ clipPath: bottom }}>
          <span className="pk-foil" />
          <span className="pk-print">
            <img src="/img/logo-white.png" alt="" />
            <b>Mystery Pack</b>
            <i>Redemption Edition</i>
            <em>1 tarjeta especial</em>
          </span>
        </span>
        <motion.span className="pk-top" style={{ clipPath: top }} aria-hidden="true" initial={false} animate={opened ? { y: -150, x: 60, rotate: 24, opacity: 0 } : { y: 0, x: 0, rotate: 0, opacity: 1 }} transition={{ duration: 0.6, ease: [0.3, 0.7, 0.4, 1] }}>
          <span className="pk-foil" />
          <span className="pk-tear">✂ abre aquí</span>
        </motion.span>
      </motion.button>
      <motion.p className="pk-hint" animate={opened ? { opacity: 0 } : { opacity: ready ? 1 : 0.5 }} aria-live="polite">
        {hasCode ? 'Tu código ya está listo. ' : ''}
        <b>Toca el pack para abrirlo</b>
      </motion.p>
      <p className="pk-fine">
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" fill="currentColor" /></svg>
        Mejor con sonido
      </p>
    </motion.div>
  );
}
