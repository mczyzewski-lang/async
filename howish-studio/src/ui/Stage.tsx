import { Component, useMemo, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { currentEpisode } from '../episodes';
import { timeFor, usePlayer } from '../engine/player';
import { makeTimeline } from '../engine/timeline';
import type { VariantId } from '../engine/types';
import { Subtitles } from '../kit/overlay';
import { films } from '../styles';

class Boundary extends Component<{ children: ReactNode }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: Error) {
    return { err: e.message };
  }
  render() {
    return this.state.err ? <div className="absolute inset-0 grid place-items-center bg-black p-6 text-center text-sm text-red-300">Film error: {this.state.err}</div> : this.props.children;
  }
}

export function Stage({ variantId, aspect = '16:9', dpr = [1, 2], forceSubs, manual }: { variantId: VariantId; aspect?: '16:9' | '9:16'; dpr?: number | [number, number]; forceSubs?: boolean; /** render only when the exporter advances the frame */ manual?: boolean }) {
  const timing = usePlayer((s) => s.timings[variantId]);
  const subs = usePlayer((s) => s.subs);
  const variant = currentEpisode.variants[variantId];
  const ratio = aspect === '16:9' ? 16 / 9 : 9 / 16;
  const tl = useMemo(() => makeTimeline(timing, () => timeFor(variantId), ratio), [timing, variantId, ratio]);
  const mod = films[variantId];
  return (
    <div className="stage relative w-full overflow-hidden" style={{ aspectRatio: aspect.replace(':', ' / '), containerType: 'inline-size', background: mod.background }} data-variant={variantId}>
      <Boundary key={`${variantId}-${timing.source}-${timing.duration}`}>
        <Canvas
          dpr={dpr}
          frameloop={manual ? 'never' : 'always'}
          shadows={mod.shadows}
          flat={mod.flat}
          camera={{ fov: 40, near: 0.05, far: 4000, position: [0, 0, 10] }}
          gl={{ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            gl.outputColorSpace = THREE.SRGBColorSpace;
          }}
        >
          <mod.Film tl={tl} />
        </Canvas>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <mod.Overlay tl={tl} />
        </div>
        {(forceSubs ?? subs) && <Subtitles tl={tl} variant={variant} />}
      </Boundary>
    </div>
  );
}
