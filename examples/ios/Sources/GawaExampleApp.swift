import Gawa
import SwiftUI
import WebKit

@main
struct GawaExampleApp: App {
    var body: some Scene {
        WindowGroup {
            ExampleWebView().ignoresSafeArea()
        }
    }
}

/// A WKWebView showing the bundled example page (`www/` folder reference).
struct ExampleWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView { context.coordinator.webView }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        coordinator.bridge.detach()
    }

    @MainActor
    final class Coordinator {
        let webView: WKWebView
        let bridge: GawaBridge

        init() {
            let root = Bundle.main.url(forResource: "www", withExtension: nil)!
            let config = WKWebViewConfiguration()
            config.setURLSchemeHandler(GawaSchemeHandler(root: root), forURLScheme: "app")
            webView = WKWebView(frame: .zero, configuration: config)
            #if DEBUG
                if #available(iOS 16.4, *) { webView.isInspectable = true }
            #endif

            bridge = GawaBridge(allowedOrigins: [URL(string: "app://localhost")!])
            ExampleHandlers.register(on: bridge) { report in
                print("GAWA_E2E \(report.ok ? "PASS" : "FAIL")")
                report.log.forEach { print("  \($0)") }
            }
            bridge.attach(to: webView)
            webView.load(URLRequest(url: URL(string: "app://localhost/index.html")!))
        }
    }
}
