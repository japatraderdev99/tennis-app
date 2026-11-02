# UX-UI-V1: navigable prototype with simulated data

Branch `feat/ux-ui-v1`, based on `88ffd73`. Owner: Claude. Local commit only; head owns integration and push.

## Files

`frontend/` and this note. No backend module, contract, schema, root file or CI changed. Decisions, API requests and handoff live in the vault at `07-Claude/UX-UI-V1/`.

## Tests

- `npm test`: 36 passed. `npm run test:e2e`: 11 passed in Chromium with a Pixel 7 viewport, including axe checks.
- `frontend/scripts/verify_against_backend.py`: the TypeScript `select_target` port matches Python in 6 of 6 seedable scenarios; mock reports validate against `PublicReport` and `PoseArtifact`.
- Backend suite in this worktree: 1,077 passed.

## Known limitations

Simulated data only. Not run on a physical phone, Safari/iOS, a real screen reader or in sunlight. Not tested with practitioners. CI does not run frontend tests, because the workflow belongs to the head.

## Interface deviations

None to existing contracts. Requested additions are marked PROPOSTA in `frontend/src/api/types.ts` and need joint review.
