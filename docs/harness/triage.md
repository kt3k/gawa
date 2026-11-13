# Triage and releases

## Issues

GitHub Issues are the public tracker. Templates for a bug and a change
request live in `.github/ISSUE_TEMPLATE/`.

For each open issue:

1. If it describes a vulnerability or includes an exploit, do not discuss the
   exploit in the issue. Stop and follow [boundaries.md](boundaries.md).
   This repository does not yet have a private security contact.
2. If it asks for something outside the spec (a UI toolkit, a plugin system,
   a CLI, a new product), thank the reporter, link to [SPEC.md](../../SPEC.md)
   and [principles.md](principles.md), and close it.
3. If it is a real bug, say which platform it affects and whether a
   `protocol/cases.json` entry should cover it. A one-line reply is enough.
   Do not promise a date.
4. If you can fix it inside the principles, do that in a separate change and
   mention the issue in the log. Do not close an issue you did not fix
   unless it is out of scope or a duplicate.

Leave the issue open when you are unsure. A wrong close is harder to undo
than a quiet open issue.

## Pull requests

A pull request should be small, should say which principle it serves, and
should show the commands from [verify.md](verify.md) that were run.

Accept it only when:

- CI is green, including the iOS and Android jobs when those files can be
  affected.
- It does not break the public API. See [principles.md](principles.md).
- Protocol changes include `SPEC.md` and `protocol/cases.json`.
- User-visible changes are under `## Unreleased` in `CHANGELOG.md`.

If the pull request is out of scope, thank the author, explain the mismatch
in a sentence or two, link to the spec, and close it. Do not leave it open
to avoid the conversation.

Do not rewrite someone else's pull request into a different feature.

## Releases

Releasing is a human action. The steps, when a person asks for a release, are
in the README and in `site/content/releasing.md`:

1. Bump `package.json` and the default version in
   `android/gawa/build.gradle.kts` to the same `X.Y.Z`.
2. Move `## Unreleased` notes into `## X.Y.Z`. Use `YYYY-MM-DD` when you know
   the date. Do not paste `git log`.
3. Run `web/build.sh` and commit `web/dist` if it changed.
4. Run `deno run -A scripts/check-versions.ts vX.Y.Z`.
5. Tag `vX.Y.Z` and push the tag. `.github/workflows/release.yml` checks the
   tag, opens the GitHub Release from that changelog section, and runs
   `npm publish` only when the `NPM_TOKEN` secret is set.

Do not create the tag yourself unless the person who owns the repository
asked for that version. Deno, Swift Package Manager, and JitPack install
from the tag, so a tag is the release.

`0.1.0` is the only released section today, and it has no date recorded.
Leave that section as it is.
