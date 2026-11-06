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

| package | path       | install                                       |
| ------- | ---------- | --------------------------------------------- |
| web     | `web/`     | `deno add jsr:@kt3k/gawa` (not published yet) |
| iOS     | `ios/`     | Swift Package (iOS 15+, macOS 12+)            |
| Android | `android/` | Android library (minSdk 24)                   |

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

## Protocol

See [docs/protocol.md](docs/protocol.md).

## License

MIT
