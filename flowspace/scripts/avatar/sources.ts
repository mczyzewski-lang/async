/**
 * Downloads the CC0 source assets used to build public/models/instructor.glb into .avatar-cache/
 * (not committed). All files are released under CC0 1.0 by the MakeHuman team / their authors:
 *
 * - avatar: met4citizen/TalkingHead avatars/mpfb.glb (made with MPFB, CC0)
 * - MakeHuman hm08 base mesh, macro/breast/proportion targets (CC0 since 2020)
 * - MPFB "game_engine" rig skin weights (CC0)
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const CACHE = resolve(import.meta.dirname, '../../.avatar-cache');
const MH = 'https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman/data';

const ages = ['young'];
const levels = ['minmuscle', 'averagemuscle', 'maxmuscle'];
const weights = ['minweight', 'averageweight', 'maxweight'];

export const TARGETS: string[] = [
  ...['female', 'male'].flatMap((g) => ages.flatMap((a) => levels.flatMap((m) => weights.map((w) => `macrodetails/universal-${g}-${a}-${m}-${w}.target`)))),
  ...['minheight', 'maxheight'].map((h) => `macrodetails/height/female-young-averagemuscle-averageweight-${h}.target`),
  ...['idealproportions', 'uncommonproportions'].map((p) => `macrodetails/proportions/female-young-averagemuscle-averageweight-${p}.target`),
  ...['mincup', 'maxcup'].flatMap((c) => ['minfirmness', 'averagefirmness', 'maxfirmness'].map((f) => `breast/female-young-averagemuscle-averageweight-${c}-${f}.target`)),
  ...['african', 'asian', 'caucasian'].map((r) => `macrodetails/${r}-female-young.target`),
];

export const FILES: Record<string, string> = {
  'mpfb.glb': 'https://raw.githubusercontent.com/met4citizen/TalkingHead/main/avatars/mpfb.glb',
  'base.obj': `${MH}/3dobjs/base.obj`,
  'weights.game_engine.json': 'https://raw.githubusercontent.com/makehumancommunity/mpfb2/master/src/mpfb/data/rigs/standard/weights.game_engine.json',
  ...Object.fromEntries(TARGETS.map((t) => [`targets/${t}`, `${MH}/targets/${t}`])),
};

export async function fetchSources() {
  for (const [name, url] of Object.entries(FILES)) {
    const out = resolve(CACHE, name);
    if (existsSync(out)) continue;
    mkdirSync(dirname(out), { recursive: true });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    writeFileSync(out, Buffer.from(await res.arrayBuffer()));
    console.log('downloaded', name);
  }
}
