import { Heart, Box } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { YogaPose } from '@/content/types';
import { usePoseThumb } from '@/three/thumbnails';
import { DIFFICULTY_LABELS } from '@/engine/labels';
import { useProgress } from '@/store/stores';

function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setSeen(true), { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return { ref, seen };
}

/** Real 3D snapshot of the instructor; frames of the entry sequence cycle as a short preview. */
export function PoseThumb({ pose, className = '', animate = false }: { pose: YogaPose; className?: string; animate?: boolean }) {
  const { ref, seen } = useInView<HTMLDivElement>();
  const frames = pose.animation ? pose.animation.entry : [];
  const [frame, setFrame] = useState(frames.length - 1);
  const holdUrl = usePoseThumb(pose.id, '', seen && !!pose.animation);
  const frameUrl = usePoseThumb(pose.id, frames[frame] ?? '', seen && animate && !!pose.animation);
  useEffect(() => {
    if (!animate || frames.length < 2) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % frames.length), 1400);
    return () => clearInterval(t);
  }, [animate, frames.length]);
  const url = animate ? frameUrl ?? holdUrl : holdUrl;
  return (
    <div ref={ref} className={`relative overflow-hidden bg-gradient-to-b from-sand-soft to-paper-2 ${className}`}>
      {pose.animation ? (
        url ? (
          <img src={url} alt={`Instruktor 3D: ${pose.namePL}`} className="h-full w-full object-contain transition-opacity duration-500" draggable={false} />
        ) : (
          <div className="absolute inset-0 animate-pulse bg-sand-soft/60" />
        )
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-center text-ink-soft">
          <span className="font-display text-sm italic">{pose.nameSanskrit ?? pose.nameEN}</span>
          <span className="text-[10px] tracking-wide uppercase">bez demonstracji 3D</span>
        </div>
      )}
    </div>
  );
}

export function PoseCard({ pose, compact = false }: { pose: YogaPose; compact?: boolean }) {
  const fav = useProgress((s) => s.favorites.includes(pose.id));
  return (
    <Link to={`/pose/${pose.slug}`} className="card group block overflow-hidden transition-transform active:scale-[0.98]" data-testid={`pose-card-${pose.id}`}>
      <div className="relative">
        <PoseThumb pose={pose} className={compact ? 'aspect-square' : 'aspect-[4/5]'} />
        <div className="absolute top-2 left-2 flex gap-1">
          {pose.animation && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink/75 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-paper">
              <Box size={11} strokeWidth={2} /> 3D
            </span>
          )}
        </div>
        {fav && <Heart className="absolute top-2 right-2 fill-coral text-coral" size={16} />}
      </div>
      <div className="p-3">
        <div className="truncate font-semibold leading-tight">{pose.namePL}</div>
        {!compact && <div className="truncate text-xs text-ink-soft italic">{pose.nameSanskrit ?? pose.nameEN}</div>}
        {!compact && <div className="mt-1 text-[11px] text-ink-soft">{DIFFICULTY_LABELS[pose.difficulty]}</div>}
      </div>
    </Link>
  );
}
