# Improvement log

Short notes from maintenance passes. User-visible changes also go in
`CHANGELOG.md` under `## Unreleased`. Newest first.

## 2026-11-23

The iOS router treated a JSON boolean as an integer, because
`JSONSerialization` boxes `true` as `NSNumber` and `as? Int` reads it as `1`.
A request with `gawa: true` or `id: true` got a reply on iOS and none on
Android. `GawaRouter.jsonInt` rejects booleans and fractional numbers.
`protocol/cases.json` now has those three ignored requests, and SPEC.md
section 4 names them next to the numeric-string rule. `deno run -A
scripts/health.ts` passed. iOS and Android were not run locally.

Left open: Dependabot PR #11 (`gradle/actions` 4 to 6) is green, but v6
moves caching into a proprietary component and says the upgrade accepts
that component's terms. Caching is on unless disabled. That acceptance is
a maintainer decision. The backlog items that need a contact are unchanged.

## 2026-11-21

Version 0.1.1 folds the JSR install and the `workflow_dispatch` release
into `CHANGELOG.md`. The tag is pushed by hand after the version PR merges,
so the existing tag-push path creates the GitHub Release and publishes to JSR.

## 2026-11-20

JSR package `@kt3k/gawa` is configured in `jsr.json` (web module only).
`deno publish --dry-run` runs in the web CI job. The `release` workflow
publishes to JSR after the GitHub Release, and the `jsr` workflow can
publish an existing tag without cutting another release. Neither was run.
OIDC is already linked on JSR.

## 2026-11-19

Releases are cut from `main` with workflow_dispatch on `.github/workflows/release.yml`
(Actions, workflow `release`, Run workflow). An empty version input uses
`package.json`. The run refuses any ref other than `refs/heads/main`, a
missing changelog section, an existing tag, and a main commit whose `web`,
`ios`, `android`, or `android-e2e` check is not success. It pushes `vX.Y.Z`
and creates the GitHub Release in that same run, because a tag pushed with
`GITHUB_TOKEN` does not start another workflow. Pushing a tag by hand still
runs the shared publish action. `contents: write` stays on those jobs only.
The workflow was not run.

## 2026-11-16

Workflow tokens follow Scorecard's Token-Permissions check: read-only at
the top of each workflow, write only on the job that needs it. `ci.yml`
had no `permissions` key; it is now `contents: read`. The jobs check out
the repo and run tests. `pages.yml` keeps `pages: read` because
`actions/configure-pages` calls Get a GitHub Pages site, and moves
`pages: write` and `id-token: write` onto the deploy job, which is what
`actions/deploy-pages` documents. `release.yml` moves `contents: write`
onto the release job. `scripts/check-workflow-permissions.ts` fails a
workflow that omits that block or grants write above `jobs:`. It runs in
`scripts/health.ts` and in the `web` CI job. `deno run -A scripts/health.ts`
passed. iOS and Android were not run locally.

## 2026-11-15

`main` will require the CI checks `web`, `ios`, `android`, and `android-e2e`
before a merge. Only the repository admin (@kt3k) may bypass that ruleset
and push directly. Agents, including the weekly harness loop, push a working
branch, open a pull request against `main`, wait for those checks, and merge.
The maintainer does not want issue labels such as `good first issue`; do not
create them. `ci` runs on pull requests targeting `main` as well as on pushes
to `main`. Job names are unchanged.

## 2026-11-14

Landing copy pass against general copywriting advice (clear beats clever,
concrete beats abstract, benefits over mechanism). The tagline "the shell
around something" said nothing about what gawa wraps, so it is now "the
shell around a WebView", which the page title and og:image alt already used.
README matches. The hero note no longer repeats "on both ends" or the origin
check that feature 03 states. Feature 01 says why a real origin matters, and
feature 02 says what a call returns. `cd site && deno task check` passed.

## 2026-11-14

Landing hero, second pass: the large 側 took about 170px of the first screen
and pushed the code pair below the fold. Library landing pages lead with a
headline that says what the tool does and put code above the fold, so 側 is
now a small seal beside the "gawa" wordmark, the h1 states what gawa is, and
the call / register pair fits in a 1280×800 first screen. `.hero-kana`
stays as the seal class. `cd site && deno task check` passed. Checked
desktop, phone, and dark mode in screenshots.

## 2026-11-14

Landing hero: replaced the three-row "Page / gawa / WebView" stack with the
page call and the app handler side by side (TypeScript next to Swift /
Kotlin tabs, `call` and `emit` arrows between them). The survey of developer
tool landing pages behind this: library heroes show code, and two-sided
tools show both ends. The lower "Quick example" is now "Full example".
`cd site && deno task check` passed. Checked desktop, phone, and dark mode
in screenshots.

## 2026-11-14

Schema generator: nullable types, arrays, named structs emitted once
(including result types), and payload-less events. Empty event lists no
longer generate `{}`. CLI flags `--schema`, `--ts`, `--swift`, `--kotlin`,
and `--kotlin-package` keep the example defaults. `installMock` gained
`legacyMethods` so tests can see `has` resolve null. `deno test schema` is
part of health.ts.

## 2026-11-14

Payload-less `emit(event)` on iOS and Android, a generic `call` type so a
wrapper needs no cast, and `bridge.has` backed by the reserved router method
`gawa.methods`. `unknown_method` stays the missing-method code. Older shells
make `has` resolve `null`. `protocol/cases.json` checks the method list.
`deno run -A scripts/health.ts` passed. iOS and Android were left to CI.

## 2026-11-13

Added this harness, `AGENTS.md`, `CONTRIBUTING.md`, issue and pull request
templates, and a weekly Dependabot config for GitHub Actions. Recorded the
survey in `docs/oss-practices.md`. `scripts/health.ts` runs the local half of
CI. Did not add `SECURITY.md` or `CODE_OF_CONDUCT.md`: both need a contact
the repository does not state. Did not tag a release.
