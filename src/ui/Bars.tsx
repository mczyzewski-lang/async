import { AnimatePresence, motion } from 'motion/react';
import {
  Box,
  ChevronDown,
  Download,
  Eye,
  FileJson,
  Focus,
  Image as ImageIcon,
  Layers,
  Lightbulb,
  Moon,
  RotateCcw,
  Ruler,
  Save,
  Scan,
  Square,
  Sun,
  FlipHorizontal2,
  PanelTop,
  Columns3,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cm } from '../engine/math';
import { PRESETS } from '../engine/presets';
import { useAnalysis } from '../store/derived';
import { useStore, type CameraMode, type WallMode } from '../store/useStore';
import { cx } from './controls';
import { exportJSON, exportPNG } from './exporting';
import { STATUS_TEXT } from './Panel';

function useClickAway(ref: React.RefObject<HTMLElement | null>, cb: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, cb]);
}

function Menu({ label, children, align = 'left' }: { label: ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickAway(ref, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:bg-sand hover:text-ink">
        {label}
        <ChevronDown size={13} className={cx('transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className={cx('absolute top-full z-50 mt-2 min-w-[240px] rounded-2xl border border-line bg-paper p-1.5 shadow-float', align === 'right' ? 'right-0' : 'left-0')}
          >
            {children(() => setOpen(false))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({ icon, children, onClick, sub }: { icon?: ReactNode; children: ReactNode; onClick: () => void; sub?: ReactNode }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[12.5px] text-ink-2 hover:bg-sand hover:text-ink">
      {icon}
      <span className="flex-1">
        {children}
        {sub && <span className="block text-[11px] text-faint">{sub}</span>}
      </span>
    </button>
  );
}

export function TopBar() {
  const applyPreset = useStore((s) => s.applyPreset);
  const presetId = useStore((s) => s.config.presetId);
  const save = useStore((s) => s.save);
  const restore = useStore((s) => s.restore);
  const reset = useStore((s) => s.reset);
  const notify = useStore((s) => s.notify);
  const current = PRESETS.find((p) => p.id === presetId);
  return (
    <header className="flex h-14 shrink-0 items-center justify-between px-5">
      <div className="flex items-center gap-3">
        <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden>
          <rect width="32" height="32" rx="8" fill="#151515" />
          <path d="M7 24h5v-5h5v-5h5V9h3" stroke="#e8dcc8" strokeWidth="2.4" fill="none" strokeLinejoin="round" />
        </svg>
        <div className="text-[13px] font-semibold tracking-[0.28em]">STAIR STUDIO</div>
        <div className="hidden h-4 w-px bg-line md:block" />
        <div className="hidden text-[12px] text-muted md:block">Schody stalowe na wymiar</div>
      </div>
      <div className="flex items-center gap-1">
        <Menu label={<span>Kolekcje{current ? <span className="ml-1.5 text-muted">· {current.name}</span> : null}</span>}>
          {(close) => (
            <div className="w-[300px]">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    applyPreset(p.id);
                    notify(`Zastosowano kolekcję „${p.name}”`, 'ok');
                    close();
                  }}
                  className={cx('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-sand', presetId === p.id && 'bg-sand')}
                >
                  <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg" style={{ background: p.swatch[1] }}>
                    <span className="absolute bottom-0 left-0 h-1/2 w-full" style={{ background: p.swatch[0], clipPath: 'polygon(0 100%, 100% 0, 100% 100%)' }} />
                  </span>
                  <span>
                    <span className="block text-[12.5px] font-medium text-ink">{p.name}</span>
                    <span className="block text-[11px] text-muted">{p.tagline}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </Menu>
        <Menu label="Plik" align="right">
          {(close) => (
            <>
              <MenuItem icon={<Save size={15} strokeWidth={1.6} />} onClick={() => (save(), close())} sub="w pamięci przeglądarki">
                Zapisz konfigurację
              </MenuItem>
              <MenuItem icon={<Download size={15} strokeWidth={1.6} />} onClick={() => (restore(), close())}>
                Przywróć zapisaną
              </MenuItem>
              <MenuItem icon={<FileJson size={15} strokeWidth={1.6} />} onClick={() => (exportJSON(), close())}>
                Eksportuj JSON
              </MenuItem>
              <MenuItem icon={<ImageIcon size={15} strokeWidth={1.6} />} onClick={() => (exportPNG(), close())}>
                Zrzut wizualizacji PNG
              </MenuItem>
              <div className="my-1 h-px bg-line" />
              <MenuItem icon={<RotateCcw size={15} strokeWidth={1.6} />} onClick={() => (reset(), close())}>
                Przywróć domyślne
              </MenuItem>
            </>
          )}
        </Menu>
        <button onClick={exportPNG} className="ml-1 hidden items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[12px] font-medium text-white hover:opacity-90 sm:flex">
          <ImageIcon size={13} /> Zapisz widok
        </button>
      </div>
    </header>
  );
}

function Metric({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <div className="flex flex-col px-3 py-1 first:pl-1">
      <span className="text-[10px] font-medium uppercase tracking-[0.07em] text-faint">{k}</span>
      <motion.span key={v} initial={{ opacity: 0.2, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className={cx('text-[13px] font-medium tabular-nums', tone)}>
        {v}
      </motion.span>
    </div>
  );
}

export function InfoStrip() {
  const a = useAnalysis();
  const H = useStore((s) => s.config.room.height);
  const tone = a.status === 'ok' ? 'bg-ok-soft text-ok' : a.status === 'warn' ? 'bg-warn-soft text-warn' : 'bg-err-soft text-err';
  return (
    <div className="pointer-events-auto flex flex-wrap items-center divide-x divide-line rounded-2xl border border-line bg-paper/90 px-2 py-1.5 shadow-soft backdrop-blur-md">
      <Metric k="Kondygnacja" v={`${cm(H)} cm`} />
      <Metric k="Stopnie" v={`${a.riserCount}`} />
      <Metric k="Wys. stopnia" v={`${cm(a.riserHeight, 1)} cm`} tone={a.riserHeight > 0.19 ? 'text-warn' : undefined} />
      <Metric k="Gł. stopnicy" v={`${cm(a.treadDepth, 1)} cm`} />
      <Metric k="Nachylenie" v={`${a.angleDeg.toFixed(1).replace('.', ',')}°`} tone={a.angleDeg > 41 ? 'text-warn' : undefined} />
      <Metric k="Zajmuje" v={`${cm(a.footprintSize.x)} × ${cm(a.footprintSize.z)}`} tone={a.fitsRoom ? undefined : 'text-err'} />
      <div className="px-3">
        <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold', tone)}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {STATUS_TEXT[a.status]}
        </span>
      </div>
    </div>
  );
}

const MODES: { id: CameraMode; label: string; icon: typeof Box }[] = [
  { id: 'perspective', label: 'Perspektywa', icon: Box },
  { id: 'top', label: 'Z góry', icon: Square },
  { id: 'side', label: 'Z boku', icon: Columns3 },
  { id: 'cutaway', label: 'Przekrój', icon: Layers },
  { id: 'eye', label: 'Poziom oczu', icon: Eye },
];

function ToolBtn({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cx('group relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors', active ? 'bg-ink text-white' : 'text-ink-2 hover:bg-sand')}
    >
      {children}
      <span className="pointer-events-none absolute bottom-full mb-2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[10.5px] text-white opacity-0 transition-opacity group-hover:opacity-100">{title}</span>
    </button>
  );
}

const WALL_MODES: { id: WallMode; label: string }[] = [
  { id: 'auto', label: 'Automatycznie (od strony kamery)' },
  { id: 'all', label: 'Pokaż wszystkie ściany' },
  { id: 'transparent', label: 'Półprzezroczyste' },
  { id: 'cutaway', label: 'Przekrój 3D' },
  { id: 'custom', label: 'Wybrane ściany' },
];

function WallMenu() {
  const view = useStore((s) => s.view);
  const walls = useStore((s) => s.config.room.walls);
  const setView = useStore((s) => s.setView);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickAway(ref, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <ToolBtn title="Ściany pomieszczenia" active={open || view.wallMode !== 'auto'} onClick={() => setOpen(!open)}>
        <PanelTop size={16} strokeWidth={1.6} />
      </ToolBtn>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-1/2 z-50 mb-3 w-[250px] -translate-x-1/2 rounded-2xl border border-line bg-paper p-1.5 shadow-float"
          >
            {WALL_MODES.map((m) => (
              <MenuItem key={m.id} onClick={() => setView({ wallMode: m.id })} icon={<span className={cx('h-2 w-2 rounded-full', view.wallMode === m.id ? 'bg-ink' : 'bg-line')} />}>
                {m.label}
              </MenuItem>
            ))}
            {view.wallMode === 'custom' && (
              <div className="grid grid-cols-4 gap-1 px-2 pb-2 pt-1">
                {(['back', 'left', 'right', 'front'] as const).map((k) => (
                  <button
                    key={k}
                    disabled={!walls[k]}
                    onClick={() => setView({ hiddenWalls: { ...view.hiddenWalls, [k]: !view.hiddenWalls[k] } })}
                    className={cx(
                      'rounded-lg border py-1 text-[11px] font-medium disabled:opacity-30',
                      !view.hiddenWalls[k] && walls[k] ? 'border-ink bg-ink text-white' : 'border-line text-muted',
                    )}
                  >
                    {{ back: 'Tył', left: 'Lewa', right: 'Prawa', front: 'Przód' }[k]}
                  </button>
                ))}
              </div>
            )}
            <div className="my-1 h-px bg-line" />
            <MenuItem onClick={() => setView({ showSlab: !view.showSlab })} icon={<span className={cx('h-2 w-2 rounded-full', view.showSlab ? 'bg-ink' : 'bg-line')} />}>
              {view.showSlab ? 'Ukryj strop' : 'Pokaż strop'}
            </MenuItem>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function BottomBar() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const lighting = useStore((s) => s.config.lighting);
  const setLighting = useStore((s) => s.setLighting);
  return (
    <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2">
      <div className="flex items-center gap-0.5 rounded-2xl border border-line bg-paper/92 p-1 shadow-soft backdrop-blur-md">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setView({ camera: m.id })}
            className={cx(
              'relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-medium transition-colors',
              view.camera === m.id ? 'text-white' : 'text-ink-2 hover:bg-sand',
            )}
          >
            {view.camera === m.id && <motion.span layoutId="cam-pill" className="absolute inset-0 rounded-xl bg-ink" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
            <m.icon size={14} strokeWidth={1.7} className="relative" />
            <span className="relative hidden lg:inline">{m.label}</span>
          </button>
        ))}
      </div>
      <AnimatePresence>
        {(view.camera === 'eye' || view.camera === 'side') && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex items-center gap-0.5 rounded-2xl border border-line bg-paper/92 p-1 shadow-soft backdrop-blur-md"
          >
            {view.camera === 'eye' ? (
              <>
                {(['bottom', 'top'] as const).map((e) => (
                  <button
                    key={e}
                    onClick={() => setView({ eye: e })}
                    className={cx('rounded-xl px-3 py-2 text-[12px] font-medium', view.eye === e ? 'bg-sand text-ink' : 'text-muted hover:text-ink')}
                  >
                    {e === 'bottom' ? 'Od wejścia' : 'Z piętra'}
                  </button>
                ))}
              </>
            ) : (
              <ToolBtn title="Odwróć stronę widoku" onClick={() => setView({ sideFlip: !view.sideFlip })}>
                <FlipHorizontal2 size={16} strokeWidth={1.6} />
              </ToolBtn>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-center gap-0.5 rounded-2xl border border-line bg-paper/92 p-1 shadow-soft backdrop-blur-md">
        <ToolBtn title="Resetuj kamerę" onClick={() => setView({ resetNonce: view.resetNonce + 1 })}>
          <RotateCcw size={16} strokeWidth={1.6} />
        </ToolBtn>
        <ToolBtn title="Dopasuj schody do widoku" onClick={() => setView({ fitNonce: view.fitNonce + 1 })}>
          <Focus size={16} strokeWidth={1.6} />
        </ToolBtn>
        <ToolBtn title={view.showDims ? 'Ukryj wymiary' : 'Pokaż wymiary'} active={view.showDims} onClick={() => setView({ showDims: !view.showDims })}>
          <Ruler size={16} strokeWidth={1.6} />
        </ToolBtn>
        <ToolBtn title="Obrys zajmowanej przestrzeni" active={view.showFootprint} onClick={() => setView({ showFootprint: !view.showFootprint })}>
          <Scan size={16} strokeWidth={1.6} />
        </ToolBtn>
        <WallMenu />
        <div className="mx-0.5 h-5 w-px bg-line" />
        <ToolBtn title={lighting.mode === 'day' ? 'Tryb nocny' : 'Tryb dzienny'} active={lighting.mode === 'night'} onClick={() => setLighting({ mode: lighting.mode === 'day' ? 'night' : 'day' })}>
          {lighting.mode === 'day' ? <Moon size={16} strokeWidth={1.6} /> : <Sun size={16} strokeWidth={1.6} />}
        </ToolBtn>
        <ToolBtn title={lighting.led ? 'Wyłącz LED' : 'Włącz LED'} active={lighting.led} onClick={() => setLighting({ led: !lighting.led })}>
          <Lightbulb size={16} strokeWidth={1.6} />
        </ToolBtn>
      </div>
    </div>
  );
}

export function Toasts() {
  const toast = useStore((s) => s.toast);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3200);
    return () => clearTimeout(t);
  }, [toast]);
  const dot = toast?.tone === 'ok' ? 'bg-ok' : toast?.tone === 'warn' ? 'bg-warn' : toast?.tone === 'error' ? 'bg-err' : 'bg-faint';
  return (
    <AnimatePresence>
      {visible && toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6 }}
          className="pointer-events-none absolute left-1/2 top-20 z-40 flex -translate-x-1/2 items-center gap-2.5 rounded-full bg-ink px-4 py-2.5 text-[12.5px] text-white shadow-float"
        >
          <span className={cx('h-1.5 w-1.5 rounded-full', dot)} />
          {toast.text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

