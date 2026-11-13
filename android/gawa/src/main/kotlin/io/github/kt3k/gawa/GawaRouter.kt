package io.github.kt3k.gawa

import kotlinx.coroutines.CancellationException
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.serializer

/**
 * An error to report to the page. The page receives it as a `GawaError`
 * with the same [code] and message.
 */
public class GawaError(public val code: String, message: String) : Exception(message)

/**
 * Protocol logic independent of Android: method registry and envelope
 * handling. [GawaBridge] connects it to a WebView.
 */
public class GawaRouter(
    @PublishedApi internal val json: Json = Json { ignoreUnknownKeys = true },
) {
    public companion object {
        public const val PROTOCOL: Int = 1
    }

    /** Optional line logger for each request and reply. Null by default. */
    public var log: ((String) -> Unit)? = null

    @PublishedApi
    internal val handlers: MutableMap<String, suspend (JsonElement) -> JsonElement> =
        mutableMapOf()

    /** Registers a handler working on raw JSON (`JsonNull` when absent). */
    public fun registerRaw(method: String, handler: suspend (JsonElement) -> JsonElement) {
        handlers[method] = handler
    }

    /**
     * Registers a typed method. Use `Unit` for [P] when the method takes no
     * parameters and for [R] when it returns nothing.
     */
    public inline fun <reified P, reified R> register(
        method: String,
        noinline handler: suspend (P) -> R,
    ) {
        val ps = serializer<P>()
        val rs = serializer<R>()
        registerRaw(method) { params ->
            val p: P = if (P::class == Unit::class) {
                @Suppress("UNCHECKED_CAST")
                Unit as P
            } else {
                try {
                    json.decodeFromJsonElement(ps, params)
                } catch (e: SerializationException) {
                    throw GawaError("invalid_params", e.message ?: "invalid params")
                } catch (e: IllegalArgumentException) {
                    throw GawaError("invalid_params", e.message ?: "invalid params")
                }
            }
            val r = handler(p)
            if (R::class == Unit::class) JsonNull else json.encodeToJsonElement(rs, r)
        }
    }

    public fun unregister(method: String) {
        handlers.remove(method)
    }

    /** A parsed incoming message. */
    public sealed interface Incoming {
        public data class Request(public val body: JsonObject) : Incoming
        public data object Hello : Incoming
    }

    /** Parses a message from the page; null when it is not a gawa message. */
    public fun parse(body: String): Incoming? {
        val env = try {
            json.parseToJsonElement(body).jsonObject
        } catch (e: Exception) {
            return null
        }
        if (env["gawa"].number()?.intOrNull != PROTOCOL) return null
        if (env["hello"].let { it is JsonPrimitive && !it.isString && it.content == "true" }) {
            return Incoming.Hello
        }
        if (env["id"].number()?.intOrNull == null) return null
        if ((env["method"] as? JsonPrimitive)?.isString != true) return null
        return Incoming.Request(env)
    }

    /** Handles a request envelope and returns the reply envelope. */
    public suspend fun handle(request: Incoming.Request): String {
        val env = request.body
        val id = (env["id"] as JsonPrimitive).int
        val method = (env["method"] as JsonPrimitive).content
        val reply = try {
            val handler = handlers[method]
                ?: throw GawaError("unknown_method", "unknown method: $method")
            val result = handler(env["params"] ?: JsonNull)
            buildJsonObject {
                put("gawa", PROTOCOL)
                put("id", id)
                put("result", result)
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: GawaError) {
            errorEnvelope(id, e.code, e.message ?: "")
        } catch (e: Exception) {
            errorEnvelope(id, "internal", e.toString())
        }
        val text = reply.toString()
        log?.invoke("reply $text")
        return text
    }

    /** Handles a raw message; null when it is not a request. */
    public suspend fun handle(body: String): String? {
        log?.invoke("receive $body")
        val request = parse(body) as? Incoming.Request
        if (request == null) {
            log?.invoke("ignore $body")
            return null
        }
        return handle(request)
    }

    /** Builds an event envelope. */
    public fun eventEnvelope(event: String, data: JsonElement): String =
        buildJsonObject {
            put("gawa", PROTOCOL)
            put("event", event)
            put("data", data)
        }.toString()

    /** The element as a JSON number (not a numeric string), or null. */
    private fun JsonElement?.number(): JsonPrimitive? =
        (this as? JsonPrimitive)?.takeIf { !it.isString && it !is JsonNull }

    private fun errorEnvelope(id: Int, code: String, message: String) = buildJsonObject {
        put("gawa", PROTOCOL)
        put("id", id)
        put("error", buildJsonObject {
            put("code", code)
            put("message", message)
        })
    }
}
