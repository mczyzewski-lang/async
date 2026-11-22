import type { VariantId } from '../../engine/types';

export const CRITERIA = [
  { id: 'clarity', label: 'Clarity' },
  { id: 'appeal', label: 'Visual Appeal' },
  { id: 'retention', label: 'Attention Retention Potential' },
  { id: 'accuracy', label: 'Scientific Accuracy' },
  { id: 'reuse', label: 'Production Reusability' },
];

/** Editorial judgement of the prototype — NOT audience data. */
export const EXPERT: Record<VariantId, Record<string, number>> = {
  A: { clarity: 4, appeal: 5, retention: 4, accuracy: 5, reuse: 3 },
  B: { clarity: 5, appeal: 3, retention: 3, accuracy: 5, reuse: 5 },
  C: { clarity: 4, appeal: 4, retention: 5, accuracy: 4, reuse: 3 },
  D: { clarity: 4, appeal: 4, retention: 4, accuracy: 5, reuse: 4 },
};

export const RECOMMENDATION = {
  headline: 'Hybrid: Cinematic hook → Minimal explanation → X-Ray reveal',
  points: [
    'Open in Cinematic (A): the real-world scale shot earns the click and sets the mystery in five seconds.',
    'Explain in Minimal (B): numbered steps on one persistent diagram scored highest on clarity, and it is the cheapest style to re-skin for a new topic.',
    'Pay off in X-Ray (D): the computed pressure map and flow data make the "two views, one force" moment feel earned and technical.',
    'Keep Playful (C) as the Shorts format: its metaphor-first pacing fits 30–45 s vertical cuts and a broader audience.',
    'All four already share one physics kit and one timeline engine, so a hybrid is an edit decision, not a rebuild.',
  ],
  notes: {
    A: 'Highest production value and strongest first impression; needs the most per-episode art direction (lighting, camera paths).',
    B: 'Clearest cause-and-effect; visually the least distinctive on a crowded YouTube shelf unless the brand typography carries it.',
    C: 'Most personality and best fit for Shorts; metaphors need a disclosure line each, and characters add modelling time per topic.',
    D: 'Makes the data the hero and reuses well for any "inside the machine" topic; denser, so it suits the second half of a video.',
  } as Record<VariantId, string>,
};
