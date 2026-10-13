# RRFLOW lifecycle film

This is a new 4:50 native Higgsedit project. The published three-minute film is unchanged.

## Completed export

[Watch the full lifecycle film](rrflow-lifecycle-demo.mp4) · [Higgsfield playback](https://d2ol7oe51mr4n9.cloudfront.net/user_3BfnxGUAoM4RM8lwA6WAH3u7aFb/4a777cc4-8565-4829-ba7e-49db9938b747.mp4) · [Captions](rrflow-lifecycle-demo.srt) · [Storyboard](../../DEMO_LIFECYCLE_SCRIPT.md).

The verified export is **290.004 seconds, 30,657,340 bytes, 1920×1080, H.264 at 24 fps**. It is silent and carries 35 editorial captions. Eleven reviewed source files preserve normal recorded speed. Native Higgsedit rendered all 6,960 frames with no diagnostics or renderer fallbacks. The complete MP4 decoded successfully; all eleven native scene previews and the final encoded confirmation, retrieval and closing frames were visually inspected. Root independently reviewed the principal evidence previews.

SHA-256: `e1ebed2766aed34409acd6ea1bfa0d640721bb3e7721c2da27f5982ad9914efe`. Higgsfield confirmed media ID: `4a777cc4-8565-4829-ba7e-49db9938b747`; upload returned HTTP 200 and the native result player was displayed successfully. The local downloaded artifact has the same checksum.

The film shows one actual human confirmation for the public Work `access.ts` source, its persistence after refresh, six native disciplines and seven relationships, existing Qdrant Work import evidence, repository synchronization, 41 checks from automatic CI capture, a separate historical reviewed failure, and actual hybrid retrieval of that lesson. The final retrieval request is `dd7dc5f2-2129-48a2-82a9-7916a9b7583e`. The returned diagnosis, correction and practice are expanded in the real UI. Raindrop delivery is labeled acceptance; no fresh independent Raindrop UI readback or autonomous improvement is claimed.

[Source ledger](source-ledger.json), [capture evidence](capture-evidence.json), [native render report](render-report.json), and [final media probe](final-probe.json) preserve the exact evidence. Source staging is the [approved release ZIP](https://github.com/EonsofStupid/rrflow-hydradb/releases/download/demo-lifecycle-20261013/rrflow-lifecycle-approved-sources.zip), SHA-256 `cf513e2bb0885e23a553a328bfda0c3850e47c468f2d2bfb3376f44f91abfbbf`. It contains only the eleven reviewed inputs and four editing documents. The staged manifest intentionally predates final visual approval; the checked-in manifest records the approved export.

The film joins actual user placement, saved confirmation, source drill-down and import provenance with the development loop: automatic CI/source capture, human-reviewed failure evidence, rule origin and retrieval for the next change. Captions separate historical imported CI cases from current automatic capture. No model-training, automatic-code-fix or measured-improvement claim is made.

## Build contract

`edit-manifest.json` is the reviewed timeline; `native-edit.mjs` is the native editor. Only exact approved inputs and SHA-256 hashes are accepted. Every source trim runs at normal speed. Editorial captions are aligned to the actual capture cues; they are not a speech transcript. No synthetic voice has been generated.

The native Higgsfield sandbox passed `higgsedit doctor`, includes `--bitrate`, and rendered a real preview with native motion and verified Inter fonts. Before the first build:

```sh
higgsedit new higgsedit-project --size 1920x1080 --fps 24
higgsedit fonts add higgsedit-project Inter:400 Inter:600
higgsedit build native-edit.mjs
```

Inspect the actual `renders/review-*.png` output. Only then set `finalReviewApproved:true` and run `RRFLOW_NATIVE_RENDER=1 higgsedit build native-edit.mjs`. A completed export is never overwritten. The native renderer uses H.264, 1080p, 24 fps and a bounded bitrate; the review copy must stay below 49 MB.

Inputs reach the sandbox through one root-published ZIP containing only the exact reviewed allowlist. Source clips stay out of Git. Generated final media must be uploaded and confirmed before the hosted sandbox expires. Keep the local editor, manifest, caption sidecar, source ledger and render report as the reproducible handoff.
