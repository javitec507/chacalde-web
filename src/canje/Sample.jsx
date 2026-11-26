import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, useSpring, useTransform } from 'motion/react';

// Where the code sits on the front of the sample card (percent of the card). Matches the sample art.
const CODE_ZONE = { left: '9.6%', top: '73.4%', width: '80.8%', height: '11.9%' };

/**
 * The sample Redemption Card (no foil: only prize cards shine). Shows its back, turns to the front
 * and spotlights the code box. Tap to turn it again. It fills the height it is given.
 */
export default function Sample({ assets }) {
  const reduce = useReducedMotion();
  const [front, setFront] = useState(Boolean(reduce));
  const rot = useSpring(front ? 180 : 0, { stiffness: 70, damping: 13 });
  useEffect(() => rot.set(front ? 180 : 0), [front, rot]);
  const backOpacity = useTransform(rot, (v) => (v < 90 ? 1 : 0));
  const frontOpacity = useTransform(rot, (v) => (v >= 90 ? 1 : 0));
  useEffect(() => {
    if (reduce) return undefined;
    const t = setTimeout(() => setFront(true), 700);
    return () => clearTimeout(t);
  }, [reduce]);

  return (
    <div className="sample">
      <motion.button
        type="button"
        className="sample-card"
        onClick={() => setFront((f) => !f)}
        aria-label={front ? 'Ver el reverso de la tarjeta' : 'Ver el frente de la tarjeta'}
        initial={reduce ? false : { opacity: 0, y: 24, scale: 0.94 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, y: [0, -8, 0], scale: 1 }}
        transition={reduce ? { duration: 0 } : { opacity: { duration: 0.4 }, scale: { type: 'spring', stiffness: 140, damping: 15 }, y: { duration: 5, repeat: Infinity, ease: 'easeInOut' } }}
      >
        <motion.span className="sample-flip" style={{ rotateY: rot }}>
          <motion.span className="sample-face" style={{ opacity: backOpacity }}>
            <img src={`${assets}/hero-back.jpg`} alt="" draggable="false" />
          </motion.span>
          <motion.span className="sample-face sample-front" style={{ opacity: frontOpacity }}>
            <img src={`${assets}/hero-front.jpg`} alt="Frente de la Redemption Card: el código va en el recuadro de abajo" draggable="false" />
            <AnimatePresence>
              {front ? (
                <motion.span key="z" className="zone" style={CODE_ZONE} initial={{ opacity: 0, scale: 1.25 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ delay: reduce ? 0 : 0.6, type: 'spring', stiffness: 260, damping: 18 }}>
                  <span className="scan" />
                </motion.span>
              ) : null}
            </AnimatePresence>
          </motion.span>
        </motion.span>
      </motion.button>
      <AnimatePresence>
        {front ? (
          <motion.p className="tip" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: reduce ? 0 : 0.8 }}>
            ↑ Tu código está aquí
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
