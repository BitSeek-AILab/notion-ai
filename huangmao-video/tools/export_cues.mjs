#!/usr/bin/env node
// Exports the picture's timing (shot starts + transitions, caption lines) as JSON for tools/sfx.py,
// so caption pops and transition whooshes always land on the frames that js/film.js draws.
//   node tools/export_cues.mjs            -> prints JSON and writes tools/cues_auto.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHOTS, CAPS, DUR } from '../js/film.js';
import { BPM, PH } from '../js/beat.js';

const shots = SHOTS.map(([a, b, fn, tr], i) => ({ i, t: +a.toFixed(4), end: +Math.min(b, DUR).toFixed(4), scene: fn.name, tr: tr ? { ...tr } : null }));
const caps = [];
CAPS.forEach((cp, k) => cp.lines.forEach((ln) => caps.push({ k, t: +ln.tIn.toFixed(4), out: +cp.b.toFixed(4), s: ln.s, n: [...ln.s].length, size: ln.size, flower: !!cp.flower })));
const out = { dur: DUR, bpm: BPM, ph: PH, shots, caps };
const json = JSON.stringify(out, null, 1);
fs.writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'cues_auto.json'), json + '\n');
process.stdout.write(json + '\n');
