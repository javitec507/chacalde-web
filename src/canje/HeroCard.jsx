import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, useSpring, useTransform } from 'motion/react';
import Foil from './Foil.jsx';
import { useShine } from './shine.js';
import { sfx } from './sound.js';

// Where the redemption code sits on the front of the sample card (percent of the card). Matches the dummy art.
const CODE_ZONE = { left: '9.6%', top: '73.4%', width: '80.8%', height: '11.9%' };

function ArrowUp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4l7 7-1.4 1.4L13 7.8V20h-2V7.8l-4.6 4.6L5 11z" fill="currentColor" />
    </svg>
  );
}

/**
 * The sample Redemption Card. mode "loop": floats and flips by itself (intro).
 * mode "front": turns to the front once and spotlights the code box ("tu código está aquí").
 * Tap to flip it yourself.
 */
export default function HeroCard({ assets, mode = 'loop' }) {
  const reduce = useReducedMotion();
  const [front, setFront] = useState(Boolean(reduce) && mode === 'front');
  const [paused, setPaused] = useState(false);
  const tiltRef = useRef(null);
  useShine(tiltRef, { tilt: 16 });

  const rot = useSpring(front ? 180 : 0, { stiffness: 70, damping: 13, mass: 1 });
  useEffect(() => rot.set(front ? 180 : 0), [front, rot]);
  const backOpacity = useTransform(rot, (v) => (v < 90 ? 1 : 0));
  const frontOpacity = useTransform(rot, (v) => (v >= 90 ? 1 : 0));

  // "front": turn once, with a whoosh
  useEffect(() => {
    if (mode !== 'front' || reduce) return undefined;
    const t = setTimeout(() => {
      setFront(true);
      sfx('whoosh');
    }, 550);
    return () => clearTimeout(t);
  }, [mode, reduce]);
  // "loop": turn back and forth (quietly)
  useEffect(() => {
    if (mode !== 'loop' || reduce || paused) return undefined;
    const t = setTimeout(() => setFront((f) => !f), front ? 5200 : 2800);
    return () => clearTimeout(t);
  }, [front, paused, reduce, mode]);
  useEffect(() => {
    if (!paused) return undefined;
    const t = setTimeout(() => setPaused(false), 9000);
    return () => clearTimeout(t);
  }, [paused]);
  useEffect(() => {
    if (front && mode === 'front') sfx('pop', { delay: 0.75 });
  }, [front, mode]);

  const toggle = () => {
    setFront((f) => !f);
    setPaused(true);
    sfx('whoosh');
  };
  const spot = front && (mode === 'front' || mode === 'loop');

  return (
    <div className="hero-card">
      <motion.div
        className="hc-float"
        initial={reduce ? false : { opacity: 0, y: 30, rotate: -5, scale: 0.94 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, y: [0, -10, 0], rotate: [-1.5, 1.5, -1.5], scale: 1 }}
        transition={
          reduce
            ? { duration: 0 }
            : { opacity: { duration: 0.5 }, scale: { type: 'spring', stiffness: 120, damping: 14 }, y: { duration: 6, repeat: Infinity, ease: 'easeInOut' }, rotate: { duration: 7, repeat: Infinity, ease: 'easeInOut' } }
        }
      >
        <button type="button" className="hc-tilt idle" ref={tiltRef} onClick={toggle} aria-label={front ? 'Ver el reverso de la tarjeta' : 'Ver el frente de la tarjeta'}>
          <motion.div className="hc-flip" style={{ rotateY: rot }}>
            <motion.div className="hc-face hc-back" style={{ opacity: backOpacity }}>
              <img src={`${assets}/hero-back.jpg`} alt="" draggable="false" />
              <Foil src={`${assets}/hero-back.jpg`} />
            </motion.div>
            <motion.div className="hc-face hc-front" style={{ opacity: frontOpacity }}>
              <img src={`${assets}/hero-front.jpg`} alt="Frente de la Redemption Card: el código de canje va en el recuadro de abajo" draggable="false" />
              <Foil src={`${assets}/hero-front.jpg`} />
              <AnimatePresence>
                {spot ? (
                  <motion.div
                    key="zone"
                    className="hc-zone"
                    style={CODE_ZONE}
                    initial={{ opacity: 0, scale: 1.25 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    transition={{ delay: reduce ? 0 : 0.7, type: 'spring', stiffness: 260, damping: 18 }}
                  >
                    <span className="hc-scan" />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        </button>
      </motion.div>
      <div className="hc-tip-slot" aria-live="polite">
        <AnimatePresence mode="wait">
          {spot ? (
            <motion.p key="f" className="hc-tip" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ delay: reduce ? 0 : 0.85, duration: 0.3 }}>
              <ArrowUp /> Tu código está aquí
            </motion.p>
          ) : (
            <motion.p key="b" className="hc-tip hc-tip--ghost" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
              Toca la tarjeta para voltearla
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
