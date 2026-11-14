import Foundation

/// An error to report to the page. The page receives it as a `GawaError`
/// with the same `code` and `message`.
public struct GawaError: Error, Equatable {
    public let code: String
    public let message: String

    public init(_ code: String, _ message: String) {
        self.code = code
        self.message = message
    }
}

/// Protocol logic independent of WebKit: method registry and envelope
/// handling. `GawaBridge` connects it to a `WKWebView`.
@MainActor
public final class GawaRouter {
    public static let protocolVersion = 1

    /// Optional line logger for each request and reply. Nil by default.
    public var log: ((String) -> Void)?

    /// A handler taking and returning JSON (`nil` means JSON `null`).
    public typealias RawHandler = (_ params: Data?) async throws -> Data?

    /// Reserved method that lists registered names. Not itself a registration.
    public static let methodsMethod = "gawa.methods"

    private var handlers: [String: RawHandler] = [:]
    /// Registration order. Re-registering a name does not move it.
    private var order: [String] = []

    public init() {}

    /// Registers a handler working on raw JSON.
    /// Registering `gawa.methods` does nothing; the router answers that name.
    public func registerRaw(_ method: String, _ handler: @escaping RawHandler) {
        guard method != Self.methodsMethod else { return }
        if handlers[method] == nil { order.append(method) }
        handlers[method] = handler
    }

    /// Registers a method with parameters and a result.
    public func register<P: Decodable, R: Encodable>(
        _ method: String, _ handler: @escaping (P) async throws -> R
    ) {
        registerRaw(method) { data in
            try Self.encode(try await handler(try Self.decode(P.self, data)))
        }
    }

    /// Registers a method with parameters and no result.
    public func register<P: Decodable>(
        _ method: String, _ handler: @escaping (P) async throws -> Void
    ) {
        registerRaw(method) { data in
            try await handler(try Self.decode(P.self, data))
            return nil
        }
    }

    /// Registers a method without parameters, with a result.
    public func register<R: Encodable>(
        _ method: String, _ handler: @escaping () async throws -> R
    ) {
        registerRaw(method) { _ in try Self.encode(try await handler()) }
    }

    /// Registers a method without parameters or result.
    public func register(_ method: String, _ handler: @escaping () async throws -> Void) {
        registerRaw(method) { _ in
            try await handler()
            return nil
        }
    }

    public func unregister(_ method: String) {
        handlers[method] = nil
        order.removeAll { $0 == method }
    }

    /// Handles one request envelope (a JSON string) and returns the reply
    /// envelope, or `nil` when the message is not a gawa request.
    public func handle(_ body: String) async -> String? {
        log?("receive \(body)")
        guard
            let data = body.data(using: .utf8),
            let env = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            env["gawa"] as? Int == Self.protocolVersion,
            let id = env["id"] as? Int,
            let method = env["method"] as? String
            else {
            log?("ignore \(body)")
            return nil
        }

        var reply: [String: Any] = ["gawa": Self.protocolVersion, "id": id]
        if method == Self.methodsMethod {
            reply["result"] = order
            let out = Self.string(reply)
            log?("reply \(out)")
            return out
        }
        do {
            guard let handler = handlers[method] else {
                throw GawaError("unknown_method", "unknown method: \(method)")
            }
            var params: Data?
            if let p = env["params"], !(p is NSNull) {
                params = try JSONSerialization.data(withJSONObject: p, options: .fragmentsAllowed)
            }
            if let result = try await handler(params) {
                reply["result"] = try JSONSerialization.jsonObject(
                    with: result, options: .fragmentsAllowed)
            } else {
                reply["result"] = NSNull()
            }
        } catch let e as GawaError {
            reply["error"] = ["code": e.code, "message": e.message]
        } catch {
            reply["error"] = ["code": "internal", "message": "\(error)"]
        }
        let out = Self.string(reply)
        log?("reply \(out)")
        return out
    }

    /// Builds an event envelope.
    public static func eventEnvelope<D: Encodable>(_ event: String, _ data: D) throws -> String {
        let d = try JSONSerialization.jsonObject(
            with: try encode(data) ?? Data("null".utf8), options: .fragmentsAllowed)
        return string(["gawa": protocolVersion, "event": event, "data": d])
    }

    // MARK: - JSON helpers

    static func decode<P: Decodable>(_ type: P.Type, _ data: Data?) throws -> P {
        do {
            return try JSONDecoder().decode(type, from: data ?? Data("null".utf8))
        } catch {
            throw GawaError("invalid_params", "\(error)")
        }
    }

    static func encode<R: Encodable>(_ value: R) throws -> Data? {
        try JSONEncoder().encode(value)
    }

    static func string(_ object: [String: Any]) -> String {
        // Only built from JSON values, so serialization cannot fail.
        let data = (try? JSONSerialization.data(withJSONObject: object)) ?? Data("{}".utf8)
        return String(decoding: data, as: UTF8.self)
    }
}
