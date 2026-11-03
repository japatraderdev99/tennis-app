# Codex UX V2 — design and scope

Authorized on 2026-11-02 while Claude is unavailable. Based on Claude's b84fa3a;
its worktree and commit are preserved. This branch improves the existing React,
TypeScript and CSS components; it does not select the final mobile platform.

## Design plan before implementation

Keep the tennis court as the visual reference: court blue `#14408f`, deeper blue
`#0c2a63`, white line `#ffffff`, ball yellow `#e4f222`, mist `#dce6f7`, and warning
orange `#ffb26b`. Archivo carries headings; Atkinson Hyperlegible Next carries
instructions and controls. Yellow remains reserved for selected state and primary
actions. The continuous/broken court line explains overlay availability.

Improve the actual observation task: video and controls stay together; at desktop
width the reading panel sits alongside the video. Mobile remains a single column.
Actions occupy document space and never cover choices. Instructions are short,
left aligned, and distinguish observed tracking from unvalidated filming quality.
The opening motion starts only on request. Keep the existing identity rather than
introducing an unrelated component library or dashboard.

Review against brief: no metrics dashboard, no ideal angles, no scores, no automatic
selection, no model-confidence display. Most visual emphasis stays on the video.
Keep the simulated watermark and visible demo notice. UI changes must retain
meaningful keyboard access, narrow-screen layout and all failure paths.

## Implementation scope

- Fix the fixture verifier, reselection authority, replay after failure/cancel and
  hit-target verification identified in the head review.
- Add asynchronous frame presentation boundary and race/error handling while
  retaining synthetic media only. This is preparation, not a real video adapter.
- Improve review layout, copy, capture guidance and intentional motion.
- Add a reproducible benchmark catalog and result protocol. Deterministic scripts
  are labelled as such; tools not actually run remain `not_run`.
- Research official open-source projects; do not execute external agents, download
  benchmark websites or spend API credits in this wave.

Testing and measured results will be recorded in the final delivery note. Human
usability, physical phones, sunlight and real screen readers remain untested.
