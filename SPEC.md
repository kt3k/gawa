# gawa Specification

Status: v1 (language-agnostic)

Purpose: Define a bridge between a page running inside a host WebView and the
native app that owns that WebView, including the wire protocol, the page and
router behavior required for interoperability, and the iOS and Android
transport profiles implemented by the reference.

The reference repository is one implementation of this document. Another
implementation in any language is conformant when it satisfies the MUSTs for
the roles it claims and passes the checks in
[section 12](#12-conformance-tests).

## Normative Language

The key words `MUST`, `MUST NOT`, `REQUIRED`, `SHOULD`, `SHOULD NOT`,
`RECOMMENDED`, `MAY`, and `OPTIONAL` in this document are to be interpreted as
described in RFC 2119.

`Implementation-defined` means the behavior is part of the implementation
contract, but this specification does not prescribe one universal policy.
Implementations MUST document the selected behavior.

JSON object key order is not significant. Comparisons MUST be structural.

## 1. Problem Statement

An app hosts a page in a WebView. The page needs to call native methods and
receive native events, and the app needs to serve that page from an origin the
WebView will treat as a real origin rather than `file://`.

gawa is that shell:

- a page client that sends requests and receives replies and events
- a native router that dispatches those requests to typed handlers
- a transport that carries JSON envelopes and checks the page origin
- OPTIONAL file serving that gives the bundled page that origin

gawa is not a UI toolkit, a plugin runtime, or a CLI.

## 2. Goals and Non-Goals

### 2.1 Goals

- One JSON protocol, version 1, that a page and a native host can implement
  independently and still interoperate.
- Request/reply calls and native-to-page events.
- Origin checks so a page from another origin cannot use the bridge.
- Concrete iOS (`WKWebView`) and Android (`WebView`) profiles, including how
  the reference serves bundled files.
- A shared fixture file so conformance does not depend on reading the
  reference source.

### 2.2 Non-Goals

- Prescribing an application framework, screen structure, or package manager.
- A plugin system, code generator, or command-line tool. The reference
  repository contains an OPTIONAL example schema generator; it is not required
  for conformance.
- Mandating one programming language for either side.
- Changing the envelope to carry logging. Logging is local.
- Serving `http` or `https` schemes that WebKit already handles itself on iOS.

## 3. Roles and Conformance

An implementation claims one or more roles:

| Role | Required behavior |
| --- | --- |
| Page | [Section 5](#5-page-client). Pass the page checks in [section 12](#12-conformance-tests). |
| Router | [Section 6](#6-native-router). Pass the native cases and events in [section 12](#12-conformance-tests). |
| iOS profile | Router plus [section 7.1](#71-ios-wkwebview) and [section 8.1](#81-ios-custom-scheme). |
| Android profile | Router plus [section 7.2](#72-android-webview) and [section 8.2](#82-android-asset-loader). |
| Other platform | Router plus a transport whose origin check is documented. Asset serving is OPTIONAL. |

A page that claims to talk to the reference iOS or Android host MUST use the
matching transport in section 7. A native host that claims to talk to the
reference page MUST accept the envelopes that section 5 produces.

## 4. Wire Format

Messages are JSON texts. Every envelope carries `"gawa": 1`. A receiver MUST
ignore a message that is not JSON, not an object, or whose `gawa` value is not
the number `1`.

### 4.1 Request (page to native)

```json
{ "gawa": 1, "id": 7, "method": "kv.get", "params": { "key": "lang" } }
```

- `id` MUST be a JSON number with no fractional part, unique among the page's
  in-flight requests. A numeric string, such as `"7"`, MUST NOT be treated as
  an id. A message whose `id` is not such a number MUST be ignored by the
  router (it produces no reply). The iOS and Android profiles accept integers
  that fit in a signed 32-bit integer. The reference page allocates `1`, `2`,
  `3`, and so on.
- `method` MUST be a string. Dotted names (`kv.get`) are a convention, not a
  protocol rule.
- `params` MAY be any JSON value. When the method takes no parameters the page
  MUST omit the key. The page MUST NOT send `params: null` to mean "no
  parameters".

### 4.2 Hello (Android transport only)

```json
{ "gawa": 1, "hello": true }
```

`hello` MUST be the JSON boolean `true`. The string `"true"` is not a hello.
Hello is not a request and MUST NOT produce a reply. On Android, a message
whose `hello` is boolean `true` is hello even when it also carries `id` or
`method`. The Android host uses the transport channel of the latest hello to
send later events. See [section 7.2](#72-android-webview).

The reference page serializes hello as `{"gawa":1,"hello":true}` (`gawa`
before `hello`, no other keys). Key order is not significant on the wire. The
reference web runner compares that exact text; a page that wants to pass that
runner MUST emit it.

### 4.3 Reply (native to page)

```json
{ "gawa": 1, "id": 7, "result": "ja" }
{ "gawa": 1, "id": 7, "error": { "code": "unknown_method", "message": "unknown method: missing" } }
```

A request produces exactly one reply. The reply MUST contain `gawa` equal to
`1`, the request's `id`, and exactly one of `result` or `error`. It MUST NOT
contain both, and it MUST NOT contain any other key.

`result` MUST be JSON `null` when the handler returns nothing or an explicit
null. The key MUST still be present.

`error` MUST be an object with a string `code`. `message` MUST be a string
when the implementation sends it. The reference page treats a missing `code`
as `"internal"` and a missing `message` as `""`.

Codes defined by gawa:

| code | who emits it | meaning |
| --- | --- | --- |
| `unknown_method` | router | no handler is registered for `method`. `message` MUST be `unknown method: ` followed by the method name. This code is stable: a page detects a missing method by this code, including on a host that does not implement [section 6.5](#65-capability-query). |
| `invalid_params` | router | `params` could not be decoded into the handler's parameter type. The message is implementation-defined. |
| `internal` | router or page | the handler threw something that is not a gawa error, or the page transport failed. The message is implementation-defined unless stated otherwise. |
| `unavailable` | page | no native host is attached. The reference message is `no native host is attached`. |
| `timeout` | page | no reply within the time limit. The message MUST be `{method} #{id}: no reply in {timeout}ms`, with `{id}` in decimal. |
| any other string | router | an application error. `code` and `message` MUST be the ones the handler supplied. |

### 4.4 Event (native to page)

```json
{ "gawa": 1, "event": "back", "data": null }
```

`event` MUST be a string. `data` MUST be present. JSON `null` and a missing
`data` key both mean no payload; the page delivers `null` to listeners. Other
JSON values, including `0` and `false`, MUST be delivered unchanged.

## 5. Page Client

The reference entry points are `createBridge`, `call`, `on`, `GawaError`, and
`PROTOCOL`. Names MAY differ. Behavior in this section MUST NOT.

### 5.1 Host detection

Inspect the global object in this order:

1. iOS, if `webkit.messageHandlers.gawa.postMessage` is a function.
2. Otherwise Android, if `gawa.postMessage` is a function.
3. Otherwise no host.

If both exist, the page MUST select iOS.

Detection happens when the connection is first created for that global. The
reference does not re-detect later, including when the first attempt found no
host. A later `createBridge` on the same global shares that result.
`available` is true only when a host was found. `platform` is `"ios"`,
`"android"`, or null.

### 5.2 Connection

Bridges created on the same global MUST share one connection. On Android, the
page MUST send hello ([section 4.2](#42-hello-android-transport-only)) exactly
once for that connection, when it is first established. It MUST NOT send hello
on iOS.

On iOS the page MUST install `globalThis.__gawa.receive` before events are
expected, and only when it is not already present. The function accepts one
argument, a JSON string or an object, and handles it as
[section 5.5](#55-receiving). The reference installs it for an Android host
too. Android events do not use it; they arrive as `message` events.

On Android the page MUST listen for `message` events on the `gawa` object
(`addEventListener("message", ...)`, or assign `onmessage` when
`addEventListener` is missing). The event's `data` is the envelope.

### 5.3 call

`call(method)` or `call(method, params)`:

1. If no host is attached, reject with `unavailable` and do not send.
2. Allocate the next integer `id`. The reference starts at 1 and increments by
   1. Any positive integer scheme that never reuses an in-flight id is
   conformant.
3. Send a request ([section 4.1](#41-request-page-to-native)). Omit `params`
   when the argument was not provided. Only the first parameter argument is
   sent.
4. If `send` returns a promise, feed its fulfillment to the receiver
   ([section 5.5](#55-receiving)). That is how iOS delivers the reply. If
   `send` returns nothing, the reply arrives later through the receiver
   (Android `message` events).
5. If the reply has `error`, reject with that `code` and `message` (missing
   `code` becomes `internal`, missing `message` becomes `""`).
6. Otherwise resolve with `result`, or `null` when `result` is missing or
   null. A result of `0` or `false` MUST be kept.

A method that returns nothing still resolves to `null`, because the reply's
`result` is JSON `null`.

`timeout` is a number of milliseconds. `0` MUST mean "do not time out". The
default MUST be `0`. When `timeout` is greater than 0 and no reply arrives in
time, the page MUST forget the pending call and reject with `timeout` and the
message in [section 4.3](#43-reply-native-to-page). A late reply for that `id`
MUST be ignored.

If sending throws, or the iOS `postMessage` promise rejects, the page MUST
reject that call with `internal`. The reference message is the thrown
message, or the thrown value's string form when there is no message.

`timeout` belongs to the bridge object that was asked to call. Two bridges
that share a connection MAY use different timeouts. `log` is shared: the
latest function passed to `createBridge` on that global is the one used.

The reference TypeScript `call` MUST be usable in both of these forms:

- `call(method)` when that method takes no parameters, and `call(method, params)`
  when it takes one.
- `call(method, params)` where `method` is a generic key `K extends keyof Methods`
  and `params` is that method's parameter type (which is `undefined` when `K`
  is a method that takes none). A wrapper with that shape MUST NOT need a cast.

### 5.3.1 has

`has(method)` asks whether the host registered `method`. It MUST resolve. It
MUST NOT reject.

- No host is attached: resolve `false`.
- The host answers `gawa.methods` ([section 6.5](#65-capability-query)) with
  an array of strings: resolve `true` when `method` is one of them, otherwise
  `false`.
- The host replies `unknown_method` for `gawa.methods`, the reply is not an
  array of strings, or the query fails (timeout, `internal`, anything else):
  resolve `null`. `null` means the page cannot tell. A page that must support
  an older shell then calls the method and treats `unknown_method` as "not
  registered".

`gawa.methods` is not part of the application's method map. The reference
sends it as a normal request with no `params`.

### 5.4 on

`on(event, listener)` registers `listener` and returns a function that removes
it. When an event envelope arrives, every current listener for that name is
called with the data from [section 4.4](#44-event-native-to-page). A listener
that throws MUST NOT prevent the others from running. The reference rethrows
that error on a later turn.

When the event's data type is `null` or `void`, the reference TypeScript
types MUST accept a listener that takes no argument, such as
`on("files.opened", () => {})`. A listener that takes the `null` value MUST
keep working.

### 5.5 Receiving

Accept a JSON string or an already-decoded object. Ignore malformed JSON,
non-objects, and envelopes whose `gawa` is not `1`.

If `event` is a string, deliver the event. Otherwise, if `id` is a JSON
number, settle the matching pending call. The reference page does not reject
a fractional `id` here; the router is what requires an integer. Ignore
anything else, including a reply whose `id` is a string. A reply for an `id`
that is not pending MUST be ignored.

### 5.6 Logging

`log`, when provided, is a function of one string. Logging MUST NOT change
the envelopes on the wire. The latest `log` passed to `createBridge` on a
shared connection is the one the reference uses. The reference lines are:

- `send ` plus the request JSON text
- `receive ` plus the raw text, or `JSON.stringify` of the value when it was
  not a string. Malformed JSON is ignored and is not logged.
- `timeout ` plus `{method} #{id} {timeout}ms`
- `error #{id} {code}: {message}`, using `internal` and `""` when those fields
  are missing

## 6. Native Router

The router is transport-agnostic. It registers handlers and turns one request
string into one reply string, or into "not a request".

### 6.1 Registration

A handler has a method name, an OPTIONAL parameter type, and a result type.
No parameter and no result are both valid. Decoding and encoding use the
platform's ordinary JSON codec.

When decoding an object, unknown fields SHOULD be ignored. A missing required
field, a JSON `null` parameter for a type that is not null, or any other decode
failure MUST become `invalid_params`.

The handler MAY be asynchronous. It MAY fail with an application error that
carries a `code` and a `message`. Any other failure MUST become `internal`.

Cancellation is platform-specific. Android MUST let `CancellationException`
propagate and MUST NOT turn it into a reply. iOS does not special-case
cancellation: an error that is not a gawa error, including one thrown because
the task was cancelled, becomes `internal`.

`unregister` MUST remove a handler. A later call sees `unknown_method`.

### 6.2 handle

Given a string:

1. If it is not a request ([section 4.1](#41-request-page-to-native)), including
   hello, the wrong version, a non-integer `id`, a missing `method`, or
   malformed JSON, return no reply.
2. Otherwise build the reply from [section 4.3](#43-reply-native-to-page).
3. `params` omitted or JSON `null` both mean "no parameters". A typed
   parameter is then decoded from JSON `null`. A handler registered with no
   parameter type MUST ignore `params`, whether the key is absent, null, or
   some other JSON value.

The reference `unknown_method` message is exactly `unknown method: ` plus the
method name. An application error's `code` and `message` MUST be copied into
the reply unchanged.

### 6.3 Events

The router MUST be able to build an event envelope ([section 4.4](#44-event-native-to-page))
for a name and a JSON value. `null` data is encoded as JSON `null`, not by
omitting `data`.

### 6.4 Logging

A router MAY expose a log function of one string. The reference logs
`receive ` plus the raw body, `ignore ` plus the body when it is not a
request, and `reply ` plus the reply JSON. The default MUST be off.

### 6.5 Capability query

The method name `gawa.methods` is reserved. A conforming router MUST answer
it with a result that is a JSON array of strings: the names currently
registered, in the order they were first registered. Re-registering a name
replaces the handler and MUST NOT add a second entry or move the name.
`unregister` removes the name. The array MUST NOT contain `gawa.methods`.

`register` of `gawa.methods` MUST be ignored. `unregister` of it MUST be a
no-op. Parameters on the query MUST be ignored. The reply is still a normal
success reply ([section 4.3](#43-reply-native-to-page)).

A router that does not implement this query is an older shell. It answers
`unknown_method`. The page treats that as [section 5.3.1](#531-has).

### 6.6 Payload-less emit

`emit(event)` with no data argument MUST send an event whose `data` is JSON
`null`. `emit(event, data)`, including `nil` / `null` encoded as JSON `null`,
MUST keep working.

## 7. Transports

### 7.1 iOS (WKWebView)

The handler name MUST be `gawa`. It MUST be installed with
`WKScriptMessageHandlerWithReply` in the page content world
(`WKContentWorld.page`), before the page is loaded.

The page sends a JSON string to
`webkit.messageHandlers.gawa.postMessage`. The reply is the resolution of that
promise: the reply JSON string. A rejected promise is a transport failure
([section 5.3](#53-call)).

Events are delivered by evaluating JavaScript in the page that calls
`globalThis.__gawa.receive` with the event envelope as a JavaScript string,
and does nothing when `__gawa` is missing. The reference expression is

```text
globalThis.__gawa && globalThis.__gawa.receive((<json>).s)
```

where `<json>` is the JSON text of `{"s": "<envelope>"}` and `<envelope>` is
the event envelope. The `.s` property is the envelope string. A different
expression that passes the same string, and that does not throw into the app
when `__gawa` is missing, is conformant.

#### Origin

The constructor takes an allowlist of origins (`scheme`, `host`, and OPTIONAL
port) and `allowSubframes` (default false).

A message is dispatched only when all of the following hold:

- `allowSubframes` is true, or the message is from the main frame
- `message.body` is a string
- the frame's `WKSecurityOrigin` matches an allowed origin: `protocol` equals
  `scheme`, `host` equals `host`, and `port` equals the allowed port. An
  allowed URL with no port matches origin port `0`.

Otherwise the reply handler MUST be called with no result and the error string
`gawa: message rejected`. The page then sees `internal`.

A string that is not a request MUST complete the reply handler with the error
string `gawa: not a request`.

`emit` MUST do nothing unless the web view's current URL has the same scheme,
host, and port as an allowed origin. A missing port matches only a missing
port. The reference log line for a skipped emit is `emit <name> skipped`.

`attach` MUST install the handler. The web view's user content controller
retains the bridge until `detach`. `detach` MUST remove the handler named
`gawa` from the page content world.

### 7.2 Android (WebView)

The listener name MUST be `gawa`, registered with
`WebViewCompat.addWebMessageListener` before the page is loaded. The third
argument of that API is `allowedOriginRules`. The reference constructor
parameter is `allowedOrigins`, and it is passed through as those rules. The
default origin is `https://appassets.androidplatform.net`.

Only the main frame is handled. A message that is not from the main frame MUST
be ignored. A body that is null MUST be ignored.

Hello ([section 4.2](#42-hello-android-transport-only)) stores the
`JavaScriptReplyProxy` it arrived with. A later hello replaces it. Events MUST
be posted through the stored proxy. `emit` before any hello MUST NOT send and
MUST report that nobody is listening. The reference returns `false` from its
raw emit and logs `emit <name> skipped`.

A request's reply MUST be posted on that request's own `JavaScriptReplyProxy`,
on the main thread. Handlers MAY run on a caller-supplied scope. The reference
default is the main scope.

If `WebViewFeature.WEB_MESSAGE_LISTENER` is not supported, constructing the
bridge MUST fail. The reference throws `IllegalStateException` with the message
`WebView does not support WEB_MESSAGE_LISTENER`.

The page object is removed when the bridge is disposed. Dispose MUST also drop
the event proxy and cancel the handler scope.

## 8. Asset Serving and Origins

Both profiles serve a directory of bundled files so the page's origin is the
origin the bridge allows. `http` and `https` schemes that the platform already
handles MUST NOT be replaced by the iOS custom-scheme handler.

Both profiles:

- An empty path, or a path that ends in `/`, serves `index.html` under the
  root.
- A path that escapes the root MUST NOT be served. The response is 404 with an
  empty body and `text/plain`. How "escapes" is decided differs by profile
  ([section 8.1](#81-ios-custom-scheme), [section 8.2](#82-android-asset-loader)).
- A file that exists is status 200 with the MIME type below.
- `spaFallback` defaults to false. When true, a missing path with no file
  extension is served `index.html` as `text/html`. A missing path that has an
  extension, such as `missing.js`, stays 404. The two profiles do not use the
  same test for "no extension"; each subsection states its own.

MIME types the profiles MUST recognize, case-insensitive:

| extension | type |
| --- | --- |
| `html`, `htm` | `text/html` |
| `js`, `mjs` | `text/javascript` |
| `css` | `text/css` |
| `json`, `map` | `application/json` |
| `wasm` | `application/wasm` |
| `svg` | `image/svg+xml` |
| `woff2` | `font/woff2` |

Anything else SHOULD use the platform MIME map, then `application/octet-stream`.

### 8.1 iOS custom scheme

The reference registers the handler for the scheme `app` and loads
`app://localhost/...`. Another scheme and host are conformant when the loaded
URL and the bridge allowlist are the same origin. WebKit schemes (`http`,
`https`, and the other schemes WebKit handles itself) MUST NOT be used.

The request path is percent-decoded. A missing URL MUST fail the task with a
bad-URL error rather than a 404.

Escape check: after resolving `.` and `..` (and symbolic links, which the
reference resolves while standardizing the path), the file path MUST stay
inside the root. Encoded `%2E%2E` is decoded before that check. The reference
accepts the file only when its standardized path has the root path plus `/`
as a prefix.

`spaFallback` uses the extension of the relative path (`pathExtension`). An
empty extension qualifies. Responses MUST include `Content-Type`,
`Content-Length`, and `Cache-Control: no-cache`. The body is produced when
the task starts; cancellation has nothing to undo.

### 8.2 Android asset loader

The reference serves `assets/www/` at
`https://appassets.androidplatform.net/` through `WebViewAssetLoader`. The
directory name and domain MAY be changed when the bridge's allowed origins use
the same origin. The page URL for `index.html` is
`https://<domain>/index.html`.

The path the handler receives is the request URL's path after the platform
has decoded it. The handler does not percent-decode again. A path segment
that is `.` or `..` MUST be 404. `spaFallback` applies when the last segment
contains no `.`. The extension used for the MIME type is the substring after
the last `.` in the whole relative path.

JavaScript is not enabled by the library. The app MUST enable it itself.

A WebView client that serves these assets SHOULD open a navigation to another
origin in the browser (`ACTION_VIEW`, with `FLAG_ACTIVITY_NEW_TASK` in the
reference) and leave the WebView on the bundled page. If nothing can handle
that intent, the client MUST stay on the page.
The reference class is replaceable: an app MAY intercept the loader from its
own client.

## 9. OPTIONAL Page Mock

An implementation MAY provide a fake host for browser development. The
reference `installMock` does the following, and a mock that claims the same
behavior MUST do the same:

- It is installed before `createBridge` on that global.
- `platform` defaults to `"ios"`. `"android"` uses the Android detection shape
  and therefore causes hello.
- `handlers` maps a method name to a function of the JSON params. The function
  MAY return a promise; the mock MUST wait for it. The return value is
  `result`. `undefined` is sent as `null`. `0` and `false` MUST be kept. A
  thrown gawa error uses its `code` and `message`. Any other throw is
  `internal`. A missing handler is `unknown_method` with message
  `unknown method: ` plus the method name.
- `calls` records `{ method, params }` in order, not including hello.
- On iOS, `postMessage` returns a promise of the reply JSON string (or no
  reply for hello). On Android, a reply is delivered later as a `message`
  event. Hello produces neither a reply nor a recorded call.
- `gawa.methods` is answered with the handler names, in insertion order, and
  is not itself one of those names. A handler registered under that name is
  not called.
- `emit(event, data)` delivers an event envelope. `data` omitted means `null`.
  On iOS this calls `__gawa.receive` after the bridge has installed it. The
  mock MUST NOT install `__gawa` itself.
- `uninstall` removes only the host object the mock installed and restores
  whatever was there before.

## 10. Reference Algorithms

### 10.1 Page sends a call

```text
if no host:
  reject unavailable
id <- allocate
envelope <- { gawa: 1, id, method }
if params were provided:
  envelope.params <- params
sent <- send JSON.stringify(envelope)
arm timeout if timeout > 0
if sent is a promise:
  on fulfillment, receive that value
  on rejection, reject this id with internal
```

### 10.2 Page receives an envelope

```text
parse JSON string or accept object
if parse fails or gawa is not 1:
  ignore
if event is a string:
  deliver data, or null when data is missing or null, to current listeners
  keep 0 and false
else if id is a number and a call with that id is pending:
  if error is present:
    reject code/message
  else:
    resolve result, or null when result is missing or null
    keep 0 and false
```

### 10.3 Router handles a string

```text
parse object
if gawa is not 1 or id is not an integer number or method is not a string:
  return no reply
if method is gawa.methods:
  reply result: registered names, in registration order
else if no handler:
  reply error unknown_method
else:
  decode params (omitted and null both mean no parameters)
  run handler
  on application error: reply that code and message
  on other failure: reply internal
  on success: reply result, using null for nothing
```

## 11. Logging, Types, and What Is Not on the Wire

Logging ([section 5.6](#56-logging), [section 6.4](#64-logging)) MUST NOT add
fields to envelopes.

Sharing a method list across languages is OPTIONAL. The reference keeps an
example list in `schema/example.json` and generates TypeScript, Swift, and
Kotlin from it. A reimplementation MAY use any other way to keep the page's
method map and the native handlers in agreement. Generated types are not part
of the wire protocol.

## 12. Conformance Tests

The normative fixture is `protocol/cases.json` in the reference repository:

<https://github.com/kt3k/gawa/blob/main/protocol/cases.json>

It has three parts.

### 12.1 `native`

Each entry is a request object, or a `raw` string, and an expected `reply`.
`reply: null` means the router returns no reply.

Register these handlers before running the list:

| method | parameters | result |
| --- | --- | --- |
| `kv.get` | object with required string `key` | the string `ja` when `key` is `lang`, otherwise null |
| `kv.set` | object with required strings `key` and `value` | nothing (JSON `null`) |
| `app.version` | none | the string `1.0` |
| `app.fail` | none | application error `nope` / `it failed` |
| `app.boom` | none | a failure that is not an application error (`internal`) |

Feed the request JSON, or `raw`, to the router. Compare structurally:

- When `reply` is null, there MUST be no reply.
- Otherwise every key in the expected reply MUST match.
- When the expected `error` object has no `message`, do not compare `message`.
- Any other extra key is a failure.
- `android: "hello"` means an Android parser MUST classify that body as hello.
  The router still returns no reply. Other platforms only check "no reply".

### 12.2 `events`

For each `{ event, data }`, the event builder MUST produce an envelope with
`gawa` 1, that `event` name, and that `data` (`null` in the fixture is JSON
`null`).

### 12.3 `page`

Using a host that answers the `native` cases:

- With no host, `call` of `unavailableMethod` rejects with `unavailable`.
- With an iOS-shaped host that never replies, `call` of `timeoutMethod` with
  `timeoutMs` rejects with `timeout`.
- Deliver each value in `ignore` to the page receiver (a string as itself, an
  object as JSON). A following `app.version` call MUST still resolve to
  `1.0`.
- For every `native` case that has a `method` and a non-null `reply`, calling
  that method (with `params` only when the request has that key) MUST send
  `gawa` 1, that method, a numeric `id`, and the same params. The call MUST
  then resolve to `result` or reject with the error `code` and, when present,
  `message`.
- On an Android-shaped host, creating two bridges on one global MUST send
  hello once. The reference runner requires the sent text to be exactly
  `{"gawa":1,"hello":true}`.

The reference runs these as:

- Web: `deno test` in `web/` (`protocol_test.ts`)
- iOS: `swift test` (`ProtocolCasesTests`)
- Android: `:gawa:testDebugUnitTest` (`ProtocolCasesTest`)

A reimplementation MUST run the same fixture. It does not have to use these
commands.

## 13. Implementation Checklist

### 13.1 REQUIRED for the role you claim

Page:

- [ ] Detect iOS before Android, or no host.
- [ ] Share one connection per global. Send Android hello once. Do not send it
      on iOS.
- [ ] Omit `params` when the call has no parameter argument.
- [ ] Integer `id`, echoed from the reply. Ignore non-integer ids.
- [ ] `unavailable`, `timeout` with the required message, `internal` on send
      failure.
- [ ] Events deliver `null` for JSON `null` or missing `data`.
- [ ] Ignore the wrong version and malformed JSON.
- [ ] Pass [section 12.3](#123-page).
- [ ] `has(method)` resolves `false`, `true`, or `null` as in
      [section 5.3.1](#531-has), and does not reject.
- [ ] A generic `call` wrapper type-checks without a cast, and a `null` or
      `void` event accepts a listener with no argument
      ([section 5.3](#53-call), [section 5.4](#54-on)).

Router:

- [ ] One reply or no reply, with the keys in [section 4.3](#43-reply-native-to-page).
- [ ] `unknown_method` message matches [section 4.3](#43-reply-native-to-page).
- [ ] `gawa.methods` returns the registered names in registration order
      ([section 6.5](#65-capability-query)).
- [ ] Application error code and message pass through.
- [ ] Decode failure is `invalid_params`. Any other throw is `internal`.
- [ ] Omitted and null params both mean no parameters.
- [ ] Event envelopes include `data`.
- [ ] Pass [section 12.1](#121-native) and [section 12.2](#122-events).

iOS profile, in addition:

- [ ] `gawa` reply handler in the page content world, installed before load.
- [ ] Origin and main-frame checks in [section 7.1](#71-ios-wkwebview).
- [ ] Events through `__gawa.receive`.
- [ ] `emit(event)` sends `data: null` ([section 6.6](#66-payload-less-emit)).
- [ ] `detach` removes the handler.
- [ ] Custom-scheme serving in [section 8.1](#81-ios-custom-scheme), including
      the root escape check.

Android profile, in addition:

- [ ] `addWebMessageListener` named `gawa` before load, main frame only.
- [ ] Hello stores the event proxy. Emit before hello does not send.
- [ ] Replies use the request's reply proxy.
- [ ] `emit(event)` sends `data: null` ([section 6.6](#66-payload-less-emit)).
- [ ] Asset serving in [section 8.2](#82-android-asset-loader), including `.`
      and `..` segments.
- [ ] Fail construction when `WEB_MESSAGE_LISTENER` is missing.

### 13.2 RECOMMENDED

- [ ] `log` callbacks from [section 5.6](#56-logging) and [section 6.4](#64-logging), default off.
- [ ] A browser mock from [section 9](#9-optional-page-mock).
- [ ] `spaFallback` defaulting to false, with the extension rules in
      [section 8](#8-asset-serving-and-origins).
- [ ] Ignore unknown object fields when decoding handler parameters.
- [ ] Open non-origin navigations in the browser on Android.

### 13.3 Not required

- The reference package names, module paths, or the example schema generator.
- A particular logging line beyond the prefixes the reference uses, except
  where a section says the line is part of the reference behavior a caller
  observes (`emit ... skipped`, the timeout message, `unknown method: `).
