import XCTest

@testable import Gawa

/// The same `protocol/cases.json` cases the web and Android tests run.
@MainActor
final class ProtocolCasesTests: XCTestCase {
    struct KVGet: Decodable { let key: String }
    struct KVSet: Decodable { let key: String; let value: String }

    func router() -> GawaRouter {
        let router = GawaRouter()
        router.register("kv.get") { (p: KVGet) -> String? in
            p.key == "lang" ? "ja" : nil
        }
        router.register("kv.set") { (_: KVSet) in }
        router.register("app.version") { () -> String in "1.0" }
        router.register("app.fail") { () in throw GawaError("nope", "it failed") }
        router.register("app.boom") { () in
            throw NSError(domain: "gawa.test", code: 1)
        }
        return router
    }

    func testNativeCases() async throws {
        let suite = try loadSuite()
        let router = router()
        for c in suite.native {
            let body: String
            if let raw = c.raw {
                body = raw
            } else {
                body = try encode(c.request!)
            }
            let out = await router.handle(body)
            if isNull(c.reply) {
                XCTAssertNil(out, c.name)
                continue
            }
            let actual = try jsonObject(out!)
            let expected = try jsonObject(encode(c.reply!))
            XCTAssertEqual(
                try canonical(normalize(actual, expected: expected)),
                try canonical(expected),
                c.name)
        }
    }

    func testEventEnvelopes() throws {
        let suite = try loadSuite()
        for event in suite.events {
            let raw = try GawaRouter.eventEnvelope(event.event, event.data as String?)
            let actual = try jsonObject(raw) as! [String: Any]
            XCTAssertEqual(actual["gawa"] as? Int, 1, event.event)
            XCTAssertEqual(actual["event"] as? String, event.event)
            if event.data == nil {
                XCTAssertTrue(actual["data"] is NSNull, event.event)
            }
        }
    }

    // MARK: - JSON

    func isNull(_ value: Any?) -> Bool {
        value == nil || value is NSNull
    }

    func loadSuite() throws -> (native: [(name: String, raw: String?, request: Any?, reply: Any?)], events: [(event: String, data: String?)]) {
        var dir = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        var file: URL?
        for _ in 0..<6 {
            let candidate = dir.appendingPathComponent("protocol/cases.json")
            if FileManager.default.fileExists(atPath: candidate.path) {
                file = candidate
                break
            }
            dir.deleteLastPathComponent()
        }
        let url = try XCTUnwrap(file, "protocol/cases.json not found")
        let data = try Data(contentsOf: url)
        let root = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        let native = (root["native"] as! [[String: Any]]).map { c in
            (
                name: c["name"] as! String,
                raw: c["raw"] as? String,
                request: c["request"],
                reply: c["reply"]
            )
        }
        let events = (root["events"] as! [[String: Any]]).map { e in
            (event: e["event"] as! String, data: e["data"] as? String)
        }
        return (native, events)
    }

    func encode(_ value: Any) throws -> String {
        let data = try JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed])
        return String(decoding: data, as: UTF8.self)
    }

    func jsonObject(_ raw: String) throws -> Any {
        try JSONSerialization.jsonObject(with: Data(raw.utf8), options: [.fragmentsAllowed])
    }

    /// Drops error.message when the fixture does not specify one.
    func normalize(_ actual: Any, expected: Any) -> Any {
        guard
            var act = actual as? [String: Any],
            let exp = expected as? [String: Any],
            let expErr = exp["error"] as? [String: Any],
            var actErr = act["error"] as? [String: Any],
            expErr["message"] == nil
        else { return actual }
        actErr.removeValue(forKey: "message")
        act["error"] = actErr
        return act
    }

    func canonical(_ value: Any) throws -> String {
        let data = try JSONSerialization.data(
            withJSONObject: value, options: [.sortedKeys, .fragmentsAllowed])
        return String(decoding: data, as: UTF8.self)
    }
}
