import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion, useSpring, useTransform } from 'motion/react';
import Holo from './Holo.jsx';

const COLORS = ['#ffffff', '#ff4fd8', '#4ff8ff', '#fff64f', '#7a5cff', '#ff3b3b', '#d9dde3'];

/** A burst of confetti from the middle of the card. */
export function Burst({ count = 26, seed = 1 }) {
  const bits = useMemo(() => {
    let s = seed * 9301 + 49297;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    return Array.from({ length: count }, (_, i) => {
      const a = rnd() * Math.PI * 2;
      const d = 90 + rnd() * 150;
      return { i, x: Math.cos(a) * d, y: Math.sin(a) * d - 50, r: rnd() * 540 - 270, w: 5 + rnd() * 7, h: 9 + rnd() * 10, c: COLORS[i % COLORS.length], delay: rnd() * 0.12 };
    });
  }, [count, seed]);
  return (
    <div className="burst" aria-hidden="true">
      {bits.map((b) => (
        <motion.span
          key={b.i}
          style={{ width: b.w, height: b.h, background: b.c }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 0.4 }}
          animate={{ x: b.x, y: [0, b.y, b.y + 120], rotate: b.r, opacity: [1, 1, 0], scale: 1 }}
          transition={{ duration: 1.4, delay: b.delay, ease: [0.15, 0.7, 0.4, 1], times: [0, 0.55, 1] }}
        />
      ))}
    </div>
  );
}

/**
 * The prize reveal: the Redemption Card (plain, no foil) trembles, flips and shows the prize card with its foil.
 * taken = the code was already used: grey stamp, no confetti. Fills the height it is given.
 */
export default function Reveal({ card, img, assets, taken, onShown }) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState(reduce ? 'shown' : 'charge');
  const shownRef = useRef(onShown);
  useLayoutEffect(() => {
    shownRef.current = onShown;
  });
  const rot = useSpring(reduce ? 180 : 0, { stiffness: 80, damping: 12 });
  const backOpacity = useTransform(rot, (v) => (v < 90 ? 1 : 0));
  const frontOpacity = useTransform(rot, (v) => (v >= 90 ? 1 : 0));

  useEffect(() => {
    if (reduce) {
      shownRef.current?.();
      return undefined;
    }
    const t1 = setTimeout(() => {
      setPhase('flip');
      rot.set(180);
    }, 1000);
    const t2 = setTimeout(() => {
      setPhase('shown');
      shownRef.current?.();
    }, 1450);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [reduce, rot]);

  const ar = (card.card.trimW / card.card.trimH).toFixed(4);
  return (
    <div className="rv">
      <motion.div className="rv-rays" aria-hidden="true" animate={{ opacity: phase === 'shown' ? (taken ? 0.15 : 1) : 0.4, rotate: 360 }} transition={{ rotate: { duration: 24, repeat: Infinity, ease: 'linear' }, opacity: { duration: 0.5 } }} />
      <motion.div
        className="rv-card"
        style={{ '--ar': ar }}
        initial={reduce ? false : { scale: 0.85, opacity: 0 }}
        animate={phase === 'charge' ? { scale: [0.85, 1, 1.03], opacity: 1, x: [0, 0, -3, 3, -4, 4, -3, 3, 0], rotate: [0, 0, -1, 1, -1.5, 1.5, -1, 1, 0] } : { scale: 1, opacity: 1, x: 0, rotate: 0 }}
        transition={phase === 'charge' ? { duration: 1, times: [0, 0.3, 1] } : { type: 'spring', stiffness: 200, damping: 16 }}
      >
        <motion.div className="rv-flip" style={{ rotateY: rot }}>
          <motion.div className="rv-face rv-back" style={{ opacity: backOpacity }}>
            <img src={`${assets}/hero-back.jpg`} alt="" draggable="false" />
          </motion.div>
          <motion.div className="rv-face rv-front" style={{ opacity: frontOpacity }}>
            <Holo card={card} img={img} stamp={taken && phase === 'shown' ? <div className="stamp gray">YA CANJEADA</div> : null} />
          </motion.div>
        </motion.div>
        {phase === 'shown' && !taken ? <Burst seed={3} /> : null}
      </motion.div>
    </div>
  );
}
