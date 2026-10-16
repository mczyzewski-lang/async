import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Equipment, ExperienceLevel, GoalId, GuidanceLevel, Intensity, MovementTag, SessionRequest, YogaSession } from '@/content/types';
import type { VoiceSettings } from '@/audio/voice';
import type { QualitySetting } from '@/three/Stage';
import type { EnvironmentId } from '@/three/world/environments';
import { newSeed } from '@/engine/session';

const storage = createJSONStorage(() => {
  try {
    return localStorage;
  } catch {
    const mem = new Map<string, string>();
    return { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
  }
});

// ---------------------------------------------------------------- settings & profile

export interface Profile {
  onboarded: boolean;
  name: string;
  level: ExperienceLevel;
  goal: GoalId;
  durationMin: number;
  equipment: Equipment[];
  exclude: MovementTag[];
  limitations: string;
}

export interface SettingsState {
  profile: Profile;
  voice: VoiceSettings;
  guidance: GuidanceLevel;
  intensity: Intensity;
  environment: EnvironmentId;
  quality: QualitySetting;
  ambientVolume: number;
  ambientOn: boolean;
  chimes: boolean;
  breathingGuide: boolean;
  keepAwake: boolean;
  seenIntro: boolean;
  disclaimerAccepted: boolean;
  setProfile: (p: Partial<Profile>) => void;
  setVoice: (v: Partial<VoiceSettings>) => void;
  set: (p: Partial<Omit<SettingsState, 'set' | 'setProfile' | 'setVoice' | 'reset'>>) => void;
  reset: () => void;
}

const defaultProfile: Profile = {
  onboarded: false,
  name: '',
  level: 'beginner',
  goal: 'relax',
  durationMin: 20,
  equipment: ['mat'],
  exclude: [],
  limitations: '',
};

const settingsDefaults = {
  profile: defaultProfile,
  voice: { enabled: true, gender: 'female', rate: 0.95, volume: 1 } as VoiceSettings,
  guidance: 'standard' as GuidanceLevel,
  intensity: 'moderate' as Intensity,
  environment: 'zen' as EnvironmentId,
  quality: 'auto' as QualitySetting,
  ambientVolume: 0.5,
  ambientOn: true,
  chimes: true,
  breathingGuide: true,
  keepAwake: true,
  seenIntro: false,
  disclaimerAccepted: false,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...settingsDefaults,
      setProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
      setVoice: (v) => set((s) => ({ voice: { ...s.voice, ...v } })),
      set: (p) => set(p),
      reset: () => set(settingsDefaults),
    }),
    { name: 'flowspace.settings', storage, version: 1 },
  ),
);

// ---------------------------------------------------------------- progress

export interface PracticeRecord {
  id: string;
  date: number;
  seconds: number;
  plannedSeconds: number;
  title: string;
  goal: GoalId | null;
  poses: string[];
  completed: boolean;
  feeling?: string;
}

export interface ProgressState {
  history: PracticeRecord[];
  learned: Record<string, number>;
  favorites: string[];
  recent: string[];
  notes: Array<{ id: string; date: number; text: string }>;
  addRecord: (r: PracticeRecord) => void;
  setFeeling: (id: string, feeling: string) => void;
  markLearned: (poseId: string) => void;
  toggleFavorite: (poseId: string) => void;
  touchRecent: (poseId: string) => void;
  addNote: (text: string) => void;
  removeNote: (id: string) => void;
  clear: () => void;
}

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      history: [],
      learned: {},
      favorites: [],
      recent: [],
      notes: [],
      addRecord: (r) =>
        set((s) => {
          const learned = { ...s.learned };
          for (const p of r.poses) learned[p] = learned[p] ?? r.date;
          return { history: [r, ...s.history.filter((h) => h.id !== r.id)].slice(0, 500), learned };
        }),
      setFeeling: (id, feeling) => set((s) => ({ history: s.history.map((h) => (h.id === id ? { ...h, feeling } : h)) })),
      markLearned: (poseId) => set((s) => ({ learned: s.learned[poseId] ? s.learned : { ...s.learned, [poseId]: Date.now() } })),
      toggleFavorite: (poseId) =>
        set((s) => ({ favorites: s.favorites.includes(poseId) ? s.favorites.filter((f) => f !== poseId) : [...s.favorites, poseId] })),
      touchRecent: (poseId) => set((s) => ({ recent: [poseId, ...s.recent.filter((r) => r !== poseId)].slice(0, 12) })),
      addNote: (text) => set((s) => ({ notes: [{ id: `n${Date.now()}`, date: Date.now(), text }, ...s.notes] })),
      removeNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
      clear: () => set({ history: [], learned: {}, favorites: [], recent: [], notes: [] }),
    }),
    { name: 'flowspace.progress', storage, version: 1 },
  ),
);

// ---------------------------------------------------------------- routines & active session

export interface SavedRoutine {
  id: string;
  name: string;
  session: YogaSession;
  favorite: boolean;
  savedAt: number;
  lastPlayed?: number;
}

export interface ActiveSession {
  session: YogaSession;
  stepIndex: number;
  stepElapsed: number;
  updatedAt: number;
  routineId?: string;
}

export interface RoutineState {
  routines: SavedRoutine[];
  active: ActiveSession | null;
  save: (session: YogaSession, name?: string, favorite?: boolean) => string;
  remove: (id: string) => void;
  toggleFavorite: (id: string) => void;
  rename: (id: string, name: string) => void;
  markPlayed: (id: string) => void;
  setActive: (a: ActiveSession | null) => void;
}

export const useRoutines = create<RoutineState>()(
  persist(
    (set) => ({
      routines: [],
      active: null,
      save: (session, name, favorite = true) => {
        const id = `r${Date.now().toString(36)}`;
        set((s) => ({ routines: [{ id, name: name ?? session.titlePL, session, favorite, savedAt: Date.now() }, ...s.routines] }));
        return id;
      },
      remove: (id) => set((s) => ({ routines: s.routines.filter((r) => r.id !== id) })),
      toggleFavorite: (id) => set((s) => ({ routines: s.routines.map((r) => (r.id === id ? { ...r, favorite: !r.favorite } : r)) })),
      rename: (id, name) => set((s) => ({ routines: s.routines.map((r) => (r.id === id ? { ...r, name } : r)) })),
      markPlayed: (id) => set((s) => ({ routines: s.routines.map((r) => (r.id === id ? { ...r, lastPlayed: Date.now() } : r)) })),
      setActive: (a) => set({ active: a }),
    }),
    { name: 'flowspace.routines', storage, version: 1 },
  ),
);

// ---------------------------------------------------------------- practice builder draft

export interface PracticeDraft {
  request: SessionRequest;
  session: YogaSession | null;
  routineId?: string;
  setRequest: (r: Partial<SessionRequest>) => void;
  setSession: (s: YogaSession | null, routineId?: string) => void;
}

export function requestFromProfile(over: Partial<SessionRequest> = {}): SessionRequest {
  const st = useSettings.getState();
  const known = Object.keys(useProgress.getState().learned);
  return {
    durationMin: st.profile.durationMin,
    goal: st.profile.goal,
    level: st.profile.level,
    intensity: st.intensity,
    equipment: st.profile.equipment,
    exclude: st.profile.exclude,
    guidance: st.guidance,
    novelty: 'balanced',
    knownPoses: known,
    seed: newSeed(),
    ...over,
  };
}

export const usePractice = create<PracticeDraft>()(
  persist(
    (set) => ({
      request: {
        durationMin: 20,
        goal: 'relax',
        level: 'beginner',
        intensity: 'moderate',
        equipment: ['mat'],
        exclude: [],
        guidance: 'standard',
        novelty: 'balanced',
        seed: 1,
      },
      session: null,
      setRequest: (r) => set((s) => ({ request: { ...s.request, ...r } })),
      setSession: (session, routineId) => set({ session, routineId }),
    }),
    { name: 'flowspace.practice', storage, version: 1 },
  ),
);
