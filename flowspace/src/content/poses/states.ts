/**
 * Authored skeletal configurations (anatomical parameters) for the 3D pose library.
 * Asymmetric poses are authored for the LEFT side (left leg forward / left side working);
 * the renderer mirrors them for the right side.
 *
 * Every state here was checked visually in /dev/pose-lab (front + side render).
 * They are plausible demonstrations, NOT expert-validated biomechanical references.
 */
import type { PoseState } from '../types';
import { neutralState, pose, setPath } from '../poseState';
import FITTED from './fitted.json';

const N = neutralState();

/**
 * Applies solver-refined values (scripts/pose-fit.ts → fitted.json) on top of the authored intent.
 * The solver only adjusts listed parameters so that floor contacts and alignment targets hold.
 */
function F(name: string, s: PoseState): PoseState {
  const fit = (FITTED as Record<string, Record<string, number>>)[name];
  if (!fit) return s;
  let out = s;
  for (const [k, v] of Object.entries(fit)) out = setPath(out, k, v);
  return out;
}

// ---------------------------------------------------------------- shared helpers

const armsOverhead = {
  clavL: { elev: 10, prot: 0 },
  clavR: { elev: 10, prot: 0 },
  shoulderL: { elev: 172, plane: 90, rot: 0 },
  shoulderR: { elev: 172, plane: 90, rot: 0 },
  elbowL: 4,
  elbowR: 4,
  wristL: { flex: 0, dev: 0, pron: 0 },
  wristR: { flex: 0, dev: 0, pron: 0 },
  fingersL: 0.05,
  fingersR: 0.05,
};

/** Palms together in front of the sternum. */
const prayerHands = {
  shoulderL: { elev: 28, plane: 60, rot: -55 },
  shoulderR: { elev: 28, plane: 60, rot: -55 },
  elbowL: 118,
  elbowR: 118,
  wristL: { flex: -60, dev: 0, pron: 10 },
  wristR: { flex: -60, dev: 0, pron: 10 },
  fingersL: 0,
  fingersR: 0,
};

const armsT = {
  shoulderL: { elev: 90, plane: 0, rot: 0 },
  shoulderR: { elev: 90, plane: 0, rot: 0 },
  elbowL: 2,
  elbowR: 2,
  wristL: { flex: 0, dev: 0, pron: 0 },
  wristR: { flex: 0, dev: 0, pron: 0 },
  fingersL: 0.05,
  fingersR: 0.05,
};

/** Hand flat on the floor with fingers pointing forward (arm roughly vertical). */
const flatHand = (ext = 85) => ({ flex: -ext, dev: 0, pron: 90 });

// ---------------------------------------------------------------- standing family

export const S_mountain: PoseState = F('S_mountain', pose(N, {
  shoulderL: { elev: 6, plane: 5, rot: 8 },
  shoulderR: { elev: 6, plane: 5, rot: 8 },
  elbowL: 5,
  elbowR: 5,
  hipL: { elev: 1, plane: 0, rot: 0 },
  hipR: { elev: 1, plane: 0, rot: 0 },
  plant: { footL: true, footR: true },
}));

export const S_mountainReady: PoseState = F('S_mountainReady', pose(S_mountain, { neck: { flex: 4, side: 0, twist: 0 } }));

export const S_mountainSlouch: PoseState = F('S_mountainSlouch', pose(S_mountain, {
  root: { pitch: -6 },
  spine: { flex: 8, side: 0, twist: 0 },
  chest: { flex: 12, side: 0, twist: 0 },
  neck: { flex: -8, side: 0, twist: 0 },
  head: { flex: 2, side: 0, twist: 0 },
  clavL: { elev: 2, prot: 14 },
  clavR: { elev: 2, prot: 14 },
}));

export const S_mountainLocked: PoseState = F('S_mountainLocked', pose(S_mountain, {
  root: { pitch: 8 },
  spine: { flex: -12, side: 0, twist: 0 },
  kneeL: -4,
  kneeR: -4,
  hipL: { elev: 8, plane: 90, rot: 0 },
  hipR: { elev: 8, plane: 90, rot: 0 },
}));

export const S_armsUp: PoseState = F('S_armsUp', pose(S_mountain, armsOverhead, {
  chest: { flex: -3, side: 0, twist: 0 },
  head: { flex: -6, side: 0, twist: 0 },
}));

export const S_armsUpShrug: PoseState = F('S_armsUpShrug', pose(S_armsUp, {
  clavL: { elev: 26, prot: 4 },
  clavR: { elev: 26, prot: 4 },
  neck: { flex: -4, side: 0, twist: 0 },
}));

export const S_prayer: PoseState = F('S_prayer', pose(S_mountain, prayerHands));

export const S_standingSideBend: PoseState = F('S_standingSideBend', pose(S_armsUp, {
  spine: { flex: 0, side: 9, twist: 0 },
  chest: { flex: 0, side: 15, twist: 0 },
  neck: { flex: 0, side: 6, twist: 0 },
  root: { roll: 2 },
  shoulderR: { elev: 176, plane: 85, rot: 0 },
  shoulderL: { elev: 165, plane: 95, rot: 0 },
}));

// Forward folds
export const S_halfFold: PoseState = F('S_halfFold', pose(S_mountain, {
  root: { pitch: 78, z: -0.1 },
  hipL: { elev: 80, plane: 90, rot: 0 },
  hipR: { elev: 80, plane: 90, rot: 0 },
  kneeL: 8,
  kneeR: 8,
  spine: { flex: -6, side: 0, twist: 0 },
  chest: { flex: -6, side: 0, twist: 0 },
  neck: { flex: -14, side: 0, twist: 0 },
  shoulderL: { elev: 64, plane: 88, rot: 0 },
  shoulderR: { elev: 64, plane: 88, rot: 0 },
  elbowL: 6,
  elbowR: 6,
  wristL: { flex: -30, dev: 0, pron: 60 },
  wristR: { flex: -30, dev: 0, pron: 60 },
}));

export const S_halfFoldRounded: PoseState = F('S_halfFoldRounded', pose(S_halfFold, {
  root: { pitch: 62 },
  hipL: { elev: 64, plane: 90, rot: 0 },
  hipR: { elev: 64, plane: 90, rot: 0 },
  spine: { flex: 16, side: 0, twist: 0 },
  chest: { flex: 22, side: 0, twist: 0 },
  neck: { flex: -6, side: 0, twist: 0 },
}));

export const S_forwardFold: PoseState = F('S_forwardFold', pose(S_mountain, {
  root: { pitch: 98, z: -0.12 },
  hipL: { elev: 104, plane: 90, rot: 0 },
  hipR: { elev: 104, plane: 90, rot: 0 },
  kneeL: 12,
  kneeR: 12,
  ankleL: { flex: 4, inv: 0 },
  ankleR: { flex: 4, inv: 0 },
  spine: { flex: 16, side: 0, twist: 0 },
  chest: { flex: 18, side: 0, twist: 0 },
  neck: { flex: 14, side: 0, twist: 0 },
  head: { flex: 6, side: 0, twist: 0 },
  shoulderL: { elev: 128, plane: 88, rot: 0 },
  shoulderR: { elev: 128, plane: 88, rot: 0 },
  elbowL: 10,
  elbowR: 10,
  wristL: { flex: -40, dev: 0, pron: 60 },
  wristR: { flex: -40, dev: 0, pron: 60 },
  fingersL: 0.1,
  fingersR: 0.1,
}));

export const S_forwardFoldLockedKnees: PoseState = F('S_forwardFoldLockedKnees', pose(S_forwardFold, {
  root: { pitch: 80 },
  hipL: { elev: 80, plane: 90, rot: 0 },
  hipR: { elev: 80, plane: 90, rot: 0 },
  kneeL: -3,
  kneeR: -3,
  spine: { flex: 30, side: 0, twist: 0 },
  chest: { flex: 30, side: 0, twist: 0 },
  neck: { flex: -14, side: 0, twist: 0 },
  shoulderL: { elev: 112, plane: 88, rot: 0 },
  shoulderR: { elev: 112, plane: 88, rot: 0 },
}));

// Chair
export const S_chair: PoseState = F('S_chair', pose(S_mountain, armsOverhead, {
  root: { pitch: 34, z: -0.08 },
  hipL: { elev: 88, plane: 90, rot: 0 },
  hipR: { elev: 88, plane: 90, rot: 0 },
  kneeL: 82,
  kneeR: 82,
  ankleL: { flex: 28, inv: 0 },
  ankleR: { flex: 28, inv: 0 },
  spine: { flex: -6, side: 0, twist: 0 },
  chest: { flex: -4, side: 0, twist: 0 },
  shoulderL: { elev: 160, plane: 90, rot: 0 },
  shoulderR: { elev: 160, plane: 90, rot: 0 },
  neck: { flex: -6, side: 0, twist: 0 },
}));

export const S_chairKneesForward: PoseState = F('S_chairKneesForward', pose(S_chair, {
  root: { pitch: 10, z: 0.05 },
  hipL: { elev: 58, plane: 90, rot: 0 },
  hipR: { elev: 58, plane: 90, rot: 0 },
  kneeL: 92,
  kneeR: 92,
  ankleL: { flex: 42, inv: 0 },
  ankleR: { flex: 42, inv: 0 },
}));

export const S_chairArched: PoseState = F('S_chairArched', pose(S_chair, {
  root: { pitch: 46 },
  spine: { flex: -20, side: 0, twist: 0 },
  chest: { flex: -8, side: 0, twist: 0 },
  hipL: { elev: 96, plane: 90, rot: 0 },
  hipR: { elev: 96, plane: 90, rot: 0 },
  clavL: { elev: 24, prot: 0 },
  clavR: { elev: 24, prot: 0 },
}));

// Tree (standing on the right leg, left foot on the inner right thigh)
export const S_treePrep: PoseState = F('S_treePrep', pose(S_prayer, {
  hipL: { elev: 34, plane: 55, rot: 50 },
  kneeL: 95,
  ankleL: { flex: -20, inv: 0 },
  hipR: { elev: 2, plane: 0, rot: 0 },
  plant: { footR: true },
}));

export const S_tree: PoseState = F('S_tree', pose(S_prayer, {
  root: { x: 0.03, roll: -1 },
  hipL: { elev: 58, plane: 22, rot: 62 },
  kneeL: 138,
  ankleL: { flex: -24, inv: 10 },
  hipR: { elev: 3, plane: 180, rot: 0 },
  kneeR: 2,
  plant: { footR: true },
}));

export const S_treeArms: PoseState = F('S_treeArms', pose(S_tree, armsOverhead, {
  shoulderL: { elev: 168, plane: 80, rot: 0 },
  shoulderR: { elev: 168, plane: 80, rot: 0 },
}));

export const S_treeHipOut: PoseState = F('S_treeHipOut', pose(S_tree, {
  root: { x: 0.07, roll: -7 },
  spine: { flex: 0, side: 6, twist: 0 },
  hipR: { elev: 9, plane: 180, rot: 0 },
}));

export const S_treeOnKnee: PoseState = F('S_treeOnKnee', pose(S_tree, {
  hipL: { elev: 40, plane: 30, rot: 45 },
  kneeL: 100,
  ankleL: { flex: -25, inv: 5 },
}));

// Warrior II (facing +X, left leg forward toward -Z... authored with yaw 90)
export const S_wideStance: PoseState = F('S_wideStance', pose(S_mountain, {
  root: { yaw: 90 },
  hipL: { elev: 26, plane: 0, rot: 30 },
  hipR: { elev: 26, plane: 0, rot: -8 },
  ankleL: { flex: 0, inv: -14 },
  ankleR: { flex: 0, inv: -18 },
  shoulderL: { elev: 10, plane: 0, rot: 0 },
  shoulderR: { elev: 10, plane: 0, rot: 0 },
}));

export const S_wideStanceArms: PoseState = F('S_wideStanceArms', pose(S_wideStance, armsT));

export const S_warrior2: PoseState = F('S_warrior2', pose(S_wideStanceArms, {
  // Pelvis semi-open (turned ~30° toward the front leg), chest counter-rotates to face the long edge.
  root: { yaw: 120, x: 0, z: 0 },
  spine: { flex: 0, side: 0, twist: -14 },
  chest: { flex: 0, side: 0, twist: -16 },
  hipL: { elev: 80, plane: 35, rot: 40 },
  kneeL: 82,
  ankleL: { flex: 8, inv: -8 },
  hipR: { elev: 35, plane: -35, rot: -10 },
  ankleR: { flex: 20, inv: -20 },
  neck: { flex: 0, side: 0, twist: 62 },
  head: { flex: -2, side: 0, twist: 8 },
}));

export const S_warrior2KneeIn: PoseState = F('S_warrior2KneeIn', pose(S_warrior2, {
  hipL: { elev: 74, plane: 30, rot: 20 },
}));

export const S_warrior2Leaning: PoseState = F('S_warrior2Leaning', pose(S_warrior2, {
  spine: { flex: 0, side: 14, twist: 0 },
  chest: { flex: 0, side: 6, twist: 0 },
  root: { roll: 6 },
}));

export const S_warrior2Shrug: PoseState = F('S_warrior2Shrug', pose(S_warrior2, {
  clavL: { elev: 22, prot: 6 },
  clavR: { elev: 22, prot: 6 },
  shoulderL: { elev: 98, plane: 0, rot: 0 },
  shoulderR: { elev: 98, plane: 0, rot: 0 },
}));

// Triangle
export const S_triangle: PoseState = F('S_triangle', pose(S_wideStanceArms, {
  root: { yaw: 90, roll: 52 },
  hipL: { elev: 66, plane: 20, rot: 40 },
  hipR: { elev: 0, plane: 0, rot: -10 },
  kneeL: 2,
  kneeR: 0,
  ankleL: { flex: 0, inv: -10 },
  ankleR: { flex: 10, inv: -24 },
  spine: { flex: 0, side: 10, twist: -6 },
  chest: { flex: 0, side: 10, twist: -12 },
  shoulderL: { elev: 84, plane: 0, rot: 0 },
  shoulderR: { elev: 94, plane: 0, rot: 0 },
  neck: { flex: 0, side: 0, twist: -32 },
  head: { flex: 0, side: 0, twist: -10 },
}));

export const S_triangleCollapsed: PoseState = F('S_triangleCollapsed', pose(S_triangle, {
  root: { roll: 46 },
  spine: { flex: 22, side: 14, twist: 4 },
  chest: { flex: 18, side: 12, twist: 10 },
  neck: { flex: 6, side: 0, twist: 0 },
  shoulderR: { elev: 70, plane: 10, rot: 0 },
}));

// Extended side angle
export const S_sideAngle: PoseState = F('S_sideAngle', pose(S_warrior2, {
  root: { roll: 54 },
  spine: { flex: 0, side: 12, twist: -6 },
  chest: { flex: 0, side: 8, twist: -14 },
  shoulderL: { elev: 34, plane: 30, rot: 0 },
  elbowL: 72,
  wristL: { flex: 10, dev: 0, pron: 70 },
  shoulderR: { elev: 162, plane: 20, rot: 0 },
  neck: { flex: 0, side: 0, twist: -30 },
  head: { flex: 0, side: 0, twist: -10 },
}));

// Warrior I
export const S_lungeStance: PoseState = F('S_lungeStance', pose(S_mountain, {
  root: { z: 0 },
  hipL: { elev: 30, plane: 92, rot: 0 },
  hipR: { elev: 28, plane: -90, rot: 40 },
  ankleR: { flex: 24, inv: -8 },
  ankleL: { flex: -6, inv: 0 },
}));

export const S_warrior1: PoseState = F('S_warrior1', pose(S_mountain, armsOverhead, {
  root: { pitch: -2, z: 0 },
  hipL: { elev: 74, plane: 92, rot: 2 },
  kneeL: 80,
  ankleL: { flex: 12, inv: 0 },
  hipR: { elev: 36, plane: -86, rot: 34 },
  kneeR: 0,
  ankleR: { flex: 28, inv: -14 },
  chest: { flex: -6, side: 0, twist: 0 },
  head: { flex: -8, side: 0, twist: 0 },
}));

export const S_warrior1KneeOver: PoseState = F('S_warrior1KneeOver', pose(S_warrior1, {
  root: { pitch: -2 },
  hipL: { elev: 80, plane: 92, rot: 0 },
  kneeL: 108,
  ankleL: { flex: 40, inv: 0 },
  hipR: { elev: 46, plane: -86, rot: 34 },
}));

export const S_warrior1Arched: PoseState = F('S_warrior1Arched', pose(S_warrior1, {
  spine: { flex: -22, side: 0, twist: 0 },
  root: { pitch: -10 },
  neck: { flex: -16, side: 0, twist: 0 },
}));

// Warrior III (standing on the left leg)
export const S_warrior3: PoseState = F('S_warrior3', pose(S_mountain, armsOverhead, {
  root: { pitch: 86, z: -0.15 },
  hipL: { elev: 88, plane: 90, rot: 0 },
  kneeL: 4,
  hipR: { elev: 2, plane: 90, rot: 0 },
  kneeR: 0,
  ankleR: { flex: 10, inv: 0 },
  shoulderL: { elev: 176, plane: 90, rot: 0 },
  shoulderR: { elev: 176, plane: 90, rot: 0 },
  neck: { flex: -8, side: 0, twist: 0 },
  plant: { footL: true },
}));

export const S_warrior3HipOpen: PoseState = F('S_warrior3HipOpen', pose(S_warrior3, {
  root: { turn: -16 },
  hipR: { elev: 10, plane: -70, rot: 30 },
}));

// Half moon (standing on the left leg, left hand down, chest opening to the right)
export const S_halfMoon: PoseState = F('S_halfMoon', pose(S_mountain, {
  root: { pitch: 86, turn: -78, z: -0.1 },
  hipL: { elev: 84, plane: 64, rot: 10 },
  kneeL: 4,
  hipR: { elev: 14, plane: 10, rot: 0 },
  kneeR: 0,
  ankleR: { flex: 12, inv: 0 },
  shoulderL: { elev: 90, plane: 0, rot: 0 },
  shoulderR: { elev: 90, plane: 0, rot: 0 },
  wristL: flatHand(80),
  neck: { flex: 0, side: 0, twist: -40 },
  plant: { footL: true, handL: true },
}));

// Dancer (standing on the left leg, right hand holding the right foot)
export const S_dancer: PoseState = F('S_dancer', pose(S_mountain, {
  root: { pitch: 42, z: -0.05 },
  hipL: { elev: 42, plane: 90, rot: 0 },
  kneeL: 4,
  hipR: { elev: 26, plane: -96, rot: 0 },
  kneeR: 112,
  ankleR: { flex: -30, inv: 0 },
  spine: { flex: -14, side: 0, twist: 0 },
  chest: { flex: -8, side: 0, twist: 0 },
  shoulderL: { elev: 150, plane: 88, rot: 0 },
  shoulderR: { elev: 60, plane: -86, rot: 70 },
  elbowR: 12,
  elbowL: 4,
  fingersR: 0.7,
  neck: { flex: -14, side: 0, twist: 0 },
  plant: { footL: true },
}));

// Wide-legged forward fold (facing +Z, legs wide along X)
export const S_wideFoldStance: PoseState = F('S_wideFoldStance', pose(S_mountain, {
  hipL: { elev: 24, plane: 0, rot: 0 },
  hipR: { elev: 24, plane: 0, rot: 0 },
  ankleL: { flex: 0, inv: -22 },
  ankleR: { flex: 0, inv: -22 },
  shoulderL: { elev: 20, plane: -40, rot: 0 },
  shoulderR: { elev: 20, plane: -40, rot: 0 },
}));

export const S_wideFold: PoseState = F('S_wideFold', pose(S_wideFoldStance, {
  root: { pitch: 100, z: -0.08 },
  hipL: { elev: 102, plane: 74, rot: 6 },
  hipR: { elev: 102, plane: 74, rot: 6 },
  kneeL: 4,
  kneeR: 4,
  spine: { flex: 12, side: 0, twist: 0 },
  chest: { flex: 12, side: 0, twist: 0 },
  neck: { flex: 10, side: 0, twist: 0 },
  shoulderL: { elev: 112, plane: 80, rot: 0 },
  shoulderR: { elev: 112, plane: 80, rot: 0 },
  elbowL: 30,
  elbowR: 30,
  wristL: flatHand(70),
  wristR: flatHand(70),
  plant: { handL: true, handR: true },
}));

// Garland squat
export const S_garland: PoseState = F('S_garland', pose(S_prayer, {
  root: { pitch: 26, z: -0.05 },
  hipL: { elev: 118, plane: 52, rot: 26 },
  hipR: { elev: 118, plane: 52, rot: 26 },
  kneeL: 142,
  kneeR: 142,
  ankleL: { flex: 34, inv: -6 },
  ankleR: { flex: 34, inv: -6 },
  spine: { flex: -8, side: 0, twist: 0 },
  chest: { flex: -4, side: 0, twist: 0 },
  shoulderL: { elev: 40, plane: 50, rot: -50 },
  shoulderR: { elev: 40, plane: 50, rot: -50 },
  elbowL: 100,
  elbowR: 100,
  neck: { flex: -10, side: 0, twist: 0 },
}));

// ---------------------------------------------------------------- all fours family

export const S_tabletop: PoseState = F('S_tabletop', pose(N, {
  root: { pitch: 90, z: -0.28 },
  hipL: { elev: 90, plane: 90, rot: 0 },
  hipR: { elev: 90, plane: 90, rot: 0 },
  kneeL: 90,
  kneeR: 90,
  ankleL: { flex: -62, inv: 0 },
  ankleR: { flex: -62, inv: 0 },
  shoulderL: { elev: 90, plane: 90, rot: 0 },
  shoulderR: { elev: 90, plane: 90, rot: 0 },
  elbowL: 2,
  elbowR: 2,
  wristL: flatHand(),
  wristR: flatHand(),
  fingersL: 0,
  fingersR: 0,
  neck: { flex: -4, side: 0, twist: 0 },
  head: { flex: -4, side: 0, twist: 0 },
  plant: { handL: true, handR: true },
}));

export const S_cat: PoseState = F('S_cat', pose(S_tabletop, {
  root: { pitch: 78 },
  hipL: { elev: 78, plane: 90, rot: 0 },
  hipR: { elev: 78, plane: 90, rot: 0 },
  spine: { flex: 18, side: 0, twist: 0 },
  chest: { flex: 24, side: 0, twist: 0 },
  neck: { flex: 22, side: 0, twist: 0 },
  head: { flex: 12, side: 0, twist: 0 },
  shoulderL: { elev: 120, plane: 90, rot: 0 },
  shoulderR: { elev: 120, plane: 90, rot: 0 },
  clavL: { elev: 0, prot: 16 },
  clavR: { elev: 0, prot: 16 },
}));

export const S_cow: PoseState = F('S_cow', pose(S_tabletop, {
  root: { pitch: 100 },
  hipL: { elev: 100, plane: 90, rot: 0 },
  hipR: { elev: 100, plane: 90, rot: 0 },
  spine: { flex: -16, side: 0, twist: 0 },
  chest: { flex: -14, side: 0, twist: 0 },
  neck: { flex: -18, side: 0, twist: 0 },
  head: { flex: -10, side: 0, twist: 0 },
  shoulderL: { elev: 70, plane: 90, rot: 0 },
  shoulderR: { elev: 70, plane: 90, rot: 0 },
  clavL: { elev: 0, prot: -10 },
  clavR: { elev: 0, prot: -10 },
}));

export const S_cowNeckCrank: PoseState = F('S_cowNeckCrank', pose(S_cow, {
  neck: { flex: -34, side: 0, twist: 0 },
  head: { flex: -24, side: 0, twist: 0 },
}));

export const S_cowShoulderSink: PoseState = F('S_cowShoulderSink', pose(S_cow, {
  clavL: { elev: 14, prot: -18 },
  clavR: { elev: 14, prot: -18 },
  neck: { flex: -6, side: 0, twist: 0 },
}));

export const S_catElbowsBent: PoseState = F('S_catElbowsBent', pose(S_cat, {
  elbowL: 24,
  elbowR: 24,
  shoulderL: { elev: 108, plane: 90, rot: 0 },
  shoulderR: { elev: 108, plane: 90, rot: 0 },
}));

// Thread the needle (left arm threads under, left shoulder down)
export const S_threadNeedle: PoseState = F('S_threadNeedle', pose(S_tabletop, {
  root: { pitch: 92, turn: -8 },
  spine: { flex: 4, side: 0, twist: -16 },
  chest: { flex: 4, side: -6, twist: -44 },
  neck: { flex: 0, side: 0, twist: -26 },
  head: { flex: 0, side: -10, twist: -10 },
  shoulderL: { elev: 96, plane: 154, rot: 70 },
  elbowL: 4,
  wristL: { flex: 0, dev: 0, pron: -70 },
  shoulderR: { elev: 136, plane: 80, rot: 0 },
  elbowR: 36,
  wristR: flatHand(60),
  plant: { handR: true },
}));

// Child's pose
export const S_kneelHeels: PoseState = F('S_kneelHeels', pose(N, {
  root: { pitch: 4, z: -0.15 },
  hipL: { elev: 96, plane: 86, rot: 0 },
  hipR: { elev: 96, plane: 86, rot: 0 },
  kneeL: 160,
  kneeR: 160,
  ankleL: { flex: -62, inv: 0 },
  ankleR: { flex: -62, inv: 0 },
  shoulderL: { elev: 30, plane: 85, rot: 0 },
  shoulderR: { elev: 30, plane: 85, rot: 0 },
  elbowL: 30,
  elbowR: 30,
  wristL: { flex: -20, dev: 0, pron: 90 },
  wristR: { flex: -20, dev: 0, pron: 90 },
}));

export const S_child: PoseState = F('S_child', pose(S_kneelHeels, {
  root: { pitch: 62, z: -0.25 },
  hipL: { elev: 140, plane: 74, rot: 4 },
  hipR: { elev: 140, plane: 74, rot: 4 },
  kneeL: 162,
  kneeR: 162,
  spine: { flex: 26, side: 0, twist: 0 },
  chest: { flex: 22, side: 0, twist: 0 },
  neck: { flex: 6, side: 0, twist: 0 },
  head: { flex: 4, side: 0, twist: 0 },
  shoulderL: { elev: 168, plane: 86, rot: 0 },
  shoulderR: { elev: 168, plane: 86, rot: 0 },
  elbowL: 12,
  elbowR: 12,
  wristL: { flex: -20, dev: 0, pron: 90 },
  wristR: { flex: -20, dev: 0, pron: 90 },
  fingersL: 0,
  fingersR: 0,
}));

export const S_childArmsBack: PoseState = F('S_childArmsBack', pose(S_child, {
  shoulderL: { elev: 12, plane: -60, rot: -40 },
  shoulderR: { elev: 12, plane: -60, rot: -40 },
  elbowL: 6,
  elbowR: 6,
  wristL: { flex: 0, dev: 0, pron: -80 },
  wristR: { flex: 0, dev: 0, pron: -80 },
}));

export const S_childHipsHigh: PoseState = F('S_childHipsHigh', pose(S_child, {
  root: { pitch: 80 },
  hipL: { elev: 120, plane: 80, rot: 0 },
  hipR: { elev: 120, plane: 80, rot: 0 },
  kneeL: 128,
  kneeR: 128,
  spine: { flex: 10, side: 0, twist: 0 },
  neck: { flex: -10, side: 0, twist: 0 },
  clavL: { elev: 20, prot: 0 },
  clavR: { elev: 20, prot: 0 },
}));

// Extended puppy
export const S_puppy: PoseState = F('S_puppy', pose(S_tabletop, {
  root: { pitch: 122, z: -0.35 },
  hipL: { elev: 120, plane: 90, rot: 0 },
  hipR: { elev: 120, plane: 90, rot: 0 },
  spine: { flex: -10, side: 0, twist: 0 },
  chest: { flex: -10, side: 0, twist: 0 },
  neck: { flex: 10, side: 0, twist: 0 },
  head: { flex: 0, side: 0, twist: 0 },
  shoulderL: { elev: 170, plane: 90, rot: 10 },
  shoulderR: { elev: 170, plane: 90, rot: 10 },
  elbowL: 4,
  elbowR: 4,
  wristL: flatHand(20),
  wristR: flatHand(20),
  plant: { handL: false, handR: false, footL: false, footR: false },
}));

// Downward-facing dog
export const S_downDog: PoseState = F('S_downDog', pose(S_tabletop, {
  root: { pitch: 136, z: -0.08 },
  hipL: { elev: 92, plane: 90, rot: 0 },
  hipR: { elev: 92, plane: 90, rot: 0 },
  kneeL: 6,
  kneeR: 6,
  ankleL: { flex: 24, inv: 0 },
  ankleR: { flex: 24, inv: 0 },
  toesL: 10,
  toesR: 10,
  spine: { flex: -6, side: 0, twist: 0 },
  chest: { flex: -4, side: 0, twist: 0 },
  neck: { flex: 6, side: 0, twist: 0 },
  head: { flex: 10, side: 0, twist: 0 },
  clavL: { elev: 14, prot: 0 },
  clavR: { elev: 14, prot: 0 },
  shoulderL: { elev: 172, plane: 90, rot: 14 },
  shoulderR: { elev: 172, plane: 90, rot: 14 },
  elbowL: 2,
  elbowR: 2,
  wristL: flatHand(46),
  wristR: flatHand(46),
  plant: { handL: true, handR: true, footL: true, footR: true },
}));

export const S_downDogBentKnees: PoseState = F('S_downDogBentKnees', pose(S_downDog, {
  root: { pitch: 142 },
  hipL: { elev: 118, plane: 90, rot: 0 },
  hipR: { elev: 118, plane: 90, rot: 0 },
  kneeL: 42,
  kneeR: 42,
  ankleL: { flex: 20, inv: 0 },
  ankleR: { flex: 20, inv: 0 },
  spine: { flex: -10, side: 0, twist: 0 },
}));

export const S_downDogRounded: PoseState = F('S_downDogRounded', pose(S_downDog, {
  root: { pitch: 112 },
  hipL: { elev: 72, plane: 90, rot: 0 },
  hipR: { elev: 72, plane: 90, rot: 0 },
  kneeL: 0,
  kneeR: 0,
  spine: { flex: 20, side: 0, twist: 0 },
  chest: { flex: 18, side: 0, twist: 0 },
  shoulderL: { elev: 136, plane: 90, rot: 0 },
  shoulderR: { elev: 136, plane: 90, rot: 0 },
  neck: { flex: 14, side: 0, twist: 0 },
}));

export const S_downDogHeelsForced: PoseState = F('S_downDogHeelsForced', pose(S_downDog, {
  root: { pitch: 126, z: -0.02 },
  hipL: { elev: 74, plane: 90, rot: 0 },
  hipR: { elev: 74, plane: 90, rot: 0 },
  kneeL: -2,
  kneeR: -2,
  ankleL: { flex: 34, inv: 0 },
  ankleR: { flex: 34, inv: 0 },
  spine: { flex: 16, side: 0, twist: 0 },
  chest: { flex: 12, side: 0, twist: 0 },
}));

export const S_downDogShoulderCollapse: PoseState = F('S_downDogShoulderCollapse', pose(S_downDog, {
  clavL: { elev: 30, prot: -10 },
  clavR: { elev: 30, prot: -10 },
  chest: { flex: -18, side: 0, twist: 0 },
  spine: { flex: -12, side: 0, twist: 0 },
  neck: { flex: -16, side: 0, twist: 0 },
  head: { flex: -12, side: 0, twist: 0 },
  shoulderL: { elev: 180, plane: 90, rot: 0 },
  shoulderR: { elev: 180, plane: 90, rot: 0 },
}));

// Plank family
export const S_plank: PoseState = F('S_plank', pose(S_tabletop, {
  root: { pitch: 76, z: -0.3 },
  hipL: { elev: 2, plane: 90, rot: 0 },
  hipR: { elev: 2, plane: 90, rot: 0 },
  kneeL: 2,
  kneeR: 2,
  ankleL: { flex: 8, inv: 0 },
  ankleR: { flex: 8, inv: 0 },
  toesL: 72,
  toesR: 72,
  shoulderL: { elev: 76, plane: 90, rot: 0 },
  shoulderR: { elev: 76, plane: 90, rot: 0 },
  neck: { flex: -6, side: 0, twist: 0 },
  head: { flex: -6, side: 0, twist: 0 },
  plant: { handL: true, handR: true },
}));

export const S_plankSagging: PoseState = F('S_plankSagging', pose(S_plank, {
  root: { pitch: 68 },
  hipL: { elev: 14, plane: -90, rot: 0 },
  hipR: { elev: 14, plane: -90, rot: 0 },
  spine: { flex: -16, side: 0, twist: 0 },
  chest: { flex: -2, side: 0, twist: 0 },
  shoulderL: { elev: 66, plane: 90, rot: 0 },
  shoulderR: { elev: 66, plane: 90, rot: 0 },
}));

export const S_plankPiked: PoseState = F('S_plankPiked', pose(S_plank, {
  root: { pitch: 98 },
  hipL: { elev: 34, plane: 90, rot: 0 },
  hipR: { elev: 34, plane: 90, rot: 0 },
  shoulderL: { elev: 98, plane: 90, rot: 0 },
  shoulderR: { elev: 98, plane: 90, rot: 0 },
}));

export const S_plankKnees: PoseState = F('S_plankKnees', pose(S_plank, {
  root: { pitch: 82 },
  hipL: { elev: 6, plane: 90, rot: 0 },
  hipR: { elev: 6, plane: 90, rot: 0 },
  kneeL: 96,
  kneeR: 96,
  ankleL: { flex: -50, inv: 0 },
  ankleR: { flex: -50, inv: 0 },
  toesL: 0,
  toesR: 0,
  shoulderL: { elev: 82, plane: 90, rot: 0 },
  shoulderR: { elev: 82, plane: 90, rot: 0 },
}));

export const S_chaturanga: PoseState = F('S_chaturanga', pose(S_plank, {
  root: { pitch: 86, z: -0.2 },
  shoulderL: { elev: 26, plane: 88, rot: 0 },
  shoulderR: { elev: 26, plane: 88, rot: 0 },
  elbowL: 88,
  elbowR: 88,
  clavL: { elev: 0, prot: -6 },
  clavR: { elev: 0, prot: -6 },
}));

export const S_chaturangaLow: PoseState = F('S_chaturangaLow', pose(S_chaturanga, {
  shoulderL: { elev: 10, plane: 60, rot: 0 },
  shoulderR: { elev: 10, plane: 60, rot: 0 },
  elbowL: 112,
  elbowR: 112,
  clavL: { elev: 4, prot: 18 },
  clavR: { elev: 4, prot: 18 },
  root: { pitch: 90 },
  neck: { flex: -16, side: 0, twist: 0 },
}));

export const S_chaturangaElbowsOut: PoseState = F('S_chaturangaElbowsOut', pose(S_chaturanga, {
  shoulderL: { elev: 40, plane: 20, rot: -30 },
  shoulderR: { elev: 40, plane: 20, rot: -30 },
}));

// Side plank on the left hand (body's left side down, chest facing -X)
export const S_sidePlank: PoseState = F('S_sidePlank', pose(S_plank, {
  root: { pitch: 72, turn: -88, z: -0.2 },
  shoulderL: { elev: 86, plane: 0, rot: 0 },
  shoulderR: { elev: 92, plane: 0, rot: 0 },
  wristL: flatHand(80),
  wristR: { flex: 0, dev: 0, pron: 0 },
  hipL: { elev: 2, plane: 0, rot: 0 },
  hipR: { elev: 2, plane: 0, rot: 0 },
  ankleL: { flex: 4, inv: -20 },
  ankleR: { flex: 4, inv: 10 },
  toesL: 0,
  toesR: 0,
  neck: { flex: 0, side: 0, twist: -20 },
  plant: { handL: true },
}));

export const S_sidePlankHipDrop: PoseState = F('S_sidePlankHipDrop', pose(S_sidePlank, {
  spine: { flex: 0, side: 16, twist: 0 },
  root: { roll: 0 },
  shoulderL: { elev: 74, plane: 0, rot: 0 },
}));

// Upward dog
export const S_upDog: PoseState = F('S_upDog', pose(S_plank, {
  root: { pitch: 92, z: -0.25 },
  hipL: { elev: 6, plane: -90, rot: 0 },
  hipR: { elev: 6, plane: -90, rot: 0 },
  spine: { flex: -22, side: 0, twist: 0 },
  chest: { flex: -16, side: 0, twist: 0 },
  neck: { flex: -10, side: 0, twist: 0 },
  head: { flex: -4, side: 0, twist: 0 },
  ankleL: { flex: -70, inv: 0 },
  ankleR: { flex: -70, inv: 0 },
  toesL: 0,
  toesR: 0,
  shoulderL: { elev: 54, plane: 90, rot: 10 },
  shoulderR: { elev: 54, plane: 90, rot: 10 },
  clavL: { elev: 0, prot: -10 },
  clavR: { elev: 0, prot: -10 },
}));

export const S_upDogCrunch: PoseState = F('S_upDogCrunch', pose(S_upDog, {
  spine: { flex: -34, side: 0, twist: 0 },
  chest: { flex: -4, side: 0, twist: 0 },
  clavL: { elev: 26, prot: 0 },
  clavR: { elev: 26, prot: 0 },
  neck: { flex: -30, side: 0, twist: 0 },
  head: { flex: -16, side: 0, twist: 0 },
}));

// ---------------------------------------------------------------- prone

export const S_prone: PoseState = F('S_prone', pose(N, {
  root: { pitch: 90, z: -0.1 },
  hipL: { elev: 2, plane: 0, rot: 0 },
  hipR: { elev: 2, plane: 0, rot: 0 },
  ankleL: { flex: -70, inv: 0 },
  ankleR: { flex: -70, inv: 0 },
  shoulderL: { elev: 30, plane: 60, rot: -10 },
  shoulderR: { elev: 30, plane: 60, rot: -10 },
  elbowL: 120,
  elbowR: 120,
  wristL: { flex: -20, dev: 0, pron: 90 },
  wristR: { flex: -20, dev: 0, pron: 90 },
  neck: { flex: -4, side: 0, twist: 0 },
  head: { flex: 0, side: 0, twist: 0 },
}));

export const S_sphinx: PoseState = F('S_sphinx', pose(S_prone, {
  spine: { flex: -12, side: 0, twist: 0 },
  chest: { flex: -10, side: 0, twist: 0 },
  shoulderL: { elev: 68, plane: 90, rot: 0 },
  shoulderR: { elev: 68, plane: 90, rot: 0 },
  elbowL: 92,
  elbowR: 92,
  wristL: { flex: 0, dev: 0, pron: 80 },
  wristR: { flex: 0, dev: 0, pron: 80 },
  neck: { flex: -6, side: 0, twist: 0 },
  head: { flex: -2, side: 0, twist: 0 },
}));

export const S_sphinxSlump: PoseState = F('S_sphinxSlump', pose(S_sphinx, {
  clavL: { elev: 26, prot: -4 },
  clavR: { elev: 26, prot: -4 },
  neck: { flex: -20, side: 0, twist: 0 },
  head: { flex: -10, side: 0, twist: 0 },
}));

export const S_cobraPrep: PoseState = F('S_cobraPrep', pose(S_prone, {
  shoulderL: { elev: 18, plane: 70, rot: 0 },
  shoulderR: { elev: 18, plane: 70, rot: 0 },
  elbowL: 118,
  elbowR: 118,
  wristL: flatHand(80),
  wristR: flatHand(80),
  plant: { handL: true, handR: true },
}));

export const S_cobra: PoseState = F('S_cobra', pose(S_cobraPrep, {
  spine: { flex: -18, side: 0, twist: 0 },
  chest: { flex: -18, side: 0, twist: 0 },
  neck: { flex: -6, side: 0, twist: 0 },
  head: { flex: -4, side: 0, twist: 0 },
  shoulderL: { elev: 28, plane: 84, rot: 0 },
  shoulderR: { elev: 28, plane: 84, rot: 0 },
  elbowL: 62,
  elbowR: 62,
  clavL: { elev: 0, prot: -10 },
  clavR: { elev: 0, prot: -10 },
}));

export const S_cobraCranked: PoseState = F('S_cobraCranked', pose(S_cobra, {
  spine: { flex: -30, side: 0, twist: 0 },
  chest: { flex: -18, side: 0, twist: 0 },
  neck: { flex: -30, side: 0, twist: 0 },
  head: { flex: -18, side: 0, twist: 0 },
  elbowL: 20,
  elbowR: 20,
  shoulderL: { elev: 50, plane: 84, rot: 0 },
  shoulderR: { elev: 50, plane: 84, rot: 0 },
  clavL: { elev: 26, prot: 0 },
  clavR: { elev: 26, prot: 0 },
}));

export const S_cobraElbowsOut: PoseState = F('S_cobraElbowsOut', pose(S_cobra, {
  shoulderL: { elev: 34, plane: 30, rot: -20 },
  shoulderR: { elev: 34, plane: 30, rot: -20 },
}));

export const S_locust: PoseState = F('S_locust', pose(S_prone, {
  spine: { flex: -14, side: 0, twist: 0 },
  chest: { flex: -12, side: 0, twist: 0 },
  neck: { flex: -2, side: 0, twist: 0 },
  hipL: { elev: 18, plane: -90, rot: 0 },
  hipR: { elev: 18, plane: -90, rot: 0 },
  ankleL: { flex: -60, inv: 0 },
  ankleR: { flex: -60, inv: 0 },
  shoulderL: { elev: 28, plane: -86, rot: -60 },
  shoulderR: { elev: 28, plane: -86, rot: -60 },
  elbowL: 2,
  elbowR: 2,
  wristL: { flex: 0, dev: 0, pron: 0 },
  wristR: { flex: 0, dev: 0, pron: 0 },
  clavL: { elev: 0, prot: -12 },
  clavR: { elev: 0, prot: -12 },
}));

export const S_locustNeck: PoseState = F('S_locustNeck', pose(S_locust, {
  neck: { flex: -32, side: 0, twist: 0 },
  head: { flex: -20, side: 0, twist: 0 },
}));

export const S_bowPrep: PoseState = F('S_bowPrep', pose(S_prone, {
  kneeL: 110,
  kneeR: 110,
  ankleL: { flex: 0, inv: 0 },
  ankleR: { flex: 0, inv: 0 },
  shoulderL: { elev: 46, plane: -88, rot: -40 },
  shoulderR: { elev: 46, plane: -88, rot: -40 },
  elbowL: 0,
  elbowR: 0,
  wristL: { flex: 0, dev: 0, pron: 0 },
  wristR: { flex: 0, dev: 0, pron: 0 },
  fingersL: 0.7,
  fingersR: 0.7,
}));

export const S_bow: PoseState = F('S_bow', pose(S_bowPrep, {
  spine: { flex: -24, side: 0, twist: 0 },
  chest: { flex: -18, side: 0, twist: 0 },
  neck: { flex: -6, side: 0, twist: 0 },
  hipL: { elev: 26, plane: -90, rot: 0 },
  hipR: { elev: 26, plane: -90, rot: 0 },
  kneeL: 102,
  kneeR: 102,
  shoulderL: { elev: 74, plane: -88, rot: -40 },
  shoulderR: { elev: 74, plane: -88, rot: -40 },
}));

// ---------------------------------------------------------------- kneeling

export const S_highKneel: PoseState = F('S_highKneel', pose(N, {
  root: { z: -0.05 },
  hipL: { elev: 2, plane: 0, rot: 0 },
  hipR: { elev: 2, plane: 0, rot: 0 },
  kneeL: 90,
  kneeR: 90,
  ankleL: { flex: -62, inv: 0 },
  ankleR: { flex: -62, inv: 0 },
}));

export const S_camelPrep: PoseState = F('S_camelPrep', pose(S_highKneel, {
  root: { pitch: -6 },
  hipL: { elev: 6, plane: -90, rot: 0 },
  hipR: { elev: 6, plane: -90, rot: 0 },
  chest: { flex: -14, side: 0, twist: 0 },
  shoulderL: { elev: 36, plane: -90, rot: -30 },
  shoulderR: { elev: 36, plane: -90, rot: -30 },
  elbowL: 80,
  elbowR: 80,
  wristL: { flex: -40, dev: 0, pron: 60 },
  wristR: { flex: -40, dev: 0, pron: 60 },
}));

export const S_camel: PoseState = F('S_camel', pose(S_highKneel, {
  root: { pitch: -16 },
  hipL: { elev: 16, plane: -90, rot: 0 },
  hipR: { elev: 16, plane: -90, rot: 0 },
  spine: { flex: -24, side: 0, twist: 0 },
  chest: { flex: -26, side: 0, twist: 0 },
  neck: { flex: -18, side: 0, twist: 0 },
  head: { flex: -10, side: 0, twist: 0 },
  shoulderL: { elev: 58, plane: -82, rot: -70 },
  shoulderR: { elev: 58, plane: -82, rot: -70 },
  elbowL: 2,
  elbowR: 2,
  wristL: { flex: -30, dev: 0, pron: 40 },
  wristR: { flex: -30, dev: 0, pron: 40 },
  ankleL: { flex: -40, inv: 0 },
  ankleR: { flex: -40, inv: 0 },
  toesL: 60,
  toesR: 60,
}));

export const S_camelHipsBack: PoseState = F('S_camelHipsBack', pose(S_camel, {
  root: { pitch: -34 },
  hipL: { elev: 34, plane: 90, rot: 0 },
  hipR: { elev: 34, plane: 90, rot: 0 },
  spine: { flex: -10, side: 0, twist: 0 },
  neck: { flex: -36, side: 0, twist: 0 },
}));

// Low lunge (left foot forward, right knee down)
export const S_lowLungePrep: PoseState = F('S_lowLungePrep', pose(N, {
  root: { pitch: 30, z: 0 },
  hipL: { elev: 100, plane: 92, rot: 0 },
  kneeL: 100,
  ankleL: { flex: 20, inv: 0 },
  hipR: { elev: 20, plane: -90, rot: 0 },
  kneeR: 96,
  ankleR: { flex: -60, inv: 0 },
  shoulderL: { elev: 34, plane: 80, rot: 0 },
  shoulderR: { elev: 34, plane: 80, rot: 0 },
  wristL: { flex: -20, dev: 0, pron: 70 },
  wristR: { flex: -20, dev: 0, pron: 70 },
}));

export const S_lowLunge: PoseState = F('S_lowLunge', pose(S_lowLungePrep, armsOverhead, {
  root: { pitch: -2, z: 0 },
  hipL: { elev: 70, plane: 92, rot: 0 },
  kneeL: 92,
  ankleL: { flex: 24, inv: 0 },
  hipR: { elev: 30, plane: -90, rot: 0 },
  kneeR: 84,
  ankleR: { flex: -64, inv: 0 },
  spine: { flex: -6, side: 0, twist: 0 },
  chest: { flex: -8, side: 0, twist: 0 },
  head: { flex: -10, side: 0, twist: 0 },
}));

export const S_lowLungeBananaBack: PoseState = F('S_lowLungeBananaBack', pose(S_lowLunge, {
  spine: { flex: -26, side: 0, twist: 0 },
  root: { pitch: 10 },
  neck: { flex: -20, side: 0, twist: 0 },
  clavL: { elev: 26, prot: 0 },
  clavR: { elev: 26, prot: 0 },
}));

// Pigeon prep (left shin forward)
export const S_pigeon: PoseState = F('S_pigeon', pose(N, {
  root: { pitch: 28, z: 0.05 },
  hipL: { elev: 110, plane: 54, rot: 70 },
  kneeL: 108,
  ankleL: { flex: 4, inv: 0 },
  hipR: { elev: 40, plane: -92, rot: 0 },
  kneeR: 4,
  ankleR: { flex: -66, inv: 0 },
  spine: { flex: -16, side: 0, twist: 0 },
  chest: { flex: -10, side: 0, twist: 0 },
  shoulderL: { elev: 24, plane: 60, rot: 0 },
  shoulderR: { elev: 24, plane: 60, rot: 0 },
  wristL: flatHand(70),
  wristR: flatHand(70),
  plant: { handL: true, handR: true },
}));

export const S_pigeonFold: PoseState = F('S_pigeonFold', pose(S_pigeon, {
  root: { pitch: 62 },
  hipL: { elev: 144, plane: 60, rot: 70 },
  hipR: { elev: 8, plane: -92, rot: 0 },
  spine: { flex: 16, side: 0, twist: 0 },
  chest: { flex: 12, side: 0, twist: 0 },
  neck: { flex: 6, side: 0, twist: 0 },
  shoulderL: { elev: 150, plane: 86, rot: 0 },
  shoulderR: { elev: 150, plane: 86, rot: 0 },
  elbowL: 70,
  elbowR: 70,
  wristL: { flex: -10, dev: 0, pron: 90 },
  wristR: { flex: -10, dev: 0, pron: 90 },
  plant: { handL: false, handR: false, footL: false, footR: false },
}));

// ---------------------------------------------------------------- seated

export const S_staff: PoseState = F('S_staff', pose(N, {
  root: { pitch: -2, z: -0.2 },
  hipL: { elev: 92, plane: 90, rot: 0 },
  hipR: { elev: 92, plane: 90, rot: 0 },
  ankleL: { flex: 12, inv: 0 },
  ankleR: { flex: 12, inv: 0 },
  shoulderL: { elev: 10, plane: -30, rot: 10 },
  shoulderR: { elev: 10, plane: -30, rot: 10 },
  elbowL: 2,
  elbowR: 2,
  wristL: flatHand(80),
  wristR: flatHand(80),
  plant: { handL: true, handR: true },
}));

export const S_staffSlump: PoseState = F('S_staffSlump', pose(S_staff, {
  root: { pitch: -18 },
  hipL: { elev: 76, plane: 90, rot: 0 },
  hipR: { elev: 76, plane: 90, rot: 0 },
  spine: { flex: 20, side: 0, twist: 0 },
  chest: { flex: 16, side: 0, twist: 0 },
  neck: { flex: -14, side: 0, twist: 0 },
  shoulderL: { elev: 18, plane: -60, rot: 10 },
  shoulderR: { elev: 18, plane: -60, rot: 10 },
}));

export const S_seatedFold: PoseState = F('S_seatedFold', pose(S_staff, {
  root: { pitch: 40 },
  hipL: { elev: 132, plane: 90, rot: 0 },
  hipR: { elev: 132, plane: 90, rot: 0 },
  kneeL: 6,
  kneeR: 6,
  spine: { flex: 14, side: 0, twist: 0 },
  chest: { flex: 14, side: 0, twist: 0 },
  neck: { flex: 6, side: 0, twist: 0 },
  shoulderL: { elev: 146, plane: 88, rot: 0 },
  shoulderR: { elev: 146, plane: 88, rot: 0 },
  elbowL: 16,
  elbowR: 16,
  wristL: { flex: 0, dev: 0, pron: 60 },
  wristR: { flex: 0, dev: 0, pron: 60 },
  plant: { handL: false, handR: false, footL: false, footR: false },
}));

export const S_seatedFoldRounded: PoseState = F('S_seatedFoldRounded', pose(S_seatedFold, {
  root: { pitch: 6 },
  hipL: { elev: 98, plane: 90, rot: 0 },
  hipR: { elev: 98, plane: 90, rot: 0 },
  spine: { flex: 34, side: 0, twist: 0 },
  chest: { flex: 34, side: 0, twist: 0 },
  neck: { flex: 22, side: 0, twist: 0 },
  shoulderL: { elev: 100, plane: 88, rot: 0 },
  shoulderR: { elev: 100, plane: 88, rot: 0 },
  kneeL: 0,
  kneeR: 0,
}));

export const S_easySeated: PoseState = F('S_easySeated', pose(N, {
  root: { pitch: 0, z: -0.15 },
  hipL: { elev: 96, plane: 42, rot: 70 },
  hipR: { elev: 94, plane: 42, rot: 70 },
  kneeL: 132,
  kneeR: 132,
  ankleL: { flex: -10, inv: 20 },
  ankleR: { flex: -10, inv: 20 },
  shoulderL: { elev: 30, plane: 50, rot: 20 },
  shoulderR: { elev: 30, plane: 50, rot: 20 },
  elbowL: 50,
  elbowR: 50,
  wristL: { flex: -6, dev: 0, pron: 50 },
  wristR: { flex: -6, dev: 0, pron: 50 },
  fingersL: 0.25,
  fingersR: 0.25,
}));

export const S_easySeatedSlump: PoseState = F('S_easySeatedSlump', pose(S_easySeated, {
  root: { pitch: -16 },
  spine: { flex: 18, side: 0, twist: 0 },
  chest: { flex: 18, side: 0, twist: 0 },
  neck: { flex: -10, side: 0, twist: 0 },
  head: { flex: 8, side: 0, twist: 0 },
  clavL: { elev: 0, prot: 16 },
  clavR: { elev: 0, prot: 16 },
}));

export const S_neckRelease: PoseState = F('S_neckRelease', pose(S_easySeated, {
  neck: { flex: 4, side: 26, twist: 0 },
  head: { flex: 0, side: 10, twist: 0 },
  shoulderR: { elev: 12, plane: 0, rot: 0 },
  elbowR: 4,
  wristR: { flex: 0, dev: 0, pron: 0 },
}));

export const S_neckReleaseShrug: PoseState = F('S_neckReleaseShrug', pose(S_neckRelease, {
  clavR: { elev: 20, prot: 4 },
  neck: { flex: 4, side: 38, twist: 0 },
  head: { flex: 0, side: 16, twist: 0 },
}));

export const S_seatedSideBend: PoseState = F('S_seatedSideBend', pose(S_easySeated, {
  spine: { flex: 0, side: -8, twist: 0 },
  chest: { flex: 0, side: -16, twist: 0 },
  neck: { flex: 0, side: -4, twist: 0 },
  shoulderL: { elev: 168, plane: 70, rot: 0 },
  elbowL: 8,
  wristL: { flex: 0, dev: 0, pron: 0 },
  shoulderR: { elev: 20, plane: 0, rot: 0 },
  elbowR: 30,
  wristR: flatHand(70),
  plant: { handR: true },
}));

export const S_seatedSideBendCollapse: PoseState = F('S_seatedSideBendCollapse', pose(S_seatedSideBend, {
  spine: { flex: 14, side: -10, twist: -8 },
  chest: { flex: 16, side: -14, twist: -10 },
  shoulderL: { elev: 140, plane: 110, rot: 0 },
  neck: { flex: 12, side: -6, twist: 0 },
}));

export const S_seatedTwist: PoseState = F('S_seatedTwist', pose(S_easySeated, {
  spine: { flex: 0, side: 0, twist: 14 },
  chest: { flex: 0, side: 0, twist: 22 },
  neck: { flex: 0, side: 0, twist: 18 },
  shoulderR: { elev: 40, plane: 112, rot: 0 },
  elbowR: 34,
  wristR: { flex: 10, dev: 0, pron: 60 },
  shoulderL: { elev: 26, plane: -60, rot: 10 },
  elbowL: 4,
  wristL: flatHand(80),
  plant: { handL: true },
}));

export const S_eagleArmsSeated: PoseState = F('S_eagleArmsSeated', pose(S_easySeated, {
  shoulderL: { elev: 84, plane: 118, rot: 0 },
  shoulderR: { elev: 92, plane: 112, rot: 0 },
  elbowL: 92,
  elbowR: 92,
  wristL: { flex: 0, dev: 0, pron: 0 },
  wristR: { flex: 0, dev: 0, pron: 0 },
  clavL: { elev: 0, prot: 14 },
  clavR: { elev: 0, prot: 14 },
  fingersL: 0,
  fingersR: 0,
}));

export const S_butterfly: PoseState = F('S_butterfly', pose(N, {
  root: { pitch: -2, z: -0.18 },
  hipL: { elev: 90, plane: 30, rot: 80 },
  hipR: { elev: 90, plane: 30, rot: 80 },
  kneeL: 130,
  kneeR: 130,
  ankleL: { flex: -12, inv: 34 },
  ankleR: { flex: -12, inv: 34 },
  shoulderL: { elev: 36, plane: 82, rot: 0 },
  shoulderR: { elev: 36, plane: 82, rot: 0 },
  elbowL: 20,
  elbowR: 20,
  wristL: { flex: 10, dev: 0, pron: 50 },
  wristR: { flex: 10, dev: 0, pron: 50 },
  fingersL: 0.6,
  fingersR: 0.6,
}));

export const S_butterflyForced: PoseState = F('S_butterflyForced', pose(S_butterfly, {
  root: { pitch: -18 },
  spine: { flex: 22, side: 0, twist: 0 },
  chest: { flex: 18, side: 0, twist: 0 },
  neck: { flex: -10, side: 0, twist: 0 },
  shoulderL: { elev: 26, plane: 40, rot: 0 },
  shoulderR: { elev: 26, plane: 40, rot: 0 },
  elbowL: 50,
  elbowR: 50,
}));

export const S_janu: PoseState = F('S_janu', pose(S_staff, {
  root: { pitch: 34, yaw: 0 },
  hipL: { elev: 124, plane: 90, rot: 0 },
  hipR: { elev: 92, plane: 30, rot: 60 },
  kneeR: 140,
  ankleR: { flex: -10, inv: 20 },
  kneeL: 4,
  spine: { flex: 12, side: 0, twist: 10 },
  chest: { flex: 14, side: 0, twist: 10 },
  neck: { flex: 6, side: 0, twist: 0 },
  shoulderL: { elev: 140, plane: 92, rot: 0 },
  shoulderR: { elev: 140, plane: 82, rot: 0 },
  elbowL: 20,
  elbowR: 20,
  wristL: { flex: 0, dev: 0, pron: 60 },
  wristR: { flex: 0, dev: 0, pron: 60 },
  plant: { handL: false, handR: false, footL: false, footR: false },
}));

export const S_januPrep: PoseState = F('S_januPrep', pose(S_janu, {
  root: { pitch: -2 },
  hipL: { elev: 92, plane: 90, rot: 0 },
  spine: { flex: 0, side: 0, twist: 12 },
  chest: { flex: -4, side: 0, twist: 10 },
  shoulderL: { elev: 168, plane: 90, rot: 0 },
  shoulderR: { elev: 168, plane: 90, rot: 0 },
  elbowL: 4,
  elbowR: 4,
}));

export const S_ardhaMatsy: PoseState = F('S_ardhaMatsy', pose(N, {
  root: { pitch: -2, z: -0.12 },
  hipR: { elev: 96, plane: 80, rot: 60 },
  kneeR: 140,
  ankleR: { flex: -20, inv: 10 },
  hipL: { elev: 112, plane: 104, rot: -6 },
  kneeL: 120,
  ankleL: { flex: 4, inv: 0 },
  spine: { flex: 0, side: 0, twist: 18 },
  chest: { flex: -2, side: 0, twist: 26 },
  neck: { flex: 0, side: 0, twist: 26 },
  shoulderR: { elev: 70, plane: 110, rot: -20 },
  elbowR: 84,
  wristR: { flex: 0, dev: 0, pron: 0 },
  shoulderL: { elev: 28, plane: -56, rot: 10 },
  elbowL: 6,
  wristL: flatHand(80),
  plant: { handL: true },
}));

export const S_boatPrep: PoseState = F('S_boatPrep', pose(S_staff, {
  root: { pitch: -24 },
  hipL: { elev: 120, plane: 90, rot: 0 },
  hipR: { elev: 120, plane: 90, rot: 0 },
  kneeL: 96,
  kneeR: 96,
  ankleL: { flex: -10, inv: 0 },
  ankleR: { flex: -10, inv: 0 },
  shoulderL: { elev: 64, plane: 90, rot: 0 },
  shoulderR: { elev: 64, plane: 90, rot: 0 },
  elbowL: 4,
  elbowR: 4,
  wristL: { flex: 0, dev: 0, pron: 0 },
  wristR: { flex: 0, dev: 0, pron: 0 },
  plant: { handL: false, handR: false, footL: false, footR: false },
}));

export const S_boat: PoseState = F('S_boat', pose(S_boatPrep, {
  root: { pitch: -34 },
  hipL: { elev: 102, plane: 90, rot: 0 },
  hipR: { elev: 102, plane: 90, rot: 0 },
  kneeL: 6,
  kneeR: 6,
  ankleL: { flex: -6, inv: 0 },
  ankleR: { flex: -6, inv: 0 },
  spine: { flex: 0, side: 0, twist: 0 },
  shoulderL: { elev: 58, plane: 90, rot: 0 },
  shoulderR: { elev: 58, plane: 90, rot: 0 },
}));

export const S_boatRounded: PoseState = F('S_boatRounded', pose(S_boatPrep, {
  root: { pitch: -50 },
  spine: { flex: 26, side: 0, twist: 0 },
  chest: { flex: 22, side: 0, twist: 0 },
  neck: { flex: 6, side: 0, twist: 0 },
  shoulderL: { elev: 30, plane: 90, rot: 0 },
  shoulderR: { elev: 30, plane: 90, rot: 0 },
}));

// ---------------------------------------------------------------- supine

export const S_supine: PoseState = F('S_supine', pose(N, {
  root: { pitch: -90, z: 0.2 },
  hipL: { elev: 4, plane: 0, rot: 20 },
  hipR: { elev: 4, plane: 0, rot: 20 },
  ankleL: { flex: -20, inv: 0 },
  ankleR: { flex: -20, inv: 0 },
  shoulderL: { elev: 14, plane: 0, rot: 30 },
  shoulderR: { elev: 14, plane: 0, rot: 30 },
  elbowL: 6,
  elbowR: 6,
  neck: { flex: 6, side: 0, twist: 0 },
}));

export const S_savasana: PoseState = F('S_savasana', pose(S_supine, {
  hipL: { elev: 10, plane: 0, rot: 34 },
  hipR: { elev: 10, plane: 0, rot: 34 },
  ankleL: { flex: -24, inv: 0 },
  ankleR: { flex: -24, inv: 0 },
  shoulderL: { elev: 24, plane: 0, rot: 80 },
  shoulderR: { elev: 24, plane: 0, rot: 80 },
  elbowL: 10,
  elbowR: 10,
  wristL: { flex: 6, dev: 0, pron: 0 },
  wristR: { flex: 6, dev: 0, pron: 0 },
  fingersL: 0.3,
  fingersR: 0.3,
}));

export const S_savasanaTense: PoseState = F('S_savasanaTense', pose(S_savasana, {
  clavL: { elev: 20, prot: 8 },
  clavR: { elev: 20, prot: 8 },
  neck: { flex: -12, side: 0, twist: 0 },
  head: { flex: -6, side: 0, twist: 0 },
  shoulderL: { elev: 6, plane: 0, rot: 0 },
  shoulderR: { elev: 6, plane: 0, rot: 0 },
  fingersL: 0.85,
  fingersR: 0.85,
  hipL: { elev: 1, plane: 0, rot: 0 },
  hipR: { elev: 1, plane: 0, rot: 0 },
}));

export const S_hookLying: PoseState = F('S_hookLying', pose(S_supine, {
  hipL: { elev: 50, plane: 90, rot: 0 },
  hipR: { elev: 50, plane: 90, rot: 0 },
  kneeL: 100,
  kneeR: 100,
  ankleL: { flex: 4, inv: 0 },
  ankleR: { flex: 4, inv: 0 },
  shoulderL: { elev: 16, plane: 0, rot: 0 },
  shoulderR: { elev: 16, plane: 0, rot: 0 },
  plant: { footL: true, footR: true },
}));

export const S_bridge: PoseState = F('S_bridge', pose(S_hookLying, {
  root: { pitch: -118 },
  spine: { flex: 10, side: 0, twist: 0 },
  chest: { flex: 14, side: 0, twist: 0 },
  neck: { flex: 12, side: 0, twist: 0 },
  hipL: { elev: 4, plane: -90, rot: 0 },
  hipR: { elev: 4, plane: -90, rot: 0 },
  kneeL: 92,
  kneeR: 92,
  ankleL: { flex: 2, inv: 0 },
  ankleR: { flex: 2, inv: 0 },
  shoulderL: { elev: 14, plane: 0, rot: -20 },
  shoulderR: { elev: 14, plane: 0, rot: -20 },
  wristL: { flex: 0, dev: 0, pron: 60 },
  wristR: { flex: 0, dev: 0, pron: 60 },
}));

export const S_bridgeKneesOut: PoseState = F('S_bridgeKneesOut', pose(S_bridge, {
  hipL: { elev: 18, plane: 40, rot: 30 },
  hipR: { elev: 18, plane: 40, rot: 30 },
}));

export const S_bridgeLowBack: PoseState = F('S_bridgeLowBack', pose(S_bridge, {
  root: { pitch: -140 },
  spine: { flex: 26, side: 0, twist: 0 },
  hipL: { elev: 26, plane: -90, rot: 0 },
  hipR: { elev: 26, plane: -90, rot: 0 },
  kneeL: 82,
  kneeR: 82,
}));

export const S_kneesToChest: PoseState = F('S_kneesToChest', pose(S_supine, {
  hipL: { elev: 122, plane: 90, rot: 0 },
  hipR: { elev: 122, plane: 90, rot: 0 },
  kneeL: 128,
  kneeR: 128,
  ankleL: { flex: -10, inv: 0 },
  ankleR: { flex: -10, inv: 0 },
  shoulderL: { elev: 64, plane: 86, rot: 0 },
  shoulderR: { elev: 64, plane: 86, rot: 0 },
  elbowL: 72,
  elbowR: 72,
  fingersL: 0.5,
  fingersR: 0.5,
}));

export const S_kneesToChestNeck: PoseState = F('S_kneesToChestNeck', pose(S_kneesToChest, {
  neck: { flex: 34, side: 0, twist: 0 },
  spine: { flex: 14, side: 0, twist: 0 },
  chest: { flex: 12, side: 0, twist: 0 },
}));

export const S_supineTwist: PoseState = F('S_supineTwist', pose(S_supine, armsT, {
  root: { turn: 64 },
  spine: { flex: 0, side: 0, twist: -24 },
  chest: { flex: 0, side: 0, twist: -36 },
  neck: { flex: 6, side: 0, twist: -32 },
  hipL: { elev: 92, plane: 90, rot: 0 },
  hipR: { elev: 92, plane: 96, rot: 0 },
  kneeL: 92,
  kneeR: 92,
  shoulderL: { elev: 86, plane: 0, rot: 60 },
  shoulderR: { elev: 86, plane: 0, rot: 60 },
}));

export const S_supineTwistShoulderLift: PoseState = F('S_supineTwistShoulderLift', pose(S_supineTwist, {
  root: { turn: 80 },
  chest: { flex: 0, side: 0, twist: -16 },
  spine: { flex: 0, side: 0, twist: -16 },
}));

export const S_recliningButterfly: PoseState = F('S_recliningButterfly', pose(S_savasana, {
  hipL: { elev: 52, plane: 34, rot: 64 },
  hipR: { elev: 52, plane: 34, rot: 64 },
  kneeL: 132,
  kneeR: 132,
  ankleL: { flex: -10, inv: 30 },
  ankleR: { flex: -10, inv: 30 },
}));

export const S_happyBaby: PoseState = F('S_happyBaby', pose(S_supine, {
  hipL: { elev: 128, plane: 56, rot: 10 },
  hipR: { elev: 128, plane: 56, rot: 10 },
  kneeL: 92,
  kneeR: 92,
  ankleL: { flex: 14, inv: 0 },
  ankleR: { flex: 14, inv: 0 },
  shoulderL: { elev: 112, plane: 64, rot: 0 },
  shoulderR: { elev: 112, plane: 64, rot: 0 },
  elbowL: 10,
  elbowR: 10,
  fingersL: 0.7,
  fingersR: 0.7,
}));

export const S_wheelPrep: PoseState = F('S_wheelPrep', pose(S_hookLying, {
  shoulderL: { elev: 168, plane: 96, rot: 20 },
  shoulderR: { elev: 168, plane: 96, rot: 20 },
  elbowL: 140,
  elbowR: 140,
  wristL: { flex: -80, dev: 0, pron: 90 },
  wristR: { flex: -80, dev: 0, pron: 90 },
  plant: { footL: true, footR: true, handL: true, handR: true },
}));

export const S_wheel: PoseState = F('S_wheel', pose(S_wheelPrep, {
  root: { pitch: -105 },
  spine: { flex: -18, side: 0, twist: 0 },
  chest: { flex: -22, side: 0, twist: 0 },
  neck: { flex: -10, side: 0, twist: 0 },
  head: { flex: -10, side: 0, twist: 0 },
  hipL: { elev: 45, plane: -90, rot: 0 },
  hipR: { elev: 45, plane: -90, rot: 0 },
  kneeL: 100,
  kneeR: 100,
  ankleL: { flex: 10, inv: 0 },
  ankleR: { flex: 10, inv: 0 },
  shoulderL: { elev: 172, plane: 90, rot: 20 },
  shoulderR: { elev: 172, plane: 90, rot: 20 },
  elbowL: 6,
  elbowR: 6,
  wristL: flatHand(80),
  wristR: flatHand(80),
}));

// ---------------------------------------------------------------- arm balance

export const S_crowPrep: PoseState = F('S_crowPrep', pose(S_garland, {
  root: { pitch: 62 },
  hipL: { elev: 132, plane: 60, rot: 10 },
  hipR: { elev: 132, plane: 60, rot: 10 },
  kneeL: 136,
  kneeR: 136,
  ankleL: { flex: 10, inv: 0 },
  ankleR: { flex: 10, inv: 0 },
  spine: { flex: 16, side: 0, twist: 0 },
  chest: { flex: 12, side: 0, twist: 0 },
  shoulderL: { elev: 96, plane: 90, rot: 0 },
  shoulderR: { elev: 96, plane: 90, rot: 0 },
  elbowL: 30,
  elbowR: 30,
  wristL: flatHand(80),
  wristR: flatHand(80),
  neck: { flex: -18, side: 0, twist: 0 },
  plant: { handL: true, handR: true },
}));

export const S_crow: PoseState = F('S_crow', pose(S_crowPrep, {
  root: { pitch: 84, z: -0.08 },
  hipL: { elev: 136, plane: 64, rot: 10 },
  hipR: { elev: 136, plane: 64, rot: 10 },
  kneeL: 140,
  kneeR: 140,
  ankleL: { flex: -30, inv: 0 },
  ankleR: { flex: -30, inv: 0 },
  shoulderL: { elev: 98, plane: 90, rot: 0 },
  shoulderR: { elev: 98, plane: 90, rot: 0 },
  elbowL: 52,
  elbowR: 52,
  neck: { flex: -26, side: 0, twist: 0 },
}));


// ---------------------------------------------------------------- additional mistake demonstrations

export const S_mountainShrug: PoseState = F('S_mountainShrug', pose(S_mountain, {
  clavL: { elev: 24, prot: 6 },
  clavR: { elev: 24, prot: 6 },
  neck: { flex: -6, side: 0, twist: 0 },
  fingersL: 0.7,
  fingersR: 0.7,
}));

export const S_armsUpArched: PoseState = F('S_armsUpArched', pose(S_armsUp, {
  root: { pitch: 10 },
  spine: { flex: -20, side: 0, twist: 0 },
  hipL: { elev: 10, plane: 90, rot: 0 },
  hipR: { elev: 10, plane: 90, rot: 0 },
  head: { flex: -16, side: 0, twist: 0 },
}));

export const S_forwardFoldNeck: PoseState = F('S_forwardFoldNeck', pose(S_forwardFold, {
  neck: { flex: -32, side: 0, twist: 0 },
  head: { flex: -20, side: 0, twist: 0 },
  clavL: { elev: 18, prot: 0 },
  clavR: { elev: 18, prot: 0 },
}));

export const S_halfFoldNeck: PoseState = F('S_halfFoldNeck', pose(S_halfFold, {
  neck: { flex: -40, side: 0, twist: 0 },
  head: { flex: -22, side: 0, twist: 0 },
}));

export const S_chairShrug: PoseState = F('S_chairShrug', pose(S_chair, {
  clavL: { elev: 30, prot: 0 },
  clavR: { elev: 30, prot: 0 },
  neck: { flex: 6, side: 0, twist: 0 },
}));

export const S_sideAngleCollapsed: PoseState = F('S_sideAngleCollapsed', pose(S_sideAngle, {
  spine: { flex: 20, side: 12, twist: 6 },
  chest: { flex: 22, side: 8, twist: 10 },
  shoulderR: { elev: 120, plane: 60, rot: 0 },
  neck: { flex: 14, side: 0, twist: -10 },
}));

export const S_warrior3NeckCrank: PoseState = F('S_warrior3NeckCrank', pose(S_warrior3, {
  neck: { flex: -38, side: 0, twist: 0 },
  head: { flex: -20, side: 0, twist: 0 },
  clavL: { elev: 26, prot: 0 },
  clavR: { elev: 26, prot: 0 },
}));

export const S_halfMoonCollapsed: PoseState = F('S_halfMoonCollapsed', pose(S_halfMoon, {
  chest: { flex: 18, side: 0, twist: 20 },
  spine: { flex: 14, side: 0, twist: 10 },
  shoulderR: { elev: 60, plane: 40, rot: 0 },
}));

export const S_dancerCollapse: PoseState = F('S_dancerCollapse', pose(S_dancer, {
  root: { pitch: 64 },
  spine: { flex: 6, side: 0, twist: 0 },
  chest: { flex: 8, side: 0, twist: 0 },
  hipL: { elev: 66, plane: 90, rot: 0 },
  hipR: { elev: 10, plane: -60, rot: 30 },
}));

export const S_tabletopSag: PoseState = F('S_tabletopSag', pose(S_tabletop, {
  spine: { flex: -10, side: 0, twist: 0 },
  clavL: { elev: 22, prot: -14 },
  clavR: { elev: 22, prot: -14 },
  neck: { flex: -22, side: 0, twist: 0 },
  elbowL: -6,
  elbowR: -6,
}));

export const S_chaturangaSag: PoseState = F('S_chaturangaSag', pose(S_chaturanga, {
  root: { pitch: 80 },
  hipL: { elev: 12, plane: -90, rot: 0 },
  hipR: { elev: 12, plane: -90, rot: 0 },
  spine: { flex: -14, side: 0, twist: 0 },
}));

export const S_upDogShrug: PoseState = F('S_upDogShrug', pose(S_upDog, {
  clavL: { elev: 30, prot: 6 },
  clavR: { elev: 30, prot: 6 },
  chest: { flex: 0, side: 0, twist: 0 },
  neck: { flex: -6, side: 0, twist: 0 },
}));

export const S_lowLungeKneeOver: PoseState = F('S_lowLungeKneeOver', pose(S_lowLunge, {
  root: { z: 0.08 },
  hipL: { elev: 80, plane: 92, rot: 0 },
  kneeL: 118,
  ankleL: { flex: 40, inv: 0 },
}));

export const S_warrior1HeelUp: PoseState = F('S_warrior1HeelUp', pose(S_warrior1, {
  hipR: { elev: 30, plane: -88, rot: 0 },
  kneeR: 4,
  ankleR: { flex: -24, inv: 0 },
  toesR: 50,
}));

export const S_triangleKneeLocked: PoseState = F('S_triangleKneeLocked', pose(S_triangle, {
  kneeL: -6,
  root: { roll: 26 },
}));

export const S_garlandHeelsUp: PoseState = F('S_garlandHeelsUp', pose(S_garland, {
  ankleL: { flex: -10, inv: 0 },
  ankleR: { flex: -10, inv: 0 },
  toesL: 50,
  toesR: 50,
  spine: { flex: 16, side: 0, twist: 0 },
  chest: { flex: 12, side: 0, twist: 0 },
}));

export const S_wideFoldRounded: PoseState = F('S_wideFoldRounded', pose(S_wideFold, {
  root: { pitch: 80 },
  hipL: { elev: 84, plane: 74, rot: 6 },
  hipR: { elev: 84, plane: 74, rot: 6 },
  spine: { flex: 30, side: 0, twist: 0 },
  chest: { flex: 30, side: 0, twist: 0 },
  kneeL: -4,
  kneeR: -4,
}));

export const S_staffLean: PoseState = F('S_staffLean', pose(S_staff, {
  root: { pitch: -16 },
  hipL: { elev: 78, plane: 90, rot: 0 },
  hipR: { elev: 78, plane: 90, rot: 0 },
  shoulderL: { elev: 28, plane: -70, rot: 10 },
  shoulderR: { elev: 28, plane: -70, rot: 10 },
  clavL: { elev: 22, prot: 0 },
  clavR: { elev: 22, prot: 0 },
}));

export const S_childShoulders: PoseState = F('S_childShoulders', pose(S_child, {
  clavL: { elev: 30, prot: 0 },
  clavR: { elev: 30, prot: 0 },
  elbowL: 0,
  elbowR: 0,
}));

export const S_happyBabyNeck: PoseState = F('S_happyBabyNeck', pose(S_happyBaby, {
  neck: { flex: 36, side: 0, twist: 0 },
  spine: { flex: 16, side: 0, twist: 0 },
}));

export const S_puppySag: PoseState = F('S_puppySag', pose(S_puppy, {
  spine: { flex: -26, side: 0, twist: 0 },
  neck: { flex: -16, side: 0, twist: 0 },
  head: { flex: -12, side: 0, twist: 0 },
}));

export const S_crowHead: PoseState = F('S_crowHead', pose(S_crow, {
  neck: { flex: 16, side: 0, twist: 0 },
  root: { pitch: 98 },
}));

export const S_wheelKneesOut: PoseState = F('S_wheelKneesOut', pose(S_wheel, {
  hipL: { elev: 43, plane: -50, rot: 34 },
  hipR: { elev: 43, plane: -50, rot: 34 },
}));

export const S_boatPrepSlump: PoseState = F('S_boatPrepSlump', pose(S_boatPrep, {
  spine: { flex: 20, side: 0, twist: 0 },
  chest: { flex: 18, side: 0, twist: 0 },
  neck: { flex: -12, side: 0, twist: 0 },
}));

export const S_cobraHandsForward: PoseState = F('S_cobraHandsForward', pose(S_cobra, {
  shoulderL: { elev: 64, plane: 88, rot: 0 },
  shoulderR: { elev: 64, plane: 88, rot: 0 },
  elbowL: 20,
  elbowR: 20,
}));

export const S_threadNeedleNeck: PoseState = F('S_threadNeedleNeck', pose(S_threadNeedle, {
  neck: { flex: -16, side: 0, twist: -40 },
  clavR: { elev: 26, prot: 0 },
}));

export const S_seatedTwistSlump: PoseState = F('S_seatedTwistSlump', pose(S_seatedTwist, {
  spine: { flex: 18, side: 0, twist: 14 },
  chest: { flex: 18, side: 0, twist: 26 },
  neck: { flex: -6, side: 0, twist: 40 },
}));

export const S_eagleArmsShrug: PoseState = F('S_eagleArmsShrug', pose(S_eagleArmsSeated, {
  clavL: { elev: 28, prot: 18 },
  clavR: { elev: 28, prot: 18 },
  neck: { flex: 14, side: 0, twist: 0 },
}));

export const S_recliningButterflyArch: PoseState = F('S_recliningButterflyArch', pose(S_recliningButterfly, {
  root: { pitch: -98 },
  spine: { flex: -14, side: 0, twist: 0 },
  hipL: { elev: 52, plane: 20, rot: 90 },
  hipR: { elev: 52, plane: 20, rot: 90 },
}));

export const S_sidePlankShoulder: PoseState = F('S_sidePlankShoulder', pose(S_sidePlank, {
  clavL: { elev: 28, prot: 10 },
  neck: { flex: 0, side: -16, twist: -10 },
}));

export const S_janupRounded: PoseState = F('S_janupRounded', pose(S_janu, {
  spine: { flex: 34, side: 0, twist: 4 },
  chest: { flex: 30, side: 0, twist: 4 },
  neck: { flex: 20, side: 0, twist: 0 },
  root: { pitch: 10 },
}));

export const S_ardhaMatsySlump: PoseState = F('S_ardhaMatsySlump', pose(S_ardhaMatsy, {
  spine: { flex: 18, side: 0, twist: 10 },
  chest: { flex: 16, side: 0, twist: 18 },
  neck: { flex: -4, side: 0, twist: 46 },
}));

export const S_pigeonCollapse: PoseState = F('S_pigeonCollapse', pose(S_pigeon, {
  root: { roll: 14, turn: 10 },
  spine: { flex: 0, side: -10, twist: 0 },
}));

export const S_bowNeck: PoseState = F('S_bowNeck', pose(S_bow, {
  neck: { flex: -32, side: 0, twist: 0 },
  head: { flex: -20, side: 0, twist: 0 },
}));

export const S_standingSideBendForward: PoseState = F('S_standingSideBendForward', pose(S_standingSideBend, {
  spine: { flex: 14, side: 6, twist: 8 },
  chest: { flex: 16, side: 10, twist: 10 },
  neck: { flex: 12, side: 4, twist: 0 },
}));

export const S_camelNeck: PoseState = F('S_camelNeck', pose(S_camel, {
  neck: { flex: -46, side: 0, twist: 0 },
  head: { flex: -20, side: 0, twist: 0 },
}));

