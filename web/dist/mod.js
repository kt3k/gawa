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
export const PROTOCOL = 1;
/** An error reported by the native side, or by the bridge itself. */
export class GawaError extends Error {
    constructor(code, message) {
        super(message);
        this.name = "GawaError";
        this.code = code;
    }
}
class Core {
    constructor(g) {
        this.nextId = 1;
        this.pending = new Map();
        this.listeners = new Map();
        this.transport = detect(g, (raw) => this.receive(raw));
        if (this.transport) {
            // Events from iOS (and any host that prefers evaluating script).
            if (!g.__gawa) {
                Object.defineProperty(g, "__gawa", {
                    value: { receive: (raw) => this.receive(raw) },
                });
            }
            if (this.transport.platform === "android") {
                // Lets the app learn where to send events for this page.
                this.transport.send(JSON.stringify({ gawa: PROTOCOL, hello: true }));
            }
        }
    }
    call(method, params, timeout) {
        const t = this.transport;
        if (!t) {
            return Promise.reject(new GawaError("unavailable", "no native host is attached"));
        }
        const id = this.nextId++;
        const envelope = { gawa: PROTOCOL, id, method };
        if (params !== undefined)
            envelope.params = params;
        return new Promise((resolve, reject) => {
            const p = { resolve, reject };
            if (timeout > 0) {
                p.timer = setTimeout(() => {
                    this.pending.delete(id);
                    reject(new GawaError("timeout", `${method}: no reply in ${timeout}ms`));
                }, timeout);
            }
            this.pending.set(id, p);
            let sent;
            try {
                sent = t.send(JSON.stringify(envelope));
            }
            catch (e) {
                this.settle(id, undefined, {
                    code: "internal",
                    message: String(e?.message ?? e),
                });
                return;
            }
            // iOS: the reply comes back as the resolution of postMessage().
            sent?.then((reply) => this.receive(reply), (e) => this.settle(id, undefined, {
                code: "internal",
                message: String(e?.message ?? e),
            }));
        });
    }
    /** Handles a reply or an event envelope (JSON string or object). */
    receive(raw) {
        let m;
        try {
            m = typeof raw === "string" ? JSON.parse(raw) : raw;
        }
        catch {
            return;
        }
        if (!m || typeof m !== "object" || m.gawa !== PROTOCOL)
            return;
        if (typeof m.event === "string") {
            for (const fn of this.listeners.get(m.event) ?? []) {
                try {
                    fn(m.data ?? null);
                }
                catch (e) {
                    setTimeout(() => {
                        throw e;
                    });
                }
            }
        }
        else if (typeof m.id === "number") {
            this.settle(m.id, m.result, m.error);
        }
    }
    settle(id, result, error) {
        const p = this.pending.get(id);
        if (!p)
            return;
        this.pending.delete(id);
        clearTimeout(p.timer);
        if (error) {
            p.reject(new GawaError(String(error.code ?? "internal"), String(error.message ?? "")));
        }
        else
            p.resolve(result ?? null);
    }
    on(event, fn) {
        let set = this.listeners.get(event);
        if (!set)
            this.listeners.set(event, set = new Set());
        set.add(fn);
        return () => void set.delete(fn);
    }
}
function detect(g, onMessage) {
    const ios = g.webkit?.messageHandlers?.gawa;
    if (ios && typeof ios.postMessage === "function") {
        return { platform: "ios", send: (m) => ios.postMessage(m) };
    }
    const android = g.gawa;
    if (android && typeof android.postMessage === "function") {
        const handler = (e) => onMessage(e.data);
        if (typeof android.addEventListener === "function") {
            android.addEventListener("message", handler);
        }
        else
            android.onmessage = handler;
        return {
            platform: "android",
            send: (m) => void android.postMessage(m),
        };
    }
    return null;
}
const cores = new WeakMap();
/**
 * Returns a typed bridge to the native host. Bridges created on the same
 * global share one connection, so this can be called from several modules.
 */
export function createBridge(options = {}) {
    const g = options.global ?? globalThis;
    let core = cores.get(g);
    if (!core)
        cores.set(g, core = new Core(g));
    const c = core;
    const timeout = options.timeout ?? 0;
    return {
        available: c.transport !== null,
        platform: c.transport?.platform ?? null,
        call: (method, ...params) => c.call(method, params[0], timeout),
        on: (event, listener) => c.on(event, listener),
    };
}
