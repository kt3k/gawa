#if os(macOS)
    import WebKit
    import XCTest

    @testable import Gawa

    /// Loads the example page (examples/web/www) in a real WKWebView through
    /// GawaSchemeHandler and GawaBridge, and waits for its self-test report.
    @MainActor
    final class EndToEndTests: XCTestCase {
        struct Echo: Decodable { let text: String }
        struct Add: Decodable { let a: Int; let b: Int }
        struct Ticks: Decodable { let count: Int }
        struct Report: Decodable { let ok: Bool; let log: [String] }

        func testExamplePage() async throws {
            let root = URL(fileURLWithPath: #filePath)
                .deletingLastPathComponent()  // GawaTests
                .deletingLastPathComponent()  // Tests
                .deletingLastPathComponent()  // ios
                .deletingLastPathComponent()  // repository root
                .appendingPathComponent("examples/web/www")
            guard FileManager.default.fileExists(atPath: root.appendingPathComponent("main.js").path)
            else {
                throw XCTSkip("run examples/web/build.sh first")
            }

            let config = WKWebViewConfiguration()
            config.setURLSchemeHandler(GawaSchemeHandler(root: root), forURLScheme: "app")
            let webView = WKWebView(
                frame: CGRect(x: 0, y: 0, width: 400, height: 600), configuration: config)
            let bridge = GawaBridge(allowedOrigins: [URL(string: "app://localhost")!])

            let reported = expectation(description: "page reported")
            var report: Report?
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
            router.register("report") { (p: Report) async throws -> Void in
                report = p
                reported.fulfill()
            }

            bridge.attach(to: webView)
            webView.load(URLRequest(url: URL(string: "app://localhost/index.html")!))
            await fulfillment(of: [reported], timeout: 30)
            bridge.detach()

            let r = try XCTUnwrap(report)
            XCTAssertTrue(r.ok, r.log.joined(separator: "\n"))
            XCTAssertEqual(r.log.first, "platform: ios")
        }
    }
#endif
