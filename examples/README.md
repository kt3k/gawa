# Examples

Two minimal apps showing the same page, [`web/www`](web/www), served from the
app bundle and talking to the app through gawa. The page runs a small self-test
(calls, errors, events) and reports the result back to the app.

First build the page script (requires [Deno](https://deno.com)):

```sh
examples/web/build.sh   # → examples/web/www/main.js
```

## iOS

Uses [XcodeGen](https://github.com/yonaskolb/XcodeGen) to create the project.

```sh
cd examples/ios
xcodegen generate
open GawaExample.xcodeproj
```

The app prints `GAWA_E2E PASS` to the console when the page's checks pass.
`swift test` at the repository root runs the same page in a `WKWebView` on macOS
(`ios/Tests/GawaTests/EndToEndTests.swift`).

## Android

The example is the `:example` module of the Gradle build in `android/`.

```sh
cd android
./gradlew :example:installDebug              # run on a device / emulator
./gradlew :example:connectedDebugAndroidTest # end-to-end test
```
