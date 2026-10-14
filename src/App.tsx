import { AnimatePresence, motion } from 'motion/react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useStore } from './store/useStore';
import { BottomBar, InfoStrip, Toasts, TopBar } from './ui/Bars';
import { Panel } from './ui/Panel';

const Scene = lazy(() => import('./three/Scene'));

function ProjectionFade() {
  const camera = useStore((s) => s.view.camera);
  const ortho = camera === 'top' || camera === 'side';
  const prev = useRef(ortho);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (prev.current !== ortho) setN((x) => x + 1);
    prev.current = ortho;
  }, [ortho]);
  return (
    <AnimatePresence>
      {n > 0 && (
        <motion.div
          key={n}
          initial={{ opacity: 0.85 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="pointer-events-none absolute inset-0 z-10 bg-[#f2f0eb]"
        />
      )}
    </AnimatePresence>
  );
}

function Loader() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-ink" />
        <span className="text-[12px] tracking-wide">Przygotowuję wizualizację…</span>
      </div>
    </div>
  );
}

export default function App() {
  const night = useStore((s) => s.config.lighting.mode === 'night');
  const camera = useStore((s) => s.view.camera);
  return (
    <div className="flex h-full flex-col bg-[#f2f0eb]">
      <TopBar />
      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3 lg:flex-row lg:overflow-hidden">
        <section
          className={`relative h-[62vh] shrink-0 overflow-hidden rounded-[22px] border border-line lg:h-auto lg:flex-1 ${night ? 'bg-[#15171b]' : 'bg-[#f2f0eb]'}`}
        >
          <Suspense fallback={<Loader />}>
            <Scene />
          </Suspense>
          <ProjectionFade />
          <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-3">
            <InfoStrip />
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-3">
            <BottomBar />
          </div>
          <div className={`pointer-events-none absolute bottom-4 left-5 z-10 hidden text-[10.5px] xl:block ${night ? 'text-white/40' : 'text-faint'}`}>
            {camera === 'top' ? 'Rzut z góry · ortogonalny' : camera === 'side' ? 'Widok z boku · ortogonalny' : 'Wizualizacja koncepcyjna'}
          </div>
          <Toasts />
        </section>
        <div className="w-full shrink-0 lg:h-full lg:w-[24%] lg:min-w-[350px] lg:max-w-[440px]">
          <Panel />
        </div>
      </main>
    </div>
  );
}
