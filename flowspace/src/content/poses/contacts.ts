/**
 * Body parts that rest on the mat in floor poses (besides the planted hands/feet flags).
 * Part ids are the driver skeleton bones: e.g. `root` = pelvis/sacrum, `chest` = upper back or
 * chest, `head`, `thighL/R` (sit bones and thighs), `shinL/R` (knees and shins), `footL/R`.
 * Checked by `npm run validate:content` and used by scripts/contact-fit.ts.
 */
import type { BoneName } from '@/three/rig/skeleton';

export const FLOOR_CONTACTS: Record<string, BoneName[]> = {
  // lying on the back
  S_supine: ['root', 'chest', 'head', 'footL', 'footR'],
  S_savasana: ['root', 'chest', 'head', 'footL', 'footR'],
  S_hookLying: ['root', 'chest', 'head', 'footL', 'footR'],
  S_kneesToChest: ['root', 'chest', 'head'],
  S_happyBaby: ['root', 'chest', 'head'],
  S_recliningButterfly: ['root', 'chest', 'head', 'footL', 'footR'],
  S_bridge: ['chest', 'head', 'footL', 'footR'],
  S_wheelPrep: ['root', 'chest', 'head', 'footL', 'footR', 'handL', 'handR'],
  S_supineTwist: ['chest', 'head', 'thighL'],
  // lying on the front
  S_prone: ['root', 'chest', 'thighL', 'thighR'],
  S_cobraPrep: ['root', 'thighL', 'thighR', 'handL', 'handR'], // hands under the shoulders keep the chest ~3 cm up
  S_cobra: ['root', 'thighL', 'thighR', 'handL', 'handR'],
  S_sphinx: ['root', 'thighL', 'thighR', 'forearmL', 'forearmR'],
  S_locust: ['root'],
  S_bow: ['root'],
  S_bowPrep: ['root', 'chest'],
  // sitting
  S_easySeated: ['thighL', 'thighR', 'shinL', 'shinR'],
  S_eagleArmsSeated: ['thighL', 'thighR', 'shinL', 'shinR'],
  S_neckRelease: ['thighL', 'thighR', 'shinL', 'shinR'],
  S_butterfly: ['thighL', 'thighR', 'footL', 'footR'],
  S_staff: ['thighL', 'thighR', 'footL', 'footR'],
  S_seatedFold: ['thighL', 'thighR', 'footL', 'footR'],
  S_seatedTwist: ['thighL', 'thighR'],
  S_seatedSideBend: ['thighL', 'thighR'],
  S_ardhaMatsy: ['thighL', 'thighR'],
  S_janu: ['thighL', 'thighR'],
  S_januPrep: ['thighL', 'thighR'],
  S_boat: ['thighL', 'thighR'],
  S_boatPrep: ['thighL', 'thighR', 'footL', 'footR'],
  // kneeling and all fours
  S_kneelHeels: ['shinL', 'shinR', 'footL', 'footR'],
  S_child: ['shinL', 'shinR', 'head', 'handL', 'handR'],
  S_highKneel: ['shinL', 'shinR'],
  S_camelPrep: ['shinL', 'shinR'],
  S_camel: ['shinL', 'shinR'],
  S_tabletop: ['shinL', 'shinR', 'handL', 'handR'],
  S_cat: ['shinL', 'shinR', 'handL', 'handR'],
  S_cow: ['shinL', 'shinR', 'handL', 'handR'],
  S_puppy: ['shinL', 'shinR', 'handL', 'handR', 'head'],
  S_threadNeedle: ['shinL', 'shinR'],
  S_plankKnees: ['shinL', 'shinR', 'handL', 'handR'],
  // planks: hands and the balls of the feet
  S_plank: ['handL', 'handR', 'toesL', 'toesR'],
  S_chaturanga: ['handL', 'handR', 'toesL', 'toesR'],
};
