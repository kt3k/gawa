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

// deno-lint-ignore no-explicit-any
type AnyFn = (...args: any[]) => unknown;

/** Methods the native side implements: `name: (params) => result`. */
export type MethodMap = { [method: string]: AnyFn };
/** Events the native side emits: `name: data`. */
export type EventMap = { [event: string]: unknown };

export type Platform = "ios" | "android";

/** An error reported by the native side, or by the bridge itself. */
export class GawaError extends Error {
  /**
   * `unavailable` (no native host), `timeout`, `unknown_method`,
   * `invalid_params`, `internal`, or an app-defined code.
   */
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "GawaError";
    this.code = code;
  }
}

export interface Bridge<M extends MethodMap, E extends EventMap> {
  /** True when a native host is attached. */
  readonly available: boolean;
  /** Which native host is attached, if any. */
  readonly platform: Platform | null;
  /** Calls a native method. Rejects with {@link GawaError}. */
  call<K extends keyof M & string>(
    method: K,
    ...params: Parameters<M[K]>
  ): Promise<Awaited<ReturnType<M[K]>>>;
  /** Listens to a native event; returns a function that stops listening. */
  on<K extends keyof E & string>(
    event: K,
    listener: (data: E[K]) => void,
  ): () => void;
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

// ---------------------------------------------------------------------------

type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
};

interface Transport {
  platform: Platform;
  /** Sends a request envelope; iOS resolves with the reply envelope. */
  send(message: string): Promise<unknown> | void;
}

// deno-lint-ignore no-explicit-any
type Global = any;

class Core {
  transport: Transport | null;
  log?: (line: string) => void;
  nextId = 1;
  pending = new Map<number, Pending>();
  listeners = new Map<string, Set<(data: unknown) => void>>();

  constructor(g: Global) {
    this.transport = detect(g, (raw) => this.receive(raw));
    if (this.transport) {
      // Events from iOS (and any host that prefers evaluating script).
      if (!g.__gawa) {
        Object.defineProperty(g, "__gawa", {
          value: { receive: (raw: unknown) => this.receive(raw) },
        });
      }
      if (this.transport.platform === "android") {
        // Lets the app learn where to send events for this page.
        this.transport.send(JSON.stringify({ gawa: PROTOCOL, hello: true }));
      }
    }
  }

  call(method: string, params: unknown, timeout: number): Promise<unknown> {
    const t = this.transport;
    if (!t) {
      return Promise.reject(
        new GawaError("unavailable", "no native host is attached"),
      );
    }
    const id = this.nextId++;
    const envelope: Record<string, unknown> = { gawa: PROTOCOL, id, method };
    if (params !== undefined) envelope.params = params;
    this.log?.(`send ${JSON.stringify(envelope)}`);
    return new Promise((resolve, reject) => {
      const p: Pending = { resolve, reject };
      if (timeout > 0) {
        p.timer = setTimeout(() => {
          this.pending.delete(id);
          this.log?.(`timeout ${method} #${id} ${timeout}ms`);
          reject(
            new GawaError(
              "timeout",
              `${method} #${id}: no reply in ${timeout}ms`,
            ),
          );
        }, timeout);
      }
      this.pending.set(id, p);
      let sent: Promise<unknown> | void;
      try {
        sent = t.send(JSON.stringify(envelope));
      } catch (e) {
        this.settle(id, undefined, {
          code: "internal",
          message: String((e as Error)?.message ?? e),
        });
        return;
      }
      // iOS: the reply comes back as the resolution of postMessage().
      sent?.then(
        (reply) => this.receive(reply),
        (e) =>
          this.settle(id, undefined, {
            code: "internal",
            message: String(e?.message ?? e),
          }),
      );
    });
  }

  /** Handles a reply or an event envelope (JSON string or object). */
  receive(raw: unknown) {
    let m: Record<string, unknown>;
    try {
      m = typeof raw === "string" ? JSON.parse(raw) : raw as typeof m;
    } catch {
      return;
    }
    this.log?.(
      `receive ${typeof raw === "string" ? raw : JSON.stringify(raw)}`,
    );
    if (!m || typeof m !== "object" || m.gawa !== PROTOCOL) return;
    if (typeof m.event === "string") {
      for (const fn of this.listeners.get(m.event) ?? []) {
        try {
          fn(m.data ?? null);
        } catch (e) {
          setTimeout(() => {
            throw e;
          });
        }
      }
    } else if (typeof m.id === "number") {
      this.settle(m.id, m.result, m.error as ErrorBody | undefined);
    }
  }

  settle(id: number, result: unknown, error?: ErrorBody) {
    const p = this.pending.get(id);
    if (!p) return;
    this.pending.delete(id);
    clearTimeout(p.timer);
    if (error) {
      this.log?.(
        `error #${id} ${String(error.code ?? "internal")}: ${
          String(error.message ?? "")
        }`,
      );
      p.reject(
        new GawaError(
          String(error.code ?? "internal"),
          String(error.message ?? ""),
        ),
      );
    } else p.resolve(result ?? null);
  }

  on(event: string, fn: (data: unknown) => void) {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, set = new Set());
    set.add(fn);
    return () => void set.delete(fn);
  }
}

type ErrorBody = { code?: unknown; message?: unknown };

function detect(
  g: Global,
  onMessage: (raw: unknown) => void,
): Transport | null {
  const ios = g.webkit?.messageHandlers?.gawa;
  if (ios && typeof ios.postMessage === "function") {
    return { platform: "ios", send: (m) => ios.postMessage(m) };
  }
  const android = g.gawa;
  if (android && typeof android.postMessage === "function") {
    const handler = (e: { data: unknown }) => onMessage(e.data);
    if (typeof android.addEventListener === "function") {
      android.addEventListener("message", handler);
    } else android.onmessage = handler;
    return {
      platform: "android",
      send: (m) => void android.postMessage(m),
    };
  }
  return null;
}

const cores = new WeakMap<object, Core>();

/**
 * Returns a typed bridge to the native host. Bridges created on the same
 * global share one connection, so this can be called from several modules.
 */
export function createBridge<
  M extends MethodMap = MethodMap,
  E extends EventMap = EventMap,
>(options: BridgeOptions = {}): Bridge<M, E> {
  const g = options.global ?? globalThis;
  let core = cores.get(g);
  if (!core) cores.set(g, core = new Core(g));
  const c = core;
  if (options.log) c.log = options.log;
  const timeout = options.timeout ?? 0;
  return {
    available: c.transport !== null,
    platform: c.transport?.platform ?? null,
    call: (method, ...params) =>
      c.call(method, params[0], timeout) as Promise<never>,
    on: (event, listener) => c.on(event, listener as (d: unknown) => void),
  };
}

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
export function installMock(options: MockOptions = {}): MockNative {
  const platform = options.platform ?? "ios";
  // deno-lint-ignore no-explicit-any
  const g = (options.global ?? globalThis) as any;
  const handlers = options.handlers ?? {};
  const calls: MockCall[] = [];
  const listeners: ((e: { data: string }) => void)[] = [];
  const dispatch = (data: string) => {
    queueMicrotask(() => listeners.forEach((fn) => fn({ data })));
  };

  const respond = async (body: string): Promise<string | undefined> => {
    const req = JSON.parse(body);
    if (req.hello) return;
    calls.push({ method: req.method, params: req.params });
    const id = req.id;
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
    } catch (e) {
      const code = e instanceof GawaError ? e.code : "internal";
      const message = e instanceof GawaError
        ? e.message
        : String((e as Error)?.message ?? e);
      return JSON.stringify({ gawa: PROTOCOL, id, error: { code, message } });
    }
  };

  let uninstall = () => {};
  if (platform === "ios") {
    const prevWebkit = g.webkit;
    const postMessage = (body: string) => respond(body);
    if (prevWebkit?.messageHandlers) {
      const prev = prevWebkit.messageHandlers.gawa;
      prevWebkit.messageHandlers.gawa = { postMessage };
      uninstall = () => {
        if (prev === undefined) delete prevWebkit.messageHandlers.gawa;
        else prevWebkit.messageHandlers.gawa = prev;
      };
    } else {
      g.webkit = { messageHandlers: { gawa: { postMessage } } };
      uninstall = () => {
        g.webkit = prevWebkit;
      };
    }
  } else {
    const prev = g.gawa;
    g.gawa = {
      postMessage(body: string) {
        respond(body).then((reply) => {
          if (reply !== undefined) dispatch(reply);
        });
      },
      addEventListener(_type: string, fn: (e: { data: string }) => void) {
        listeners.push(fn);
      },
    };
    uninstall = () => {
      if (prev === undefined) delete g.gawa;
      else g.gawa = prev;
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
      if (platform === "ios") g.__gawa?.receive(json);
      else dispatch(json);
    },
    uninstall,
  };
}
