/**
 * Core configuration & solution types.
 * All internal dimensions are in METRES. The UI converts to centimetres.
 */

export type StairShape = 'I' | 'L' | 'U';
export type Turn = 'left' | 'right';
/** World direction of ascent of the first flight. back = towards z=0 wall. */
export type EntryDir = 'back' | 'front' | 'left' | 'right';
export type Align = 'start' | 'center' | 'end' | 'manual';

export type StructureType = 'A' | 'B' | 'C' | 'D' | 'E';
export type LandingSupport = 'posts4' | 'posts2' | 'wall' | 'cantilever';
export type RiserMode = 'open' | 'closed';

export type RailingType = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export type SideMode = 'railing' | 'wall' | 'none';
export type HandrailStyle = 'round' | 'rect' | 'flat';
export type HandrailMaterial = 'metal' | 'wood';

export type SteelFinish = 'matte' | 'satin' | 'metallic' | 'brushed';
export type WoodId =
  | 'oak-natural'
  | 'oak-white'
  | 'oak-honey'
  | 'oak-smoked'
  | 'walnut'
  | 'ash'
  | 'oak-black';

export interface WallsPresence {
  back: boolean;
  front: boolean;
  left: boolean;
  right: boolean;
}

export interface RoomConfig {
  /** X extent (m) */
  width: number;
  /** Z extent (m) */
  depth: number;
  /** floor-to-floor (finished) height (m) */
  height: number;
  slabThickness: number;
  wallThickness: number;
  /** structural presence of walls (open-plan when false) */
  walls: WallsPresence;
}

export interface PlacementConfig {
  entry: EntryDir;
  alignX: Align;
  alignZ: Align;
  /** manual offsets: distance from left wall (x=0) and back wall (z=0) to staircase bounding box */
  offsetX: number;
  offsetZ: number;
  /** clearance used for wall alignment */
  wallGap: number;
}

export interface OpeningConfig {
  mode: 'auto' | 'manual';
  /** along the exit direction (m) */
  length: number;
  /** perpendicular to exit direction (m) */
  width: number;
}

export interface StairConfig {
  shape: StairShape;
  turn: Turn;
  flightWidth: number;
  /** tread going (horizontal step depth, nosing to nosing) */
  going: number;
  treadThickness: number;
  nosing: number;
  riserCountMode: 'auto' | 'manual';
  riserCount: number;
  /** preferred riser height used by the automatic riser count */
  targetRiser: number;
  /** risers in the first flight for L/U ('auto' => balanced) */
  splitMode: 'auto' | 'manual';
  split: number;
  /** landing depth along the first flight direction */
  landingDepth: number;
  /** clear gap between U flights */
  gap: number;
  placement: PlacementConfig;
  opening: OpeningConfig;
}

export interface StructureConfig {
  type: StructureType;
  landingSupport: LandingSupport;
  risers: RiserMode;
  steelColor: string;
  steelFinish: SteelFinish;
  steelPreset: string;
}

export interface TreadConfig {
  wood: WoodId;
  edge: 'straight' | 'rounded';
}

export interface RailingConfig {
  type: RailingType;
  height: number;
  /** profile thickness (m) – baluster diameter / slat width / rod diameter */
  profile: number;
  /** centre spacing of infill members (m) */
  spacing: number;
  /** side modes. For I: outer = left, inner = right */
  outer: SideMode;
  inner: SideMode;
  landing: boolean;
  /** guard railing around the slab opening on the upper floor */
  openingGuard: boolean;
  handrailStyle: HandrailStyle;
  handrailMaterial: HandrailMaterial;
  matchSteel: boolean;
  color: string;
  colorPreset: string;
  finish: SteelFinish;
}

export interface LightingConfig {
  mode: 'day' | 'night';
  led: boolean;
  ledTemp: 'warm' | 'neutral';
  ledIntensity: number;
}

export interface Config {
  version: number;
  presetId: string | null;
  room: RoomConfig;
  stair: StairConfig;
  structure: StructureConfig;
  treads: TreadConfig;
  railing: RailingConfig;
  lighting: LightingConfig;
}

// ---------------------------------------------------------------------------
// Solution types (computed)
// ---------------------------------------------------------------------------

export type V2 = { x: number; z: number };
export type V3 = { x: number; y: number; z: number };

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface FlightSolved {
  index: number;
  /** world point: centre of the first riser line */
  start: V2;
  /** world unit direction of ascent */
  dir: V2;
  /** world unit vector pointing to walker's right */
  right: V2;
  width: number;
  risers: number;
  treads: number;
  riserHeight: number;
  going: number;
  /** elevation of the walking surface at the flight bottom */
  baseY: number;
  /** elevation at the top of the flight */
  topY: number;
  /** horizontal run first riser -> last riser */
  run: number;
  baseOn: 'floor' | 'landing';
  topOn: 'landing' | 'slab';
  /** which landing (index) is below/above */
  landingBelow: number | null;
  landingAbove: number | null;
  /** yaw angle for three.js (rotation.y) so that local +z = dir, local +x = walker's left */
  yaw: number;
  /** plan rectangle covered by the flight's treads (world) */
  rect: Rect;
  /** individual tread rects for headroom checks */
  treadRects: { rect: Rect; topY: number }[];
}

export interface LandingSolved {
  index: number;
  rect: Rect;
  topY: number;
  thickness: number;
}

export interface Opening {
  rect: Rect;
  /** exit edge: the upper floor starts beyond this line */
  exitDir: V2;
  exitLine: { a: V2; b: V2 };
  length: number;
  width: number;
  autoLength: number;
  autoWidth: number;
}

export interface RailingRun {
  id: string;
  side: 'outer' | 'inner' | 'guard';
  /** points along the walking line, already offset to railing plane, y = walking level */
  points: V3[];
  /** per segment: is it sloped (stair) or flat (landing) */
  sloped: boolean[];
  /** per-run ownership info for wall handrails */
  kind: 'railing' | 'wall';
  /** For wall handrails: horizontal direction pointing towards the wall */
  wallNormal?: V2;
  /** distance from the railing line to the wall */
  wallDistance?: number;
}

export interface Layout {
  shape: StairShape;
  riserCount: number;
  riserHeight: number;
  going: number;
  flights: FlightSolved[];
  landings: LandingSolved[];
  /** stair-only footprint (treads, landings, nosings) */
  footprint: Rect;
  opening: Opening;
  /** world forward dir of entry */
  entryDir: V2;
  /** origin for local (u,v) frame */
  origin: V2;
  /** local -> world helpers data */
  fwd: V2;
  right: V2;
}

export type IssueLevel = 'error' | 'warning' | 'info';

export interface Issue {
  level: IssueLevel;
  code: string;
  message: string;
  /** which constraint causes the problem */
  constraint?: string;
  suggestion?: string;
}

export interface Analysis {
  riserCount: number;
  riserHeight: number;
  going: number;
  treadDepth: number;
  blondel: number;
  angleDeg: number;
  flightsTreads: number[];
  flightsRisers: number[];
  flightsRun: number[];
  landingElevations: number[];
  landingSizes: { w: number; d: number }[];
  /** full footprint incl. railings */
  footprint: Rect;
  footprintSize: { x: number; z: number };
  clearances: { left: number; right: number; back: number; front: number };
  headroomMin: number | null;
  headroomOk: boolean;
  fitsRoom: boolean;
  overflow: { left: number; right: number; back: number; front: number };
  status: 'ok' | 'warn' | 'fail';
  issues: Issue[];
  suggestions: string[];
  exitClear: number;
}
