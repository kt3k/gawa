package io.github.kt3k.gawa.example

import android.app.Activity
import android.os.Bundle
import android.util.Log
import android.webkit.WebView
import io.github.kt3k.gawa.GawaAssets
import io.github.kt3k.gawa.GawaBridge
import io.github.kt3k.gawa.GawaError
import io.github.kt3k.gawa.GawaWebViewClient
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Shows the bundled example page (examples/web) and answers its calls. */
class MainActivity : Activity() {
    companion object {
        /** Completed with the page's self-test report (used by the tests). */
        @Volatile
        var report: CompletableDeferred<Report> = CompletableDeferred()
    }

    private val scope = MainScope()
    private lateinit var webView: WebView
    private lateinit var bridge: GawaBridge

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WebView.setWebContentsDebuggingEnabled(true)
        webView = WebView(this)
        webView.settings.javaScriptEnabled = true
        webView.webViewClient = GawaWebViewClient(GawaAssets.loader(this))
        setContentView(webView)

        bridge = GawaBridge(webView, scope = scope)
        val router = bridge.router
        router.register<Echo, String>("echo") { it.text }
        router.register<Add, Int>("add") { it.a + it.b }
        router.register<Unit, Unit>("fail") { throw GawaError("nope", "it failed") }
        router.register<Ticks, Unit>("startTicks") { p ->
            scope.launch {
                for (i in 1..maxOf(p.count, 1)) {
                    delay(50)
                    bridge.emit("tick", i)
                }
            }
        }
        router.register<Report, Unit>("report") { r ->
            Log.i("GAWA_E2E", (if (r.ok) "PASS\n" else "FAIL\n") + r.log.joinToString("\n"))
            report.complete(r)
        }

        webView.loadUrl(GawaAssets.url())
    }

    override fun onDestroy() {
        bridge.dispose()
        scope.cancel()
        webView.destroy()
        super.onDestroy()
    }
}
