package io.github.kt3k.gawa.example

import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/** Runs the example page in a real WebView and checks its self-test report. */
@RunWith(AndroidJUnit4::class)
class EndToEndTest {
    @Test
    fun examplePagePasses() {
        val deferred = CompletableDeferred<Report>()
        MainActivity.report = deferred
        ActivityScenario.launch(MainActivity::class.java).use {
            val report = runBlocking { withTimeout(60_000) { deferred.await() } }
            assertTrue(report.log.joinToString("\n"), report.ok)
            assertEquals("platform: android", report.log.first())
        }
    }
}
