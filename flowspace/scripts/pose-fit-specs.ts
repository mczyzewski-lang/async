import type { FitSpec } from './pose-fit';

/** Fitting specs used while authoring states (see scripts/pose-fit.ts). */
export const SPECS: Record<string, FitSpec> = {
  warrior2: {
    base: 'S_warrior2',
    free: {
      'hipL.elev': [40, 100], 'hipL.plane': [0, 80], 'hipL.rot': [-20, 100], kneeL: [40, 110],
      'hipR.elev': [10, 60], 'hipR.plane': [-80, 20], 'hipR.rot': [-40, 40],
      'ankleL.flex': [-20, 40], 'ankleR.flex': [-10, 40], 'root.pitch': [-10, 15],
    },
    terms: [
      { gap: 'footL' }, { gap: 'footR' }, { vert: ['kneeL', 'ankleL'] },
      { dist: ['ankleL', 'ankleR'], value: 1.15 }, { rel: ['ankleL', 'ankleR'], d: [0, null, null] },
      { flat: 'L' }, { flat: 'R', w: 0.5 }, { rel: ['kneeL', 'hipL'], d: [null, -0.08, null] }, { comOver: 'feet', w: 0.1 },
    ],
  },
  warrior1: {
    base: 'S_warrior1',
    free: {
      'hipL.elev': [40, 100], kneeL: [40, 110], 'hipR.elev': [15, 60], 'hipR.rot': [0, 60],
      'ankleR.flex': [0, 40], 'ankleL.flex': [-10, 40], 'root.pitch': [-15, 10], 'hipL.plane': [80, 100],
    },
    terms: [
      { gap: 'footL' }, { gap: 'footR' }, { vert: ['kneeL', 'ankleL'] }, { dist: ['ankleL', 'ankleR'], value: 1.05 },
      { flat: 'L' }, { flat: 'R', w: 0.5 }, { comOver: 'feet', w: 0.3 },
    ],
  },
  tree: {
    base: 'S_tree',
    free: {
      'hipL.elev': [20, 100], 'hipL.plane': [-20, 90], 'hipL.rot': [0, 120], kneeL: [90, 165],
      'ankleL.flex': [-50, 20], 'ankleL.inv': [-20, 40], 'root.x': [-0.1, 0.1], 'root.roll': [-8, 8],
    },
    terms: [
      { gap: 'footR' }, { rel: ['ankleL', 'kneeR'], d: [0.08, 0.3, 0.01], w: 4 },
      { rel: ['kneeL', 'hipL'], d: [0.3, -0.25, 0.04], w: 0.3 }, { comOver: 'footR', w: 0.6 },
    ],
  },
  triangle: {
    base: 'S_triangle',
    free: {
      'hipL.elev': [40, 100], 'hipL.plane': [0, 60], 'hipL.rot': [-20, 80], 'hipR.elev': [0, 60], 'hipR.plane': [-80, 20],
      'root.roll': [30, 75], 'root.pitch': [-10, 25], 'ankleL.flex': [-20, 30], 'ankleR.flex': [-10, 40],
    },
    terms: [
      { gap: 'footL' }, { gap: 'footR' }, { dist: ['ankleL', 'ankleR'], value: 1.1 }, { rel: ['ankleL', 'ankleR'], d: [0, null, null] },
      { flat: 'L' }, { flat: 'R', w: 0.5 }, { comOver: 'feet', w: 0.5 }, { gap: 'handL', value: 0.28, w: 0.3 },
    ],
  },
  warrior3: {
    base: 'S_warrior3',
    free: { 'root.pitch': [70, 100], 'hipL.elev': [70, 100], 'hipR.elev': [-10, 20], 'ankleL.flex': [-10, 20] },
    terms: [{ gap: 'footL' }, { flat: 'L' }, { comOver: 'footL', w: 3 }, { rel: ['ankleR', 'hipR'], d: [null, 0.0, null], w: 0.5 }],
  },
  halfMoon: {
    base: 'S_halfMoon',
    free: { 'root.pitch': [70, 100], 'root.turn': [-95, -60], 'hipL.elev': [60, 100], 'hipL.plane': [30, 90], 'shoulderL.elev': [70, 110], 'ankleL.flex': [-10, 20] },
    terms: [{ gap: 'footL' }, { gap: 'handL' }, { flat: 'L' }, { comOver: 'footL', w: 0.5 }],
  },
  wideFold: {
    base: 'S_wideFold',
    free: { 'root.pitch': [80, 130], 'hipL.elev|hipR.elev': [80, 130], 'spine.flex': [0, 40], 'neck.flex': [0, 30], 'chest.flex': [0, 35], 'kneeL|kneeR': [0, 14], 'shoulderL.elev|shoulderR.elev': [80, 160], 'elbowL|elbowR': [0, 60] },
    terms: [
      { gap: 'footL' }, { gap: 'footR' }, { gap: 'handL' }, { gap: 'handR' },
      { rel: ['handL', 'ankleL'], d: [null, null, 0], w: 0.5 }, { rel: ['handR', 'ankleR'], d: [null, null, 0], w: 0.5 },
      { dist: ['ankleL', 'ankleR'], value: 1.0 },
    ],
  },
  downDogBent: {
    base: 'S_downDogBentKnees',
    free: { 'root.pitch': [125, 160], 'ankleL.flex|ankleR.flex': [0, 40], 'shoulderL.elev|shoulderR.elev': [140, 180] },
    terms: [{ gap: 'footL' }, { gap: 'footR' }, { gap: 'handL' }, { gap: 'handR' }],
  },
  tabletop: {
    base: 'S_tabletop',
    free: { 'ankleL.flex|ankleR.flex': [-90, -30] },
    terms: [{ gap: 'footL' }, { gap: 'footR' }, { gap: 'handL' }, { gap: 'handR' }],
  },
  cat: {
    base: 'S_cat',
    free: { 'shoulderL.elev|shoulderR.elev': [100, 140], 'elbowL|elbowR': [0, 25], 'clavL.prot|clavR.prot': [0, 25] },
    terms: [{ gap: 'footL' }, { gap: 'footR' }, { gap: 'handL' }, { gap: 'handR' }, { vert: ['shoulderL', 'wristL'], w: 0.3 }, { vert: ['shoulderR', 'wristR'], w: 0.3 }],
  },
  cow: {
    base: 'S_cow',
    free: { 'shoulderL.elev|shoulderR.elev': [50, 90], 'root.pitch': [92, 106] },
    terms: [{ gap: 'footL' }, { gap: 'footR' }, { gap: 'handL' }, { gap: 'handR' }, { vert: ['shoulderL', 'wristL'], w: 0.3 }, { vert: ['shoulderR', 'wristR'], w: 0.3 }],
  },
  threadNeedle: {
    base: 'S_threadNeedle',
    free: {
      'root.turn': [-40, 10], 'chest.twist': [-70, -10], 'spine.twist': [-40, 0], 'shoulderL.elev': [60, 130], 'shoulderL.plane': [120, 180],
      'shoulderR.elev': [90, 170], elbowR: [0, 90], 'root.pitch': [80, 110],
    },
    terms: [
      { gap: 'handL' }, { gap: 'handR' }, { gap: 'footL', value: 0.0 }, { gap: 'footR', value: 0.0 }, { abs: 'head', p: [null, 0.1, null] },
    ],
  },
  puppy: {
    base: 'S_puppy',
    free: { 'root.pitch': [100, 145], 'hipL.elev|hipR.elev': [90, 140], 'spine.flex': [-25, 5], 'chest.flex': [-25, 5], 'neck.flex': [-10, 30] },
    terms: [{ gap: 'handL' }, { gap: 'handR' }, { gap: 'footL' }, { gap: 'footR' }, { vert: ['hipL', 'kneeL'] }, { abs: 'head', p: [null, 0.11, null], w: 0.5 }],
  },
  plank: {
    base: 'S_plank',
    free: { 'root.pitch': [65, 85], 'shoulderL.elev|shoulderR.elev': [60, 90], 'ankleL.flex|ankleR.flex': [-10, 30] },
    terms: [{ gap: 'handL' }, { gap: 'handR' }, { gap: 'footL' }, { gap: 'footR' }, { vert: ['shoulderL', 'wristL'] }, { vert: ['shoulderR', 'wristR'] }],
  },
  chaturanga: {
    base: 'S_chaturanga',
    free: { 'root.pitch': [75, 98], 'shoulderL.elev|shoulderR.elev': [0, 50], 'elbowL|elbowR': [60, 110], 'ankleL.flex|ankleR.flex': [-10, 30] },
    terms: [
      { gap: 'handL' }, { gap: 'handR' }, { gap: 'footL' }, { gap: 'footR' }, { vert: ['elbowL', 'wristL'] }, { vert: ['elbowR', 'wristR'] },
      { rel: ['shoulderL', 'elbowL'], d: [null, 0.03, null] }, { rel: ['shoulderR', 'elbowR'], d: [null, 0.03, null] },
    ],
  },
  sidePlank: {
    base: 'S_sidePlank',
    free: { 'root.pitch': [55, 90], 'root.turn': [-100, -75], 'shoulderL.elev': [60, 100], 'ankleL.inv': [-40, 20], 'hipL.elev': [0, 15], 'hipR.elev': [0, 15] },
    terms: [{ gap: 'handL' }, { gap: 'footL' }, { gap: 'footR', value: 0.07, w: 0.5 }, { vert: ['shoulderL', 'wristL'] }],
  },
  upDog: {
    base: 'S_upDog',
    free: { 'root.pitch': [70, 110], 'spine.flex': [-35, -5], 'chest.flex': [-25, 0], 'shoulderL.elev|shoulderR.elev': [30, 80], 'hipL.elev|hipR.elev': [0, 30] },
    terms: [{ gap: 'handL' }, { gap: 'handR' }, { gap: 'footL' }, { gap: 'footR' }, { vert: ['shoulderL', 'wristL'] }, { vert: ['shoulderR', 'wristR'] }, { abs: 'pelvis', p: [null, 0.24, null] }],
  },
  prone: {
    base: 'S_prone',
    free: { 'shoulderL.elev|shoulderR.elev': [0, 90], 'shoulderL.plane|shoulderR.plane': [0, 90], 'elbowL|elbowR': [60, 150] },
    terms: [{ gap: 'handL' }, { gap: 'handR' }, { gap: 'footL' }, { gap: 'footR' }, { abs: 'chest', p: [null, 0.11, null] }],
  },
  sphinx: {
    base: 'S_sphinx',
    free: { 'shoulderL.elev|shoulderR.elev': [40, 100], 'elbowL|elbowR': [60, 120], 'spine.flex': [-25, 0], 'chest.flex': [-25, 0] },
    terms: [{ gap: 'handL' }, { gap: 'handR' }, { gap: 'footL' }, { gap: 'footR' }, { vert: ['shoulderL', 'elbowL'] }, { vert: ['shoulderR', 'elbowR'] }, { abs: 'pelvis', p: [null, 0.1, null] }],
  },
  cobra: {
    base: 'S_cobra',
    free: { 'shoulderL.elev|shoulderR.elev': [0, 70], 'elbowL|elbowR': [20, 120], 'spine.flex': [-35, 0], 'chest.flex': [-30, 0] },
    terms: [
      { gap: 'handL' }, { gap: 'handR' }, { gap: 'footL' }, { gap: 'footR' }, { abs: 'pelvis', p: [null, 0.1, null] },
      { rel: ['handL', 'shoulderL'], d: [null, null, -0.05] }, { rel: ['handR', 'shoulderR'], d: [null, null, -0.05] },
    ],
  },
  bow: {
    base: 'S_bow',
    free: { 'shoulderL.elev|shoulderR.elev': [20, 110], 'shoulderL.plane|shoulderR.plane': [-130, -50], 'kneeL|kneeR': [70, 140], 'hipL.elev|hipR.elev': [0, 40] },
    terms: [{ rel: ['handL', 'ankleL'], d: [0, 0, 0] }, { rel: ['handR', 'ankleR'], d: [0, 0, 0] }, { abs: 'pelvis', p: [null, 0.1, null], w: 0.3 }],
  },
  camel: {
    base: 'S_camel',
    free: { 'shoulderL.elev|shoulderR.elev': [20, 110], 'shoulderL.plane|shoulderR.plane': [-120, -60], 'spine.flex': [-40, 0], 'chest.flex': [-40, 0], 'root.pitch': [-30, 0], 'hipL.elev|hipR.elev': [0, 30] },
    terms: [
      { rel: ['handL', 'ankleL'], d: [0, 0.03, -0.04] }, { rel: ['handR', 'ankleR'], d: [0, 0.03, -0.04] }, { gap: 'footL' }, { gap: 'footR' },
      { rel: ['hipL', 'kneeL'], d: [null, null, 0.03], w: 0.5 },
    ],
  },
  lowLunge: {
    base: 'S_lowLunge',
    free: { 'hipR.elev': [0, 60], kneeR: [40, 120], 'ankleR.flex': [-90, -30], 'root.pitch': [-15, 10], 'hipL.elev': [50, 110], kneeL: [60, 120], 'ankleL.flex': [-10, 40] },
    terms: [{ gap: 'footL' }, { gap: 'footR' }, { vert: ['kneeL', 'ankleL'] }, { flat: 'L' }, { abs: 'kneeR', p: [null, 0.055, null] }],
  },
  pigeon: {
    base: 'S_pigeon',
    free: { 'root.pitch': [15, 45], 'hipR.elev': [20, 45], 'hipL.elev': [70, 140], 'hipL.rot': [20, 90], 'hipL.plane': [20, 80], kneeL: [70, 140], 'shoulderL.elev|shoulderR.elev': [0, 60], 'ankleR.flex': [-90, -30], 'spine.flex': [-35, 0] },
    terms: [
      { gap: 'footR' }, { gap: 'handL' }, { gap: 'handR' }, { abs: 'kneeL', p: [null, 0.06, null] }, { abs: 'ankleL', p: [null, 0.07, null] },
      { abs: 'kneeR', p: [null, 0.06, null] }, { rel: ['ankleL', 'pelvis'], d: [-0.2, null, null], w: 0.5 },
    ],
  },

  pigeonFold: {
    base: 'S_pigeonFold',
    free: { 'root.pitch': [40, 90], 'hipR.elev': [-10, 45], 'hipL.elev': [100, 170], 'hipL.rot': [20, 90], kneeL: [70, 140], 'shoulderL.elev|shoulderR.elev': [100, 180], 'elbowL|elbowR': [20, 120], 'ankleR.flex': [-90, -30], 'spine.flex': [0, 30] },
    terms: [
      { gap: 'footR' }, { gap: 'handL' }, { gap: 'handR' }, { abs: 'kneeL', p: [null, 0.06, null] }, { abs: 'ankleL', p: [null, 0.07, null] },
      { abs: 'kneeR', p: [null, 0.06, null] }, { abs: 'elbowL', p: [null, 0.05, null] }, { abs: 'elbowR', p: [null, 0.05, null] }, { abs: 'head', p: [null, 0.2, null], w: 0.3 },
    ],
  },

  staff: {
    base: 'S_staff',
    free: { 'hipL.elev|hipR.elev': [80, 100], 'shoulderL.elev|shoulderR.elev': [0, 30], 'clavL.elev|clavR.elev': [-14, 0], 'wristL.flex|wristR.flex': [-90, -20] },
    terms: [{ gap: 'footL' }, { gap: 'footR' }, { gap: 'handL' }, { gap: 'handR' }],
  },
  easySeated: {
    base: 'S_easySeated',
    free: { 'hipL.elev': [80, 115], 'hipL.plane': [20, 70], 'hipL.rot': [30, 110], kneeL: [110, 160], 'hipR.elev': [80, 115], 'hipR.plane': [20, 70], 'hipR.rot': [30, 110], kneeR: [110, 160] },
    terms: [
      { rel: ['ankleL', 'kneeR'], d: [0.04, null, -0.02] }, { rel: ['ankleR', 'kneeL'], d: [-0.04, null, -0.1] },
      { abs: 'kneeL', p: [null, 0.14, null] }, { abs: 'kneeR', p: [null, 0.14, null] }, { gap: 'footL', value: 0.0, w: 0.3 }, { gap: 'footR', value: 0.0, w: 0.3 },
    ],
  },
  butterfly: {
    base: 'S_butterfly',
    free: { 'hipL.elev|hipR.elev': [60, 110], 'hipL.plane|hipR.plane': [0, 60], 'hipL.rot|hipR.rot': [20, 110], 'kneeL|kneeR': [100, 160] },
    terms: [
      { dist: ['ankleL', 'ankleR'], value: 0.09 }, { rel: ['ankleL', 'pelvis'], d: [null, null, 0.32] }, { abs: 'kneeL', p: [null, 0.2, null], w: 0.5 },
      { gap: 'footL', w: 0.3 }, { gap: 'footR', w: 0.3 },
    ],
  },
  ardhaMatsy: {
    base: 'S_ardhaMatsy',
    free: { 'hipR.elev': [70, 120], 'hipR.plane': [40, 130], 'hipR.rot': [20, 100], kneeR: [110, 165], 'hipL.elev': [80, 130], 'hipL.plane': [80, 130], 'hipL.rot': [-30, 30], kneeL: [90, 150] },
    terms: [
      { rel: ['ankleR', 'pelvis'], d: [0.17, null, 0.04] }, { rel: ['kneeR', 'pelvis'], d: [0.0, null, 0.36] }, { abs: 'kneeR', p: [null, 0.07, null] },
      { rel: ['ankleL', 'kneeR'], d: [-0.12, null, 0.02] }, { gap: 'footL' }, { vert: ['kneeL', 'ankleL'], w: 0.3 }, { gap: 'handL' },
    ],
  },
  sideAngle: {
    base: 'S_sideAngle',
    free: {
      'root.roll': [30, 65], 'hipL.elev': [40, 110], 'hipL.plane': [0, 80], 'hipL.rot': [-20, 100], kneeL: [40, 110],
      'hipR.elev': [10, 70], 'hipR.plane': [-80, 20], 'hipR.rot': [-40, 40], 'ankleL.flex': [-20, 40], 'ankleR.flex': [-10, 40],
    },
    terms: [
      { gap: 'footL' }, { gap: 'footR' }, { vert: ['kneeL', 'ankleL'] }, { dist: ['ankleL', 'ankleR'], value: 1.15 }, { rel: ['ankleL', 'ankleR'], d: [0, null, null] },
      { flat: 'L' }, { flat: 'R', w: 0.5 }, { rel: ['kneeL', 'hipL'], d: [null, -0.08, null] }, { dist: ['elbowL', 'kneeL'], value: 0.14, w: 0.5 },
    ],
  },
  janu: {
    base: 'S_janu',
    free: { 'hipL.elev': [100, 150], 'root.pitch': [10, 50], 'hipR.elev': [60, 130], 'hipR.plane': [0, 80], 'hipR.rot': [20, 110], kneeR: [110, 165] },
    terms: [
      { gap: 'footL' }, { rel: ['ankleR', 'pelvis'], d: [0.04, null, 0.22] }, { abs: 'kneeR', p: [null, 0.07, null] }, { abs: 'kneeL', p: [null, 0.07, null] },
    ],
  },
  hookLying: {
    base: 'S_hookLying',
    free: { 'hipL.elev|hipR.elev': [30, 70], 'kneeL|kneeR': [70, 120] },
    terms: [{ gap: 'footL' }, { gap: 'footR' }, { flat: 'L' }, { flat: 'R' }],
  },
  bridge: {
    base: 'S_bridge',
    free: { 'root.pitch': [-150, -105], 'spine.flex|chest.flex': [0, 35], 'hipL.elev|hipR.elev': [0, 30], 'kneeL|kneeR': [60, 120], 'neck.flex': [0, 40] },
    terms: [{ gap: 'footL' }, { gap: 'footR' }, { abs: 'shoulderL', p: [null, 0.07, null] }, { abs: 'shoulderR', p: [null, 0.07, null] }, { vert: ['kneeL', 'ankleL'], w: 0.5 }, { vert: ['kneeR', 'ankleR'], w: 0.5 }, { abs: 'pelvis', p: [null, 0.36, null] }, { flat: 'L' }, { flat: 'R' }],
  },

  supineTwist: {
    base: 'S_supineTwist',
    free: { 'root.turn': [40, 95], 'chest.twist': [-60, 0], 'spine.twist': [-40, 0], 'hipL.elev': [60, 110], 'hipR.elev': [60, 110] },
    terms: [{ abs: 'kneeL', p: [null, 0.08, null] }, { abs: 'shoulderL', p: [null, 0.08, null] }, { abs: 'shoulderR', p: [null, 0.08, null] }],
  },
  wheel: {
    base: 'S_wheel',
    free: { 'root.pitch': [-125, -85], 'spine.flex': [-40, 0], 'chest.flex': [-40, 0], 'hipL.elev|hipR.elev': [15, 60], 'kneeL|kneeR': [60, 130], 'shoulderL.elev|shoulderR.elev': [150, 185], 'ankleL.flex|ankleR.flex': [-20, 30] },
    terms: [{ gap: 'footL' }, { gap: 'footR' }, { gap: 'handL' }, { gap: 'handR' }, { abs: 'pelvis', p: [null, 0.72, null], w: 0.5 }, { flat: 'L', w: 0.3 }, { flat: 'R', w: 0.3 }],
  },

  crow: {
    base: 'S_crow',
    free: { 'root.pitch': [60, 110], 'hipL.elev|hipR.elev': [110, 150], 'elbowL|elbowR': [20, 80], 'shoulderL.elev|shoulderR.elev': [70, 120] },
    terms: [{ gap: 'handL' }, { gap: 'handR' }, { comOver: 'hands', w: 2 }, { gap: 'footL', value: 0.18, w: 0.3 }, { gap: 'footR', value: 0.18, w: 0.3 }],
  },
};
