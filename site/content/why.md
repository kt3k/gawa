# Why gawa

gawa is a small library you attach to a `WKWebView` or Android `WebView` that is already in your app. It serves the bundled page from a real origin, and it gives you typed request/reply calls and events. It does not bring a runtime, a plugin system, or a CLI.

The notes below come from a survey of similar projects in November 2026 ([`docs/comparison.md`](https://github.com/kt3k/gawa/blob/main/docs/comparison.md)). The survey looked at public source. It did not find a project that, at the same time, typed the calls through to plain Swift and Kotlin, used `WKScriptMessageHandlerWithReply` and `addWebMessageListener`, served files from a real origin and checked that origin, and could be added to an existing app. That is a statement about the projects that were reviewed, not a claim that no other design exists.

## Make your own

The recommended way to use gawa is to implement [SPEC.md](https://github.com/kt3k/gawa/blob/main/SPEC.md), not to take a dependency on these packages. The npm, Deno, Swift Package Manager, and JitPack packages are a reference implementation of that spec. A page, an iOS host, an Android host, or another platform can be written again from the spec, and [`protocol/cases.json`](https://github.com/kt3k/gawa/blob/main/protocol/cases.json) checks that it still speaks protocol version 1. The packages stay available for when you want the reference instead.

## What gawa keeps small

- The page API is `createBridge`, `call`, and `on`.
- iOS handlers are `Codable`. Android handlers are `@Serializable`. The page describes the same methods as a TypeScript map.
- iOS serves files with `WKURLSchemeHandler` (`app://localhost/` in the examples). Android serves them with `WebViewAssetLoader` (`https://appassets.androidplatform.net/`).
- Messages from another origin, or from a subframe unless you opt in on iOS, are not dispatched.
- Install is a git tag. There is no gawa CLI.

## Capacitor

[Capacitor](https://github.com/ionic-team/capacitor) is the project whose job overlaps gawa the most. It serves bundled files from a real origin (`capacitor://localhost` on iOS via `WKURLSchemeHandler`, and its own local server on Android). On Android it passes origin rules to `addWebMessageListener` and accepts the main frame only. The iOS side of the survey used the older script-message handler, and a message-time origin check was not found in the sources that were read.

Capacitor plugins are typed as TypeScript interfaces passed to `registerPlugin`. The native side reads values out of a dictionary (`CAPPluginCall`). It also ships a CLI, a plugin system, and its own view controller and activity. gawa does not.

## Hotwire Native

[Hotwire Native](https://github.com/hotwired/hotwire-native-bridge) is component and event oriented. On iOS, `reply(to:with:)` takes an `Encodable`. On Android it uses `addWebMessageListener` and checks the main frame and a trusted origin itself. It assumes a remote, server-rendered app, and it does not serve a bundled file tree. It does not have a per-method type map.

## Tauri

[Tauri](https://github.com/tauri-apps/tauri) v2 on mobile returns a promise from `invoke`. iOS and Android load the page from their own localhost origins. Commands can be gated by capabilities. The core is Rust and the project includes a CLI. Attaching it to an existing app is outside what that design is for.

## Lighter native bridges

[Kamome](https://github.com/HituziANDO/kamome) is the closest small native library in the survey. `KM.send()` returns a promise, and the native side can call back into the page. The native values are dictionaries, and the documented example loads `file://`.

[metabridge](https://github.com/daangn/metabridge) generates TypeScript, Swift, and Kotlin from a JSON Schema. The generated native side is types and method names. It does not connect a WebView; the app supplies the transport. That is closer to a tool you could use beside gawa than a replacement for it.

React Native bridges ([webview-bridge](https://github.com/gronxb/webview-bridge), [safe-webview-bridge](https://www.npmjs.com/package/safe-webview-bridge), [lepont](https://github.com/kt3k/lepont)) share types with a React Native host. They are not for a plain `WKWebView` or Android `WebView`.

Older bridges such as WebViewJavascriptBridge and WKBridge predate `WKScriptMessageHandlerWithReply` and do not check origin.

## What this page is not

It is not a benchmark, and it does not rank projects by popularity. Where the survey could not confirm a behavior, this page says so. The longer notes, including the ones that were left uncertain, are in [`docs/comparison.md`](https://github.com/kt3k/gawa/blob/main/docs/comparison.md).
