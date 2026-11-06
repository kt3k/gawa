/**
 * gawa — a thin, typed bridge between a web page and the native app that
 * hosts it in a WebView.
 *
 * ```ts
 * import { createBridge } from "gawa";
 *
 * type Methods = {
 *   "kv.get": (p: { key: string }) => string | null;
 *   "app.version": () => string;
 * };
 * type Events = { back: null };
 *
 * const bridge = createBridge<Methods, Events>();
 * if (bridge.available) {
 *   const lang = await bridge.call("kv.get", { key: "lang" });
 *   bridge.on("back", () => history.back());
 * }
 * ```
 *
 * Transports (chosen automatically):
 *
 * - iOS: `WKScriptMessageHandlerWithReply` named `gawa`
 *   (`webkit.messageHandlers.gawa.postMessage()` resolves with the reply).
 *   Events arrive via `globalThis.__gawa.receive()`.
 * - Android: `WebViewCompat.addWebMessageListener` named `gawa`
 *   (`globalThis.gawa.postMessage()`); replies and events arrive as
 *   `message` events on that object.
 *
 * @module
 */
/** Protocol version carried in every envelope as `gawa: 1`. */
export declare const PROTOCOL = 1;
type AnyFn = (...args: any[]) => unknown;
/** Methods the native side implements: `name: (params) => result`. */
export type MethodMap = {
    [method: string]: AnyFn;
};
/** Events the native side emits: `name: data`. */
export type EventMap = {
    [event: string]: unknown;
};
export type Platform = "ios" | "android";
/** An error reported by the native side, or by the bridge itself. */
export declare class GawaError extends Error {
    /**
     * `unavailable` (no native host), `timeout`, `unknown_method`,
     * `invalid_params`, `internal`, or an app-defined code.
     */
    readonly code: string;
    constructor(code: string, message: string);
}
export interface Bridge<M extends MethodMap, E extends EventMap> {
    /** True when a native host is attached. */
    readonly available: boolean;
    /** Which native host is attached, if any. */
    readonly platform: Platform | null;
    /** Calls a native method. Rejects with {@link GawaError}. */
    call<K extends keyof M & string>(method: K, ...params: Parameters<M[K]>): Promise<Awaited<ReturnType<M[K]>>>;
    /** Listens to a native event; returns a function that stops listening. */
    on<K extends keyof E & string>(event: K, listener: (data: E[K]) => void): () => void;
}
export interface BridgeOptions {
    /** Rejects calls that get no reply within this many ms (0 = never). */
    timeout?: number;
    /** The global object to look for the host on (for tests). */
    global?: object;
}
/**
 * Returns a typed bridge to the native host. Bridges created on the same
 * global share one connection, so this can be called from several modules.
 */
export declare function createBridge<M extends MethodMap = MethodMap, E extends EventMap = EventMap>(options?: BridgeOptions): Bridge<M, E>;
export {};
