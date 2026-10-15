import type { RailingType, SteelFinish, StructureType, WoodId, RiserMode } from './types';

export interface WoodPreset {
  id: WoodId;
  name: string;
  description: string;
  base: string;
  grain: string;
  dark: string;
  /** grain contrast 0..1 */
  contrast: number;
  roughness: number;
}

export const WOODS: WoodPreset[] = [
  { id: 'oak-natural', name: 'Dąb naturalny', description: 'Jasny, naturalny dąb olejowany', base: '#cfa271', grain: '#a2723f', dark: '#7d5530', contrast: 0.6, roughness: 0.58 },
  { id: 'oak-white', name: 'Dąb bielony', description: 'Dąb bielony, skandynawski charakter', base: '#e6dccb', grain: '#c6b498', dark: '#a8957a', contrast: 0.45, roughness: 0.62 },
  { id: 'oak-honey', name: 'Dąb miodowy', description: 'Ciepły, miodowy odcień', base: '#c98f4f', grain: '#9c6430', dark: '#7d4c22', contrast: 0.55, roughness: 0.55 },
  { id: 'oak-smoked', name: 'Dąb wędzony', description: 'Głęboki, wędzony dąb', base: '#7c5b40', grain: '#5a3e29', dark: '#3f2b1c', contrast: 0.6, roughness: 0.6 },
  { id: 'walnut', name: 'Orzech', description: 'Ciemny orzech amerykański', base: '#6a4631', grain: '#4a2f1f', dark: '#2f1d13', contrast: 0.6, roughness: 0.5 },
  { id: 'ash', name: 'Jesion naturalny', description: 'Jasny jesion o wyraźnym usłojeniu', base: '#dcc6a0', grain: '#a98d63', dark: '#8b7049', contrast: 0.75, roughness: 0.6 },
  { id: 'oak-black', name: 'Czarny dąb', description: 'Dąb barwiony na głęboką czerń', base: '#2e2823', grain: '#1c1814', dark: '#100d0b', contrast: 0.5, roughness: 0.55 },
];

export const woodById = (id: WoodId) => WOODS.find((w) => w.id === id) ?? WOODS[0];

export interface SteelPreset {
  id: string;
  name: string;
  code?: string;
  color: string;
  finish: SteelFinish;
}

export const STEELS: SteelPreset[] = [
  { id: 'black', name: 'Czarny mat', code: 'RAL 9005', color: '#1b1b1c', finish: 'matte' },
  { id: 'anthracite', name: 'Antracyt', code: 'RAL 7016', color: '#3a3f44', finish: 'matte' },
  { id: 'white', name: 'Biały', code: 'RAL 9016', color: '#f1f0ec', finish: 'matte' },
  { id: 'lightgrey', name: 'Jasnoszary', code: 'RAL 7035', color: '#c8cac7', finish: 'matte' },
  { id: 'bronze', name: 'Ciemny brąz', color: '#4a3a2c', finish: 'satin' },
  { id: 'champagne', name: 'Szampański metaliczny', color: '#b8a17c', finish: 'metallic' },
  { id: 'brushed', name: 'Stal szczotkowana', color: '#a9abab', finish: 'brushed' },
];

export const FINISHES: { id: SteelFinish; name: string }[] = [
  { id: 'matte', name: 'Mat (proszkowo)' },
  { id: 'satin', name: 'Satyna' },
  { id: 'metallic', name: 'Metalik' },
  { id: 'brushed', name: 'Szczotkowana' },
];

export type SupportCategory = 'freestanding' | 'posts' | 'wall';

export interface StructureMeta {
  id: StructureType;
  name: string;
  short: string;
  description: string;
  support: SupportCategory;
  supportNote: string;
  risers: RiserMode[];
}

export const STRUCTURES: StructureMeta[] = [
  {
    id: 'A',
    name: 'Belka centralna',
    short: 'Mono',
    description: 'Pojedyncza belka z profilu zamkniętego pod osią biegu, wsporniki pod stopnicami — efekt lewitacji.',
    support: 'freestanding',
    supportNote: 'Koncepcja wolnostojąca: kotwienie do posadzki i czoła stropu, spocznik na słupach.',
    risers: ['open'],
  },
  {
    id: 'B',
    name: 'Dwa policzki boczne',
    short: 'Policzki',
    description: 'Dwie stalowe blachy boczne, stopnice osadzone pomiędzy nimi na kątownikach.',
    support: 'freestanding',
    supportNote: 'Koncepcja wolnostojąca: policzki oparte na posadzce i stropie, spocznik na słupach.',
    risers: ['open', 'closed'],
  },
  {
    id: 'C',
    name: 'Policzki zygzakowe',
    short: 'Zygzak',
    description: 'Policzki cięte w zęby piły, kopiujące kształt stopni. Stopnice leżą na górze.',
    support: 'freestanding',
    supportNote: 'Koncepcja wolnostojąca: dwa policzki zygzakowe, spocznik na słupach.',
    risers: ['open', 'closed'],
  },
  {
    id: 'D',
    name: 'Gięta blacha',
    short: 'Blacha',
    description: 'Ciągła, gięta blacha stalowa tworząca stopnie i podstopnice, z drewnianymi nakładkami.',
    support: 'wall',
    supportNote: 'Może wymagać kotwienia do ściany lub ukrytych żeber usztywniających (pokazane w modelu).',
    risers: ['closed'],
  },
  {
    id: 'E',
    name: 'Rama spawana',
    short: 'Rama',
    description: 'Lekka rama z profili prostokątnych, każda stopnica na własnej ramce.',
    support: 'posts',
    supportNote: 'Wymaga dodatkowych słupów podporowych pod dłuższymi biegami.',
    risers: ['open', 'closed'],
  },
];

export const structureById = (id: StructureType) => STRUCTURES.find((s) => s.id === id) ?? STRUCTURES[0];

export interface RailingMeta {
  id: RailingType;
  name: string;
  description: string;
  hasSpacing: boolean;
  profileLabel: string;
  profileRange: [number, number];
  spacingRange: [number, number];
  defaultProfile: number;
  defaultSpacing: number;
}

export const RAILINGS: RailingMeta[] = [
  { id: 'A', name: 'Pręty pionowe', description: 'Bardzo cienkie pionowe pręty stalowe w równym rytmie.', hasSpacing: true, profileLabel: 'Średnica pręta', profileRange: [0.01, 0.025], spacingRange: [0.06, 0.16], defaultProfile: 0.014, defaultSpacing: 0.11 },
  { id: 'B', name: 'Płaskowniki pionowe', description: 'Płaskie profile stalowe tworzące elegancki rytm.', hasSpacing: true, profileLabel: 'Szerokość płaskownika', profileRange: [0.02, 0.08], spacingRange: [0.06, 0.18], defaultProfile: 0.04, defaultSpacing: 0.1 },
  { id: 'C', name: 'Pręty poziome', description: 'Smukłe poziome pręty, lekki wygląd.', hasSpacing: true, profileLabel: 'Średnica pręta', profileRange: [0.01, 0.025], spacingRange: [0.08, 0.16], defaultProfile: 0.014, defaultSpacing: 0.11 },
  { id: 'D', name: 'Blacha perforowana', description: 'Panele z cienkiej blachy z subtelną perforacją.', hasSpacing: false, profileLabel: 'Grubość ramy', profileRange: [0.015, 0.05], spacingRange: [0.1, 0.1], defaultProfile: 0.025, defaultSpacing: 0.1 },
  { id: 'E', name: 'Siatka cięto-ciągniona', description: 'Architektoniczna siatka w smukłej ramie.', hasSpacing: false, profileLabel: 'Grubość ramy', profileRange: [0.015, 0.05], spacingRange: [0.1, 0.1], defaultProfile: 0.025, defaultSpacing: 0.1 },
  { id: 'F', name: 'Pełne panele', description: 'Gładkie panele z blachy stalowej, smukły profil górny.', hasSpacing: false, profileLabel: 'Grubość blachy', profileRange: [0.006, 0.015], spacingRange: [0.1, 0.1], defaultProfile: 0.008, defaultSpacing: 0.1 },
  { id: 'G', name: 'Szkło', description: 'Tafle szkła hartowanego laminowanego (VSG) na uchwytach punktowych, bez słupków.', hasSpacing: false, profileLabel: 'Grubość szkła', profileRange: [0.012, 0.025], spacingRange: [0.1, 0.1], defaultProfile: 0.017, defaultSpacing: 0.1 },
];

export const railingById = (id: RailingType) => RAILINGS.find((r) => r.id === id) ?? RAILINGS[0];

/** Ergonomic & reference limits (not a legal certification) */
export const LIMITS = {
  riserMin: 0.15,
  riserMax: 0.2,
  riserComfortMax: 0.19,
  goingMin: 0.22,
  goingComfortMin: 0.25,
  goingMax: 0.34,
  blondelMin: 0.6,
  blondelMax: 0.65,
  blondelHardMin: 0.57,
  blondelHardMax: 0.68,
  headroom: 2.0,
  maxRisersPerFlight: 18,
  minRisersPerFlight: 3,
  railingMinHeight: 0.9,
  railingMaxGap: 0.12,
};
