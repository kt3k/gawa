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
/** Methods whose parameter list is not a required tuple (`()` or an untyped function). */
type NoParamKeys<M extends MethodMap> = {
    [K in keyof M & string]: Parameters<M[K]> extends readonly [unknown, ...unknown[]] ? never : K;
}[keyof M & string];
/** Methods that take one required parameter. */
type ParamKeys<M extends MethodMap> = {
    [K in keyof M & string]: Parameters<M[K]> extends readonly [unknown, ...unknown[]] ? K : never;
}[keyof M & string];
export interface Bridge<M extends MethodMap, E extends EventMap> {
    /** True when a native host is attached. */
    readonly available: boolean;
    /** Which native host is attached, if any. */
    readonly platform: Platform | null;
    /**
     * Calls a native method. Rejects with {@link GawaError}.
     *
     * A method with a parameter takes that value. A method with no parameter
     * is called with no second argument. A generic key also works:
     * `call<K extends keyof M>(method: K, params: Parameters<M[K]>[0])`.
     */
    call<K extends ParamKeys<M> & string>(method: K, params: Parameters<M[K]>[0]): Promise<Awaited<ReturnType<M[K]>>>;
    call<K extends NoParamKeys<M> & string>(method: K): Promise<Awaited<ReturnType<M[K]>>>;
    call<K extends keyof M & string>(method: K, params: Parameters<M[K]>[0]): Promise<Awaited<ReturnType<M[K]>>>;
    /**
     * Listens to a native event; returns a function that stops listening.
     * When `E[K]` is `null` or `void`, the listener may take no argument.
     */
    on<K extends keyof E & string>(event: K, listener: (data: E[K]) => void): () => void;
    /**
     * Whether the host registered `method`. Resolves `false` when no host is
     * attached, `true` or `false` from `gawa.methods` when the host lists its
     * methods, and `null` when it does not (an older shell) or the query fails.
     * It does not reject.
     */
    has(method: string): Promise<boolean | null>;
}
export interface BridgeOptions {
    /** Rejects calls that get no reply within this many ms (0 = never). */
    timeout?: number;
    /** The global object to look for the host on (for tests). */
    global?: object;
    /**
     * Called with one line per envelope sent or received, and for timeout
     * and error. Bridges on the same global share the connection, so the
     * latest `log` passed to `createBridge` is the one that is used.
     */
    log?: (line: string) => void;
}
/**
 * Returns a typed bridge to the native host. Bridges created on the same
 * global share one connection, so this can be called from several modules.
 */
export declare function createBridge<M extends MethodMap = MethodMap, E extends EventMap = EventMap>(options?: BridgeOptions): Bridge<M, E>;
/** One call the page made through {@link installMock}. */
export interface MockCall {
    method: string;
    params: unknown;
}
export interface MockOptions {
    /** Which host to imitate. Default `"ios"`. */
    platform?: Platform;
    /** Object to install the host on. Default `globalThis`. */
    global?: object;
    /**
     * Methods the mock implements. Return the result, or throw
     * {@link GawaError} for an app-defined error. A thrown value that is not
     * a `GawaError` becomes `internal`. Unknown methods reply `unknown_method`.
     */
    handlers?: Record<string, (params: unknown) => unknown | Promise<unknown>>;
}
export interface MockNative {
    /** Calls received since installation, in order. */
    readonly calls: MockCall[];
    /** Deliver an event. Create the bridge first, so it can receive it. */
    emit(event: string, data?: unknown): void;
    /** Remove the host this mock installed. */
    uninstall(): void;
}
/**
 * Installs a fake native host so a page can call `createBridge` in a normal
 * browser. Call this before `createBridge` on the same global: the bridge
 * looks for the host when it is created.
 *
 * ```ts
 * import { createBridge, installMock } from "gawa";
 *
 * const mock = installMock({
 *   handlers: {
 *     "app.version": () => "1.0",
 *   },
 * });
 * const bridge = createBridge<{ "app.version": () => string }>();
 * await bridge.call("app.version"); // "1.0"
 * mock.emit("back", null);
 * mock.uninstall();
 * ```
 */
export declare function installMock(options?: MockOptions): MockNative;
export {};
