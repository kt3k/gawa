# Improvement loop

Run this when the task is "make gawa healthier," not when a person has
already named a bug. One loop produces at most one change.

## 1. Check

Run:

```sh
deno run -A scripts/health.ts
```

The script runs the web tests, the site check, and the drift checks. It
prints the iOS and Android jobs it did not run. Those run in GitHub Actions
on `main`. If `health.ts` fails, fix that before looking for new work.

Also skim, without inventing numbers:

- `docs/harness/backlog.md` for a known gap.
- `docs/harness/log.md` so you do not repeat a pass.
- Open issues, if you can read them. An issue with no maintainer reply is
  more important than a new idea. [CHAOSS](https://www.chaoss.community/kb/metrics-model-project-viability-starter/)
  treats an unclosed change-request queue as a maintenance signal.

## 2. List

Write down at most five candidates. For each one, one line: what is wrong,
which principle it serves, and whether it needs a person
([boundaries.md](boundaries.md)). Drop anything that is a new product feature
or a breaking change.

Good candidates are stale docs, a missing test for an existing guarantee, a
check the health script should grow, or the next item in the backlog that
does not need a private contact.

## 3. Choose

Pick the candidate that a later agent can verify with a command already in
[verify.md](verify.md). Prefer the smallest one. If two are equal, prefer the
one a user of the bridge would notice.

If every candidate needs a person, do not invent the answer. Add the question
to the log and stop.

## 4. Change

Edit the smallest set of files. When the protocol changes, update `SPEC.md`
and `protocol/cases.json` together, and say so in the changelog. When a
generated file changes, regenerate it. Do not reformat unrelated files.

## 5. Verify

Run the commands in [verify.md](verify.md) for the files you touched, then
`deno run -A scripts/health.ts` again. iOS and Android still have to pass in
CI after the push. Do not claim they passed if you did not run them.

## 6. Record

Append a short entry to [log.md](log.md): the date, what changed, what you
ran, and what you left undone. Move a finished backlog item out of
[backlog.md](backlog.md), or say why it is still open.

Push only when the task says to push. This repository's standing instruction
from the maintainer has been to push maintenance work to `main`. A release
tag is never part of the loop.
