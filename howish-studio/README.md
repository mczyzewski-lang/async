# HOWISH Creative Lab

**How things actually work.** — a working prototype of the HOWISH production engine: programmatic 3D explainers (Three.js), narration from ElevenLabs, deterministic MP4 export.

Pilot episode: **“How Do Planes Stay in the Air?”**, told four ways (60–75 s each) so the styles can be compared on the same content.

| | Style | Idea |
|---|---|---|
| A | Cinematic | Sunlit airliner at altitude; the wing is sliced open to reveal the airflow |
| B | Minimal | One diagram, four numbered steps, the "catch-up" myth debunked with a race |
| C | Playful | Plane and air-blob characters, hand-out-of-the-car-window metaphor |
| D | X-Ray | Transparent aircraft, pressure heat-map, force vectors, lift ∝ speed² |

## Run

```bash
cd howish-studio
npm install
npm run dev        # http://localhost:5173  (lab UI + local API in one process)
```

Other commands: `npm run build`, `npm run typecheck`, `npm test` (flow physics), `node scripts/smoke.mjs` (browser smoke test against a running dev server).

Without any keys the lab works fully: films play silently with subtitles on estimated timing.

## Narration (ElevenLabs)

```bash
cp .env.example .env    # set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID, restart npm run dev
```

- The key is read only by the local server (`server/voiceover.mjs`); nothing is bundled into the frontend.
- Audio is generated only when you press **Generate Voiceover** (per style). Voice ID and speed (0.7–1.2) can be overridden in that panel.
- The server calls `POST /v1/text-to-speech/{voice_id}/with-timestamps` and stores `public/audio/<episode>/<variant>-<hash>.mp3` plus a manifest with per-sentence times taken from the character timestamps. Identical requests are served from this cache.
- Once a manifest exists, the film re-times itself to the real audio: every animation, camera key and subtitle is keyed to cue ids, not to hard-coded seconds.

> The ElevenLabs endpoint, field names and default model (`eleven_multilingual_v2`) were written from prior knowledge of the API: the docs site was not reachable from the build environment, and no key was available to make a live call. Check them against the current API reference before relying on it; model and speed are set in `.env`.

## Export

**Export Video** in the UI (or the CLI) renders frame by frame: headless Chromium seeks the film to each frame time, captures the stage (WebGL canvas + DOM overlays + subtitles) and pipes frames to FFmpeg → H.264 MP4, 30 fps, with the narration muxed in when it exists.

```bash
npm run export -- --variant A                       # 1920×1080
npm run export -- --variant C --aspect 9:16         # 1080×1920 (experimental framing)
npm run export -- --variant B --height 720 --from 10 --to 20 --no-subs
```

Requirements: `ffmpeg` on PATH and Playwright's Chromium (`npm i -D playwright && npx playwright install chromium`). The dev server must be running (`--url` to point elsewhere). With a GPU this is quick; with software WebGL expect roughly 0.3–1.5 s per 1080p frame depending on the style.

## How it is built

```
src/engine/      types.ts      Episode · Variant · Scene · Cue · Timing · VoiceoverManifest
                 timing.ts     estimate or audio-measured timing, beat-normalised axis, subtitles, SRT
                 timeline.ts   Timeline handed to every film: now(), cue(id), scene(id)
                 player.ts     playhead; the audio element is the clock when narration exists
                 anim.ts       pure easing / ramp / camera-track helpers
src/kit/         flow.ts       real 2D potential flow around a Joukowski airfoil (tested)
                 airliner.tsx  procedural airliner, wings lofted from airfoil sections
                 three.tsx     CameraRig, FlowLines, FlowDots, Arrow, Tag …
                 overlay.tsx   Show, Live, Subtitles, Brand, Simplified chip
src/episodes/    flight/       facts, sources, simplifications, four scripts + storyboards, evaluation
src/styles/      cinematic · minimal · playful · xray — one FilmModule each ({ Film, Overlay })
src/ui/          lab interface, Stage, render page (/?render=A used by the exporter)
server/          local API: status, voiceover (ElevenLabs + cache), export jobs
scripts/         render.mjs (exporter), smoke.mjs (browser test)
```

Rules that keep it reusable:

- **Films are pure functions of time.** No accumulated state, no frame counters; pause, seek, compare and export all just set the time.
- **Visuals reference cue ids** (`tl.cue('a-turn-2').start`), so a new voice, speed or language only changes the timing map.
- **Compare Mode** maps every variant onto one axis by story beat (hook → mystery → how → aha → reveal), so pausing stops all four at the same logical point; one variant at a time supplies the narration.
- **A new episode** is a folder in `src/episodes` (facts, sources, scripts) plus film components that reuse the kit; a new style is another `FilmModule`.

## Science

Lift is explained as flow turning (Newton's third law) and as a pressure difference, presented as two views of one force; the equal-transit-time story is explicitly called out as a myth in style B. The streamlines, speeds, pressure map and "top parcel arrives first" race are computed from potential flow rather than drawn by hand. Sources and declared simplifications are listed in the **Science** tab and in `src/episodes/flight/index.ts`.
