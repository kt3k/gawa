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
        this.log?.(`send ${JSON.stringify(envelope)}`);
        return new Promise((resolve, reject) => {
            const p = { resolve, reject };
            if (timeout > 0) {
                p.timer = setTimeout(() => {
                    this.pending.delete(id);
                    this.log?.(`timeout ${method} #${id} ${timeout}ms`);
                    reject(new GawaError("timeout", `${method} #${id}: no reply in ${timeout}ms`));
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
        this.log?.(`receive ${typeof raw === "string" ? raw : JSON.stringify(raw)}`);
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
            this.log?.(`error #${id} ${String(error.code ?? "internal")}: ${String(error.message ?? "")}`);
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
    if (options.log)
        c.log = options.log;
    const timeout = options.timeout ?? 0;
    return {
        available: c.transport !== null,
        platform: c.transport?.platform ?? null,
        call: (method, ...params) => c.call(method, params[0], timeout),
        on: (event, listener) => c.on(event, listener),
        has(method) {
            if (!c.transport)
                return Promise.resolve(false);
            return c.call("gawa.methods", undefined, timeout).then((result) => {
                if (!Array.isArray(result) ||
                    result.some((name) => typeof name !== "string"))
                    return null;
                return result.includes(method);
            }, () => null);
        },
    };
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
export function installMock(options = {}) {
    const platform = options.platform ?? "ios";
    // deno-lint-ignore no-explicit-any
    const g = (options.global ?? globalThis);
    const handlers = options.handlers ?? {};
    const calls = [];
    const listeners = [];
    const dispatch = (data) => {
        queueMicrotask(() => listeners.forEach((fn) => fn({ data })));
    };
    const respond = async (body) => {
        const req = JSON.parse(body);
        if (req.hello)
            return;
        calls.push({ method: req.method, params: req.params });
        const id = req.id;
        if (req.method === "gawa.methods") {
            return JSON.stringify({
                gawa: PROTOCOL,
                id,
                result: Object.keys(handlers).filter((name) => name !== "gawa.methods"),
            });
        }
        try {
            const handler = handlers[req.method];
            if (!handler) {
                return JSON.stringify({
                    gawa: PROTOCOL,
                    id,
                    error: {
                        code: "unknown_method",
                        message: `unknown method: ${req.method}`,
                    },
                });
            }
            const result = await handler(req.params);
            return JSON.stringify({ gawa: PROTOCOL, id, result: result ?? null });
        }
        catch (e) {
            const code = e instanceof GawaError ? e.code : "internal";
            const message = e instanceof GawaError
                ? e.message
                : String(e?.message ?? e);
            return JSON.stringify({ gawa: PROTOCOL, id, error: { code, message } });
        }
    };
    let uninstall = () => { };
    if (platform === "ios") {
        const prevWebkit = g.webkit;
        const postMessage = (body) => respond(body);
        if (prevWebkit?.messageHandlers) {
            const prev = prevWebkit.messageHandlers.gawa;
            prevWebkit.messageHandlers.gawa = { postMessage };
            uninstall = () => {
                if (prev === undefined)
                    delete prevWebkit.messageHandlers.gawa;
                else
                    prevWebkit.messageHandlers.gawa = prev;
            };
        }
        else {
            g.webkit = { messageHandlers: { gawa: { postMessage } } };
            uninstall = () => {
                g.webkit = prevWebkit;
            };
        }
    }
    else {
        const prev = g.gawa;
        g.gawa = {
            postMessage(body) {
                respond(body).then((reply) => {
                    if (reply !== undefined)
                        dispatch(reply);
                });
            },
            addEventListener(_type, fn) {
                listeners.push(fn);
            },
        };
        uninstall = () => {
            if (prev === undefined)
                delete g.gawa;
            else
                g.gawa = prev;
        };
    }
    return {
        calls,
        emit(event, data) {
            const json = JSON.stringify({
                gawa: PROTOCOL,
                event,
                data: data === undefined ? null : data,
            });
            if (platform === "ios")
                g.__gawa?.receive(json);
            else
                dispatch(json);
        },
        uninstall,
    };
}
