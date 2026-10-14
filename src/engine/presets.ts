import { STEELS, railingById } from './catalog';
import type { Config, HandrailMaterial, HandrailStyle, LandingSupport, RailingType, RiserMode, StructureType, WoodId } from './types';

export interface DesignPreset {
  id: string;
  name: string;
  tagline: string;
  structure: StructureType;
  risers: RiserMode;
  landingSupport: LandingSupport;
  wood: WoodId;
  edge: 'straight' | 'rounded';
  steel: string;
  railing: RailingType;
  railingSteel: string | null; // null = match structure
  handrailStyle: HandrailStyle;
  handrailMaterial: HandrailMaterial;
  led: boolean;
  /** swatch colours for the UI card */
  swatch: [string, string];
}

export const PRESETS: DesignPreset[] = [
  {
    id: 'minimal-black-oak',
    name: 'Minimal Black Oak',
    tagline: 'Belka centralna, dąb naturalny, cienkie czarne pręty',
    structure: 'A', risers: 'open', landingSupport: 'posts4',
    wood: 'oak-natural', edge: 'rounded', steel: 'black',
    railing: 'A', railingSteel: null, handrailStyle: 'flat', handrailMaterial: 'metal', led: false,
    swatch: ['#1b1b1c', '#d3ad7f'],
  },
  {
    id: 'japandi-natural',
    name: 'Japandi Natural',
    tagline: 'Policzki boczne, jesion, płaskowniki z drewnianym pochwytem',
    structure: 'B', risers: 'open', landingSupport: 'posts2',
    wood: 'ash', edge: 'rounded', steel: 'lightgrey',
    railing: 'B', railingSteel: null, handrailStyle: 'rect', handrailMaterial: 'wood', led: false,
    swatch: ['#c8cac7', '#dcc6a0'],
  },
  {
    id: 'architectural-zigzag',
    name: 'Architectural Zigzag',
    tagline: 'Policzki zygzakowe, dąb miodowy, antracyt',
    structure: 'C', risers: 'open', landingSupport: 'posts4',
    wood: 'oak-honey', edge: 'straight', steel: 'anthracite',
    railing: 'A', railingSteel: null, handrailStyle: 'round', handrailMaterial: 'wood', led: false,
    swatch: ['#3a3f44', '#c98f4f'],
  },
  {
    id: 'industrial-loft',
    name: 'Industrial Loft',
    tagline: 'Spawana rama, dąb wędzony, siatka cięto-ciągniona',
    structure: 'E', risers: 'open', landingSupport: 'posts4',
    wood: 'oak-smoked', edge: 'straight', steel: 'black',
    railing: 'E', railingSteel: null, handrailStyle: 'rect', handrailMaterial: 'metal', led: true,
    swatch: ['#1b1b1c', '#7c5b40'],
  },
  {
    id: 'modern-white-oak',
    name: 'Modern White Oak',
    tagline: 'Gięta blacha, dąb bielony, biała perforacja',
    structure: 'D', risers: 'closed', landingSupport: 'posts4',
    wood: 'oak-white', edge: 'rounded', steel: 'white',
    railing: 'D', railingSteel: null, handrailStyle: 'flat', handrailMaterial: 'metal', led: false,
    swatch: ['#f1f0ec', '#e6dccb'],
  },
  {
    id: 'dark-luxury',
    name: 'Dark Luxury',
    tagline: 'Szampańska stal, orzech, pełne panele i LED',
    structure: 'A', risers: 'open', landingSupport: 'posts4',
    wood: 'walnut', edge: 'rounded', steel: 'champagne',
    railing: 'F', railingSteel: 'bronze', handrailStyle: 'flat', handrailMaterial: 'metal', led: true,
    swatch: ['#b8a17c', '#6a4631'],
  },
];

/** Apply a style preset to a configuration — dimensions and room are kept. */
export function applyPreset(config: Config, presetId: string): Config {
  const p = PRESETS.find((x) => x.id === presetId);
  if (!p) return config;
  const steel = STEELS.find((s) => s.id === p.steel) ?? STEELS[0];
  const rSteel = p.railingSteel ? STEELS.find((s) => s.id === p.railingSteel) ?? steel : steel;
  const rm = railingById(p.railing);
  return {
    ...config,
    presetId: p.id,
    structure: {
      ...config.structure,
      type: p.structure,
      risers: p.risers,
      landingSupport: p.landingSupport,
      steelColor: steel.color,
      steelFinish: steel.finish,
      steelPreset: steel.id,
    },
    treads: { ...config.treads, wood: p.wood, edge: p.edge },
    railing: {
      ...config.railing,
      type: p.railing,
      profile: rm.defaultProfile,
      spacing: rm.defaultSpacing,
      handrailStyle: p.handrailStyle,
      handrailMaterial: p.handrailMaterial,
      matchSteel: p.railingSteel === null,
      color: rSteel.color,
      colorPreset: rSteel.id,
      finish: rSteel.finish,
    },
    lighting: { ...config.lighting, led: p.led },
  };
}
