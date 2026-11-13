package io.github.kt3k.gawa

import java.io.File
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The same `protocol/cases.json` cases the web and iOS tests run. */
class ProtocolCasesTest {
    @Serializable data class KVGet(val key: String)
    @Serializable data class KVSet(val key: String, val value: String)

    private val json = Json { ignoreUnknownKeys = true }

    private fun router() = GawaRouter().apply {
        register<KVGet, String?>("kv.get") { if (it.key == "lang") "ja" else null }
        register<KVSet, Unit>("kv.set") { }
        register<Unit, String>("app.version") { "1.0" }
        register<Unit, Unit>("app.fail") { throw GawaError("nope", "it failed") }
        register<Unit, Unit>("app.boom") { error("boom") }
    }

    @Test
    fun nativeCases() = runTest {
        val router = router()
        for (c in cases("native")) {
            val name = c["name"]!!.jsonPrimitive.content
            val rawPrim = c["raw"] as? JsonPrimitive
            val raw = if (rawPrim != null && rawPrim !is JsonNull) rawPrim.content else null
            val body = raw ?: c["request"]!!.toString()
            val reply = c["reply"]
            val android = c["android"] as? JsonPrimitive
            if (android != null && android !is JsonNull && android.content == "hello") {
                assertTrue(name, router.parse(body) is GawaRouter.Incoming.Hello)
            }
            if (reply == null || reply is JsonNull) {
                assertNull(name, router.handle(body))
            } else {
                val actual = normalize(json.parseToJsonElement(router.handle(body)!!), reply)
                assertEquals(name, reply, actual)
            }
        }
    }

    @Test
    fun eventEnvelopes() {
        val router = GawaRouter()
        for (event in cases("events")) {
            val name = event["event"]!!.jsonPrimitive.content
            val data = event["data"] ?: JsonNull
            val actual = json.parseToJsonElement(router.eventEnvelope(name, data)).jsonObject
            assertEquals(1, (actual["gawa"] as JsonPrimitive).content.toInt())
            assertEquals(name, actual["event"]!!.jsonPrimitive.content)
            assertEquals(data, actual["data"])
        }
    }

    private fun cases(key: String): List<JsonObject> {
        var dir: File? = File(System.getProperty("user.dir"))
        while (dir != null) {
            val file = File(dir, "protocol/cases.json")
            if (file.isFile) {
                val root = json.parseToJsonElement(file.readText()).jsonObject
                return (root[key] as JsonArray).map { it.jsonObject }
            }
            dir = dir.parentFile
        }
        error("protocol/cases.json not found from ${System.getProperty("user.dir")}")
    }

    /** Drops error.message when the fixture does not specify one. */
    private fun normalize(actual: JsonElement, expected: JsonElement): JsonElement {
        val act = actual as? JsonObject ?: return actual
        val exp = expected as? JsonObject ?: return actual
        val expErr = exp["error"] as? JsonObject ?: return actual
        val actErr = act["error"] as? JsonObject ?: return actual
        if ("message" in expErr) return actual
        val stripped = JsonObject(actErr.filterKeys { it != "message" })
        return JsonObject(act + ("error" to stripped))
    }
}
