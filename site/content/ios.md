# iOS

Swift Package Manager. Platforms: iOS 15+ / macOS 12+. The product and the module are both `Gawa`. Sources: [`ios/Sources/Gawa`](https://github.com/kt3k/gawa/tree/main/ios/Sources/Gawa).

```swift
.package(url: "https://github.com/kt3k/gawa", from: "{{version}}")
```

`GawaBridge` and `GawaRouter` are `@MainActor`. Handlers may be `async`.

## Serving the page

`GawaSchemeHandler` serves a directory of bundled files under a custom URL scheme, so the page has a real origin (the examples use `app://localhost`) instead of `file://`.

`http`, `https`, and the other schemes WebKit handles itself cannot be used. The scheme and host are whatever you load and allow: register the handler for the scheme, load `scheme://host/…`, and pass that origin to `GawaBridge`.

Bundle the web build as a folder reference (for example `www/`).

```swift
import Gawa
import WebKit

let config = WKWebViewConfiguration()
let root = Bundle.main.url(forResource: "www", withExtension: nil)!
config.setURLSchemeHandler(GawaSchemeHandler(root: root), forURLScheme: "app")
let webView = WKWebView(frame: .zero, configuration: config)
webView.load(URLRequest(url: URL(string: "app://localhost/index.html")!))
```

```swift
public init(root: URL, spaFallback: Bool = false)
```

- `root` — directory to serve.
- `spaFallback` — when true, a missing path with no file extension is answered with `index.html` (client-side routing). The default is false. A missing path that has an extension, such as `missing.js`, is still 404.

Paths:

- An empty path or a path ending in `/` serves `index.html`.
- The path is percent-decoded. A path that escapes `root` (including `..` and `%2E%2E`) is not served.
- A file that exists is returned with status 200.
- Otherwise, with `spaFallback` and no path extension, `index.html` is served as `text/html`.
- Otherwise the status is 404, the body is empty, and the type is `text/plain`.

Responses set `Content-Type`, `Content-Length`, and `Cache-Control: no-cache`. The body is produced synchronously; `stop` has nothing to cancel.

MIME types: `html` / `htm` → `text/html`, `js` / `mjs` → `text/javascript`, `css` → `text/css`, `json` / `map` → `application/json`, `wasm` → `application/wasm`, `svg` → `image/svg+xml`, `woff2` → `font/woff2`. Anything else uses `UTType`'s preferred type, or `application/octet-stream`.

## GawaBridge

```swift
@MainActor
public final class GawaBridge: NSObject, WKScriptMessageHandlerWithReply {
    public static let handlerName = "gawa"
    public let router: GawaRouter

    public init(
        allowedOrigins: [URL],
        allowSubframes: Bool = false,
        router: GawaRouter? = nil
    )
    public func attach(to webView: WKWebView)
    public func detach()
    public func emit<D: Encodable>(_ event: String, _ data: D) throws
}
```

- `allowedOrigins` — origins (`scheme://host[:port]`) whose pages may use the bridge. For the example scheme handler that is `app://localhost`.
- `allowSubframes` — also accept messages from iframes. The default is false (main frame only).
- `router` — an existing router, or a new one when `nil`.

`attach(to:)` installs the message handler named `gawa` in the page content world (`WKContentWorld.page`). Call it before loading the page. The web view's user content controller retains the bridge until `detach()`. `detach()` removes the handler. The example app calls it from `dismantleUIView`.

The page calls `webkit.messageHandlers.gawa.postMessage` with a JSON string. The reply is the resolution of that promise. See [Web](/docs/web/) and the [protocol](/docs/protocol/).

### Origin checks

A message is handled when it is from the main frame (or `allowSubframes` is true), its `WKSecurityOrigin` matches an allowed origin, and `message.body` is a `String`. The origin matches when `protocol`, `host`, and `port` are equal. An allowed URL with no port matches port `0`.

Anything else is not dispatched. The script-message reply handler is called with the error string `"gawa: message rejected"`, so the page's `postMessage` promise rejects and `call` rejects with `GawaError` code `internal`. A string that is not a gawa request gets `"gawa: not a request"`.

`emit` sends an event the page receives with `bridge.on`. It does nothing unless the web view is showing a page whose URL matches an allowed origin (`scheme`, `host`, and `port`, with a missing port matching only a missing port). The payload is any `Encodable`. Pass `nil as String?` for no data.

```swift
try bridge.emit("back", nil as String?)
```

## GawaRouter

Protocol logic, independent of WebKit. `protocolVersion` is `1`. Parameters and results are encoded with `JSONEncoder` and decoded with `JSONDecoder`.

```swift
public struct GawaError: Error, Equatable {
    public let code: String
    public let message: String
    public init(_ code: String, _ message: String)
}
```

The page receives that `code` and `message` as a web `GawaError`.

```swift
public func register<P: Decodable, R: Encodable>(
    _ method: String, _ handler: @escaping (P) async throws -> R)
public func register<P: Decodable>(
    _ method: String, _ handler: @escaping (P) async throws -> Void)
public func register<R: Encodable>(
    _ method: String, _ handler: @escaping () async throws -> R)
public func register(
    _ method: String, _ handler: @escaping () async throws -> Void)
public func registerRaw(
    _ method: String, _ handler: @escaping (_ params: Data?) async throws -> Data?)
public func unregister(_ method: String)
```

Swift picks the overload from the closure. `registerRaw` takes the JSON `params` as `Data` (`nil` when the request has no params or JSON `null`) and returns `Data` (`nil` means JSON `null`).

```swift
struct KVGet: Decodable { let key: String }

bridge.router.register("kv.get") { (p: KVGet) -> String? in
    UserDefaults.standard.string(forKey: p.key)
}
bridge.router.register("app.version") { () -> String in "1.0" }
bridge.router.register("fail") { () async throws -> Void in
    throw GawaError("nope", "it failed")
}
```

`handle(_:)` takes one request envelope, a JSON string, and returns the reply envelope, or `nil` when the message is not a gawa request (not JSON, `gawa` is not `1`, or `id` / `method` are missing). `GawaRouter.eventEnvelope(_:_:)` builds an event envelope.

Results:

| situation                                                     | reply                                              |
| ------------------------------------------------------------- | -------------------------------------------------- |
| handler returns a value                                       | `{ "gawa": 1, "id", "result" }`                    |
| handler returns nothing (`Void`, or `nil` from `registerRaw`) | `"result": null`                                   |
| no handler                                                    | `unknown_method`, message `unknown method: <name>` |
| `JSONDecoder` fails                                           | `invalid_params`, message is the decoding error    |
| thrown `GawaError`                                            | that `code` and `message`                          |
| any other thrown error                                        | `internal`                                         |

## Example

```swift
let bridge = GawaBridge(allowedOrigins: [URL(string: "app://localhost")!])
bridge.router.register("app.version") { () -> String in "1.0" }
bridge.attach(to: webView)
webView.load(URLRequest(url: URL(string: "app://localhost/index.html")!))
```

Call `detach()` when you throw the web view away.
