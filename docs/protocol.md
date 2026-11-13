# gawa protocol, version 1

Messages are JSON strings. Every envelope carries `"gawa": 1`; messages without
it (or with another version) are ignored by both sides.

## Page → native

### Request

```json
{ "gawa": 1, "id": 7, "method": "kv.get", "params": { "key": "lang" } }
```

- `id`: an integer unique among the page's pending requests.
- `method`: a string. Namespacing with dots (`kv.get`) is a convention.
- `params`: any JSON value; omitted when the method takes none.

### Hello (Android only)

```json
{ "gawa": 1, "hello": true }
```

Sent once when the page creates its first bridge. The app keeps the
`JavaScriptReplyProxy` it arrived with and sends events through it.

## Native → page

### Reply

```json
{ "gawa": 1, "id": 7, "result": "ja" }
{ "gawa": 1, "id": 7, "error": { "code": "unknown_method", "message": "…" } }
```

Exactly one reply per request. `result` is `null` for methods that return
nothing.

Error codes used by gawa itself:

| code             | meaning                                    |
| ---------------- | ------------------------------------------ |
| `unknown_method` | no handler is registered for `method`      |
| `invalid_params` | `params` could not be decoded              |
| `internal`       | the handler threw something unexpected     |
| `unavailable`    | (page side) no native host is attached     |
| `timeout`        | (page side) no reply within the time limit |

Handlers may throw `GawaError(code, message)` with any other code.

### Event

```json
{ "gawa": 1, "event": "back", "data": null }
```

## Transports

|               | iOS (`WKWebView`)                                                                                       | Android (`WebView`)                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| page → native | `webkit.messageHandlers.gawa.postMessage(json)` (`WKScriptMessageHandlerWithReply`, page content world) | `gawa.postMessage(json)` (`WebViewCompat.addWebMessageListener`)               |
| reply         | resolution of that `postMessage()` promise                                                              | `message` event on the `gawa` object, via the request's `JavaScriptReplyProxy` |
| event         | `globalThis.__gawa.receive(json)` via `evaluateJavaScript`                                              | `message` event on the `gawa` object, via the hello's `JavaScriptReplyProxy`   |
| origin check  | `WKScriptMessage.frameInfo.securityOrigin` against an allowlist; main frame only by default             | `allowedOriginRules` of `addWebMessageListener`; main frame only               |

`protocol/cases.json` is the shared check for this document. CI runs it
against the web, iOS, and Android implementations.
