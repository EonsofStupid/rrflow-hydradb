#!/usr/bin/env node
// Run in WSL. No application state or credentials are read by this editor.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const mode = argv.find((arg) => ['--plan', '--check', '--render'].includes(arg)) ?? '--plan';
const manifestArg = argv.indexOf('--manifest');
const manifestPath = resolve(manifestArg >= 0 ? argv[manifestArg + 1] : join(here, 'edit-manifest.json'));
const base = dirname(manifestPath);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const fps = 24;
const maxBytes = 49_000_000;
const errors = [];

function fail(message) { throw new Error(message); }
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, ...options });
  if (result.error || result.status !== 0) fail(`${command} failed: ${result.error?.message ?? result.stderr?.slice(-4000)}`);
  return result.stdout;
}
function localPath(value, label) {
  if (typeof value !== 'string' || !value.trim()) fail(`${label}: file path is missing`);
  const full = resolve(base, value);
  const rel = relative(base, full);
  if (rel.startsWith('..') || isAbsolute(rel)) fail(`${label}: paths must stay inside the media directory`);
  if (!existsSync(full)) fail(`${label}: missing ${rel}`);
  return full;
}
function probe(path) {
  const parsed = JSON.parse(run('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', path]));
  const duration = Number(parsed.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0) fail(`Invalid media duration: ${relative(base, path)}`);
  return { duration, streams: parsed.streams ?? [] };
}
function seconds(value, label, zero = false) {
  if (!Number.isFinite(value) || value < 0 || (!zero && value === 0)) fail(`${label}: invalid seconds`);
  return value;
}
function clock(seconds) {
  const ms = Math.round(seconds * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
}
function assClock(seconds) {
  const ticks = Math.round(seconds * 100);
  return `${Math.floor(ticks / 360000)}:${String(Math.floor(ticks / 6000) % 60).padStart(2, '0')}:${String(Math.floor(ticks / 100) % 60).padStart(2, '0')}.${String(ticks % 100).padStart(2, '0')}`;
}
function normalizedWords(text) {
  return text.toLocaleLowerCase('en-US').replace(/[’‘]/g, "'").match(/[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu)?.join(' ') ?? '';
}
function timestamp(value) {
  const parts = value.trim().replace(',', '.').split(':').map(Number);
  if ((parts.length !== 2 && parts.length !== 3) || parts.some((n) => !Number.isFinite(n))) fail(`Invalid caption timestamp: ${value}`);
  return parts.reduce((a, n) => a * 60 + n, 0);
}
function readCues(path) {
  const raw = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  if (path.endsWith('.json')) {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) fail(`Caption JSON must be an array: ${path}`);
    return data;
  }
  return raw.replace(/\r/g, '').split(/\n\s*\n/).flatMap((block) => {
    const lines = block.split('\n');
    const index = lines.findIndex((line) => line.includes('-->'));
    if (index < 0) return [];
    const match = lines[index].match(/^\s*([\d:.,]+)\s*-->\s*([\d:.,]+)/);
    if (!match) fail(`Invalid SRT/VTT cue in ${path}`);
    return [{ start: timestamp(match[1]), end: timestamp(match[2]), text: lines.slice(index + 1).join('\n').replace(/<[^>]*>/g, '') }];
  });
}
function filterPath(path) {
  // FFmpeg filter paths, not a shell. Filenames are constrained to local files.
  return path.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "'\\''");
}

try {
  if (manifest.version !== 1 || !Array.isArray(manifest.scenes) || !manifest.scenes.length) fail('Expected version 1 and ordered scenes');
  const ids = new Set();
  let cursor = 0;
  for (const scene of manifest.scenes) {
    if (!/^[a-z0-9-]+$/.test(scene.id) || ids.has(scene.id)) fail('Scene IDs must be unique lowercase slugs');
    ids.add(scene.id);
    seconds(scene.duration, `${scene.id} duration`);
    if (Math.abs(scene.duration * fps - Math.round(scene.duration * fps)) > 0.0001) fail(`${scene.id}: duration must align to 24 fps`);
    scene.timelineStart = cursor;
    cursor += scene.duration;
  }
  if (Math.abs(cursor - 180) > 1 / fps) fail(`The event cut must be 180 seconds; plan is ${cursor}`);
  if (manifest.scenes[0].id !== 'intro' || manifest.scenes[0].duration !== 8) fail('The first scene must be the eight-second concept intro');
  console.log(`RRFLOW edit: ${cursor}s, 1920×1080, ${fps} fps; final limit ${maxBytes / 1e6} MB.`);
  for (const scene of manifest.scenes) console.log(`${clock(scene.timelineStart)} → ${clock(scene.timelineStart + scene.duration)}  ${scene.id}: ${scene.title}`);
  if (mode === '--plan') {
    console.log('Plan only. No video rendered. Fill verified footage and action-aligned captions (optional measured narration), then run --check.');
    process.exit(0);
  }

  run('ffmpeg', ['-version']);
  run('ffprobe', ['-version']);
  const allCues = [];
  for (const scene of manifest.scenes) {
    try {
      if (scene.reviewed !== true) fail(`${scene.id}: recording must be reviewed for safe public content and the captioned actions`);
      if (!Array.isArray(scene.shots) || !scene.shots.length) fail(`${scene.id}: no actual footage assigned`);
      let shotDuration = 0;
      scene.checkedShots = scene.shots.map((shot, index) => {
        const label = `${scene.id} shot ${index + 1}`;
        const path = localPath(shot.path, label);
        const info = probe(path);
        const videoStream = info.streams.find((stream) => stream.codec_type === 'video');
        if (!videoStream) fail(`${label}: no video stream`);
        if (shot.crop) {
          const { x, y, width, height } = shot.crop;
          if (![x, y, width, height].every(Number.isInteger) || x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > videoStream.width || y + height > videoStream.height) fail(`${label}: crop lies outside the recorded frame`);
        }
        seconds(shot.in, `${label} in`, true);
        seconds(shot.duration, `${label} duration`);
        const hold = seconds(shot.hold ?? 0, `${label} hold`, true);
        if (shot.in + shot.duration > info.duration + 0.05) fail(`${label}: source is too short; do not speed it up`);
        if (hold > 0 && shot.holdReviewed !== true) fail(`${label}: frozen reading hold requires explicit review`);
        shotDuration += shot.duration + hold;
        return { ...shot, path, hold };
      });
      if (Math.abs(shotDuration - scene.duration) > 1 / fps) fail(`${scene.id}: shots total ${shotDuration}s; expected ${scene.duration}s`);
      const narration = scene.narration;
      let audioInfo;
      let cues;
      if (narration) {
        if (narration.reviewed !== true) fail(`${scene.id}: narration must be listened to`);
        const audioPath = localPath(narration.path, `${scene.id} narration`);
        audioInfo = probe(audioPath);
        if (!audioInfo.streams.some((stream) => stream.codec_type === 'audio')) fail(`${scene.id}: narration has no audio stream`);
        seconds(narration.offset ?? 0, `${scene.id} narration offset`, true);
        if ((narration.offset ?? 0) + audioInfo.duration > scene.duration + 0.05) fail(`${scene.id}: narration exceeds its slot; rewrite text or revise the plan, never time-stretch`);
        if (narration.captionsReviewed !== true) fail(`${scene.id}: speech captions need comparison with the actual take`);
        cues = readCues(localPath(narration.captions, `${scene.id} captions`));
        if (normalizedWords(cues.map((cue) => cue.text).join(' ')) !== normalizedWords(scene.script)) fail(`${scene.id}: captions differ from the approved spoken text; update both after reviewing the actual take`);
        scene.checkedNarration = { ...narration, path: audioPath, duration: audioInfo.duration };
      } else {
        if (scene.captionMode !== 'on-screen-summary' || scene.captionsReviewed !== true) fail(`${scene.id}: silent edit needs reviewed editorial captions aligned to the recorded actions`);
        cues = readCues(localPath(scene.captions, `${scene.id} editorial captions`));
      }
      if (!cues.length) fail(`${scene.id}: no aligned captions`);
      let previousEnd = 0;
      for (const cue of cues) {
        seconds(cue.start, `${scene.id} caption start`, true);
        seconds(cue.end, `${scene.id} caption end`);
        if (cue.end <= cue.start || cue.start < previousEnd - 0.001 || cue.end > (audioInfo?.duration ?? scene.duration) + 0.05) fail(`${scene.id}: captions overlap or exceed their media`);
        if (typeof cue.text !== 'string' || !cue.text.trim()) fail(`${scene.id}: empty caption`);
        previousEnd = cue.end;
        const offset = scene.timelineStart + (narration?.offset ?? 0);
        if (cue.position !== undefined && cue.position !== 'top' && cue.position !== 'bottom') fail(`${scene.id}: caption position must be top or bottom`);
        allCues.push({ start: offset + cue.start, end: offset + cue.end, text: cue.text, position: cue.position ?? 'bottom' });
      }
      console.log(`Verified ${scene.id}: ${shotDuration}s footage, ${audioInfo ? `${audioInfo.duration.toFixed(2)}s narration` : 'silent editorial cut'}, ${cues.length} aligned captions.`);
    } catch (error) { errors.push(error.message); }
  }
  if (errors.length) fail(`Edit is not ready:\n- ${errors.join('\n- ')}`);
  if (mode === '--check') {
    console.log('Inputs verified. No output rendered. Use --render only after the real footage and captions are approved.');
    process.exit(0);
  }
  if (manifest.finalReviewApproved !== true) fail('Final render requires finalReviewApproved:true after evidence and privacy review');
  const output = resolve(base, manifest.output ?? 'rrflow-event-demo.mp4');
  if (relative(base, output).startsWith('..') || isAbsolute(relative(base, output))) fail('Output must stay in the media directory');
  if (existsSync(output)) fail('Output already exists. Choose a new output name; completed renders are never overwritten');
  const work = join(base, 'render-work', new Date().toISOString().replace(/[:.]/g, '-'));
  mkdirSync(work, { recursive: true });
  const font = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
  if (!existsSync(font)) fail('DejaVu Sans is required for readable labels');
  const sceneOutputs = [];
  for (const scene of manifest.scenes) {
    const args = ['-hide_banner', '-loglevel', 'error'];
    for (const shot of scene.checkedShots) args.push('-ss', String(shot.in), '-t', String(shot.duration), '-i', shot.path);
    if (scene.checkedNarration) args.push('-i', scene.checkedNarration.path);
    else args.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo');
    const filters = [];
    scene.checkedShots.forEach((shot, index) => {
      const crop = shot.crop ? `crop=${shot.crop.width}:${shot.crop.height}:${shot.crop.x}:${shot.crop.y},` : '';
      let filter = `[${index}:v]setpts=PTS-STARTPTS,${crop}scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0a0a12,setsar=1,fps=${fps},format=yuv420p`;
      if (shot.hold) filter += `,tpad=stop_mode=clone:stop_duration=${shot.hold},drawtext=fontfile=${font}:text='Paused for reading':x=w-tw-42:y=42:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=10:enable='gte(t,${shot.duration})'`;
      filters.push(`${filter}[s${index}]`);
    });
    filters.push(`${scene.checkedShots.map((_, i) => `[s${i}]`).join('')}concat=n=${scene.checkedShots.length}:v=1:a=0[cut]`);
    let video = '[cut]';
    const label = scene.id === 'intro' ? 'Concept illustration' : scene.label;
    if (label) {
      const labelPath = join(work, `${scene.id}-label.txt`);
      writeFileSync(labelPath, label);
      filters.push(`${video}drawtext=fontfile=${font}:textfile='${filterPath(labelPath)}':x=42:y=42:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.72:boxborderw=12[labeled]`);
      video = '[labeled]';
    }
    if (scene.id !== 'intro' && manifest.captureLabel) {
      const provenancePath = join(work, `${scene.id}-provenance.txt`);
      writeFileSync(provenancePath, manifest.captureLabel);
      filters.push(`${video}drawtext=fontfile=${font}:textfile='${filterPath(provenancePath)}':x=w-tw-42:y=44:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.72:boxborderw=10[provenance]`);
      video = '[provenance]';
    }
    if (scene.id === 'intro') {
      filters.push(`${video}drawtext=fontfile=${font}:text='RRFLOW':x=(w-tw)/2:y=(h-th)/2:fontsize=82:fontcolor=white:shadowcolor=black@0.4:shadowx=2:shadowy=2[intro]`);
      video = '[intro]';
    }
    const delay = Math.round((scene.checkedNarration?.offset ?? 0) * 1000);
    filters.push(`[${scene.checkedShots.length}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,adelay=${delay}:all=1,apad,atrim=duration=${scene.duration},asetpts=PTS-STARTPTS[audio]`);
    const sceneOutput = join(work, `${scene.id}.mp4`);
    args.push('-filter_complex_threads', '2', '-filter_complex', filters.join(';'), '-map', video, '-map', '[audio]', '-t', String(scene.duration), '-c:v', 'libx264', '-threads', '4', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', sceneOutput);
    console.log(`Rendering reviewed scene: ${scene.id}`);
    run('ffmpeg', args);
    sceneOutputs.push(sceneOutput);
  }
  const concatPath = join(work, 'scenes.txt');
  writeFileSync(concatPath, sceneOutputs.map((path) => `file '${path.replace(/'/g, "'\\''")}'`).join('\n') + '\n');
  const captionsPath = join(work, 'captions.ass');
  const captions = allCues.map((cue, i) => `${i + 1}\n${clock(cue.start)} --> ${clock(cue.end)}\n${cue.text}\n`).join('\n');
  const assHeader = '[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\nWrapStyle: 0\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,DejaVu Sans,34,&H00FFFFFF,&H00FFFFFF,&H20000000,&H90000000,0,0,0,0,100,100,0,0,3,6,0,2,100,100,42,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';
  const assEvents = allCues.map((cue) => {
    const position = cue.position === 'top' ? '{\\an8\\pos(960,120)}' : '';
    const text = cue.text.replace(/\\/g, '\\\\').replace(/[{}]/g, '').replace(/\r?\n/g, '\\N');
    return `Dialogue: 0,${assClock(cue.start)},${assClock(cue.end)},Default,,0,0,0,,${position}${text}`;
  }).join('\n');
  writeFileSync(captionsPath, assHeader + assEvents + '\n');
  const vf = `ass=filename='${filterPath(captionsPath)}'`;
  const videoBitrate = Math.floor(((47_000_000 * 8 / cursor) - 128000) / 1000);
  const passLog = join(work, 'encode');
  const common = ['-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', concatPath, '-vf', vf, '-c:v', 'libx264', '-threads', '4', '-b:v', `${videoBitrate}k`, '-preset', 'medium', '-pix_fmt', 'yuv420p', '-passlogfile', passLog];
  run('ffmpeg', [...common, '-pass', '1', '-an', '-f', 'null', '/dev/null']);
  run('ffmpeg', [...common, '-pass', '2', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-t', String(cursor), output]);
  const finalInfo = probe(output);
  if (statSync(output).size >= maxBytes) fail(`Rendered file exceeds 49MB: ${output}`);
  if (Math.abs(finalInfo.duration - cursor) > 0.1) fail(`Rendered duration differs from reviewed plan: ${finalInfo.duration}`);
  writeFileSync(output.replace(/\.mp4$/i, '.srt'), captions);
  const publicManifest = { ...manifest, scenes: manifest.scenes.map(({ checkedShots, checkedNarration, ...scene }) => scene), renderedAt: new Date().toISOString(), bytes: statSync(output).size, actualDuration: finalInfo.duration };
  writeFileSync(output.replace(/\.mp4$/i, '.manifest.json'), JSON.stringify(publicManifest, null, 2) + '\n');
  console.log(`Completed ${relative(base, output)}: ${finalInfo.duration.toFixed(2)}s, ${(statSync(output).size / 1e6).toFixed(2)}MB. Inspect the final film before publishing.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
