import type {
  BaseShape,
  BodyArea,
  CameraPreset,
  CommonMistake,
  Difficulty,
  Equipment,
  GoalId,
  InstructionStep,
  JointId,
  Keyframe,
  Modification,
  MovementTag,
  PoseCategory,
  PoseState,
  ReviewStatus,
  SessionMeta,
  TechnicalGuide,
  YogaPose,
} from '../types';

/** Camera presets shared by every pose (azimuth is relative to the pose's facing direction). */
export const STANDARD_CAMERAS: CameraPreset[] = [
  { id: 'front', labelPL: 'Przód', azimuth: 0, elevation: 8, distance: 3.6, target: 'center' },
  { id: 'threeQuarter', labelPL: '3/4', azimuth: 38, elevation: 14, distance: 3.6, target: 'center' },
  { id: 'side', labelPL: 'Bok', azimuth: 90, elevation: 6, distance: 3.6, target: 'center' },
  { id: 'back', labelPL: 'Tył', azimuth: 180, elevation: 10, distance: 3.6, target: 'center' },
  { id: 'otherSide', labelPL: 'Drugi bok', azimuth: -90, elevation: 6, distance: 3.6, target: 'center' },
  { id: 'high', labelPL: 'Z góry', azimuth: 30, elevation: 52, distance: 3.8, target: 'center' },
  { id: 'focusPelvis', labelPL: 'Miednica', azimuth: 50, elevation: 12, distance: 2.1, target: 'pelvis' },
  { id: 'focusSpine', labelPL: 'Kręgosłup', azimuth: 90, elevation: 18, distance: 2.4, target: 'chest' },
  { id: 'focusShoulders', labelPL: 'Barki', azimuth: 25, elevation: 18, distance: 2.0, target: 'chest' },
  { id: 'focusHead', labelPL: 'Głowa i szyja', azimuth: 60, elevation: 10, distance: 1.7, target: 'neck' },
  { id: 'focusKnees', labelPL: 'Kolana', azimuth: 40, elevation: 14, distance: 2.0, target: 'kneeL' },
  { id: 'focusFeet', labelPL: 'Stopy', azimuth: 35, elevation: 24, distance: 1.9, target: 'feet' },
  { id: 'focusHands', labelPL: 'Dłonie', azimuth: 30, elevation: 26, distance: 1.9, target: 'handL' },
];

export const kf = (id: string, labelPL: string, base: BaseShape, state: PoseState, duration = 1.6): Keyframe => ({
  id,
  labelPL,
  base,
  state,
  duration,
});

export function step(
  id: string,
  keyframe: string,
  descriptionPL: string,
  opts: { cam?: string; joints?: JointId[]; narr?: string; duration?: number } = {},
): InstructionStep {
  return {
    id,
    animationSegment: keyframe,
    descriptionPL,
    duration: opts.duration ?? 6,
    cameraPreset: opts.cam ?? 'threeQuarter',
    highlightedJoints: opts.joints ?? [],
    narrationPL: opts.narr ?? descriptionPL,
  };
}

export function mistake(m: {
  id: string;
  title: string;
  explanation: string;
  correction: string;
  state: PoseState | null;
  corrected: string;
  cam?: string;
  joints: JointId[];
}): CommonMistake {
  return {
    id: m.id,
    titlePL: m.title,
    explanationPL: m.explanation,
    correctionPL: m.correction,
    incorrectPoseState: m.state,
    correctedPoseState: m.corrected,
    cameraPreset: m.cam ?? 'side',
    highlightedJoints: m.joints,
  };
}

export const mod = (id: string, titlePL: string, descriptionPL: string, equipment: Equipment[] = []): Modification => ({
  id,
  titlePL,
  descriptionPL,
  equipment,
});

export const guide = (kind: TechnicalGuide['kind'], joints: JointId[], labelPL: string, direction?: [number, number, number]): TechnicalGuide => ({
  kind,
  joints,
  labelPL,
  direction,
});

export interface PoseInput {
  id: string;
  namePL: string;
  nameEN: string;
  nameSanskrit?: string;
  category: PoseCategory;
  secondaryCategories?: PoseCategory[];
  difficulty: Difficulty;
  targetAreas: BodyArea[];
  benefits: string[];
  cautions: string[];
  contraindications?: string[];
  equipment?: Equipment[];
  learningMinutes: number;
  duration: { min: number; typical: number; max: number };
  sided?: boolean;
  summary: string;
  keyframes?: Keyframe[];
  hold?: string;
  entry?: string[];
  exit?: string[];
  facing?: number;
  breathing?: 'chest' | 'belly' | 'subtle';
  steps: InstructionStep[];
  mistakes?: CommonMistake[];
  modifications: Modification[];
  guides?: TechnicalGuide[];
  cameras?: CameraPreset[];
  transitionsTo?: string[];
  narration: { intro: string; cues: string[]; breath?: string; exit: string };
  session?: (Omit<SessionMeta, 'movements' | 'entry' | 'exit' | 'hold'> & {
    movements?: MovementTag[];
    entry?: number;
    exit?: number;
    hold?: SessionMeta['hold'];
  }) | null;
  goals: GoalId[];
  requiresSupervision?: boolean;
  contentReviewStatus?: ReviewStatus;
  animationReviewStatus?: ReviewStatus | 'none';
}

export function definePose(p: PoseInput): YogaPose {
  const keyframes = p.keyframes ?? [];
  const has3D = keyframes.length > 0;
  const hold = p.hold ?? keyframes[keyframes.length - 1]?.id;
  const entry = p.entry ?? keyframes.map((k) => k.id);
  const exit = p.exit ?? [...entry].reverse().slice(1);
  return {
    id: p.id,
    slug: p.id,
    namePL: p.namePL,
    nameEN: p.nameEN,
    nameSanskrit: p.nameSanskrit,
    category: p.category,
    secondaryCategories: p.secondaryCategories,
    difficulty: p.difficulty,
    targetAreas: p.targetAreas,
    benefits: p.benefits,
    cautions: p.cautions,
    contraindications: p.contraindications ?? [],
    equipment: p.equipment ?? ['mat'],
    learningMinutes: p.learningMinutes,
    duration: p.duration,
    sided: p.sided ?? false,
    summaryPL: p.summary,
    instructions: p.steps,
    commonMistakes: p.mistakes ?? [],
    modifications: p.modifications,
    animation: has3D
      ? {
          keyframes,
          entry,
          hold: hold!,
          exit,
          breathing: p.breathing ?? 'chest',
          mirrorForRight: p.sided ?? false,
          facing: p.facing ?? 0,
        }
      : null,
    cameraPresets: [...STANDARD_CAMERAS, ...(p.cameras ?? [])],
    technicalGuides: p.guides ?? [],
    transitionsTo: p.transitionsTo ?? [],
    narration: p.narration,
    session: p.session
      ? {
          movements: [],
          entry: has3D ? 6 : 8,
          exit: 4,
          hold: { min: p.duration.min, default: p.duration.typical, max: p.duration.max },
          ...p.session,
        }
      : null,
    requiresSupervision: p.requiresSupervision,
    contentReviewStatus: p.contentReviewStatus ?? 'internal-review',
    animationReviewStatus: has3D ? (p.animationReviewStatus ?? 'internal-review') : 'none',
    goals: p.goals,
  };
}
