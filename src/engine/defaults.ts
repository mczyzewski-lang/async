import type { Config } from './types';

export const CONFIG_VERSION = 1;

/** Default: U-shaped staircase, 350 cm floor-to-floor, 240 x 390 cm space. */
export const DEFAULT_CONFIG: Config = {
  version: CONFIG_VERSION,
  presetId: 'minimal-black-oak',
  room: {
    width: 2.4,
    depth: 3.9,
    height: 3.5,
    slabThickness: 0.25,
    wallThickness: 0.2,
    walls: { back: true, left: true, right: true, front: false },
  },
  stair: {
    shape: 'U',
    turn: 'right',
    flightWidth: 0.95,
    going: 0.28,
    treadThickness: 0.04,
    nosing: 0.02,
    riserCountMode: 'auto',
    riserCount: 20,
    targetRiser: 0.175,
    splitMode: 'auto',
    split: 10,
    landingDepth: 0.95,
    gap: 0.1,
    placement: {
      entry: 'back',
      alignX: 'center',
      alignZ: 'start',
      offsetX: 0.2,
      offsetZ: 0.05,
      wallGap: 0.08,
    },
    opening: { mode: 'auto', length: 3.6, width: 2.1 },
  },
  structure: {
    type: 'A',
    landingSupport: 'cantilever',
    risers: 'open',
    steelColor: '#1b1b1c',
    steelFinish: 'matte',
    steelPreset: 'black',
  },
  treads: { wood: 'oak-natural', edge: 'rounded' },
  railing: {
    type: 'A',
    height: 0.95,
    profile: 0.014,
    spacing: 0.11,
    outer: 'railing',
    inner: 'railing',
    landing: true,
    openingGuard: true,
    handrailStyle: 'flat',
    handrailMaterial: 'metal',
    matchSteel: true,
    color: '#1b1b1c',
    colorPreset: 'black',
    finish: 'matte',
  },
  lighting: { mode: 'day', led: false, ledTemp: 'warm', ledIntensity: 1 },
};

export const cloneConfig = (c: Config): Config => JSON.parse(JSON.stringify(c));
