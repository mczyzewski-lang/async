import type { BodyArea, Difficulty, Equipment, ExperienceLevel, GoalId, Intensity, MovementTag, PoseCategory, SessionPhase } from '@/content/types';

export const GOAL_LABELS: Record<GoalId, string> = {
  relax: 'Relaks i wyciszenie',
  neckShoulders: 'Rozluźnienie karku i barków',
  spineMobility: 'Mobilność kręgosłupa',
  hipMobility: 'Mobilność bioder',
  fullStretch: 'Rozciąganie całego ciała',
  recovery: 'Regeneracja po treningu',
  morning: 'Joga na dobry poranek',
  afterWork: 'Joga po pracy',
  balance: 'Poprawa równowagi',
  beforeSleep: 'Delikatna joga przed snem',
  flexibility: 'Większa elastyczność',
  strength: 'Wzmocnienie ciała',
};
export const GOAL_ORDER = Object.keys(GOAL_LABELS) as GoalId[];

export const LEVEL_LABELS: Record<ExperienceLevel, string> = {
  newcomer: 'Zupełnie początkujący',
  beginner: 'Początkujący',
  intermediate: 'Średniozaawansowany',
  advanced: 'Zaawansowany',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: 'Początkujący',
  intermediate: 'Średni',
  advanced: 'Zaawansowany',
};

export const INTENSITY_LABELS: Record<Intensity, string> = {
  gentle: 'Łagodnie',
  moderate: 'Umiarkowanie',
  dynamic: 'Dynamicznie',
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  mat: 'Mata',
  block: 'Klocek',
  strap: 'Pasek',
  chair: 'Krzesło',
  blanket: 'Koc',
  bolster: 'Wałek (bolster)',
  wall: 'Ściana',
};

export const MOVEMENT_LABELS: Record<MovementTag, string> = {
  kneeling: 'Klęk na kolanach',
  wristLoad: 'Obciążenie nadgarstków',
  inversion: 'Pozycje odwrócone',
  deepBackbend: 'Głębokie wygięcia w tył',
  deepForwardFold: 'Głębokie skłony',
  balance: 'Równowaga na jednej nodze',
  twist: 'Skręty',
  lyingProne: 'Leżenie na brzuchu',
  lyingSupine: 'Leżenie na plecach',
  deepKneeFlexion: 'Głębokie zgięcie kolan',
  neckLoad: 'Obciążenie szyi',
  jumping: 'Przeskoki',
};

export const PHASE_LABELS: Record<SessionPhase, string> = {
  arrival: 'Przybycie i oddech',
  warmup: 'Rozgrzewka',
  main: 'Część główna',
  cooldown: 'Wyciszenie',
  relax: 'Relaks końcowy',
};

export const CATEGORY_LABELS: Record<PoseCategory, string> = {
  standing: 'Stojące',
  seated: 'Siedzące',
  kneeling: 'Klęczące',
  supine: 'Na plecach',
  prone: 'Na brzuchu',
  allfours: 'Na czworakach',
  balance: 'Równowaga',
  armbalance: 'Balans na rękach',
  inversion: 'Odwrócone',
  backbend: 'Wygięcia w tył',
  twist: 'Skręty',
  forwardfold: 'Skłony',
  restorative: 'Regenerujące',
  breathing: 'Oddech',
};

export const AREA_LABELS: Record<BodyArea, string> = {
  neck: 'Szyja',
  shoulders: 'Barki',
  upperBack: 'Górna część pleców',
  lowerBack: 'Dolna część pleców',
  spine: 'Kręgosłup',
  chest: 'Klatka piersiowa',
  core: 'Brzuch i tułów',
  hips: 'Biodra',
  glutes: 'Pośladki',
  hamstrings: 'Tył ud',
  quads: 'Przód ud',
  knees: 'Kolana',
  calves: 'Łydki',
  ankles: 'Kostki',
  feet: 'Stopy',
  arms: 'Ramiona',
  wrists: 'Nadgarstki',
  sideBody: 'Boki tułowia',
  wholeBody: 'Całe ciało',
};

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function formatMinutes(totalSeconds: number): string {
  const m = Math.round(totalSeconds / 60);
  return `${m} min`;
}

/** Polish plural for "minuta". */
export function minutesPL(n: number) {
  if (n === 1) return 'minuta';
  const d = n % 10;
  const t = n % 100;
  if (d >= 2 && d <= 4 && (t < 12 || t > 14)) return 'minuty';
  return 'minut';
}

export function pluralPL(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  const d = n % 10;
  const t = n % 100;
  if (d >= 2 && d <= 4 && (t < 12 || t > 14)) return few;
  return many;
}
