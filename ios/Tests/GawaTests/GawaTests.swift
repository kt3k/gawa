import XCTest

@testable import Gawa

@MainActor
final class GawaRouterTests: XCTestCase {
    struct Add: Codable { let a: Int; let b: Int }

    func reply(_ router: GawaRouter, _ request: String) async throws -> [String: Any] {
        let out = await router.handle(request)
        let s = try XCTUnwrap(out)
        return try XCTUnwrap(
            JSONSerialization.jsonObject(with: Data(s.utf8)) as? [String: Any])
    }

    func testResults() async throws {
        let router = GawaRouter()
        router.register("add") { (p: Add) in p.a + p.b }
        router.register("hello") { () -> String in "hi" }
        router.register("noop") { () in }

        var r = try await reply(router, #"{"gawa":1,"id":1,"method":"add","params":{"a":2,"b":3}}"#)
        XCTAssertEqual(r["id"] as? Int, 1)
        XCTAssertEqual(r["result"] as? Int, 5)

        r = try await reply(router, #"{"gawa":1,"id":2,"method":"hello"}"#)
        XCTAssertEqual(r["result"] as? String, "hi")

        r = try await reply(router, #"{"gawa":1,"id":3,"method":"noop"}"#)
        XCTAssertTrue(r["result"] is NSNull)
    }

    func testErrors() async throws {
        let router = GawaRouter()
        router.register("add") { (p: Add) in p.a + p.b }
        router.register("fail") { () in throw GawaError("nope", "it failed") }

        var r = try await reply(router, #"{"gawa":1,"id":1,"method":"missing"}"#)
        XCTAssertEqual((r["error"] as? [String: Any])?["code"] as? String, "unknown_method")

        r = try await reply(router, #"{"gawa":1,"id":2,"method":"add","params":{"a":1}}"#)
        XCTAssertEqual((r["error"] as? [String: Any])?["code"] as? String, "invalid_params")

        r = try await reply(router, #"{"gawa":1,"id":3,"method":"fail"}"#)
        let e = try XCTUnwrap(r["error"] as? [String: Any])
        XCTAssertEqual(e["code"] as? String, "nope")
        XCTAssertEqual(e["message"] as? String, "it failed")
    }

    func testIgnoresNonRequests() async {
        let router = GawaRouter()
        let a = await router.handle("not json")
        let b = await router.handle(#"{"gawa":2,"id":1,"method":"x"}"#)
        let c = await router.handle(#"{"gawa":1,"hello":true}"#)
        XCTAssertNil(a)
        XCTAssertNil(b)
        XCTAssertNil(c)
    }

    func testEventEnvelope() throws {
        let s = try GawaRouter.eventEnvelope("tick", 3)
        let o = try XCTUnwrap(
            JSONSerialization.jsonObject(with: Data(s.utf8)) as? [String: Any])
        XCTAssertEqual(o["gawa"] as? Int, 1)
        XCTAssertEqual(o["event"] as? String, "tick")
        XCTAssertEqual(o["data"] as? Int, 3)
    }

    func testLog() async {
        let router = GawaRouter()
        router.register("hello") { () -> String in "hi" }
        var lines: [String] = []
        router.log = { lines.append($0) }
        _ = await router.handle(#"{"gawa":1,"id":1,"method":"hello"}"#)
        XCTAssertTrue(lines.contains { $0.hasPrefix("receive ") })
        XCTAssertTrue(lines.contains { $0.hasPrefix("reply ") })
    }
}

final class GawaSchemeHandlerTests: XCTestCase {
    var root: URL!

    override func setUpWithError() throws {
        root = FileManager.default.temporaryDirectory
            .appendingPathComponent("gawa-\(UUID().uuidString)")
        try FileManager.default.createDirectory(
            at: root.appendingPathComponent("assets"), withIntermediateDirectories: true)
        try Data("<html>".utf8).write(to: root.appendingPathComponent("index.html"))
        try Data("x".utf8).write(to: root.appendingPathComponent("assets/app.js"))
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: root)
    }

    func testServesFiles() {
        let h = GawaSchemeHandler(root: root)
        XCTAssertEqual(h.response(for: "/").0, 200)
        XCTAssertEqual(h.response(for: "/index.html").2, "text/html")
        let js = h.response(for: "/assets/app.js")
        XCTAssertEqual(js.0, 200)
        XCTAssertEqual(js.2, "text/javascript")
        XCTAssertEqual(h.response(for: "/missing.js").0, 404)
    }

    func testRejectsTraversal() {
        let h = GawaSchemeHandler(root: root)
        XCTAssertEqual(h.response(for: "/../secret").0, 404)
        XCTAssertEqual(h.response(for: "/assets/../../secret").0, 404)
        XCTAssertEqual(h.response(for: "/%2E%2E/secret").0, 404)
    }

    func testSpaFallback() {
        let h = GawaSchemeHandler(root: root, spaFallback: true)
        XCTAssertEqual(h.response(for: "/games/42").0, 200)
        XCTAssertEqual(h.response(for: "/missing.js").0, 404)
    }
}
