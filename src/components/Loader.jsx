import { useEffect, useState } from 'react';
import { motion, useReducedMotion, useSpring } from 'motion/react';

const curtain = [0.76, 0, 0.24, 1];

// Full-screen "sala de espera": logo, LED counter and a thin progress line.
// Used while the site opens and while the note, PDF and photos are being made.
export default function Loader({ progress = 0, label = 'Abriendo el consultorio', sub = '', turno = '' }) {
  const reduce = useReducedMotion();
  const spring = useSpring(0, { stiffness: 90, damping: 22, mass: 0.6 });
  const [pct, setPct] = useState(0);

  useEffect(() => spring.on('change', (v) => setPct(Math.max(0, Math.min(100, Math.round(v))))), [spring]);
  useEffect(() => {
    spring.set(Math.max(0, Math.min(1, progress)) * 100);
  }, [progress, spring]);

  // No scrolling the page behind the waiting room.
  useEffect(() => {
    const el = document.documentElement;
    const prev = el.style.overflow;
    el.style.overflow = 'hidden';
    return () => {
      el.style.overflow = prev;
    };
  }, []);

  const done = pct >= 100;

  return (
    <motion.div
      className="loader"
      role="status"
      aria-live="polite"
      aria-label={`${label}: ${pct}%`}
      initial={{ opacity: 1 }}
      exit={reduce ? { opacity: 0, transition: { duration: 0.25 } } : { y: '-100%', transition: { duration: 0.85, ease: curtain } }}
    >
      <div className="loader__top">
        <span className="loader__dot" aria-hidden="true" />
        <span>{done ? 'Pase a retirar' : 'En consulta'}</span>
        {turno ? <span className="loader__turno">№ {turno}</span> : null}
      </div>

      <div className="loader__center">
        <img className="loader__logo" src="/img/logo-white.png" width="800" height="286" alt="Chacalde" />
        <p className="loader__room">Sala de espera · Disque Consultorios</p>
        <div className="loader__led" aria-hidden="true">
          <span className="loader__num">{String(pct).padStart(3, '0')}</span>
          <span className="loader__pct">%</span>
        </div>
        <div className="loader__bar" aria-hidden="true">
          <span style={{ transform: `scaleX(${pct / 100})` }} />
        </div>
        <p className="loader__label">{label}…</p>
        {sub ? <p className="loader__sub">{sub}</p> : null}
      </div>

      <p className="loader__fine">Contenido de humor. Esta nota no es válida para ningún trámite.</p>
    </motion.div>
  );
}

// Waits for the fonts and the hero photo before the site shows, reporting progress.
export function useBoot(minMs = 1100, maxMs = 5000) {
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const t0 = performance.now();
    const wide = window.matchMedia('(min-width: 1100px)').matches;
    const img = (src) =>
      new Promise((resolve) => {
        const im = new Image();
        im.onload = im.onerror = () => resolve();
        im.src = src;
      });
    const font = (spec) => (document.fonts ? document.fonts.load(spec).catch(() => {}) : Promise.resolve());
    const tasks = [
      font('italic 900 40px "Archivo"'),
      font('400 16px "Atkinson Hyperlegible Next"'),
      font('700 16px "Atkinson Hyperlegible Next"'),
      font('900 30px "Doto"'),
      img('/img/logo-white.png'),
      img(wide ? '/img/escritorio-ancho.jpg' : '/img/cenital-base.jpg')
    ];
    let done = 0;
    tasks.forEach((p) =>
      p.then(() => {
        done += 1;
        if (alive) setProgress(done / tasks.length);
      })
    );
    const all = Promise.all(tasks);
    const cap = new Promise((r) => setTimeout(r, maxMs));
    Promise.race([all, cap]).then(() => {
      if (!alive) return;
      setProgress(1);
      const wait = Math.max(0, minMs - (performance.now() - t0));
      setTimeout(() => alive && setReady(true), wait + 280);
    });
    return () => {
      alive = false;
    };
  }, [minMs, maxMs]);

  return { progress, ready };
}
