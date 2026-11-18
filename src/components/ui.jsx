import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export const Arrow = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" aria-hidden="true">
    <path d="M4 12h15" />
    <path d="M13 5l7 7-7 7" />
  </svg>
);
export const ArrowUp = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" aria-hidden="true">
    <path d="M12 20V5" />
    <path d="M5 11l7-7 7 7" />
  </svg>
);
export const ArrowOut = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" aria-hidden="true">
    <path d="M6 18L18 6" />
    <path d="M8 6h10v10" />
  </svg>
);
export const ArrowBack = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" aria-hidden="true">
    <path d="M20 12H5" />
    <path d="M11 5l-7 7 7 7" />
  </svg>
);
export const Download = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" aria-hidden="true">
    <path d="M12 3v13" />
    <path d="M6 10l6 6 6-6" />
    <path d="M4 21h16" />
  </svg>
);
export const Share = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true">
    <path d="M12 15V4" />
    <path d="M8 8l4-4 4 4" />
    <path d="M5 13v7h14v-7" />
  </svg>
);
export const Printer = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true">
    <path d="M7 9V4h10v5" />
    <path d="M7 17H4v-8h16v8h-3" />
    <path d="M7 14h10v6H7z" />
  </svg>
);
export const SoundOn = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" aria-hidden="true">
    <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" stroke="none" />
    <path d="M16.5 8.5a5 5 0 0 1 0 7" />
    <path d="M19 6a8.5 8.5 0 0 1 0 12" />
  </svg>
);
export const SoundOff = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" aria-hidden="true">
    <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" stroke="none" />
    <path d="M16 9.5l5 5" />
    <path d="M21 9.5l-5 5" />
  </svg>
);
export const Cross = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z" fill="currentColor" />
  </svg>
);

export function useMedia(query, initial = false) {
  const [match, setMatch] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : initial
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

// Scales fixed-size content (w x h) to the width of its container, never cropping it.
export function Scaled({ w, h, className = '', style, children, innerClassName = '', innerStyle }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setScale(el.clientWidth / w || 1);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w]);
  return (
    <div ref={ref} className={className} style={{ position: 'relative', width: '100%', height: h * scale, ...style }}>
      <div
        className={innerClassName}
        style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, transform: `scale(${scale})`, transformOrigin: '0 0', ...innerStyle }}
      >
        {children}
      </div>
    </div>
  );
}

export function randomTurno() {
  const n = Math.floor(100000 + Math.random() * 899999);
  return String(n);
}
