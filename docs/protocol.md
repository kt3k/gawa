# gawa protocol, version 1

This file is a map. The normative specification is
[SPEC.md](https://github.com/kt3k/gawa/blob/main/SPEC.md). It is not a second spec:
the envelopes, the algorithms, the transports, and the conformance checks live
there so they are not maintained twice.

Messages are JSON strings. Every envelope carries `"gawa": 1`.

SPEC.md defines the request, the Android hello, the reply, and the event.
The error codes `unknown_method`, `invalid_params`, `internal`,
`unavailable`, and `timeout` are defined there, including which side emits
each one. iOS delivers events with `__gawa.receive`. Android delivers
replies and events with `JavaScriptReplyProxy`, and the listener is created
with `allowedOriginRules`.

The shared fixture is
[`protocol/cases.json`](https://github.com/kt3k/gawa/blob/main/protocol/cases.json).
[Section 12 of SPEC.md](https://github.com/kt3k/gawa/blob/main/SPEC.md#12-conformance-tests)
says how to run it against a page and a router.
