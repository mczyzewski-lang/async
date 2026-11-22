/** DOM overlay primitives. They sit above the canvas and are captured by the exporter. */
import { useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { buildSubtitles } from '../engine/timing';
import { ease, ramp, win } from '../engine/anim';
import { useTick, type Timeline } from '../engine/timeline';
import type { EpisodeVariant } from '../engine/types';

/** Shows children between `from` and `to` (seconds) with a fade + small rise. Sizes should use cqw units. */
export function Show({ tl, from, to, children, className = '', style, rise = 1.2, fade = 0.45, pop = false }: { tl: Timeline; from: number; to: number; children: ReactNode; className?: string; style?: CSSProperties; rise?: number; fade?: number; pop?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useTick(() => {
    const el = ref.current;
    if (!el) return;
    const t = tl.now();
    const o = win(t, from, to, fade, fade);
    el.style.opacity = String(o);
    el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
    const inP = ramp(t, from, from + fade * 1.4, pop ? ease.outBack : ease.out);
    el.style.transform = pop ? `scale(${0.6 + 0.4 * inP})` : `translateY(${(1 - inP) * rise}cqw)`;
  });
  return (
    <div ref={ref} className={`absolute ${className}`} style={{ opacity: 0, ...style }}>
      {children}
    </div>
  );
}

/** Imperative per-frame DOM hook for custom overlay animation (counters, bars…). */
export function Live({ tl, update, className = '', style, children }: { tl: Timeline; update: (el: HTMLDivElement, t: number) => void; className?: string; style?: CSSProperties; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useTick(() => ref.current && update(ref.current, tl.now()));
  return (
    <div ref={ref} className={`absolute ${className}`} style={style}>
      {children}
    </div>
  );
}

export function Subtitles({ tl, variant }: { tl: Timeline; variant: EpisodeVariant }) {
  const lines = useMemo(() => buildSubtitles(variant, tl.timing), [variant, tl.timing]);
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef(-2);
  useTick(() => {
    const el = ref.current;
    if (!el) return;
    const t = tl.now();
    const i = lines.findIndex((l) => t >= l.start && t < l.end);
    if (i !== last.current) {
      last.current = i;
      el.textContent = i >= 0 ? lines[i].text : '';
      el.style.opacity = i >= 0 ? '1' : '0';
    }
  });
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[5.2%] flex justify-center px-[6%]">
      <div ref={ref} className={`film-sub ${variant.visualStyle.subtitleClass}`} style={{ opacity: 0 }} />
    </div>
  );
}

/** Brand sign-off used by every style's final scene. */
export function Brand({ tl, from, to, dark = true, className = '' }: { tl: Timeline; from: number; to: number; dark?: boolean; className?: string }) {
  return (
    <Show tl={tl} from={from} to={to} className={`inset-x-0 bottom-[17%] flex flex-col items-center ${className}`} fade={0.7}>
      <div className="font-brand font-bold tracking-[0.32em]" style={{ fontSize: '3.4cqw', color: dark ? '#fff' : '#101218' }}>
        HOWISH
      </div>
      <div className="font-brand" style={{ fontSize: '1.25cqw', marginTop: '0.4cqw', letterSpacing: '0.08em', color: dark ? 'rgba(255,255,255,.72)' : 'rgba(16,18,24,.62)' }}>
        How things actually work.
      </div>
    </Show>
  );
}

/** Small "simplified" disclosure chip so metaphors are never passed off as literal physics. */
export function Simplified({ tl, from, to, text, dark = true }: { tl: Timeline; from: number; to: number; text: string; dark?: boolean }) {
  return (
    <Show tl={tl} from={from} to={to} className="left-[3%] top-[4.5%]" rise={0.4}>
      <div className="font-ui" style={{ fontSize: '0.95cqw', padding: '0.35cqw 0.8cqw', borderRadius: '10cqw', letterSpacing: '0.02em', background: dark ? 'rgba(255,255,255,.1)' : 'rgba(16,18,24,.07)', color: dark ? 'rgba(255,255,255,.78)' : 'rgba(16,18,24,.7)', backdropFilter: 'blur(6px)' }}>
        <b style={{ letterSpacing: '0.1em', marginRight: '0.5cqw' }}>SIMPLIFIED</b>
        {text}
      </div>
    </Show>
  );
}
