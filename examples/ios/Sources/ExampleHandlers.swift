import Foundation
import Gawa

/// The methods the example page (examples/web) calls.
///
/// Kept in sync with ios/Tests/GawaTests/EndToEndTests.swift, which runs
/// the same page in a WKWebView on macOS.
@MainActor
enum ExampleHandlers {
    struct Echo: Decodable { let text: String }
    struct Add: Decodable { let a: Int; let b: Int }
    struct Ticks: Decodable { let count: Int }
    struct Report: Decodable { let ok: Bool; let log: [String] }

    static func register(on bridge: GawaBridge, onReport: @escaping (Report) -> Void) {
        let router = bridge.router
        router.register("echo") { (p: Echo) -> String in p.text }
        router.register("add") { (p: Add) -> Int in p.a + p.b }
        router.register("fail") { () async throws -> Void in
            throw GawaError("nope", "it failed")
        }
        router.register("startTicks") { [weak bridge] (p: Ticks) async throws -> Void in
            _ = Task { @MainActor in
                for i in 1...max(p.count, 1) {
                    try await Task.sleep(nanoseconds: 50_000_000)
                    try bridge?.emit("tick", i)
                }
            }
        }
        router.register("report") { (p: Report) async throws -> Void in onReport(p) }
    }
}
