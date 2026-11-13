## What

## Checks

- [ ] `deno run -A scripts/health.ts` (or the narrower commands in `docs/harness/verify.md`)
- [ ] iOS and Android CI, if those trees can be affected. Say if you could not run them locally.
- [ ] `SPEC.md` and `protocol/cases.json` updated together, if the wire protocol changed
- [ ] User-visible notes added under `## Unreleased` in `CHANGELOG.md`
- [ ] No breaking change to an existing caller. If there is one, stop and say so.
