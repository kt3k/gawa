# gawa maintenance harness

This directory is the operating manual for a coding agent that improves gawa.
`AGENTS.md` at the repository root is only the map. Start here, then open the
file for the task you actually have.

gawa is a small typed bridge. The reference packages are one implementation.
[SPEC.md](../../SPEC.md) is the behavior. The survey behind these rules is
[docs/oss-practices.md](../oss-practices.md).

## Read this order

| File | When |
| --- | --- |
| [principles.md](principles.md) | Before choosing a change. |
| [loop.md](loop.md) | When running a maintenance pass with no specific bug. |
| [verify.md](verify.md) | Before and after every change. |
| [triage.md](triage.md) | When looking at issues or pull requests. |
| [boundaries.md](boundaries.md) | When the next step needs a person. |
| [backlog.md](backlog.md) | When deciding what maintenance work is already known. |
| [log.md](log.md) | After a pass, to record what changed. |

Release steps live in the README and in `site/content/releasing.md`. Do not
tag or publish from a maintenance pass. See [boundaries.md](boundaries.md).

## One pass

1. Read [principles.md](principles.md) and the backlog.
2. Run `deno run -A scripts/health.ts`. Note anything it cannot run (iOS and Android).
3. Pick one small improvement that the principles allow.
4. Make the change. Update `SPEC.md` and `protocol/cases.json` together when behavior changes.
5. Run the commands in [verify.md](verify.md) that the change touches, then `scripts/health.ts` again.
6. Add a dated note to [log.md](log.md). If a user will notice the change, add it under `## Unreleased` in `CHANGELOG.md`.
7. Stop at a [boundary](boundaries.md) instead of guessing.
