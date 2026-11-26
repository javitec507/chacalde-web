import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react';

const MOBILE = '(max-width: 719px)';

function useMedia(q) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const f = () => setM(mq.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, [q]);
  return m;
}

// Space taken by the on-screen keyboard (iPhone keeps the page size and covers it), so the sheet sits above it.
function useKeyboard() {
  const [v, setV] = useState({ inset: 0, height: typeof window !== 'undefined' ? window.innerHeight : 800 });
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const f = () => setV({ inset: Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)), height: Math.round(vv.height) });
    vv.addEventListener('resize', f);
    vv.addEventListener('scroll', f);
    f();
    return () => {
      vv.removeEventListener('resize', f);
      vv.removeEventListener('scroll', f);
    };
  }, []);
  return v;
}

/** Pop-up for anything we ask: a sheet from the bottom on phones (drag it down to close), a centered window on bigger screens. */
export default function Sheet({ open, onClose, label, children }) {
  const mobile = useMedia(MOBILE);
  const reduce = useReducedMotion();
  const kb = useKeyboard();
  const drag = useDragControls();

  useEffect(() => {
    if (!open) return undefined;
    const el = document.documentElement;
    const prev = el.style.overflow;
    el.style.overflow = 'hidden';
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => {
      el.style.overflow = prev;
      window.removeEventListener('keydown', k);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className={`sheet-root${mobile ? ' sheet-root--m' : ''}`} role="dialog" aria-modal="true" aria-label={label}>
          <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="sheet"
            style={mobile ? { bottom: kb.inset, maxHeight: kb.height - 12 } : undefined}
            initial={reduce ? { opacity: 0 } : mobile ? { y: '100%' } : { opacity: 0, y: 24, scale: 0.97 }}
            animate={mobile ? { y: 0, opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : mobile ? { y: '100%' } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            drag={mobile ? 'y' : false}
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={(e, i) => {
              if (i.offset.y > 110 || i.velocity.y > 650) onClose();
            }}
          >
            {mobile ? <div className="sheet-grip" onPointerDown={(e) => drag.start(e)} aria-hidden="true"><span /></div> : null}
            <button type="button" className="sheet-x" onClick={onClose} aria-label="Cerrar">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6 10.6 12 5 6.4z" fill="currentColor" /></svg>
            </button>
            <div className="sheet-body">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
