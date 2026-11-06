# gawa

> **gawa** (側) — the shell around something.

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

## Install

Everything is installed straight from a git tag — no registry needed.

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

[`examples/`](examples) has a minimal iOS app and Android app showing the same
bundled page. The page also tests the bridge end to end; CI runs it in a real
`WKWebView` (macOS) and a real Android `WebView` (emulator).

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
3. Tag `vX.Y.Z` and push the tag. npm, Deno, Swift Package Manager and JitPack
   all consume the tag directly.

## Protocol

See [docs/protocol.md](docs/protocol.md).

## License

MIT
