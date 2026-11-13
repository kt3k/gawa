# Android

minSdk 24. Package `io.github.kt3k.gawa`. The `:gawa` module is published by [JitPack](https://jitpack.io/#kt3k/gawa) from a git tag. Sources: [`android/gawa/src/main/kotlin/io/github/kt3k/gawa`](https://github.com/kt3k/gawa/tree/main/android/gawa/src/main/kotlin/io/github/kt3k/gawa).

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
plugins {
    id("org.jetbrains.kotlin.plugin.serialization")
}
dependencies {
    implementation("com.github.kt3k:gawa:{{tag}}")
}
```

The library depends on AndroidX WebKit, kotlinx.serialization, and kotlinx-coroutines (`api` in `android/gawa/build.gradle.kts`). Types that cross the bridge must be `@Serializable`.

`consumer-rules.pro` notes that gawa looks up serializers with reified `serializer<T>()`. Keep the serializers of the types you pass across the bridge. The kotlinx.serialization plugin's rules cover `@Serializable` types.

JitPack builds with JDK 17 (`jitpack.yml`).

## Serving the page

Put the web build in `src/main/assets/www/`. `GawaAssets` serves that directory at `https://appassets.androidplatform.net/` through `WebViewAssetLoader`, so the page has a real https origin instead of `file://`.

```kotlin
import io.github.kt3k.gawa.*

webView.webViewClient = GawaWebViewClient(GawaAssets.loader(context))
webView.settings.javaScriptEnabled = true
webView.loadUrl(GawaAssets.url())
```

The library does not turn JavaScript on. `GawaAssets.url()` is `https://appassets.androidplatform.net/index.html`.

```kotlin
public object GawaAssets {
    public const val DEFAULT_DOMAIN: String = WebViewAssetLoader.DEFAULT_DOMAIN
    public const val DEFAULT_ORIGIN: String = "https://$DEFAULT_DOMAIN"

    public fun loader(
        context: Context,
        dir: String = "www",
        spaFallback: Boolean = false,
        domain: String = DEFAULT_DOMAIN,
    ): WebViewAssetLoader

    public fun url(
        path: String = "index.html",
        domain: String = DEFAULT_DOMAIN,
    ): String
}
```

`DEFAULT_DOMAIN` is `WebViewAssetLoader.DEFAULT_DOMAIN` (`appassets.androidplatform.net`). `loader` serves `assets/<dir>/` at the root of `https://<domain>/`. Pass the same `domain` to `url`, and allow `https://<domain>` on the bridge.

`AssetDirHandler` is the public `WebViewAssetLoader.PathHandler` if you build a loader yourself.

Paths:

- An empty path or a path ending in `/` serves `index.html`.
- A segment that is `.` or `..` is 404.
- A file that exists in assets is returned with a MIME type and a null encoding.
- With `spaFallback`, a missing path whose last segment contains no `.` is answered with `index.html`. `missing.js` stays 404.
- Otherwise 404, `text/plain`, empty body.

MIME types match iOS: `html` / `htm`, `js` / `mjs`, `css`, `json` / `map`, `wasm`, `svg`, `woff2`, then `MimeTypeMap`, then `application/octet-stream`.

### GawaWebViewClient

```kotlin
public open class GawaWebViewClient(
    private val loader: WebViewAssetLoader,
    private val origin: String = GawaAssets.DEFAULT_ORIGIN,
) : WebViewClientCompat()
```

`shouldInterceptRequest` forwards to the loader. `shouldOverrideUrlLoading` keeps a URL whose origin equals `origin` in the WebView and opens any other origin with `ACTION_VIEW`. If nothing can handle that intent, the page stays put. Subclass the client, or call `loader.shouldInterceptRequest` from your own.

## GawaBridge

Construct the bridge before loading the page. The constructor is `@MainThread`.

```kotlin
public class GawaBridge @MainThread constructor(
    webView: WebView,
    allowedOrigins: Set<String> = setOf(GawaAssets.DEFAULT_ORIGIN),
    public val router: GawaRouter = GawaRouter(),
    scope: CoroutineScope = MainScope(),
) {
    public companion object {
        public const val NAME: String = "gawa"
        public fun isSupported(): Boolean
    }

    public inline fun <reified D> emit(event: String, data: D)
    @MainThread public fun emitRaw(event: String, data: JsonElement): Boolean
    @MainThread public fun dispose()
}
```

`allowedOrigins` is passed to `WebViewCompat.addWebMessageListener` as `allowedOriginRules`. Only those origins receive the `gawa` object. Only messages from the main frame are handled.

`isSupported()` is `WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)`. The constructor checks it and throws `IllegalStateException` (`"WebView does not support WEB_MESSAGE_LISTENER"`) when the device's WebView does not.

Handlers run on `scope` (a `MainScope` by default). The reply is posted on the main thread with `webView.post`. `dispose()` removes the `gawa` object from future pages, drops the event proxy, and cancels the scope. The example activity calls it from `onDestroy`, before `webView.destroy()`.

### Events

The page sends `{ "gawa": 1, "hello": true }` once, when it creates its first bridge. The app keeps that message's `JavaScriptReplyProxy` and sends events through it. Replies use the proxy of the request they answer.

`emit` encodes `data` with the router's JSON and posts an event envelope. `emitRaw` posts a `JsonElement` and returns false when the page has not said hello yet, in which case the event is not sent. `emit` ignores that boolean.

```kotlin
bridge.emit("back", null as String?)
```

## GawaRouter

```kotlin
public class GawaError(public val code: String, message: String) : Exception(message)

public class GawaRouter {
    public companion object {
        public const val PROTOCOL: Int = 1
    }

    public fun registerRaw(
        method: String,
        handler: suspend (JsonElement) -> JsonElement,
    )
    public inline fun <reified P, reified R> register(
        method: String,
        noinline handler: suspend (P) -> R,
    )
    public fun unregister(method: String)

    public sealed interface Incoming {
        public data class Request(public val body: JsonObject) : Incoming
        public data object Hello : Incoming
    }

    public fun parse(body: String): Incoming?
    public suspend fun handle(request: Incoming.Request): String
    public suspend fun handle(body: String): String?
    public fun eventEnvelope(event: String, data: JsonElement): String
}
```

The default `Json` uses `ignoreUnknownKeys = true`. The `json` property is internal to the module; apps use the default.

Use `Unit` for no parameters and for no result. `registerRaw` receives `JsonNull` when `params` is absent.

```kotlin
@Serializable data class KVGet(val key: String)

bridge.router.register<KVGet, String?>("kv.get") { prefs.getString(it.key, null) }
bridge.router.register<Unit, String>("app.version") { "1.0" }
bridge.router.register<Unit, Unit>("fail") { throw GawaError("nope", "it failed") }
```

`parse` returns:

- `Incoming.Hello` when `gawa` is `1` and `hello` is JSON `true` (a string `"true"` does not count).
- `Incoming.Request` when `gawa` is `1`, `id` is a JSON number (not a numeric string), and `method` is a string.
- `null` for malformed JSON, another version, or anything else.

`handle(body)` returns null when the message is not a request (including hello).

| situation                                                                    | reply                                                                                             |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| handler returns a value                                                      | `{ "gawa": 1, "id", "result" }`                                                                   |
| `R` is `Unit`                                                                | `"result": null`                                                                                  |
| no handler                                                                   | `unknown_method`, message `unknown method: <name>`                                                |
| `SerializationException` or `IllegalArgumentException` while decoding params | `invalid_params`                                                                                  |
| thrown `GawaError`                                                           | that `code` and `message`                                                                         |
| any other exception                                                          | `internal`, message `e.toString()`. `CancellationException` is rethrown, not turned into a reply. |

## Example

```kotlin
val webView = WebView(context)
webView.webViewClient = GawaWebViewClient(GawaAssets.loader(context))

val bridge = GawaBridge(webView) // before loading the page
bridge.router.register<Unit, String>("app.version") { "1.0" }

webView.settings.javaScriptEnabled = true
webView.loadUrl(GawaAssets.url())
```

`GawaWebViewClient` also opens links to other origins in the browser. Subclass it, or call `GawaAssets.loader(...).shouldInterceptRequest` from your own client.
