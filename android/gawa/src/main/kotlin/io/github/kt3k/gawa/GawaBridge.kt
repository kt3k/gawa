package io.github.kt3k.gawa

import android.webkit.WebView
import androidx.annotation.MainThread
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.serializer

/**
 * Connects a [GawaRouter] to a WebView through
 * `WebViewCompat.addWebMessageListener`.
 *
 * ```kotlin
 * val bridge = GawaBridge(webView)          // before loading the page
 * bridge.router.register<Unit, String>("app.version") { "1.0" }
 * webView.loadUrl(GawaAssets.url())
 * bridge.emit("back", null as String?)
 * ```
 *
 * Only pages from [allowedOrigins] get the `gawa` object, and only messages
 * from the main frame are handled.
 *
 * @param allowedOrigins origin rules, e.g. `https://appassets.androidplatform.net`.
 * @param scope where handlers run; replies are posted on the main thread.
 */
public class GawaBridge @MainThread constructor(
    private val webView: WebView,
    allowedOrigins: Set<String> = setOf(GawaAssets.DEFAULT_ORIGIN),
    public val router: GawaRouter = GawaRouter(),
    private val scope: CoroutineScope = MainScope(),
) {
    public companion object {
        public const val NAME: String = "gawa"

        /** True when this device's WebView supports the bridge. */
        public fun isSupported(): Boolean =
            WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)
    }

    /** Where events go: the reply proxy of the page's latest `hello`. */
    private var eventProxy: JavaScriptReplyProxy? = null

    init {
        check(isSupported()) { "WebView does not support WEB_MESSAGE_LISTENER" }
        WebViewCompat.addWebMessageListener(webView, NAME, allowedOrigins) {
                _, message, _, isMainFrame, replyProxy ->
            val body = message.data
            if (isMainFrame && body != null) onMessage(body, replyProxy)
        }
    }

    private fun onMessage(body: String, replyProxy: JavaScriptReplyProxy) {
        when (val m = router.parse(body)) {
            is GawaRouter.Incoming.Hello -> eventProxy = replyProxy
            is GawaRouter.Incoming.Request -> scope.launch {
                val reply = router.handle(m)
                webView.post { replyProxy.postMessage(reply) }
            }
            null -> Unit
        }
    }

    /** Sends an event to the page (`bridge.on(event, …)` on the web side). */
    public inline fun <reified D> emit(event: String, data: D) {
        emitRaw(event, router.json.encodeToJsonElement(serializer<D>(), data))
    }

    /** Sends an event with raw JSON data. Returns false if no page listens. */
    @MainThread
    public fun emitRaw(event: String, data: JsonElement): Boolean {
        val proxy = eventProxy ?: return false
        proxy.postMessage(router.eventEnvelope(event, data))
        return true
    }

    /** Removes the `gawa` object from future pages and stops handlers. */
    @MainThread
    public fun dispose() {
        WebViewCompat.removeWebMessageListener(webView, NAME)
        eventProxy = null
        scope.cancel()
    }
}
