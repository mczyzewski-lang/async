import { useEffect } from 'react';
import { advance } from '@react-three/fiber';
import { clock, usePlayer } from '../engine/player';
import type { VariantId } from '../engine/types';
import { Stage } from './Stage';

declare global {
  interface Window {
    __howish?: { ready: boolean; duration: number; audioPath: string | null; seek: (t: number) => Promise<void> };
  }
}

/** Chrome-less page used by scripts/render.mjs: /?render=A&aspect=16:9 */
export function RenderPage() {
  const q = new URLSearchParams(location.search);
  const variant = (q.get('render') || 'A') as VariantId;
  const aspect = q.get('aspect') === '9:16' ? '9:16' : '16:9';
  const subs = q.get('subs') !== '0';
  useEffect(() => {
    const p = usePlayer.getState();
    p.set({ master: variant });
    void p.refresh().then(() => {
      const s = usePlayer.getState();
      const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
      window.__howish = {
        ready: false,
        duration: s.timings[variant].duration,
        audioPath: s.timings[variant].source === 'audio' ? (s.manifests[variant]?.audioPath ?? null) : null,
        seek: async (t) => {
          clock.time = t;
          // exactly two renders per exported frame: one to move everything, one so
          // camera-projected DOM labels settle; then one rAF for the overlay layer to paint
          advance(performance.now());
          advance(performance.now());
          await raf();
        },
      };
      // let fonts, textures and shaders settle before the first frame is captured
      void document.fonts.ready.then(() => setTimeout(() => {
          for (let i = 0; i < 4; i++) advance(performance.now());
          window.__howish!.ready = true;
        }, 1200));
    });
  }, [variant]);
  return (
    <div className="grid h-screen w-screen place-items-center overflow-hidden bg-black">
      <div style={aspect === '16:9' ? { width: '100vw' } : { height: '100vh', aspectRatio: '9 / 16' }}>
        <Stage variantId={variant} aspect={aspect} dpr={1} forceSubs={subs} manual />
      </div>
    </div>
  );
}
