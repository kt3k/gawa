# Verification

Run the relevant commands before you start, so you know the tree was already
green, and again after the edit. `deno` on this machine may live at
`$HOME/.deno/bin/deno` rather than on `PATH`.

`scripts/health.ts` is the local bundle of the web job and the site check.
Use it as the last step of a pass. It does not replace a narrower command
while you are still editing.

## Always, at the end of a pass

```sh
deno run -A scripts/health.ts
```

## Web, protocol, and generated files

From the repository root, this is what the `web` CI job runs:

```sh
cd web && deno fmt --check && deno lint && deno check mod.ts && deno test
cd .. && web/build.sh && git diff --exit-code -- web/dist
deno run -A scripts/check-versions.ts
deno fmt --check schema && deno lint schema && deno test -A --config schema/deno.json schema
deno run -A schema/generate.ts && git diff --exit-code -- \
  examples/web/src/methods.ts \
  examples/ios/Sources/ExampleTypes.swift \
  examples/android/src/main/kotlin/io/github/kt3k/gawa/example/ExampleTypes.kt
cd examples/web && deno check src/main.ts && ./build.sh
```

`web/mod_test.ts`, `web/protocol_test.ts`, `web/mock_test.ts`, and
`web/log_test.ts` are the page tests. `protocol_test.ts` reads
`protocol/cases.json`. A change to the page client or the fixture should
fail one of those tests if the change is wrong.

Do not hand-edit `web/dist` or the three generated example type files.
Regenerate them and commit the result.

## Site

```sh
cd site && deno fmt --check && deno lint && deno task check
```

`deno task check` builds the site and crawls every internal link. If you
change a heading that the site links to, the crawl fails until the link
matches. `site/check.ts` also requires specific phrases. Update it when you
intentionally change those phrases.

## iOS and Android

These need macOS with Swift, or an Android SDK. They are not part of
`scripts/health.ts`. GitHub Actions runs them on every push to `main` and
every pull request (`.github/workflows/ci.yml`):

- iOS: `examples/web/build.sh`, then `swift test`, an iOS library build, and
  an XcodeGen build of `examples/ios`.
- Android: `examples/web/build.sh`, then `:gawa:testDebugUnitTest`,
  `:gawa:assembleRelease`, a Maven local publish, `:example:assembleDebug`,
  and `:example:connectedDebugAndroidTest` on an emulator.

`ProtocolCasesTests` (Swift) and `ProtocolCasesTest` (Kotlin) read the same
`protocol/cases.json`. If you cannot run them locally, say so in the log and
wait for CI. Do not weaken a native test to make a job pass.

## What not to treat as proof

- A screenshot of the docs site is proof of a visual change only. Behavior
  still needs the commands above.
- `git log` is not a test.
- A green `health.ts` does not mean the iOS or Android jobs passed.
