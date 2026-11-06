# @kt3k/gawa

Web side of [gawa](https://github.com/kt3k/gawa): a thin, typed bridge between a
web page and the native iOS / Android app hosting it in a WebView.

```ts
import { createBridge } from "@kt3k/gawa";

type Methods = { "app.version": () => string };
const bridge = createBridge<Methods>();
if (bridge.available) console.log(await bridge.call("app.version"));
```
