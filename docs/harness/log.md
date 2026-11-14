# Improvement log

Short notes from maintenance passes. User-visible changes also go in
`CHANGELOG.md` under `## Unreleased`. Newest first.

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
