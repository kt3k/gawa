package io.github.kt3k.gawa

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class GawaRouterTest {
    @Serializable
    data class Add(val a: Int, val b: Int)

    private fun obj(s: String?): JsonObject = Json.parseToJsonElement(s!!).jsonObject

    private fun router() = GawaRouter().apply {
        register<Add, Int>("add") { it.a + it.b }
        register<Unit, String>("hello") { "hi" }
        register<Unit, Unit>("noop") { }
        register<Unit, Unit>("fail") { throw GawaError("nope", "it failed") }
    }

    @Test
    fun results() = runTest {
        val r = router()
        var o = obj(r.handle("""{"gawa":1,"id":1,"method":"add","params":{"a":2,"b":3}}"""))
        assertEquals(1, o["id"]!!.jsonPrimitive.int)
        assertEquals(5, o["result"]!!.jsonPrimitive.int)

        o = obj(r.handle("""{"gawa":1,"id":2,"method":"hello"}"""))
        assertEquals("hi", o["result"]!!.jsonPrimitive.content)

        o = obj(r.handle("""{"gawa":1,"id":3,"method":"noop"}"""))
        assertEquals(JsonNull, o["result"])
    }

    @Test
    fun errors() = runTest {
        val r = router()
        fun code(s: String?) = obj(s)["error"]!!.jsonObject["code"]!!.jsonPrimitive.content

        assertEquals("unknown_method", code(r.handle("""{"gawa":1,"id":1,"method":"x"}""")))
        assertEquals(
            "invalid_params",
            code(r.handle("""{"gawa":1,"id":2,"method":"add","params":{"a":1}}""")),
        )
        val e = obj(r.handle("""{"gawa":1,"id":3,"method":"fail"}"""))["error"]!!.jsonObject
        assertEquals("nope", e["code"]!!.jsonPrimitive.content)
        assertEquals("it failed", e["message"]!!.jsonPrimitive.content)
    }

    @Test
    fun parsing() = runTest {
        val r = router()
        assertTrue(r.parse("""{"gawa":1,"hello":true}""") is GawaRouter.Incoming.Hello)
        assertNull(r.parse("not json"))
        assertNull(r.parse("""{"gawa":2,"id":1,"method":"x"}"""))
        assertNull(r.parse("""{"gawa":1,"id":"1","method":"x"}"""))
        assertNull(r.handle("""{"gawa":1,"hello":true}"""))
    }

    @Test
    fun events() {
        val o = obj(GawaRouter().eventEnvelope("tick", JsonPrimitive(3)))
        assertEquals(1, o["gawa"]!!.jsonPrimitive.int)
        assertEquals("tick", o["event"]!!.jsonPrimitive.content)
        assertEquals(3, o["data"]!!.jsonPrimitive.int)
    }
}
