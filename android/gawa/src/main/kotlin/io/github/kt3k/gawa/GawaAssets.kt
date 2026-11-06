package io.github.kt3k.gawa

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.webkit.MimeTypeMap
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import java.io.ByteArrayInputStream
import java.io.IOException

/**
 * Serves files from the app's `assets/<dir>/` at
 * `https://appassets.androidplatform.net/`, so the page has a real https
 * origin instead of `file://`.
 *
 * ```kotlin
 * webView.webViewClient = GawaWebViewClient(GawaAssets.loader(context))
 * webView.loadUrl(GawaAssets.url())
 * ```
 */
public object GawaAssets {
    public const val DEFAULT_DOMAIN: String = WebViewAssetLoader.DEFAULT_DOMAIN
    public const val DEFAULT_ORIGIN: String = "https://$DEFAULT_DOMAIN"

    /**
     * @param dir directory under `assets/` to serve at the root.
     * @param spaFallback serve `index.html` for missing paths without a file
     *   extension (client-side routing).
     */
    public fun loader(
        context: Context,
        dir: String = "www",
        spaFallback: Boolean = false,
        domain: String = DEFAULT_DOMAIN,
    ): WebViewAssetLoader = WebViewAssetLoader.Builder()
        .setDomain(domain)
        .addPathHandler("/", AssetDirHandler(context.applicationContext, dir, spaFallback))
        .build()

    /** The URL of a page served by [loader]. */
    public fun url(path: String = "index.html", domain: String = DEFAULT_DOMAIN): String =
        "https://$domain/${path.removePrefix("/")}"
}

/** A [WebViewAssetLoader.PathHandler] for one directory under `assets/`. */
public class AssetDirHandler(
    private val context: Context,
    private val dir: String,
    private val spaFallback: Boolean = false,
) : WebViewAssetLoader.PathHandler {
    override fun handle(path: String): WebResourceResponse {
        var rel = path.removePrefix("/")
        if (rel.isEmpty() || rel.endsWith("/")) rel += "index.html"
        if (rel.split('/').any { it == ".." || it == "." }) return notFound()
        open(rel)?.let { return it }
        if (spaFallback && !rel.substringAfterLast('/').contains('.')) {
            open("index.html")?.let { return it }
        }
        return notFound()
    }

    private fun open(rel: String): WebResourceResponse? = try {
        WebResourceResponse(mimeType(rel), null, context.assets.open("$dir/$rel"))
    } catch (e: IOException) {
        null
    }

    private fun notFound() = WebResourceResponse(
        "text/plain", null, 404, "Not Found", emptyMap(), ByteArrayInputStream(ByteArray(0)),
    )

    private fun mimeType(rel: String): String =
        when (val ext = rel.substringAfterLast('.', "").lowercase()) {
            "html", "htm" -> "text/html"
            "js", "mjs" -> "text/javascript"
            "css" -> "text/css"
            "json", "map" -> "application/json"
            "wasm" -> "application/wasm"
            "svg" -> "image/svg+xml"
            "woff2" -> "font/woff2"
            else -> MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext)
                ?: "application/octet-stream"
        }
}

/**
 * A WebViewClient that serves [loader]'s assets and opens links to other
 * origins in the browser. Subclass it to add your own behaviour.
 */
public open class GawaWebViewClient(
    private val loader: WebViewAssetLoader,
    private val origin: String = GawaAssets.DEFAULT_ORIGIN,
) : WebViewClientCompat() {
    override fun shouldInterceptRequest(
        view: WebView,
        request: WebResourceRequest,
    ): WebResourceResponse? = loader.shouldInterceptRequest(request.url)

    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        val url = request.url
        if (url.toOriginString() == origin) return false
        try {
            view.context.startActivity(
                Intent(Intent.ACTION_VIEW, url).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
        } catch (e: Exception) {
            // No app can open it; stay on the page.
        }
        return true
    }
}

private fun Uri.toOriginString(): String =
    "$scheme://$host" + if (port != -1) ":$port" else ""
