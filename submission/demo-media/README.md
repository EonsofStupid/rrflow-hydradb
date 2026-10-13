# RRFLOW event media

## Finished film

[Watch the captioned three-minute demo](rrflow-event-demo.mp4). The reviewed export is **180.02 seconds, 35,827,710 bytes (35.83 MB), 1920×1080, 24 fps, H.264/AAC**. Its audio track is silent. It combines the Higgsfield concept intro with actual local production UI at normal speed. The public placement is explicitly a preview; the owner-workspace shot shows real TypeScript research drill-down; the receipt is a HydraDB read.

[Editorial captions](rrflow-event-demo.srt) · [Exact edit manifest](rrflow-event-demo.manifest.json) · [Final contact sheet](final-contact-sheet.jpg)

Validation: all seven input scenes and 28 caption cues passed the editor's checks; the complete exported file decoded without an FFmpeg error. Six full-resolution samples and the full timeline contact sheet were visually inspected. Captions preserve the UI evidence, native request ID and status disclosure. No password, real inbox or private Personal source was recorded. SHA-256: `45131b0c0534fdae676cc061aa552546315f8baef53d0285ae083ba371b3b584`.

## Concept intro

The generated intro is an abstract concept illustration for the first eight seconds of the demonstration. It is not a product screen recording, a neural-network visualization, or evidence of automatic learning. Use actual RRFLOW footage for the remainder of the film.

Visual direction: charcoal background, separated lavender Personal and mint Work glass-card constellations, one amber card pausing for human judgment. No text is generated into the scene; add the exact RRFLOW title in editing.

Generation: Higgsfield `seedance_2_5`, prompt-only, 8 seconds, 16:9, 1080p, silent, high bitrate. One job only; preflight quote 96 credits. Existing account preferences select no automatically created media project.

The tool’s generation widget displays progress and the completed output. `INTRO_JOB.json` records the exact job and result status; never resubmit merely because rendering takes time.

Completed output:

- [Playback/editing copy](rrflow-concept-intro-web.mp4): H.264, fast start, 1920×1080 at 24 fps, 8.04 seconds, silent.
- [Original Higgsfield output](rrflow-concept-intro.mp4): HEVC, 1920×1080 at 24 fps, 8.04 seconds, silent.
- [Four sampled frames](intro-contact-sheet.jpg): visual inspection shows the intended separate color groups and amber review cue, with no text or invented product controls.
- [Voiceover text](VOICEOVER.txt): optional human-presenter narration for the full three-minute film. The release cut is silent and captioned; a synthetic voice has not been selected or generated.

Use [the complete three-minute storyboard](../DEMO_EVENT_SCRIPT.md). The title card must carry a small **Concept illustration** label during the opening shot. Product footage must retain the public-preview disclosure, and the separate protected-workspace shot must use only an explicitly public source.

## Reproducible edit

Run in Ubuntu WSL with Node and FFmpeg available:

```sh
node submission/demo-media/assemble-demo.mjs --plan
node submission/demo-media/assemble-demo.mjs --check
node submission/demo-media/assemble-demo.mjs --render
```

`edit-manifest.json` assigns actual recordings, normal-speed source in-points, durations, safe-content review and action-aligned captions to seven scenes. The planned duration is exactly 180 seconds. Evidence shots can specify a bounded `crop:{x,y,width,height}` for legibility; only recorded pixels are shown. A checked `hold` explicitly freezes a frame and displays **Paused for reading**. Normal footage is never accelerated. Final rendering requires reviewed real footage and `finalReviewApproved:true`; completed outputs are never overwritten. Each product scene states its recording date and local-app provenance.

The silent film uses short editorial captions aligned to visible actions, not invented speech timestamps. Each scene's `captions` file is an array of `{start,end,text}`, with seconds relative to that scene. Captioned scenes must be reviewed against the actual recording. If a selected voice is later generated, a scene can instead supply `narration:{path,offset,reviewed,captions,captionsReviewed}`; its measured JSON/SRT/VTT captions must match the approved `script` text. Audio is never stretched to fit.

The editor produces H.264/AAC 1080p at 24 fps, a sidecar SRT, and the exact render manifest. Two-pass encoding reserves enough overhead to keep the complete MP4 below 49 MB. Scratch renders stay in `render-work/`; publish the final MP4, not duplicate intermediate files. Inspect the completed film before publication.
