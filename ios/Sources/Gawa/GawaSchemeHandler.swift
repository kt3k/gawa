import Foundation
import UniformTypeIdentifiers
import WebKit

/// Serves files bundled with the app under a custom scheme, so the page has
/// a real origin (e.g. `app://localhost`) instead of `file://`.
///
/// ```swift
/// let root = Bundle.main.url(forResource: "www", withExtension: nil)!
/// let config = WKWebViewConfiguration()
/// config.setURLSchemeHandler(GawaSchemeHandler(root: root), forURLScheme: "app")
/// let webView = WKWebView(frame: .zero, configuration: config)
/// webView.load(URLRequest(url: URL(string: "app://localhost/index.html")!))
/// ```
///
/// `http`, `https` and other schemes WebKit handles itself cannot be used.
public final class GawaSchemeHandler: NSObject, WKURLSchemeHandler {
    private let root: URL
    private let spaFallback: Bool

    /// - Parameters:
    ///   - root: directory to serve (a folder reference in the app bundle).
    ///   - spaFallback: serve `index.html` for missing paths without a file
    ///     extension (client-side routing).
    public init(root: URL, spaFallback: Bool = false) {
        self.root = root.standardizedFileURL
        self.spaFallback = spaFallback
    }

    public func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }
        let (status, data, mime) = response(for: url.path)
        let res = HTTPURLResponse(
            url: url, statusCode: status, httpVersion: "HTTP/1.1",
            headerFields: [
                "Content-Type": mime,
                "Content-Length": String(data.count),
                "Cache-Control": "no-cache",
            ])!
        urlSchemeTask.didReceive(res)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    public func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        // Responses are produced synchronously in start(); nothing to cancel.
    }

    /// Resolves a request path to (status, body, MIME type).
    func response(for path: String) -> (Int, Data, String) {
        var rel = path.removingPercentEncoding ?? path
        if rel.hasPrefix("/") { rel.removeFirst() }
        if rel.isEmpty || rel.hasSuffix("/") { rel += "index.html" }

        if let file = resolve(rel), let data = try? Data(contentsOf: file) {
            return (200, data, Self.mimeType(file.pathExtension))
        }
        if spaFallback, (rel as NSString).pathExtension.isEmpty,
            let file = resolve("index.html"), let data = try? Data(contentsOf: file)
        {
            return (200, data, "text/html")
        }
        return (404, Data(), "text/plain")
    }

    /// The file for a relative path, or nil when it escapes the root.
    func resolve(_ rel: String) -> URL? {
        let file = root.appendingPathComponent(rel).standardizedFileURL
        guard file.path.hasPrefix(root.path + "/") else { return nil }
        return file
    }

    static func mimeType(_ ext: String) -> String {
        switch ext.lowercased() {
        case "html", "htm": return "text/html"
        case "js", "mjs": return "text/javascript"
        case "css": return "text/css"
        case "json", "map": return "application/json"
        case "wasm": return "application/wasm"
        case "svg": return "image/svg+xml"
        case "woff2": return "font/woff2"
        default:
            return UTType(filenameExtension: ext)?.preferredMIMEType ?? "application/octet-stream"
        }
    }
}
