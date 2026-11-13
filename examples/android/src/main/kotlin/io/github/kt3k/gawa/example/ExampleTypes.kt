// Generated from schema/example.json by schema/generate.ts. Do not edit.
package io.github.kt3k.gawa.example

import kotlinx.serialization.Serializable

@Serializable
data class Echo(val text: String)

@Serializable
data class Add(val a: Int, val b: Int)

@Serializable
data class Ticks(val count: Int)

@Serializable
data class Report(val ok: Boolean, val log: List<String>)
