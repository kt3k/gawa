# Getting started

gawa (側) is a thin, typed bridge between a web page and the native iOS / Android app that hosts it in a WebView. There is no runtime, no plugin system, and no CLI. Add a `WKWebView` or `WebView` anywhere in an app you already have and attach gawa to it.

It does three things:

- Serve bundled files from a real origin instead of `file://`.
- Request / reply RPC and events, typed on both ends.
- Origin checks, so only your bundled page can talk to the app.

## Install

Everything is installed straight from a git tag. The version below is `package.json`'s `version`.

### Web (npm / pnpm / yarn)

The compiled `web/dist` is committed, so the package installs from git.

```sh
npm install github:kt3k/gawa#{{tag}}
```

```ts
import { createBridge } from "gawa";
```

The package name is `gawa`.

### Web (Deno)

Import the source by URL.

```ts
import { createBridge } from "https://raw.githubusercontent.com/kt3k/gawa/{{tag}}/web/mod.ts";
```

### iOS

Swift Package Manager, iOS 15+ / macOS 12+. Add `https://github.com/kt3k/gawa` and depend on the `Gawa` product.

```swift
.package(url: "https://github.com/kt3k/gawa", from: "{{version}}")
```

### Android

minSdk 24, via [JitPack](https://jitpack.io/#kt3k/gawa). JitPack builds the tag on first request.

```kotlin
// settings.gradle.kts
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven("https://jitpack.io")
    }
}
// build.gradle.kts
dependencies {
    implementation("com.github.kt3k:gawa:{{tag}}")
}
```

Apply the `org.jetbrains.kotlin.plugin.serialization` Gradle plugin. Types that cross the bridge must be `@Serializable`. See [Android](/docs/android/).

## Wire it up

1. Bundle the web build and serve it from a real origin: [`GawaSchemeHandler`](/docs/ios/) on iOS (`app://localhost/` in the examples), [`GawaAssets`](/docs/android/) on Android (`https://appassets.androidplatform.net/`).
2. Create a `GawaBridge` before loading the page, allow that origin, and register methods on `bridge.router`.
3. In the page, `createBridge` and `call` / `on`. When `available` is false you are in a normal browser.

The [quick example](/#example) on the home page is the same shape on all three sides: `kv.get`, `app.version`, and a `back` event.

## Examples

[`examples/`](https://github.com/kt3k/gawa/tree/main/examples) has a minimal iOS app and Android app showing the same bundled page. The page also tests the bridge end to end. CI runs it in a real `WKWebView` (macOS) and a real Android `WebView` (emulator).

Build the page script first (requires [Deno](https://deno.com)):

```sh
examples/web/build.sh   # → examples/web/www/main.js
```

iOS uses [XcodeGen](https://github.com/yonaskolb/XcodeGen):

```sh
cd examples/ios
xcodegen generate
open GawaExample.xcodeproj
```

The app prints `GAWA_E2E PASS` when the page's checks pass. `swift test` at the repository root runs the same page in a `WKWebView` on macOS (`ios/Tests/GawaTests/EndToEndTests.swift`).

Android: the example is the `:example` module of the Gradle build in `android/`.

```sh
cd android
./gradlew :example:installDebug              # run on a device / emulator
./gradlew :example:connectedDebugAndroidTest # end-to-end test
```

## Next

- [Web](/docs/web/) — `createBridge`, calls, events, errors
- [iOS](/docs/ios/) — `GawaSchemeHandler`, `GawaBridge`, `GawaRouter`
- [Android](/docs/android/) — `GawaAssets`, `GawaBridge`, `GawaRouter`
- [Protocol](/docs/protocol/) — the JSON envelopes
