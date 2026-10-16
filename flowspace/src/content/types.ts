/**
 * Renderer-independent content model for FLOWSPACE.
 *
 * The same data drives the pose encyclopedia, the 3D rig, voice guidance,
 * session generation, mistake demonstrations and recommendations.
 * Angles are in degrees, distances in metres.
 */

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced'];

export type PoseCategory =
  | 'standing'
  | 'seated'
  | 'kneeling'
  | 'supine'
  | 'prone'
  | 'allfours'
  | 'balance'
  | 'armbalance'
  | 'inversion'
  | 'backbend'
  | 'twist'
  | 'forwardfold'
  | 'restorative'
  | 'breathing';

/** Coarse body orientation used for transition planning. */
export type BaseShape =
  | 'standing'
  | 'allfours'
  | 'kneeling'
  | 'seated'
  | 'supine'
  | 'prone'
  | 'plank';

export type BodyArea =
  | 'neck'
  | 'shoulders'
  | 'upperBack'
  | 'lowerBack'
  | 'spine'
  | 'chest'
  | 'core'
  | 'hips'
  | 'glutes'
  | 'hamstrings'
  | 'quads'
  | 'knees'
  | 'calves'
  | 'ankles'
  | 'feet'
  | 'arms'
  | 'wrists'
  | 'sideBody'
  | 'wholeBody';

export type Equipment = 'mat' | 'block' | 'strap' | 'chair' | 'blanket' | 'bolster' | 'wall';

export type GoalId =
  | 'relax'
  | 'neckShoulders'
  | 'spineMobility'
  | 'hipMobility'
  | 'fullStretch'
  | 'recovery'
  | 'morning'
  | 'afterWork'
  | 'balance'
  | 'beforeSleep'
  | 'flexibility'
  | 'strength';

export type ReviewStatus = 'draft' | 'internal-review' | 'expert-reviewed';

/** Joints that can be highlighted, targeted by cameras and inspected. */
export type JointId =
  | 'pelvis'
  | 'spine'
  | 'chest'
  | 'neck'
  | 'head'
  | 'clavL'
  | 'clavR'
  | 'shoulderL'
  | 'shoulderR'
  | 'elbowL'
  | 'elbowR'
  | 'wristL'
  | 'wristR'
  | 'handL'
  | 'handR'
  | 'hipL'
  | 'hipR'
  | 'kneeL'
  | 'kneeR'
  | 'ankleL'
  | 'ankleR'
  | 'toesL'
  | 'toesR';

export const JOINT_IDS: JointId[] = [
  'pelvis', 'spine', 'chest', 'neck', 'head',
  'clavL', 'clavR', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'wristL', 'wristR', 'handL', 'handR',
  'hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR', 'toesL', 'toesR',
];

// ---------------------------------------------------------------------------
// Skeletal pose state (anatomical parameters, not raw bone rotations)
// ---------------------------------------------------------------------------

/** Spine-like segment: flexion (+ forward), side bend (+ toward the body's left), twist (+ toward left). */
export interface SegmentAngles {
  flex: number;
  side: number;
  twist: number;
}

/**
 * Ball joint (shoulder / hip) in "globe" coordinates.
 * elev: 0 = limb hanging down, 90 = horizontal, 180 = overhead.
 * plane: direction of elevation, 0 = lateral (abduction), 90 = forward (flexion),
 *        -90 = backward (extension), >90 = across the body.
 * rot: axial rotation, + = external rotation.
 */
export interface BallJoint {
  elev: number;
  plane: number;
  rot: number;
}

export interface ClavicleAngles {
  /** + = shrug / elevation */
  elev: number;
  /** + = protraction (shoulders rounding forward) */
  prot: number;
}

export interface WristAngles {
  /** + = flexion toward the palm, - = extension (hand flat on floor) */
  flex: number;
  /** + = radial deviation */
  dev: number;
  /** + = pronation (palm turning back / down) */
  pron: number;
}

export interface AnkleAngles {
  /** + = dorsiflexion (toes toward shin), - = plantar flexion (pointed foot) */
  flex: number;
  /** + = inversion (sole turning in) */
  inv: number;
}

export interface RootTransform {
  /** + = whole body tilts forward (90 = prone) */
  pitch: number;
  /** + = body turns to its left (counter-clockwise from above) */
  yaw: number;
  /** + = body rolls toward its left (lateral tilt in the frontal plane) */
  roll: number;
  /** + = rotation about the body's own long axis toward its left (e.g. opening into side plank) */
  turn?: number;
  /** Horizontal position of the pelvis on the mat */
  x: number;
  z: number;
}

export interface PoseState {
  root: RootTransform;
  spine: SegmentAngles;
  chest: SegmentAngles;
  neck: SegmentAngles;
  head: SegmentAngles;
  clavL: ClavicleAngles;
  clavR: ClavicleAngles;
  shoulderL: BallJoint;
  shoulderR: BallJoint;
  elbowL: number;
  elbowR: number;
  wristL: WristAngles;
  wristR: WristAngles;
  /** 0 = open hand, 1 = soft fist */
  fingersL: number;
  fingersR: number;
  hipL: BallJoint;
  hipR: BallJoint;
  kneeL: number;
  kneeR: number;
  ankleL: AnkleAngles;
  ankleR: AnkleAngles;
  /** + = toes extended (tucked under) */
  toesL: number;
  toesR: number;
  /** Limbs to plant on the floor with two-bone IK after grounding. */
  plant?: Partial<Record<'handL' | 'handR' | 'footL' | 'footR', boolean>>;
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
export type PoseDelta = DeepPartial<PoseState>;

export interface Keyframe {
  id: string;
  labelPL: string;
  base: BaseShape;
  state: PoseState;
  /** Transition time into this keyframe at speed 1.0 (seconds). */
  duration: number;
}

export interface CameraPreset {
  id: string;
  labelPL: string;
  /** Degrees around the pose's facing direction (0 = in front). */
  azimuth: number;
  /** Degrees above the horizon. */
  elevation: number;
  distance: number;
  target: JointId | 'center' | 'feet';
}

export interface TechnicalGuide {
  kind: 'alignment' | 'orientation' | 'vertical' | 'contacts' | 'balance' | 'arrow';
  joints: JointId[];
  labelPL: string;
  /** Arrow direction in body space (x = left, y = up, z = forward), only for kind 'arrow'. */
  direction?: [number, number, number];
}

export interface PoseAnimation {
  /** Keyframes in entry order. The last keyframe is the held pose. */
  keyframes: Keyframe[];
  /** Keyframe ids played on entry, hold and exit. */
  entry: string[];
  hold: string;
  exit: string[];
  breathing: 'chest' | 'belly' | 'subtle';
  /** Rendered pose is mirrored for the right side. */
  mirrorForRight: boolean;
  /** Facing direction of the held pose (deg), used to orient camera presets. */
  facing: number;
}

export interface InstructionStep {
  id: string;
  descriptionPL: string;
  duration: number;
  /** Keyframe id displayed for this step. */
  animationSegment: string;
  cameraPreset: string;
  highlightedJoints: JointId[];
  narrationPL: string;
}

export interface CommonMistake {
  id: string;
  titlePL: string;
  explanationPL: string;
  correctionPL: string;
  /** Pose state demonstrating the (non-dangerous, mild) error. null = text-only mistake. */
  incorrectPoseState: PoseState | null;
  /** Keyframe id of the corrected state. */
  correctedPoseState: string;
  cameraPreset: string;
  highlightedJoints: JointId[];
}

export interface Modification {
  id: string;
  titlePL: string;
  descriptionPL: string;
  equipment: Equipment[];
}

export interface SessionMeta {
  /** Phases in which the pose fits. */
  roles: Array<'arrival' | 'warmup' | 'main' | 'peak' | 'cooldown' | 'relax'>;
  /** 1 (very gentle) – 5 (very demanding). */
  intensity: 1 | 2 | 3 | 4 | 5;
  goals: Partial<Record<GoalId, number>>;
  /** Movement tags that users may exclude. */
  movements: MovementTag[];
  entry: number;
  exit: number;
  hold: { min: number; default: number; max: number };
  /** Pose requires a warm body / preparation before it. */
  needsPrep?: string[];
}

export type MovementTag =
  | 'kneeling'
  | 'wristLoad'
  | 'inversion'
  | 'deepBackbend'
  | 'deepForwardFold'
  | 'balance'
  | 'twist'
  | 'lyingProne'
  | 'lyingSupine'
  | 'deepKneeFlexion'
  | 'neckLoad'
  | 'jumping';

export interface YogaPose {
  id: string;
  slug: string;
  namePL: string;
  nameEN: string;
  nameSanskrit?: string;
  category: PoseCategory;
  secondaryCategories?: PoseCategory[];
  difficulty: Difficulty;
  targetAreas: BodyArea[];
  /** Intended effects, stated conservatively. */
  benefits: string[];
  cautions: string[];
  contraindications: string[];
  equipment: Equipment[];
  /** Estimated time to learn the basic shape, minutes of practice. */
  learningMinutes: number;
  /** Typical hold in seconds. */
  duration: { min: number; typical: number; max: number };
  sided: boolean;
  summaryPL: string;
  instructions: InstructionStep[];
  commonMistakes: CommonMistake[];
  modifications: Modification[];
  /** null = catalog-only entry without a validated 3D demonstration. */
  animation: PoseAnimation | null;
  cameraPresets: CameraPreset[];
  technicalGuides: TechnicalGuide[];
  transitionsTo: string[];
  narration: { intro: string; cues: string[]; breath?: string; exit: string };
  session: SessionMeta | null;
  requiresSupervision?: boolean;
  contentReviewStatus: ReviewStatus;
  animationReviewStatus: ReviewStatus | 'none';
  goals: GoalId[];
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export type SessionPhase = 'arrival' | 'warmup' | 'main' | 'cooldown' | 'relax';
export type ExperienceLevel = 'newcomer' | 'beginner' | 'intermediate' | 'advanced';
export type Intensity = 'gentle' | 'moderate' | 'dynamic';
export type GuidanceLevel = 'minimal' | 'standard' | 'detailed';

export interface SessionRequest {
  durationMin: number;
  goal: GoalId;
  level: ExperienceLevel;
  intensity: Intensity;
  equipment: Equipment[];
  exclude: MovementTag[];
  guidance: GuidanceLevel;
  novelty: 'familiar' | 'balanced' | 'new';
  knownPoses?: string[];
  seed: number;
}

export interface SessionStep {
  id: string;
  poseId: string;
  variationId?: string;
  side: 'none' | 'L' | 'R';
  phase: SessionPhase;
  entryDuration: number;
  holdDuration: number;
  exitDuration: number;
  restDuration: number;
  narration: string[];
  transition: string;
}

export interface YogaSession {
  id: string;
  titlePL: string;
  request: SessionRequest;
  steps: SessionStep[];
  totalSeconds: number;
  createdAt: number;
  equipment: Equipment[];
  difficulty: Difficulty;
  custom?: boolean;
}
