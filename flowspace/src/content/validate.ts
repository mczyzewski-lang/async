import type { PoseState, YogaPose } from './types';
import { DIFFICULTIES, JOINT_IDS } from './types';
import { neutralState } from './poseState';

export interface Issue {
  level: 'error' | 'warning';
  pose: string;
  message: string;
}

const CATEGORIES = ['standing', 'seated', 'kneeling', 'supine', 'prone', 'allfours', 'balance', 'armbalance', 'inversion', 'backbend', 'twist', 'forwardfold', 'restorative', 'breathing'];
const BASES = ['standing', 'allfours', 'kneeling', 'seated', 'supine', 'prone', 'plank'];
const POLISH = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]|\b(i|w|z|na|do|się|nie)\b/;

function flat(o: unknown, prefix = '', out: Record<string, unknown> = {}) {
  if (o && typeof o === 'object' && !Array.isArray(o)) {
    for (const [k, v] of Object.entries(o)) flat(v, prefix ? `${prefix}.${k}` : k, out);
  } else out[prefix] = o;
  return out;
}

const REQUIRED_STATE_KEYS = Object.keys(flat({ ...neutralState(), plant: undefined })).filter((k) => !k.startsWith('plant'));

/** Validates that a skeletal state references only known joints and has finite, plausible values. */
export function validateState(s: PoseState, where: string, pose: string, issues: Issue[]) {
  const f = flat(s);
  for (const k of REQUIRED_STATE_KEYS) {
    const v = f[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) issues.push({ level: 'error', pose, message: `${where}: invalid or missing skeleton parameter "${k}"` });
    else if (!k.startsWith('root.') && Math.abs(v) > 200) issues.push({ level: 'error', pose, message: `${where}: implausible joint angle ${k}=${v}` });
  }
  for (const k of Object.keys(f)) {
    if (k.startsWith('plant')) continue;
    if (!REQUIRED_STATE_KEYS.includes(k) && k !== 'root.turn') issues.push({ level: 'error', pose, message: `${where}: unknown skeleton reference "${k}"` });
  }
}

export function validatePoses(poses: YogaPose[]): Issue[] {
  const issues: Issue[] = [];
  const ids = new Set<string>();
  const holdSignatures = new Map<string, string>();
  const err = (pose: string, message: string) => issues.push({ level: 'error', pose, message });
  const warn = (pose: string, message: string) => issues.push({ level: 'warning', pose, message });

  for (const p of poses) {
    if (ids.has(p.id)) err(p.id, 'duplicate id');
    ids.add(p.id);
    for (const [k, v] of Object.entries({ namePL: p.namePL, nameEN: p.nameEN, slug: p.slug, summaryPL: p.summaryPL })) {
      if (!v || !String(v).trim()) err(p.id, `missing field ${k}`);
    }
    if (!DIFFICULTIES.includes(p.difficulty)) err(p.id, `unsupported difficulty "${p.difficulty}"`);
    if (!CATEGORIES.includes(p.category)) err(p.id, `unsupported category "${p.category}"`);
    if (!p.targetAreas.length) err(p.id, 'no target areas');
    if (!p.benefits.length) err(p.id, 'no benefits');
    if (!p.cautions.length) err(p.id, 'no cautions');
    if (!p.modifications.length) err(p.id, 'no beginner-friendly variations');
    if (!p.instructions.length) err(p.id, 'no instructions');
    if (!p.commonMistakes.length) warn(p.id, 'no common mistakes');
    if (!(p.duration.min <= p.duration.typical && p.duration.typical <= p.duration.max)) err(p.id, 'invalid duration range');
    if (!POLISH.test(`${p.summaryPL} ${p.instructions.map((i) => i.descriptionPL).join(' ')}`)) err(p.id, 'instructions do not look Polish');
    for (const s of p.instructions) {
      if (!s.descriptionPL.trim()) err(p.id, `step ${s.id}: missing Polish description`);
      if (!s.narrationPL.trim()) err(p.id, `step ${s.id}: missing Polish narration`);
    }
    for (const m of p.commonMistakes) {
      if (!m.titlePL || !m.explanationPL || !m.correctionPL) err(p.id, `mistake ${m.id}: missing Polish explanation`);
      for (const j of m.highlightedJoints) if (!JOINT_IDS.includes(j)) err(p.id, `mistake ${m.id}: invalid joint "${j}"`);
    }
    for (const t of p.transitionsTo) if (!poses.some((x) => x.id === t)) err(p.id, `transition reference to unknown pose "${t}"`);
    if (!p.narration.intro || !p.narration.exit) err(p.id, 'missing voice script');

    const cams = new Set(p.cameraPresets.map((c) => c.id));
    const anim = p.animation;
    if (anim) {
      const kfs = new Set(anim.keyframes.map((k) => k.id));
      if (!anim.keyframes.length) err(p.id, 'animation without keyframes');
      if (!kfs.has(anim.hold)) err(p.id, `hold keyframe "${anim.hold}" missing`);
      for (const id of [...anim.entry, ...anim.exit]) if (!kfs.has(id)) err(p.id, `entry/exit keyframe "${id}" missing`);
      for (const k of anim.keyframes) {
        if (!BASES.includes(k.base)) err(p.id, `keyframe ${k.id}: invalid base "${k.base}"`);
        if (!(k.duration > 0)) err(p.id, `keyframe ${k.id}: invalid duration`);
        validateState(k.state, `keyframe ${k.id}`, p.id, issues);
      }
      if (p.instructions.length < 2 || p.instructions.length > 6) warn(p.id, `has ${p.instructions.length} steps (expected 3–6)`);
      for (const s of p.instructions) {
        if (!kfs.has(s.animationSegment)) err(p.id, `step ${s.id}: animation segment "${s.animationSegment}" missing`);
        if (!cams.has(s.cameraPreset)) err(p.id, `step ${s.id}: camera preset "${s.cameraPreset}" missing`);
        for (const j of s.highlightedJoints) if (!JOINT_IDS.includes(j)) err(p.id, `step ${s.id}: invalid joint "${j}"`);
      }
      for (const m of p.commonMistakes) {
        if (!cams.has(m.cameraPreset)) err(p.id, `mistake ${m.id}: camera preset "${m.cameraPreset}" missing`);
        if (!kfs.has(m.correctedPoseState)) err(p.id, `mistake ${m.id}: corrected state "${m.correctedPoseState}" missing`);
        if (m.incorrectPoseState) validateState(m.incorrectPoseState, `mistake ${m.id}`, p.id, issues);
      }
      if (p.commonMistakes.length < 3) warn(p.id, `only ${p.commonMistakes.length} common mistakes`);
      for (const g of p.technicalGuides) for (const j of g.joints) if (!JOINT_IDS.includes(j)) err(p.id, `guide "${g.labelPL}": invalid joint "${j}"`);
      // Each 3D pose must have its own held configuration (no silent reuse of a generic animation).
      const hold = anim.keyframes.find((k) => k.id === anim.hold);
      if (hold) {
        const sig = JSON.stringify(hold.state);
        const other = holdSignatures.get(sig);
        if (other) err(p.id, `held pose is identical to "${other}" (generic animation reuse)`);
        holdSignatures.set(sig, p.id);
      }
      if (!p.session) warn(p.id, '3D pose without session metadata');
      if (p.animationReviewStatus === 'none') err(p.id, '3D pose without animation review status');
    } else {
      if (p.animationReviewStatus !== 'none') err(p.id, 'catalog-only pose claims an animation review status');
      if (p.session) err(p.id, 'catalog-only pose is marked for sessions');
    }
    if (p.session) {
      const h = p.session.hold;
      if (!(h.min <= h.default && h.default <= h.max)) err(p.id, 'invalid session hold range');
      for (const id of p.session.needsPrep ?? []) if (!poses.some((x) => x.id === id)) err(p.id, `needsPrep references unknown pose "${id}"`);
      if (!p.session.roles.length) err(p.id, 'session meta without roles');
    }
    if (p.contentReviewStatus === 'expert-reviewed') warn(p.id, 'marked expert-reviewed — make sure a reviewer signed off');
  }
  return issues;
}
