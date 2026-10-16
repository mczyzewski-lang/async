import { useEffect, useState } from 'react';

/**
 * Calm breathing visual: a circle that expands on the inhale and contracts on the exhale.
 * Default rhythm 4 s in / 6 s out (a comfortable, slightly longer exhale). No breath holds.
 */
export function BreathingCircle({ inhale = 4, exhale = 6, size = 200, onPhase }: { inhale?: number; exhale?: number; size?: number; onPhase?: (p: 'in' | 'out') => void }) {
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  useEffect(() => {
    onPhase?.(phase);
    const t = setTimeout(() => setPhase((p) => (p === 'in' ? 'out' : 'in')), (phase === 'in' ? inhale : exhale) * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, inhale, exhale]);
  const dur = phase === 'in' ? inhale : exhale;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }} data-testid="breathing-circle" data-phase={phase}>
      <div className="absolute inset-0 rounded-full border border-sage/40" />
      <div
        className="absolute rounded-full bg-gradient-to-br from-sage-soft/90 to-sage/60 shadow-[0_0_60px_rgba(140,154,128,0.45)]"
        style={{
          width: size,
          height: size,
          transform: `scale(${phase === 'in' ? 1 : 0.55})`,
          transition: `transform ${dur}s cubic-bezier(0.45, 0, 0.35, 1)`,
        }}
      />
      <span className={`relative font-display text-ink ${size < 130 ? "text-base" : "text-xl"}`}>{phase === 'in' ? 'Wdech' : 'Wydech'}</span>
    </div>
  );
}
