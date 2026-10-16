export type EnvironmentId = 'zen' | 'ocean' | 'mountain' | 'forest';

export interface EnvironmentDef {
  id: EnvironmentId;
  namePL: string;
  descriptionPL: string;
  skyTop: string;
  skyHorizon: string;
  skyBottom: string;
  sunColor: string;
  sunIntensity: number;
  /** Direction toward the sun (unnormalised). */
  sunDir: [number, number, number];
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  fog: string;
  fogNear: number;
  fogFar: number;
  exposure: number;
  ground: 'gravel' | 'water' | 'meadow' | 'moss';
  groundColor: string;
  groundAccent: string;
  deckColor: string;
  matColor: string;
  mountains: Array<{ radius: number; height: number; color: string; seed: number }>;
  trees: { maple: number; pine: number; radiusMin: number; radiusMax: number; mapleColor: string };
  pavilion: boolean;
  particles: string;
  ambience: 'garden' | 'ocean' | 'mountain' | 'forest';
}

export const ENVIRONMENTS: Record<EnvironmentId, EnvironmentDef> = {
  zen: {
    id: 'zen',
    namePL: 'Pawilon Zen',
    descriptionPL: 'Drewniany pawilon w ogrodzie zen, złote światło późnego popołudnia.',
    skyTop: '#9fb4c4',
    skyHorizon: '#f2dcc0',
    skyBottom: '#e9dccb',
    sunColor: '#ffe2b8',
    sunIntensity: 2.6,
    sunDir: [-6, 5.5, 7],
    hemiSky: '#fff1dc',
    hemiGround: '#8a7a64',
    hemiIntensity: 0.95,
    fog: '#ead9c3',
    fogNear: 18,
    fogFar: 120,
    exposure: 1.0,
    ground: 'gravel',
    groundColor: '#d8cfbf',
    groundAccent: '#b9ab93',
    deckColor: '#a8794f',
    matColor: '#b9c0a8',
    mountains: [
      { radius: 70, height: 16, color: '#a9a8a3', seed: 3 },
      { radius: 105, height: 30, color: '#b9b3ab', seed: 8 },
    ],
    trees: { maple: 7, pine: 9, radiusMin: 7, radiusMax: 22, mapleColor: '#c2593a' },
    pavilion: true,
    particles: '#fff3dd',
    ambience: 'garden',
  },
  ocean: {
    id: 'ocean',
    namePL: 'Taras nad oceanem',
    descriptionPL: 'Platforma nad spokojnym morzem, szeroki horyzont i delikatny szum fal.',
    skyTop: '#7fa6c2',
    skyHorizon: '#f6dcc3',
    skyBottom: '#9cb3bd',
    sunColor: '#fff0d6',
    sunIntensity: 2.7,
    sunDir: [5, 4, -9],
    hemiSky: '#eaf3ff',
    hemiGround: '#6d7f86',
    hemiIntensity: 1.0,
    fog: '#e4dccf',
    fogNear: 25,
    fogFar: 180,
    exposure: 1.0,
    ground: 'water',
    groundColor: '#4f7d8c',
    groundAccent: '#9cc3c9',
    deckColor: '#b48a64',
    matColor: '#c9b9a0',
    mountains: [{ radius: 150, height: 14, color: '#9fb0b6', seed: 21 }],
    trees: { maple: 0, pine: 0, radiusMin: 0, radiusMax: 0, mapleColor: '#000' },
    pavilion: false,
    particles: '#ffffff',
    ambience: 'ocean',
  },
  mountain: {
    id: 'mountain',
    namePL: 'Górskie sanktuarium',
    descriptionPL: 'Drewniany taras z panoramą szczytów i chłodnym, czystym światłem.',
    skyTop: '#6f93b8',
    skyHorizon: '#dfe6ea',
    skyBottom: '#c8cfcf',
    sunColor: '#fff4e2',
    sunIntensity: 2.8,
    sunDir: [7, 8, 4],
    hemiSky: '#e8f0ff',
    hemiGround: '#6c705f',
    hemiIntensity: 1.0,
    fog: '#d9e0e3',
    fogNear: 30,
    fogFar: 170,
    exposure: 1.0,
    ground: 'meadow',
    groundColor: '#7f8a62',
    groundAccent: '#a3a679',
    deckColor: '#9b7350',
    matColor: '#a9b39b',
    mountains: [
      { radius: 55, height: 22, color: '#77806f', seed: 31 },
      { radius: 90, height: 48, color: '#9aa4ab', seed: 32 },
      { radius: 135, height: 70, color: '#c3ccd3', seed: 33 },
    ],
    trees: { maple: 0, pine: 16, radiusMin: 12, radiusMax: 40, mapleColor: '#000' },
    pavilion: false,
    particles: '#ffffff',
    ambience: 'mountain',
  },
  forest: {
    id: 'forest',
    namePL: 'Leśne studio',
    descriptionPL: 'Spokojna polana otoczona drzewami, miękkie rozproszone światło.',
    skyTop: '#a9c0b4',
    skyHorizon: '#e7e4cf',
    skyBottom: '#c6c9b2',
    sunColor: '#fff0cf',
    sunIntensity: 2.2,
    sunDir: [-3, 7, 5],
    hemiSky: '#f3f7e6',
    hemiGround: '#55603f',
    hemiIntensity: 1.1,
    fog: '#cdd2bd',
    fogNear: 10,
    fogFar: 70,
    exposure: 1.0,
    ground: 'moss',
    groundColor: '#6f7b4f',
    groundAccent: '#8d9861',
    deckColor: '#a27a55',
    matColor: '#c7b79c',
    mountains: [],
    trees: { maple: 10, pine: 34, radiusMin: 6, radiusMax: 26, mapleColor: '#b6a24a' },
    pavilion: false,
    particles: '#fbf6d8',
    ambience: 'forest',
  },
};

export const ENVIRONMENT_LIST = Object.values(ENVIRONMENTS);
