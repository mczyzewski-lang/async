// HOWISH local API, mounted into the Vite dev and preview servers.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { AUDIO_DIR, ROOT, config, generateVoiceover, readManifest } from './voiceover.mjs';

const EXPORT_DIR = path.join(ROOT, 'exports');
const jobs = new Map();
let jobSeq = 0;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 2e6) reject(new Error('body too large')); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
  });
}
function sendFile(req, res, file, type) {
  if (!fs.existsSync(file)) return send(res, 404, { error: 'not found' });
  const size = fs.statSync(file).size;
  res.setHeader('Content-Type', type);
  res.setHeader('Accept-Ranges', 'bytes');
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (m) {
    const start = m[1] ? Number(m[1]) : 0;
    const end = m[2] ? Number(m[2]) : size - 1;
    res.statusCode = 206;
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    res.setHeader('Content-Length', end - start + 1);
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.setHeader('Content-Length', size);
  fs.createReadStream(file).pipe(res);
}
const hasFfmpeg = () => spawnSync('ffmpeg', ['-version']).status === 0;

async function handle(req, res, next) {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith('/api/')) return next();
  try {
    if (url.pathname === '/api/status') {
      const c = config();
      return send(res, 200, { hasKey: !!c.apiKey, hasVoice: !!c.voiceId, voiceId: c.voiceId, modelId: c.modelId, speed: c.speed, ffmpeg: hasFfmpeg() });
    }
    if (url.pathname === '/api/voiceover' && req.method === 'GET') {
      return send(res, 200, { manifest: readManifest(url.searchParams.get('episode'), url.searchParams.get('variant')) });
    }
    if (url.pathname === '/api/voiceover' && req.method === 'POST') {
      const out = await generateVoiceover(await readBody(req));
      return send(res, 200, out);
    }
    if (url.pathname.startsWith('/api/audio/')) {
      const rel = url.pathname.slice('/api/audio/'.length).split('/').map((s) => s.replace(/[^a-zA-Z0-9_.-]/g, '')).join('/');
      return sendFile(req, res, path.join(AUDIO_DIR, rel), 'audio/mpeg');
    }
    if (url.pathname === '/api/export' && req.method === 'POST') {
      const body = await readBody(req);
      const running = [...jobs.values()].find((j) => j.state === 'running');
      if (running) return send(res, 409, { error: 'An export is already running.', job: running });
      const variant = String(body.variantId || 'A').replace(/[^A-D]/g, '') || 'A';
      const aspect = body.aspect === '9:16' ? '9:16' : '16:9';
      const height = [540, 720, 1080].includes(body.height) ? body.height : 1080;
      const id = String(++jobSeq);
      const name = `howish-${String(body.episodeId || 'episode').replace(/[^a-z0-9-]/gi, '')}-${variant}-${aspect.replace(':', 'x')}-${height}p.mp4`;
      const origin = `http://${req.headers.host}`;
      const job = { id, state: 'running', progress: 0, file: name, variant, error: null, log: '' };
      jobs.set(id, job);
      const child = spawn(process.execPath, ['scripts/render.mjs', '--variant', variant, '--url', origin, '--aspect', aspect, '--height', String(height), '--out', path.join('exports', name)], { cwd: ROOT });
      const onData = (d) => {
        const s = String(d);
        job.log = (job.log + s).slice(-2000);
        const m = [...s.matchAll(/PROGRESS (\d+)\/(\d+)/g)].pop();
        if (m) job.progress = Number(m[1]) / Number(m[2]);
      };
      child.stdout.on('data', onData);
      child.stderr.on('data', onData);
      child.on('close', (code) => {
        job.state = code === 0 ? 'done' : 'error';
        if (code !== 0) job.error = job.log.split('\n').filter(Boolean).slice(-3).join(' | ');
        else job.progress = 1;
      });
      return send(res, 200, { job });
    }
    if (url.pathname === '/api/export' && req.method === 'GET') {
      const job = jobs.get(url.searchParams.get('id'));
      return job ? send(res, 200, { job: { ...job, log: undefined } }) : send(res, 404, { error: 'unknown job' });
    }
    if (url.pathname === '/api/export/file') {
      const name = path.basename(url.searchParams.get('name') || '');
      res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
      return sendFile(req, res, path.join(EXPORT_DIR, name), 'video/mp4');
    }
    send(res, 404, { error: 'unknown endpoint' });
  } catch (e) {
    send(res, e.status || 500, { error: e.message || String(e) });
  }
}

export function howishApi() {
  return {
    name: 'howish-api',
    configureServer(server) { server.middlewares.use(handle); },
    configurePreviewServer(server) { server.middlewares.use(handle); },
  };
}
