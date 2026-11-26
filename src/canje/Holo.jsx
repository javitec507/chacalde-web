import { useRef } from 'react';
import Foil from './Foil.jsx';
import { num } from './lib.js';
import { useShine } from './shine.js';

/** The prize card with its foil finish (holo, refractor, super…), tilting with the finger or the phone. */
export default function Holo({ card, img, stamp = null, className = '' }) {
  const ref = useRef(null);
  useShine(ref);
  const ar = (card.card.trimW / card.card.trimH).toFixed(4);
  return (
    <div ref={ref} className={`holo idle ${className}`} style={{ '--ar': ar }}>
      {img ? <img src={img} alt={`${card.name}, ${card.variant} ${num(card)}`} draggable="false" /> : null}
      <Foil src={img} fx={card.effect || 'holo'} />
      {stamp}
    </div>
  );
}
