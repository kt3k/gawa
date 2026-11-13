# gawa

> **gawa** (側) — the shell around something.

Documentation: <https://kt3k.github.io/gawa/>
Specification: <https://github.com/kt3k/gawa/blob/main/SPEC.md>

A thin, typed bridge between a web page and the native iOS / Android app that
hosts it in a WebView. Nothing more: no runtime, no plugin system, no CLI, no
opinion about your screens.

- **Serve bundled files from a real origin** instead of `file://`
  - iOS: `WKURLSchemeHandler` → `app://localhost/`
  - Android: `WebViewAssetLoader` → `https://appassets.androidplatform.net/`
- **Request / reply RPC and events**, typed on both ends
  - iOS: `WKScriptMessageHandlerWithReply`
  - Android: `WebViewCompat.addWebMessageListener`
- **Origin checks**: only your bundled page can talk to the app

It works in an app you already have — add a `WKWebView` / `WebView` anywhere and
attach gawa to it.

## Option 1. Make your own

This is the recommended way to use gawa. The behavior is specified in
[SPEC.md](https://github.com/kt3k/gawa/blob/main/SPEC.md). Hand that file to a
coding agent and it can implement a compatible gawa in the language and
platform you want: the web page, iOS, Android, or another host.
[`protocol/cases.json`](protocol/cases.json) is the conformance check (section
12 of the spec).

```text
Implement gawa according to the following spec:
https://github.com/kt3k/gawa/blob/main/SPEC.md

Read that spec and implement the roles you need — page, router, and the iOS and/or Android profile, or another platform — so the result is compatible with the reference. Check it with protocol/cases.json as section 12 describes:
https://github.com/kt3k/gawa/blob/main/protocol/cases.json
```

## Option 2. Use the reference implementation

The packages in this repository are one implementation of the spec. Use them
when you want that code instead of writing your own. Everything is installed
straight from a git tag — no registry needed.

**Web** (npm / pnpm / yarn): the compiled `web/dist` is committed.

```sh
npm install github:kt3k/gawa#v0.1.0
```

```ts
import { createBridge } from "gawa";
```

**Web** (Deno): import the source by URL.

```ts
import { createBridge } from "https://raw.githubusercontent.com/kt3k/gawa/v0.1.0/web/mod.ts";
```

**iOS** (Swift Package Manager, iOS 15+ / macOS 12+): add
`https://github.com/kt3k/gawa` and use the `Gawa` product.

```swift
.package(url: "https://github.com/kt3k/gawa", from: "0.1.0")
```

**Android** (minSdk 24) via [JitPack](https://jitpack.io/#kt3k/gawa), which
builds the tag on first request:

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
    implementation("com.github.kt3k:gawa:v0.1.0")
}
```

## Examples

[`examples/`](examples) is a minimal iOS app and a minimal Android app showing
the same bundled page ([`examples/web`](examples/web)). The page also tests the
bridge end to end; CI runs it in a real `WKWebView` (macOS) and a real Android
`WebView` (emulator).

The page, the iOS app, and the Android app share one method list,
[`schema/example.json`](schema/example.json). Regenerate the types with
`deno run -A schema/generate.ts`. CI fails if the generated files drift.

Build the page first (requires [Deno](https://deno.com)):

```sh
examples/web/build.sh   # → examples/web/www/main.js
```

iOS uses [XcodeGen](https://github.com/yonaskolb/XcodeGen):

```sh
cd examples/ios
xcodegen generate
open GawaExample.xcodeproj
```

Android: the example is the `:example` module of the Gradle build in `android/`.

```sh
cd android
./gradlew :example:installDebug              # device or emulator
./gradlew :example:connectedDebugAndroidTest # end-to-end test
```

## Web

```ts
import { createBridge, GawaError } from "@kt3k/gawa";

// Describe what your app implements.
type Methods = {
  "kv.get": (p: { key: string }) => string | null;
  "kv.set": (p: { key: string; value: string }) => void;
  "app.version": () => string;
};
type Events = { back: null };

const bridge = createBridge<Methods, Events>();

if (bridge.available) {
  const lang = await bridge.call("kv.get", { key: "lang" }); // string | null
  bridge.on("back", () => closeDialog());
} else {
  // In a normal browser: fall back to web APIs.
}
```

Calls reject with `GawaError` (`err.code`, `err.message`).

In a browser with no app, `installMock` stands in for the native host. Call it
before `createBridge`:

```ts
import { createBridge, installMock } from "gawa";

installMock({ handlers: { "app.version": () => "1.0" } });
const bridge = createBridge<Methods, Events>();
```

## iOS

Bundle the web build as a folder reference (e.g. `www/`), then:

```swift
import Gawa
import WebKit

let config = WKWebViewConfiguration()
let root = Bundle.main.url(forResource: "www", withExtension: nil)!
config.setURLSchemeHandler(GawaSchemeHandler(root: root), forURLScheme: "app")
let webView = WKWebView(frame: .zero, configuration: config)

let bridge = GawaBridge(allowedOrigins: [URL(string: "app://localhost")!])
struct KVGet: Decodable { let key: String }
bridge.router.register("kv.get") { (p: KVGet) -> String? in
    UserDefaults.standard.string(forKey: p.key)
}
bridge.router.register("app.version") { () -> String in "1.0" }
bridge.attach(to: webView)

webView.load(URLRequest(url: URL(string: "app://localhost/index.html")!))

// Later:
try bridge.emit("back", nil as String?)
```

`attach(to:)` makes the web view's content controller retain the bridge; call
`detach()` when you throw the web view away.

## Android

Put the web build in `src/main/assets/www/`, then:

```kotlin
import io.github.kt3k.gawa.*
import kotlinx.serialization.Serializable

@Serializable data class KVGet(val key: String)

val webView = WebView(context)
webView.webViewClient = GawaWebViewClient(GawaAssets.loader(context))

val bridge = GawaBridge(webView) // before loading the page
bridge.router.register<KVGet, String?>("kv.get") { prefs.getString(it.key, null) }
bridge.router.register<Unit, String>("app.version") { "1.0" }

webView.settings.javaScriptEnabled = true
webView.loadUrl(GawaAssets.url())

// Later:
bridge.emit("back", null as String?)
```

Use `Unit` for no parameters / no result. Types crossing the bridge must be
`@Serializable` (apply the `org.jetbrains.kotlin.plugin.serialization` Gradle
plugin). `GawaWebViewClient` also opens links to other origins in the browser;
subclass it or call `GawaAssets.loader(...).shouldInterceptRequest` from your
own client.

## Releasing

1. Bump the version in `package.json` and the default in
   `android/gawa/build.gradle.kts`.
2. Run `web/build.sh` and commit `web/dist` (CI fails if it is stale).
3. Add a `## X.Y.Z` section to `CHANGELOG.md`.
4. Tag `vX.Y.Z` and push the tag. Deno, Swift Package Manager, and JitPack
   consume the tag. The release workflow creates the GitHub Release from the
   changelog and publishes to npm when `NPM_TOKEN` is set.

## Specification

[SPEC.md](SPEC.md) is the normative specification.
[docs/protocol.md](docs/protocol.md) is a short map of it and is not a second
spec.

## Maintaining

[AGENTS.md](AGENTS.md) points a coding agent at
[docs/harness/](docs/harness/README.md). That is how this repository is meant
to be improved: small compatible changes, checked with
`deno run -A scripts/health.ts`. People contributing by hand should start at
[CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
