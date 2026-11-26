/**
 * Holographic foil the way it prints: the card's white areas become foil, black stays black.
 * The layer is masked by the card's own picture (luminance), so only light areas get the rainbow,
 * the sparkles and the glare. Browsers without luminance masks fall back to multiply (same idea, softer).
 * It moves with --mx / --my from the parent (finger, mouse or phone tilt).
 */
export default function Foil({ src, fx = 'holo' }) {
  if (!src || fx === 'none') return null;
  const url = `url("${src}")`;
  return (
    <div className={`foil fx-${fx}`} style={{ WebkitMaskImage: url, maskImage: url }} aria-hidden="true">
      <div className="foil-rainbow" />
      <div className="foil-sparkle" />
      <div className="foil-glare" />
    </div>
  );
}
