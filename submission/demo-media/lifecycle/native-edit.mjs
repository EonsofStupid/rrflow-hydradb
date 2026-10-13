// Build only this new, unshared project with the hosted Higgsedit CLI.
// Fonts must first be vendored: higgsedit fonts add higgsedit-project Inter:400 Inter:600
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(here, 'edit-manifest.json'), 'utf8'));
const fps = 24;
const frameTolerance = 1 / fps;
const check = (condition, message) => { if (!condition) throw new Error(message); };
const stamp = (seconds) => {
  const ms = Math.round(seconds * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
};

export default async ({ project, text, rect, frame }) => {
  check(manifest.version === 1 && manifest.reviewed === true, 'The exact source and caption manifest must be reviewed first.');
  check(Array.isArray(manifest.scenes) && manifest.scenes.length > 0, 'No reviewed scenes.');
  check(manifest.targetSeconds >= 285 && manifest.targetSeconds <= 295, 'Expected a 4:45–4:55 lifecycle film.');
  const p = await project({ dir: join(here, 'higgsedit-project'), size: '1920x1080', fps, background: '#0b1410' });
  const assetMap = new Map();
  const inputLedger = [];
  const sourceNames = new Set();
  for (const input of manifest.inputs) {
    check(input.file === basename(input.file) && !sourceNames.has(input.file), 'Inputs must have unique plain filenames.');
    check(input.reviewed === true && /^[a-f0-9]{64}$/.test(input.sha256), `Unreviewed input: ${input.file}`);
    sourceNames.add(input.file);
    const path = join(here, 'inputs', input.file);
    check(existsSync(path), `Missing approved source: ${input.file}`);
    check(createHash('sha256').update(readFileSync(path)).digest('hex') === input.sha256, `Source checksum differs: ${input.file}`);
    const handle = await p.add(path);
    assetMap.set(input.file, handle);
    inputLedger.push({ file: input.file, sha256: input.sha256, duration: handle.duration, width: handle.width, height: handle.height });
  }
  const sceneIds = new Set();
  const allCues = [];
  const frameTimes = [];
  let at = 0;
  for (const scene of manifest.scenes) {
    check(/^[a-z0-9-]+$/.test(scene.id) && !sceneIds.has(scene.id), 'Scene IDs must be unique slugs.');
    check(scene.reviewed === true && scene.captionsReviewed === true, `Scene is not reviewed: ${scene.id}`);
    check(Number.isFinite(scene.duration) && scene.duration > 0, `Invalid duration: ${scene.id}`);
    check(Array.isArray(scene.shots) && scene.shots.length > 0, `Missing actual footage: ${scene.id}`);
    sceneIds.add(scene.id);
    let local = 0;
    for (const shot of scene.shots) {
      const asset = assetMap.get(shot.file);
      check(asset, `Unapproved source file: ${shot.file}`);
      check(Number.isFinite(shot.from) && shot.from >= 0 && Number.isFinite(shot.duration) && shot.duration > 0, `Invalid source cut: ${scene.id}`);
      check(Number.isFinite(asset.duration) && shot.from + shot.duration <= asset.duration + 0.05, `Source is too short: ${shot.file}`);
      // A native cut preserves recorded speed. No generated controls or source-frame replacement.
      p.cut(asset, { from: shot.from, dur: shot.duration, at: at + local, fit: 'contain' });
      local += shot.duration;
    }
    check(Math.abs(local - scene.duration) < frameTolerance, `Cuts do not fill the slot: ${scene.id}`);
    const accent = scene.loop === 'development' ? '#d2c2f6' : '#b5e8c5';
    const label = scene.id === 'intro' ? 'Concept illustration' : scene.label;
    check(typeof label === 'string' && label.length > 0 && label.length < 105, `Missing clear scope label: ${scene.id}`);
    const labelWidth = Math.min(1170, Math.max(300, label.length * 13 + 36));
    p.compose(frame({ x: 40, y: 32, width: labelWidth, height: 50, layout: 'none', background: '#08110ee8', radius: 10 }, [
      rect({ x: 0, y: 0, width: 4, height: 50, fill: accent, radius: 2 }),
      text(label, { x: 18, y: 12, width: labelWidth - 34, height: 29, fontFamily: 'Inter', fontSize: 22, color: '#eff6f1' }),
    ]), { at, dur: scene.duration, name: `${scene.id}-scope` });
    if (scene.id !== 'intro') {
      p.compose(frame({ x: 1430, y: 36, width: 450, height: 43, layout: 'none', background: '#08110ed9', radius: 9 }, [
        text(scene.provenance, { x: 12, y: 10, width: 426, height: 26, fontFamily: 'Inter', fontSize: 17, align: 'right', color: '#dce7e0' }),
      ]), { at, dur: scene.duration, name: `${scene.id}-provenance` });
    } else {
      p.compose(text('RRFLOW', { x: 420, y: 448, width: 1080, height: 120, fontFamily: 'Inter', fontSize: 88, fontWeight: 600, align: 'center', color: '#f1f7f2' }), { at, dur: scene.duration, name: 'RRFLOW-title' });
    }
    if (scene.id === 'close') {
      p.compose(frame({ x: 245, y: 350, width: 1430, height: 345, layout: 'none', background: '#08110ef5', radius: 24 }, [
        text('The next attempt starts with evidence.', { x: 65, y: 55, width: 1300, height: 70, fontFamily: 'Inter', fontSize: 49, fontWeight: 600, align: 'center', color: '#eff6f1' }),
        text('Explore the curated event · owner workspace requires sign-in', { x: 65, y: 150, width: 1300, height: 42, fontFamily: 'Inter', fontSize: 25, align: 'center', color: '#b5e8c5' }),
        text('rrflow-mv63m3vynl0-prod.cloud.modelence.app', { x: 65, y: 220, width: 1300, height: 42, fontFamily: 'Inter', fontSize: 31, align: 'center', color: '#eff6f1' }),
      ]), { at, dur: scene.duration, name: 'verified-hosted-event-endcard' });
    }
    let previousEnd = 0;
    for (let index = 0; index < scene.captions.length; index++) {
      const cue = scene.captions[index];
      check(Number.isFinite(cue.start) && cue.start >= previousEnd && cue.end > cue.start && cue.end <= scene.duration, `Invalid cue timing: ${scene.id}/${index}`);
      check(typeof cue.text === 'string' && cue.text.trim().length > 0 && cue.text.length <= 220, `Invalid caption text: ${scene.id}/${index}`);
      previousEnd = cue.end;
      const lines = cue.text.split('\n');
      check(lines.length <= 3, `Caption has too many lines: ${scene.id}/${index}`);
      const height = lines.length === 1 ? 78 : lines.length === 2 ? 119 : 158;
      const y = cue.position === 'top' ? 110 : 1032 - height;
      const width = Math.min(1690, Math.max(780, Math.max(...lines.map(line => line.length)) * 18 + 72));
      const duration = cue.end - cue.start;
      p.compose(frame({ x: (1920 - width) / 2, y, width, height, layout: 'none', background: '#08110ee8', radius: 13, motion: {
        enter: { from: { y: 6, opacity: 0 }, duration: Math.min(0.18, duration / 4) },
        exit: { to: { opacity: 0 }, duration: Math.min(0.14, duration / 4), anchor: 'end' },
      } }, [text(cue.text, { x: 26, y: 17, width: width - 52, height: height - 28, fontFamily: 'Inter', fontSize: 34, fontWeight: 600, lineHeight: 1.2, align: 'center', color: '#f1f7f2' })]), { at: at + cue.start, dur: duration, name: `${scene.id}-caption-${index + 1}` });
      allCues.push({ start: at + cue.start, end: at + cue.end, text: cue.text });
    }
    frameTimes.push({ scene: scene.id, time: at + Math.min(scene.duration - 1, scene.previewAt ?? scene.duration / 2) });
    at += scene.duration;
  }
  check(Math.abs(at - manifest.targetSeconds) < frameTolerance, `Planned ${at}s, expected ${manifest.targetSeconds}s.`);
  check(Math.abs(p.duration() - at) < frameTolerance, 'Native timeline duration differs from the approved edit.');
  mkdirSync(join(here, 'output'), { recursive: true });
  writeFileSync(join(here, 'output', 'rrflow-lifecycle-demo.srt'), allCues.map((cue, i) => `${i + 1}\n${stamp(cue.start)} --> ${stamp(cue.end)}\n${cue.text}\n`).join('\n'));
  writeFileSync(join(here, 'output', 'source-ledger.json'), JSON.stringify({ inputLedger, frameTimes, targetSeconds: at, reviewedManifest: manifest }, null, 2));
  for (const frame of frameTimes) await p.frame(frame.time, `renders/review-${frame.scene}.png`);
  if (process.env.RRFLOW_NATIVE_RENDER === '1') {
    check(manifest.finalReviewApproved === true, 'Review the actual native frames before final export.');
    const output = join(here, 'higgsedit-project', 'renders', 'rrflow-lifecycle-demo.mp4');
    check(!existsSync(output), 'A completed export already exists; do not overwrite it.');
    const report = await p.render('renders/rrflow-lifecycle-demo.mp4', { depth: 8, bitrate: 1_250_000, shards: 12, concurrency: 3 });
    check(statSync(output).size < 49_000_000, 'Review copy exceeds 49 MB. Keep the native project and compress a distinct delivery copy.');
    writeFileSync(join(here, 'output', 'render-report.json'), JSON.stringify({ ...report, bytes: statSync(output).size, sha256: createHash('sha256').update(readFileSync(output)).digest('hex') }, null, 2));
    console.log(JSON.stringify({ rendered: true, duration: report.durationSeconds, bytes: statSync(output).size, captionCount: allCues.length }));
  } else {
    console.log(JSON.stringify({ previewOnly: true, duration: p.duration(), captionCount: allCues.length, frames: frameTimes }));
  }
};
