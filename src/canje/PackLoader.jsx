import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

// Crimped edge of a pack, as a clip-path polygon (teeth along the top or the bottom).
function crimp(edge, teeth = 16, depth = 5) {
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
 * Opening screen while the page loads: a black Mystery Pack tears open by itself and a Redemption Card
 * rises out of it (about 2 seconds). A tap skips it.
 */
export default function PackLoader({ assets, onDone }) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState('in'); // in → open → out
  const done = useRef(false);
  const top = useMemo(() => crimp('top', 16, 30), []);
  const bottom = useMemo(() => crimp('bottom', 16, 4), []);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };

  useEffect(() => {
    if (reduce) {
      const t = setTimeout(finish, 250);
      return () => clearTimeout(t);
    }
    let alive = true;
    const ready = Promise.race([Promise.all([preload(`${assets}/hero-back.jpg`), preload(`${assets}/hero-front.jpg`), document.fonts ? document.fonts.ready : null]), new Promise((r) => setTimeout(r, 2500))]);
    const minIn = new Promise((r) => setTimeout(r, 650));
    Promise.all([ready, minIn]).then(() => {
      if (!alive) return;
      setPhase('open');
      setTimeout(() => alive && setPhase('out'), 1150);
      setTimeout(() => alive && finish(), 1450);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, reduce]);

  const opened = phase !== 'in';
  return (
    <motion.div className="pk" onClick={finish} role="status" aria-label="Abriendo tu Mystery Pack" animate={phase === 'out' ? { opacity: 0 } : { opacity: 1 }} transition={{ duration: 0.3 }}>
      <motion.div className="pk-rays" aria-hidden="true" animate={{ opacity: opened ? 0.9 : 0.25, rotate: 360 }} transition={{ rotate: { duration: 30, repeat: Infinity, ease: 'linear' }, opacity: { duration: 0.5 } }} />
      <motion.div className="pk-pack" initial={reduce ? false : { y: 50, opacity: 0, rotate: -6, scale: 0.9 }} animate={opened ? { y: 36, rotate: 0, scale: 0.96, opacity: 1 } : { y: 0, rotate: 0, opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 150, damping: 15 }}>
        <motion.span className="pk-card" aria-hidden="true" initial={false} animate={opened ? { y: '-58%', opacity: 1 } : { y: '6%', opacity: 0 }} transition={{ delay: opened ? 0.3 : 0, type: 'spring', stiffness: 90, damping: 14 }}>
          <img src={`${assets}/hero-back.jpg`} alt="" draggable="false" />
        </motion.span>
        <span className="pk-body" style={{ clipPath: bottom }}>
          <span className="pk-gloss" />
          <span className="pk-print">
            <img src="/img/logo-white.png" alt="" />
            <b>Mystery Pack</b>
            <i>Redemption Edition</i>
          </span>
        </span>
        <motion.span className="pk-top" style={{ clipPath: top }} aria-hidden="true" initial={false} animate={opened ? { y: -140, x: 50, rotate: 22, opacity: 0 } : { y: 0, x: 0, rotate: 0, opacity: 1 }} transition={{ duration: 0.55, ease: [0.3, 0.7, 0.4, 1] }}>
          <span className="pk-tear">abre aquí</span>
        </motion.span>
      </motion.div>
    </motion.div>
  );
}
