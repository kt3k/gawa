# gawa

gawa is a thin typed bridge between a page and a WKWebView or Android
WebView. The reference packages in this repository are one implementation.
The behavior is [SPEC.md](SPEC.md).

This file is a map. The maintenance manual is [docs/harness/README.md](docs/harness/README.md).
Read that, then the one harness file that matches the task. Do not load the
whole manual into the task.

## When you change code

- Keep the public API compatible. `0.y.z` is not permission to break callers.
  [docs/harness/principles.md](docs/harness/principles.md)
- A protocol change updates `SPEC.md` and `protocol/cases.json` together.
- Do not hand-edit `web/dist` or the generated example types. Regenerate them.
- Verify with [docs/harness/verify.md](docs/harness/verify.md). The local
  bundle is `deno run -A scripts/health.ts`. iOS and Android run in CI.
- Stop for a release, a breaking change, a vulnerability, or an external post.
  [docs/harness/boundaries.md](docs/harness/boundaries.md)

## Where things are

| Path | What it is |
| --- | --- |
| `SPEC.md` | Normative spec. |
| `docs/protocol.md` | A short map of the spec, not a second spec. |
| `protocol/cases.json` | Shared conformance fixture. |
| `web/` | Page client. Tests: `deno test` in `web/`. |
| `ios/` | Swift package. |
| `android/` | Gradle build. |
| `schema/` | Example type generator. Optional for conformance. |
| `site/` | Docs site. `cd site && deno task check`. |
| `docs/harness/` | How to keep improving the project. |
