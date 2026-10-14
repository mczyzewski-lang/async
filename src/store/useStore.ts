import { create } from 'zustand';
import { CONFIG_VERSION, DEFAULT_CONFIG, cloneConfig } from '../engine/defaults';
import { applyPreset } from '../engine/presets';
import type {
  Config,
  LightingConfig,
  OpeningConfig,
  PlacementConfig,
  RailingConfig,
  RoomConfig,
  StairConfig,
  StructureConfig,
  TreadConfig,
} from '../engine/types';

export type CameraMode = 'perspective' | 'top' | 'side' | 'cutaway' | 'eye';
export type WallMode = 'auto' | 'all' | 'transparent' | 'custom' | 'cutaway';
export type WallKey = 'back' | 'front' | 'left' | 'right';

export interface ViewState {
  camera: CameraMode;
  eye: 'bottom' | 'top';
  sideFlip: boolean;
  showDims: boolean;
  wallMode: WallMode;
  hiddenWalls: Record<WallKey, boolean>;
  showSlab: boolean;
  showFootprint: boolean;
  /** bump to request camera reset / fit */
  resetNonce: number;
  fitNonce: number;
}

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'ok' | 'warn' | 'error';
}

interface Store {
  config: Config;
  view: ViewState;
  toast: Toast | null;
  savedAt: string | null;
  setRoom: (p: Partial<RoomConfig>) => void;
  setStair: (p: Partial<StairConfig>) => void;
  setPlacement: (p: Partial<PlacementConfig>) => void;
  setOpening: (p: Partial<OpeningConfig>) => void;
  setStructure: (p: Partial<StructureConfig>) => void;
  setTreads: (p: Partial<TreadConfig>) => void;
  setRailing: (p: Partial<RailingConfig>) => void;
  setLighting: (p: Partial<LightingConfig>) => void;
  setConfig: (c: Config) => void;
  applyPreset: (id: string) => void;
  reset: () => void;
  setView: (p: Partial<ViewState>) => void;
  notify: (text: string, tone?: Toast['tone']) => void;
  save: () => void;
  restore: () => boolean;
}

export const STORAGE_KEY = 'stair-studio:config';

const readSaved = (): { config: Config; savedAt: string } | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.config || data.config.version !== CONFIG_VERSION) return null;
    return data;
  } catch {
    return null;
  }
};

/** deep merge saved config onto defaults so older saves stay valid */
export function normalizeConfig(c: Partial<Config>): Config {
  const d = cloneConfig(DEFAULT_CONFIG);
  return {
    ...d,
    ...c,
    version: CONFIG_VERSION,
    room: { ...d.room, ...c.room, walls: { ...d.room.walls, ...c.room?.walls } },
    stair: {
      ...d.stair,
      ...c.stair,
      placement: { ...d.stair.placement, ...c.stair?.placement },
      opening: { ...d.stair.opening, ...c.stair?.opening },
    },
    structure: { ...d.structure, ...c.structure },
    treads: { ...d.treads, ...c.treads },
    railing: { ...d.railing, ...c.railing },
    lighting: { ...d.lighting, ...c.lighting },
  };
}

let toastId = 0;

export const useStore = create<Store>((set, get) => ({
  config: cloneConfig(DEFAULT_CONFIG),
  view: {
    camera: 'perspective',
    eye: 'bottom',
    sideFlip: false,
    showDims: true,
    wallMode: 'auto',
    hiddenWalls: { back: false, front: true, left: false, right: false },
    showSlab: true,
    showFootprint: false,
    resetNonce: 0,
    fitNonce: 0,
  },
  toast: null,
  savedAt: readSaved()?.savedAt ?? null,
  setRoom: (p) => set((s) => ({ config: { ...s.config, room: { ...s.config.room, ...p } } })),
  setStair: (p) => set((s) => ({ config: { ...s.config, stair: { ...s.config.stair, ...p } } })),
  setPlacement: (p) =>
    set((s) => ({ config: { ...s.config, stair: { ...s.config.stair, placement: { ...s.config.stair.placement, ...p } } } })),
  setOpening: (p) =>
    set((s) => ({ config: { ...s.config, stair: { ...s.config.stair, opening: { ...s.config.stair.opening, ...p } } } })),
  setStructure: (p) =>
    set((s) => {
      const structure = { ...s.config.structure, ...p };
      const railing = s.config.railing.matchSteel
        ? { ...s.config.railing, color: structure.steelColor, finish: structure.steelFinish, colorPreset: structure.steelPreset }
        : s.config.railing;
      return { config: { ...s.config, presetId: null, structure, railing } };
    }),
  setTreads: (p) => set((s) => ({ config: { ...s.config, presetId: null, treads: { ...s.config.treads, ...p } } })),
  setRailing: (p) =>
    set((s) => {
      let railing = { ...s.config.railing, ...p };
      if (railing.matchSteel)
        railing = { ...railing, color: s.config.structure.steelColor, finish: s.config.structure.steelFinish, colorPreset: s.config.structure.steelPreset };
      return { config: { ...s.config, presetId: null, railing } };
    }),
  setLighting: (p) => set((s) => ({ config: { ...s.config, lighting: { ...s.config.lighting, ...p } } })),
  setConfig: (c) => set({ config: normalizeConfig(c) }),
  applyPreset: (id) => set((s) => ({ config: applyPreset(s.config, id) })),
  reset: () => {
    set({ config: cloneConfig(DEFAULT_CONFIG) });
    get().setView({ camera: 'perspective', resetNonce: get().view.resetNonce + 1 });
    get().notify('Przywrócono konfigurację domyślną', 'info');
  },
  setView: (p) => set((s) => ({ view: { ...s.view, ...p } })),
  notify: (text, tone = 'info') => set({ toast: { id: ++toastId, text, tone } }),
  save: () => {
    const savedAt = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ config: get().config, savedAt }));
      set({ savedAt });
      get().notify('Konfiguracja zapisana w przeglądarce', 'ok');
    } catch {
      get().notify('Nie udało się zapisać konfiguracji', 'error');
    }
  },
  restore: () => {
    const s = readSaved();
    if (!s) {
      get().notify('Brak zapisanej konfiguracji', 'warn');
      return false;
    }
    set({ config: normalizeConfig(s.config) });
    get().notify('Wczytano zapisaną konfigurację', 'ok');
    return true;
  },
}));

/** canvas capture hook registered by the scene */
export const captureRef: { current: null | (() => string) } = { current: null };
