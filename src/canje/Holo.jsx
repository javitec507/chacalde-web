import { useRef } from 'react';
import { num } from './lib.js';
import { useShine } from './shine.js';

/** The prize card with its finish (holo, refractor, super…), tilting with the finger or the phone. */
export default function Holo({ card, img, stamp = null, flip = false }) {
  const ref = useRef(null);
  useShine(ref);
  const ar = (card.card.trimW / card.card.trimH).toFixed(4);
  return (
    <div ref={ref} className={`holo idle fx-${card.effect || 'holo'}${flip ? ' flip' : ''}`} style={{ '--ar': ar }}>
      {img ? <img src={img} alt={`${card.name}, ${card.variant} ${num(card)}`} /> : null}
      <div className="shine" />
      <div className="sparkle" />
      <div className="glare" />
      {stamp}
    </div>
  );
}
