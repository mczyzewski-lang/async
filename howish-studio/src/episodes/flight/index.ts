import type { Episode, EpisodeVariant, SceneDef, VisualStyle } from '../../engine/types';

/**
 * EPISODE 001 — "How Do Planes Stay in the Air?"
 * One set of facts, four tellings. Every claim below maps to a source.
 */

const styles: Record<'A' | 'B' | 'C' | 'D', VisualStyle> = {
  A: { id: 'A', key: 'cinematic', name: 'Cinematic', tagline: 'Documentary-grade 3D', narrationTone: 'Calm, fascinated, mystery-driven', accent: '#f4b860', subtitleClass: 'sub-cinematic' },
  B: { id: 'B', key: 'minimal', name: 'Minimal', tagline: 'Elegant science infographic', narrationTone: 'Very simple and logical', accent: '#ff5a36', subtitleClass: 'sub-minimal' },
  C: { id: 'C', key: 'playful', name: 'Playful', tagline: 'Friendly stylised 3D', narrationTone: 'Energetic, conversational, curious', accent: '#ffc83d', subtitleClass: 'sub-playful' },
  D: { id: 'D', key: 'xray', name: 'X-Ray', tagline: 'See-through technical', narrationTone: 'Technical but very clear', accent: '#38e1ff', subtitleClass: 'sub-xray' },
};

const A: SceneDef[] = [
  {
    id: 'a-hook', title: 'Four hundred tons', beat: 'hook',
    cues: [
      { id: 'a-hook-1', text: 'Four hundred tons of metal, fuel and people.' },
      { id: 'a-hook-2', text: 'Eleven kilometers above the ground. And nothing is holding it up.' },
    ],
    objects: ['Airliner', 'Cloud deck', 'Sun, atmosphere'], camera: 'Wide orbit from below-front, sun flare behind the tail',
    onScreenText: ['400 t', '11 km'], targetState: 'Plane established as impossibly heavy and unsupported',
  },
  {
    id: 'a-mystery', title: 'Air seems like nothing', beat: 'mystery',
    cues: [
      { id: 'a-mys-1', text: 'Air seems like nothing. You walk through it without noticing.' },
      { id: 'a-mys-2', text: 'So how can something so thin carry something so heavy?' },
    ],
    objects: ['Airliner', 'Weight arrow'], camera: 'Slow push along the fuselage toward the wing root',
    onScreenText: ['What holds it up?'], targetState: 'Weight arrow pulling down, no visible support',
  },
  {
    id: 'a-wing', title: 'The wing', beat: 'how',
    cues: [
      { id: 'a-wing-1', text: 'The answer is the wing, and what it does to the air.' },
      { id: 'a-wing-2', text: 'It is curved, and tilted slightly upward.' },
    ],
    objects: ['Wing', 'Glowing cross-section slice'], camera: 'Fly in to the wing; a light slice reveals its cross-section',
    onScreenText: ['Curved', 'Tilted a few degrees'], targetState: 'Viewer sees the wing as a shape in cross-section',
  },
  {
    id: 'a-turn', title: 'Air is turned downward', beat: 'how',
    cues: [
      { id: 'a-turn-1', text: 'Air follows that surface, above and below, and leaves pointing down.' },
      { id: 'a-turn-2', text: 'The wing pushes air down. The air pushes the wing up.' },
    ],
    objects: ['Wing section', 'Computed streamlines', 'Air parcels', 'Action / reaction arrows'], camera: 'Side-on, slow lateral drift with the flow',
    onScreenText: ['Air pushed down', 'Wing pushed up'], targetState: 'Flow visibly deflected down; equal-and-opposite arrows',
    simplification: 'Flow shown as a 2D slice of smooth, frictionless air. Real flow is 3D and slightly turbulent.',
  },
  {
    id: 'a-pressure', title: 'The same force, seen as pressure', beat: 'how',
    cues: [
      { id: 'a-pres-1', text: 'You can measure the same push as pressure: lower above the wing, higher below.' },
      { id: 'a-pres-2', text: 'Two views of one force. Lift.' },
    ],
    objects: ['Wing section', 'Pressure field', 'Lift arrow'], camera: 'Hold side-on, ease closer',
    onScreenText: ['Lower pressure', 'Higher pressure', 'LIFT'], targetState: 'Pressure map and deflection shown together as one explanation',
    simplification: 'Colours show pressure relative to the surrounding air; differences are exaggerated for visibility.',
  },
  {
    id: 'a-speed', title: 'Speed', beat: 'how',
    cues: [
      { id: 'a-speed-1', text: 'But it only works at speed. Double the speed, and lift grows four times.' },
      { id: 'a-speed-2', text: 'That is what the engines are for.' },
    ],
    objects: ['Airliner', 'Lift arrow growing', 'Engine glow'], camera: 'Pull back out to the whole aircraft, tracking alongside',
    onScreenText: ['2× speed → 4× lift'], targetState: 'Lift tied to speed; engines provide speed, not lift',
  },
  {
    id: 'a-aha', title: 'Not floating', beat: 'aha',
    cues: [
      { id: 'a-aha-1', text: 'So an airplane is not floating.' },
      { id: 'a-aha-2', text: 'Every second, it throws tons of air toward the ground, and rides the reaction.' },
    ],
    objects: ['Airliner', 'Downwash sheet behind the wings'], camera: 'Rear three-quarter chase, looking along the descending wake',
    onScreenText: ['Tons of air, every second'], targetState: 'Viewer sees a continuous stream of air sent downward behind the aircraft',
    simplification: '"Tons per second" is an order-of-magnitude estimate from momentum balance for a large airliner.',
  },
  {
    id: 'a-reveal', title: 'Four forces', beat: 'reveal',
    cues: [
      { id: 'a-rev-1', text: 'Lift balances weight. Thrust balances drag.' },
      { id: 'a-rev-2', text: 'That is how four hundred tons stay in the sky.' },
    ],
    objects: ['Airliner', 'Four force arrows'], camera: 'Wide heroic profile, slow pull-out into the sunset',
    onScreenText: ['Lift', 'Weight', 'Thrust', 'Drag', 'HOWISH — How things actually work.'], targetState: 'Balanced forces; brand sign-off',
  },
];

const B: SceneDef[] = [
  {
    id: 'b-hook', title: 'Heavier than air', beat: 'hook',
    cues: [{ id: 'b-hook-1', text: 'A plane is heavier than air. Much heavier. So why doesn\'t it fall?' }],
    objects: ['Flat plane icon', 'Weight arrow'], camera: 'Static front-on, plane drifts in',
    onScreenText: ['Why doesn\'t it fall?'], targetState: 'One plane, one downward arrow, one question',
  },
  {
    id: 'b-myth', title: 'The catch-up myth', beat: 'mystery',
    cues: [
      { id: 'b-myth-1', text: 'You may have heard that air on top has to speed up to catch the air below.' },
      { id: 'b-myth-2', text: 'That is a myth. Watch two bits of air that start together. The top one wins. It never waits.' },
    ],
    objects: ['Wing section', 'Two marked air parcels'], camera: 'Flat side view, locked',
    onScreenText: ['Myth: "air must catch up"', 'Top arrives first'], targetState: 'Top parcel clearly ahead at the trailing edge',
    simplification: 'Computed for smooth, frictionless 2D flow.',
  },
  {
    id: 'b-steps', title: 'What really happens', beat: 'how',
    cues: [
      { id: 'b-step-1', text: 'Here is what really happens. One: the wing moves forward, fast.' },
      { id: 'b-step-2', text: 'Two: it is curved, and tilted a few degrees.' },
      { id: 'b-step-3', text: 'Three: air flowing past bends to follow it, and leaves heading down.' },
      { id: 'b-step-4', text: 'Four: pushing air down pushes the wing up. That push is lift.' },
    ],
    objects: ['Wing section', 'Streamlines', 'Tilt angle arc', 'Down / up arrows'], camera: 'Locked side view; subtle zoom per step',
    onScreenText: ['1 Moves fast', '2 Curved + tilted', '3 Air turns down', '4 Wing pushed up'], targetState: 'Four numbered steps accumulated on one diagram',
    simplification: 'Arrow lengths are illustrative, not to scale.',
  },
  {
    id: 'b-pressure', title: 'Pressure agrees', beat: 'how',
    cues: [{ id: 'b-pres-1', text: 'Measure the pressure and you find the same thing: less on top, more below.' }],
    objects: ['Wing section', 'Pressure zones'], camera: 'Locked side view',
    onScreenText: ['− lower pressure', '+ higher pressure'], targetState: 'Two soft zones, above and below',
    simplification: 'Zones show pressure relative to surrounding air, exaggerated.',
  },
  {
    id: 'b-speed', title: 'Speed squared', beat: 'how',
    cues: [{ id: 'b-speed-1', text: 'More speed means more lift. Twice the speed gives four times the lift.' }],
    objects: ['Wing section', 'Speed bar', 'Lift bar'], camera: 'Slide left to make room for two bars',
    onScreenText: ['Speed ×2', 'Lift ×4'], targetState: 'Bars: speed doubles, lift quadruples',
  },
  {
    id: 'b-aha', title: 'Lift equals weight', beat: 'aha',
    cues: [
      { id: 'b-aha-1', text: 'When lift equals weight, the plane holds its height.' },
      { id: 'b-aha-2', text: 'Nothing is floating. The wing is working, every moment.' },
    ],
    objects: ['Flat plane', 'Lift and weight arrows', 'Stream of air going down'], camera: 'Back to the plane, front-on',
    onScreenText: ['Lift = Weight'], targetState: 'Two equal arrows; air continuously sent downward',
  },
  {
    id: 'b-reveal', title: 'That\'s flight', beat: 'reveal',
    cues: [{ id: 'b-rev-1', text: 'A wing turns air down. Air pushes the wing up. That\'s flight.' }],
    objects: ['Wing section', 'Summary arrows', 'Brand'], camera: 'Settle centred',
    onScreenText: ['Air down. Wing up.', 'HOWISH — How things actually work.'], targetState: 'One-line summary and sign-off',
  },
];

const Cc: SceneDef[] = [
  {
    id: 'c-hook', title: 'Eighty elephants', beat: 'hook',
    cues: [
      { id: 'c-hook-1', text: 'This plane weighs as much as eighty elephants. Eighty!' },
      { id: 'c-hook-2', text: 'And it\'s just up there. Relaxing.' },
    ],
    objects: ['Cheerful plane character', 'Puffy clouds', 'Elephant counter'], camera: 'Bouncy follow-cam, plane wiggles its wings',
    onScreenText: ['= 80 elephants'], targetState: 'Lovable heavy hero, floating smugly',
    simplification: 'A big airliner at ~400 t vs. ~5 t per African elephant.',
  },
  {
    id: 'c-mystery', title: 'No strings', beat: 'mystery',
    cues: [{ id: 'c-mys-1', text: 'No strings. No balloons. No flapping. So what\'s the trick?' }],
    objects: ['Plane', 'String, balloon, flapping gags crossed out'], camera: 'Quick whip between three gags',
    onScreenText: ['Strings ✕', 'Balloons ✕', 'Flapping ✕'], targetState: 'Three wrong ideas dismissed',
  },
  {
    id: 'c-hand', title: 'Hand out the window', beat: 'how',
    cues: [
      { id: 'c-hand-1', text: 'You already know it. Ever put your hand out of a car window?' },
      { id: 'c-hand-2', text: 'Tilt it up a little, and whoosh! The air shoves it upward.' },
    ],
    objects: ['Little car', 'Hand', 'Air blobs'], camera: 'Side tracking shot of the car',
    onScreenText: ['Tilt…', 'Whoosh!'], targetState: 'Tilted hand deflects air blobs down and rises',
    simplification: 'A flat hand makes lift the same basic way as a wing, just far less efficiently.',
  },
  {
    id: 'c-wing', title: 'A wing is that hand, perfected', beat: 'how',
    cues: [
      { id: 'c-wing-1', text: 'A wing is that hand, perfected. Tilted, curved, and super smooth.' },
      { id: 'c-wing-2', text: 'Air hugs the curve, and gets flung downward.' },
      { id: 'c-wing-3', text: 'And air pushes back. Up!' },
    ],
    objects: ['Chunky wing section', 'Air blob characters following real streamlines', 'Up arrow'], camera: 'Hand morph-cuts to wing; side view',
    onScreenText: ['Air goes down', 'Wing goes UP'], targetState: 'Blobs flung down, wing bounces upward',
    simplification: 'Air blobs are cartoon stand-ins for parcels of air, moving along computed flow paths.',
  },
  {
    id: 'c-pressure', title: 'Same push, different glasses', beat: 'how',
    cues: [{ id: 'c-pres-1', text: 'Scientists also see it as pressure: lower on top, higher underneath. Same push, different glasses.' }],
    objects: ['Wing', 'Goggles wipe', 'Pressure colours'], camera: 'Goggles slide over the lens',
    onScreenText: ['Low pressure', 'High pressure'], targetState: 'Same scene re-tinted as pressure zones',
  },
  {
    id: 'c-speed', title: 'Needs speed', beat: 'how',
    cues: [
      { id: 'c-speed-1', text: 'The catch? It needs speed. Lots of it.' },
      { id: 'c-speed-2', text: 'That\'s the engines\' job. Not lifting. Just going fast.' },
    ],
    objects: ['Plane on runway', 'Speedometer', 'Engines'], camera: 'Runway side chase; lift-off at the end',
    onScreenText: ['Engines = speed', 'Wings = lift'], targetState: 'Plane accelerates and lifts off only when fast',
  },
  {
    id: 'c-aha', title: 'Surfing on air', beat: 'aha',
    cues: [
      { id: 'c-aha-1', text: 'So the plane isn\'t floating like a balloon.' },
      { id: 'c-aha-2', text: 'It\'s surfing, on air it keeps throwing down.' },
    ],
    objects: ['Plane', 'Stream of air blobs sent downward'], camera: 'Rear chase with blobs streaming down',
    onScreenText: ['Not floating — pushing!'], targetState: 'Continuous downward stream of blobs under the wings',
    simplification: '"Surfing" is a metaphor: the wing is held up by the reaction to air it deflects downward.',
  },
  {
    id: 'c-reveal', title: 'No strings attached', beat: 'reveal',
    cues: [{ id: 'c-rev-1', text: 'Push air down, get pushed up. Eighty elephants, no strings attached.' }],
    objects: ['Plane', 'Sunset clouds', 'Brand'], camera: 'Plane loops toward camera and off into the sunset',
    onScreenText: ['Push air down → get pushed up', 'HOWISH — How things actually work.'], targetState: 'Happy summary and sign-off',
  },
];

const D: SceneDef[] = [
  {
    id: 'd-hook', title: 'Switch off the paint', beat: 'hook',
    cues: [{ id: 'd-hook-1', text: 'Let\'s switch off the paint, and look at flight the way an engineer does.' }],
    objects: ['Airliner turning transparent', 'Scan line'], camera: 'Three-quarter front; scan sweeps nose to tail',
    onScreenText: ['X-RAY: ON'], targetState: 'Aircraft rendered as a glowing transparent structure',
  },
  {
    id: 'd-mystery', title: 'Where is the force?', beat: 'mystery',
    cues: [{ id: 'd-mys-1', text: 'One pair of wings. Four hundred tons. Where exactly does the force come from?' }],
    objects: ['X-ray airliner', 'Load readout', 'Wing highlight'], camera: 'Orbit to the wing, readouts lock on',
    onScreenText: ['MASS 400 t', 'REQUIRED LIFT ≈ 3.9 MN'], targetState: 'Wing isolated as the component under investigation',
    simplification: '3.9 MN is simply 400 t × g.',
  },
  {
    id: 'd-flow', title: 'Trace the airflow', beat: 'how',
    cues: [
      { id: 'd-flow-1', text: 'Start with the airflow. Each line is a path that air takes around the wing.' },
      { id: 'd-flow-2', text: 'Above the wing, the lines squeeze together. The air there speeds up, and its pressure drops.' },
    ],
    objects: ['Wing section slice', 'Streamlines', 'Speed-coloured particles'], camera: 'Cut into the wing slice, side-on',
    onScreenText: ['STREAMLINES', 'FASTER → LOWER PRESSURE'], targetState: 'Streamlines drawn; fast region above highlighted',
    simplification: 'Inviscid 2D model. Speed and pressure are linked along each streamline (Bernoulli).',
  },
  {
    id: 'd-pressure', title: 'Pressure map', beat: 'how',
    cues: [
      { id: 'd-pres-1', text: 'Below, the air slows and pressure rises.' },
      { id: 'd-pres-2', text: 'The wing is pulled from above and pushed from below. Most of the lift comes from the top.' },
    ],
    objects: ['Pressure heat-map', 'Surface force vectors'], camera: 'Hold; slight push-in',
    onScreenText: ['LOW P', 'HIGH P'], targetState: 'Heat-map with force vectors normal to the surface',
    simplification: 'Pressure differences exaggerated; vectors illustrative.',
  },
  {
    id: 'd-wake', title: 'Follow the air behind', beat: 'how',
    cues: [
      { id: 'd-wake-1', text: 'Now follow the air behind the wing. It leaves angled downward.' },
      { id: 'd-wake-2', text: 'Low pressure above, air turned down behind: one force, measured two ways.' },
    ],
    objects: ['Streamlines', 'Downwash vector', 'Reaction vector'], camera: 'Drift aft to the trailing edge',
    onScreenText: ['DOWNWASH', 'REACTION = LIFT'], targetState: 'Momentum view and pressure view tied together',
  },
  {
    id: 'd-speed', title: 'Speed squared', beat: 'how',
    cues: [{ id: 'd-speed-1', text: 'The force scales with the square of speed. At takeoff speed, lift finally exceeds weight.' }],
    objects: ['Lift-vs-speed curve', 'Weight threshold line'], camera: 'Graph plane slides in beside the wing',
    onScreenText: ['LIFT ∝ SPEED²', 'LIFT > WEIGHT'], targetState: 'Curve crosses the weight line',
  },
  {
    id: 'd-aha', title: 'An exchange of momentum', beat: 'aha',
    cues: [
      { id: 'd-aha-1', text: 'So lift is not a property of the wing alone.' },
      { id: 'd-aha-2', text: 'It is a continuous exchange. The wing changes the air\'s momentum, and the air returns the favor.' },
    ],
    objects: ['X-ray airliner', 'Downwash field behind wings'], camera: 'Pull back to the whole aircraft from behind',
    onScreenText: ['AIR ↓  ⇄  WING ↑'], targetState: 'Whole-aircraft view of the air stream being deflected',
  },
  {
    id: 'd-reveal', title: 'Four forces in balance', beat: 'reveal',
    cues: [{ id: 'd-rev-1', text: 'Weight, lift, thrust, drag. Balance all four, and four hundred tons fly straight and level.' }],
    objects: ['X-ray airliner', 'Four vectors', 'Brand'], camera: 'Profile, slow settle',
    onScreenText: ['LIFT', 'WEIGHT', 'THRUST', 'DRAG', 'HOWISH — How things actually work.'], targetState: 'Free-body diagram in balance; sign-off',
  },
];

const variant = (id: 'A' | 'B' | 'C' | 'D', scenes: SceneDef[]): EpisodeVariant => ({ id, visualStyle: styles[id], scenes, assets: ['procedural:airliner', 'procedural:joukowski-flow'] });

export const flightEpisode: Episode = {
  id: 'flight',
  title: 'How Do Planes Stay in the Air?',
  topic: 'Aerodynamic lift',
  language: 'en',
  hookLine: 'Four hundred tons, eleven kilometers up — and nothing is holding it.',
  facts: [
    { id: 'f1', statement: 'Lift is generated when a moving wing turns the airflow; the wing pushes air down and the air pushes the wing up (Newton\'s third law).', sources: ['nasa-lift', 'nasa-turning'] },
    { id: 'f2', statement: 'The same force appears as a pressure difference: lower pressure above the wing, higher below. Pressure and flow-turning are two descriptions of one phenomenon, not competing causes.', sources: ['nasa-bernoulli-newton', 'babinsky'] },
    { id: 'f3', statement: 'The "equal transit time" story is wrong: air over the top is not required to rejoin the air below, and in fact arrives first.', sources: ['nasa-wrong1', 'babinsky'] },
    { id: 'f4', statement: 'Both the curvature (camber) and the tilt (angle of attack) of a wing contribute to turning the flow.', sources: ['nasa-incline', 'babinsky'] },
    { id: 'f5', statement: 'Lift is proportional to air density, wing area and the square of airspeed.', sources: ['nasa-lift-eq'] },
    { id: 'f6', statement: 'In steady level flight lift equals weight and thrust equals drag. Engines provide thrust, not lift.', sources: ['nasa-forces'] },
    { id: 'f7', statement: 'A large airliner such as the Airbus A380 has a maximum take-off weight of about 575 t; "400 t" is a representative in-flight figure for a large long-haul jet.', sources: ['airbus-a380'] },
  ],
  simplifications: [
    { id: 's1', note: 'All flow visuals use a 2D, frictionless (potential-flow) model of a Joukowski airfoil. Real wings are 3D, with wingtip vortices and thin boundary layers.' },
    { id: 's2', note: 'Arrow lengths and pressure colours are exaggerated for legibility.' },
    { id: 's3', note: 'Stall (flow separation at high tilt) is intentionally left for a follow-up episode.' },
    { id: 's4', note: '"Tons of air per second" is an order-of-magnitude momentum estimate, not a measured value.' },
  ],
  scientificSources: [
    { id: 'nasa-lift', title: 'What is Lift?', publisher: 'NASA Glenn Research Center — Beginner\'s Guide to Aeronautics', url: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/what-is-lift/', supports: 'Definition of lift; lift from turning a moving fluid' },
    { id: 'nasa-turning', title: 'Lift from Flow Turning', publisher: 'NASA Glenn Research Center', url: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/lift-from-flow-turning/', supports: 'Wing turns the flow; action and reaction' },
    { id: 'nasa-bernoulli-newton', title: 'Bernoulli and Newton', publisher: 'NASA Glenn Research Center', url: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/bernoulli-and-newton/', supports: 'Pressure and momentum explanations are both correct and equivalent' },
    { id: 'nasa-wrong1', title: 'Incorrect Lift Theory #1 ("Equal Transit")', publisher: 'NASA Glenn Research Center', url: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/wrong1/', supports: 'Why the equal-transit-time explanation is wrong' },
    { id: 'nasa-incline', title: 'Inclination Effects on Lift', publisher: 'NASA Glenn Research Center', url: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/inclination-effects-on-lift/', supports: 'Angle of attack and lift' },
    { id: 'nasa-lift-eq', title: 'The Lift Equation', publisher: 'NASA Glenn Research Center', url: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/lift-equation/', supports: 'L = Cl · ½ρv² · A — lift grows with speed squared' },
    { id: 'nasa-forces', title: 'Four Forces on an Airplane', publisher: 'NASA Glenn Research Center', url: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/four-forces-on-an-airplane/', supports: 'Lift, weight, thrust, drag and their balance' },
    { id: 'babinsky', title: 'How do wings work?', publisher: 'H. Babinsky, Physics Education 38 (6), 2003 — IOP Publishing', url: 'https://iopscience.iop.org/article/10.1088/0031-9120/38/6/001', supports: 'Flow curvature and pressure; debunks equal transit with wind-tunnel imagery' },
    { id: 'airbus-a380', title: 'A380 — facts and figures', publisher: 'Airbus', url: 'https://aircraft.airbus.com/en/aircraft/a380', supports: 'Maximum take-off weight of a large airliner' },
  ],
  variants: { A: variant('A', A), B: variant('B', B), C: variant('C', Cc), D: variant('D', D) },
};
