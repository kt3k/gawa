# Principles

These are the survey in [docs/oss-practices.md](../oss-practices.md), applied
to this repository. A change that breaks one of them is not an improvement.

## The spec is the product

[SPEC.md](../../SPEC.md) is the normative description. `docs/protocol.md` is a
map and must not grow a second copy of the rules. A behavior change updates
the spec and `protocol/cases.json` in the same change. A reimplementation that
follows the spec must keep working.

## Stay small

gawa serves files from a real origin, carries typed calls and events, and
checks the page origin. It is not a UI toolkit, a plugin runtime, or a CLI.
Decline work that adds one. The reference implementation should stay thin
enough that someone can re-read it against the spec.

## Prefer compatible changes

The public API is the page surface in `web/mod.ts` (`createBridge`, `call`,
`on`, `GawaError`, `installMock`, `PROTOCOL`), the iOS types in the `Gawa`
module, and the Android types in `io.github.kt3k.gawa`.

The current version is `0.y.z`. [SemVer](https://semver.org/) allows a `0.y.z`
API to change at any time. This repository does not use that permission.
Until a maintainer decides otherwise:

- Do not change a wire field, a required message string, or a public function
  signature in a way that breaks an existing caller.
- Do not remove or rename a public type.
- Adding an optional argument with a default that preserves today's behavior
  is allowed.
- If a break seems necessary, stop and write the proposal in the log. Do not
  implement it.

When the project is `1.0.0` or later, follow SemVer: incompatible changes are
a major bump, and a removal is preceded by a deprecation in a minor release.
Record deprecations in `CHANGELOG.md` under Deprecated, and removals under
Removed.

## Small diffs

One pass does one thing. A drive-by rewrite of a working file is drift, not
maintenance. Match the style of the file you are editing. Do not add a
dependency for something the three platforms can do in a few lines.

## Tests are the review

A behavior change needs a test that fails without the change. Protocol
behavior uses `protocol/cases.json` so web, iOS, and Android are checked
against the same fixture. Generated files (`web/dist`, the example types) are
committed and CI rejects drift. Do not hand-edit generated output.

## Docs match the code

The site is generated from this repository. Do not describe an API the code
does not have. If a document and the code disagree, the spec wins for
protocol behavior and the code wins for an implementation detail the spec
left implementation-defined. Then fix the stale document.

## Leave a trail

User-visible changes go under `## Unreleased` in `CHANGELOG.md`, grouped the
way [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) describes
(Added, Changed, Deprecated, Removed, Fixed, Security). Maintenance that
users cannot see goes in [log.md](log.md) only.

## People are not on call

Do not promise a response time. Do not expand the queue to look busy. Close
work that is outside the scope, with a short reason and a link to the spec
or these principles. Never post to Slack, X, Zenn, npm, or any other external
service unless the task explicitly says to.
