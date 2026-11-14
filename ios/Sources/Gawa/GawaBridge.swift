import Foundation
import WebKit

/// Connects a `GawaRouter` to a `WKWebView`.
///
/// ```swift
/// let bridge = GawaBridge(allowedOrigins: [URL(string: "app://localhost")!])
/// bridge.router.register("app.version") { () -> String in "1.0" }
/// bridge.attach(to: webView)   // before loading the page
/// try bridge.emit("back")
/// ```
///
/// The page calls `webkit.messageHandlers.gawa.postMessage(json)`, which
/// resolves with the reply. Messages from other origins or from subframes
/// are ignored.
@MainActor
public final class GawaBridge: NSObject, WKScriptMessageHandlerWithReply {
    public static let handlerName = "gawa"

    public let router: GawaRouter
    private let allowedOrigins: [URL]
    private let allowSubframes: Bool
    private let log: ((String) -> Void)?
    private weak var webView: WKWebView?

    /// - Parameters:
    ///   - allowedOrigins: origins (`scheme://host[:port]`) whose pages may
    ///     use the bridge, e.g. `app://localhost` for `GawaSchemeHandler`.
    ///   - allowSubframes: also accept messages from iframes.
    ///   - log: optional line logger. Also stored on `router`.
    public init(
        allowedOrigins: [URL], allowSubframes: Bool = false, router: GawaRouter? = nil,
        log: ((String) -> Void)? = nil
    ) {
        self.allowedOrigins = allowedOrigins
        self.allowSubframes = allowSubframes
        self.log = log
        self.router = router ?? GawaRouter()
        self.router.log = log
    }

    /// Installs the `gawa` message handler on the web view. Call it before
    /// loading the page. The web view's user content controller retains the
    /// bridge until `detach()`.
    public func attach(to webView: WKWebView) {
        self.webView = webView
        webView.configuration.userContentController.addScriptMessageHandler(
            self, contentWorld: .page, name: Self.handlerName)
    }

    /// Removes the message handler, breaking the retain cycle.
    public func detach() {
        webView?.configuration.userContentController.removeScriptMessageHandler(
            forName: Self.handlerName, contentWorld: .page)
        webView = nil
    }

    /// Sends an event with no payload (`data` is JSON `null`).
    public func emit(_ event: String) throws {
        try emit(event, nil as String?)
    }

    /// Sends an event to the page (`bridge.on(event, …)` on the web side).
    /// Does nothing unless the web view shows a page from an allowed origin.
    /// Pass `nil as String?` for no data; `emit(event)` does the same.
    public func emit<D: Encodable>(_ event: String, _ data: D) throws {
        guard let webView, let url = webView.url, isAllowed(url) else {
            log?("emit \(event) skipped")
            return
        }
        log?("emit \(event)")
        let envelope = try GawaRouter.eventEnvelope(event, data)
        // Pass the envelope as a JS string literal (JSON-escaped).
        let literal = GawaRouter.string(["s": envelope])
        webView.evaluateJavaScript(
            "globalThis.__gawa && globalThis.__gawa.receive((\(literal)).s)")
    }

    public func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage,
        replyHandler: @escaping (Any?, String?) -> Void
    ) {
        guard
            allowSubframes || message.frameInfo.isMainFrame,
            isAllowed(message.frameInfo.securityOrigin),
            let body = message.body as? String
        else {
            log?("reject message")
            replyHandler(nil, "gawa: message rejected")
            return
        }
        Task { @MainActor in
            let reply = await router.handle(body)
            replyHandler(reply, reply == nil ? "gawa: not a request" : nil)
        }
    }

    // MARK: - Origin checks

    private func isAllowed(_ origin: WKSecurityOrigin) -> Bool {
        allowedOrigins.contains { allowed in
            allowed.scheme == origin.protocol && allowed.host == origin.host
                && (allowed.port ?? 0) == origin.port
        }
    }

    private func isAllowed(_ url: URL) -> Bool {
        allowedOrigins.contains { allowed in
            allowed.scheme == url.scheme && allowed.host == url.host
                && allowed.port == url.port
        }
    }
}
