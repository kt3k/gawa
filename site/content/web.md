# Web

The page side is one module, [`web/mod.ts`](https://github.com/kt3k/gawa/blob/main/web/mod.ts). npm installs the compiled `web/dist` (`mod.js` and `mod.d.ts`). Deno imports the TypeScript source. The package name is `gawa`.

```ts
import { createBridge, GawaError, PROTOCOL } from "gawa";
```

`PROTOCOL` is `1`. Every envelope carries `gawa: 1`. Messages with another version are ignored.

## createBridge

```ts
function createBridge<
  M extends MethodMap = MethodMap,
  E extends EventMap = EventMap,
>(options?: BridgeOptions): Bridge<M, E>;
```

Returns a typed bridge to the native host. Bridges created on the same global share one connection, so this can be called from several modules. On Android, the first bridge on that global sends `{ "gawa": 1, "hello": true }` once; later calls do not send it again.

`available` is true when `createBridge` found a native host. `platform` is `"ios"`, `"android"`, or `null`.

### MethodMap and EventMap

A method map describes what the native side implements: `name: (params) => result`. An event map describes what the native side emits: `name: data`.

```ts
type Methods = {
  "kv.get": (p: { key: string }) => string | null;
  "kv.set": (p: { key: string; value: string }) => void;
  "app.version": () => string;
};
type Events = { back: null };
```

Namespacing with dots (`kv.get`) is a convention.

### BridgeOptions

- `timeout` — reject a call that gets no reply within this many milliseconds. `0` means no time limit. The default is `0`. The value applies to `call`s made through the bridge object it was passed to. The error message includes the method and the request id.
- `global` — the object to look for the host on. For tests. The default is `globalThis`.
- `log` — called with one line for each envelope sent or received, and for a timeout or error. Bridges on the same global share the connection, so the latest `log` passed to `createBridge` is the one that is used.

## Calls

```ts
call<K extends keyof M & string>(
  method: K,
  ...params: Parameters<M[K]>
): Promise<Awaited<ReturnType<M[K]>>>;
```

`call` sends the first argument as the envelope's `params`. A method with no parameters is called with no second argument, and the envelope omits `params`. A generic key works without a cast, including when that key might be a method with no parameters (`params` is then `undefined`):

```ts
function callHost<K extends keyof Methods>(
  method: K,
  params: Parameters<Methods[K]>[0],
) {
  return bridge.call(method, params);
}
```

```ts
const bridge = createBridge<Methods, Events>();

if (bridge.available) {
  const lang = await bridge.call("kv.get", { key: "lang" }); // string | null
  await bridge.call("kv.set", { key: "lang", value: "ja" });
  const version = await bridge.call("app.version");
}
```

The promise rejects with `GawaError`. A method that returns nothing still resolves to `null`, because the reply's `result` is JSON `null`.

```ts
has(method: string): Promise<boolean | null>;
```

`has` asks the host which methods it registered, by calling the reserved method `gawa.methods`. It resolves `true` or `false` from that list. It resolves `false` when no host is attached. It resolves `null` when the host does not implement `gawa.methods` (an older shell replies `unknown_method`) or the query fails. `has` does not reject. `null` means the page cannot tell: call the method and treat `unknown_method` as "not registered". The code `unknown_method`, message `unknown method: <name>`, is stable.

## Events

```ts
on<K extends keyof E & string>(
  event: K,
  listener: (data: E[K]) => void,
): () => void;
```

`on` listens for a native event and returns a function that stops listening. If the envelope has no `data`, the listener receives `null`. When the event's data type is `null` or `void`, the listener may take no argument. A listener that throws is rethrown on a timer, so the other listeners for that event still run.

```ts
const off = bridge.on("back", () => {
  // Close this page's own UI.
});
off();
```

## GawaError

```ts
class GawaError extends Error {
  readonly code: string;
  constructor(code: string, message: string);
}
```

`name` is `"GawaError"`. `code` is `unavailable` (no native host), `timeout`, `unknown_method`, `invalid_params`, `internal`, or a code the app's handler threw.

Messages from this module:

| code          | when                                                                              |
| ------------- | --------------------------------------------------------------------------------- |
| `unavailable` | `call` with no native host. Message: `no native host is attached`.                |
| `timeout`     | no reply within `timeout` ms. Message: `<method> #<id>: no reply in <timeout>ms`. |
| `internal`    | sending the request threw, or the iOS `postMessage` promise rejected.             |

A native reply `{ "error": { "code", "message" } }` rejects with those fields. A missing `code` becomes `"internal"`. A missing `message` becomes `""`. The shared codes are listed in the [protocol](/docs/protocol/).

## Transports

The host is detected automatically. iOS is checked first.

- **iOS.** `WKScriptMessageHandlerWithReply` named `gawa`. The page calls `webkit.messageHandlers.gawa.postMessage(json)`, and that promise resolves with the reply. Events arrive through `globalThis.__gawa.receive(json)`, which `createBridge` installs when a host is present.
- **Android.** `WebViewCompat.addWebMessageListener` named `gawa`. The page calls `gawa.postMessage(json)`. Replies and events arrive as `message` events on that object. The bridge uses `addEventListener("message", …)`, or assigns `onmessage` when `addEventListener` is missing.

In a normal browser there is no host: `available` is false, `platform` is null, and `call` rejects with `unavailable`. Fall back to web APIs there.

## Developing without the app

`installMock` puts a fake iOS or Android host on a global, so the page can be developed in a browser. Call it before `createBridge` on that global. The bridge looks for the host when it is created.

```ts
import { createBridge, installMock } from "gawa";

const mock = installMock({
  handlers: {
    "app.version": () => "1.0",
    "kv.get": (p) => localStorage.getItem((p as { key: string }).key),
  },
});
const bridge = createBridge<Methods, Events>();
await bridge.call("app.version"); // "1.0"
mock.emit("back", null); // bridge.on("back", …)
mock.uninstall();
```

`handlers` return the result, or throw `GawaError` for an app-defined code. Anything else becomes `internal`. A method with no handler replies `unknown_method`. `platform` defaults to `"ios"`; pass `"android"` to imitate that transport, including the hello message. `calls` lists what the page sent. `emit` delivers an event after the bridge exists.

```ts
const bridge = createBridge<Methods, Events>({ timeout: 10_000 });
```

## What is ignored

A message is ignored when it is not JSON, not an object, or its `gawa` field is not `1`. A reply is applied only when `id` is a number. An event is delivered only when `event` is a string.

## Package

`package.json` exports `"."` to `web/dist/mod.js` with types `web/dist/mod.d.ts`. `web/build.sh` compiles `web/mod.ts` with `tsc` (`--target es2020`). CI fails if `web/dist` is stale. See [Releasing](/docs/releasing/).
