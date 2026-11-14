# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project treats its public API as compatible across `0.y.z` releases
even though [Semantic Versioning](https://semver.org/spec/v2.0.0.html) would
allow those releases to break. See `docs/harness/principles.md`.

## Unreleased

### Added

- `emit(event)` on iOS and Android sends an event with JSON `null` data. `emit(event, data)`, including `nil as String?` and `null as String?`, is unchanged.
- `bridge.has(method)` reports whether the host registered that method. A current router answers the reserved call `gawa.methods` with the registered names. An older shell, which replies `unknown_method`, makes `has` resolve `null` instead of rejecting. `unknown_method` (message `unknown method: <name>`) stays the stable code for a missing method.
- The web `call` type accepts a generic method key, so a helper `callHost<K extends keyof Methods>(method, params)` does not need a cast. Methods with no parameter are still called with no second argument. A `null` or `void` event listener may omit its argument.

## 0.1.0

- Web SDK, iOS bridge, and Android bridge. Protocol version 1.
- Install from a git tag: npm (`github:kt3k/gawa#v0.1.0`), Deno (raw `web/mod.ts`), Swift Package Manager, and JitPack.
