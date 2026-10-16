import type { YogaPose } from '../types';
import { catalogPoses } from './catalog';
import { floorPoses } from './floor';
import { seatedSupinePoses } from './seatedSupine';
import { standingPoses } from './standing';

/** The complete pose library (3D-demonstrated poses first). */
export const POSES: YogaPose[] = [...standingPoses, ...floorPoses, ...seatedSupinePoses, ...catalogPoses];

export const POSE_BY_ID: Record<string, YogaPose> = Object.fromEntries(POSES.map((p) => [p.id, p]));

export const POSES_3D = POSES.filter((p) => p.animation);

export function getPose(id: string): YogaPose | undefined {
  return POSE_BY_ID[id];
}

export function has3D(p: YogaPose): boolean {
  return !!p.animation;
}
