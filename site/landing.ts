import { GITHUB, siteUrl } from "./base.ts";
import { escapeHtml } from "./html.ts";
import { highlight } from "./markdown.ts";
import { promptBlock, SPEC_URL } from "./prompt.ts";

function blocks(parts: { lang: string; code: string }[]): string {
  return parts.map((part) => highlight(part.code, part.lang)).join("");
}

function tabset(
  name: string,
  label: string,
  items: { id: string; label: string; html: string }[],
): string {
  const buttons = items.map((item, index) => {
    const selected = index === 0;
    const id = `${name}-${item.id}`;
    return `<button type="button" class="tab" role="tab" id="tab-${id}" aria-selected="${selected}" aria-controls="panel-${id}" tabindex="${
      selected ? "0" : "-1"
    }">${escapeHtml(item.label)}</button>`;
  }).join("");
  const panels = items.map((item, index) => {
    const id = `${name}-${item.id}`;
    const hidden = index === 0 ? "" : " hidden";
    return `<div role="tabpanel" id="panel-${id}" aria-labelledby="tab-${id}"${hidden}>${item.html}</div>`;
  }).join("");
  return `<div class="panel" data-tabs>
  <div class="panel-bar">
    <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
    <div class="tab-tools">
      <div class="tablist" role="tablist" aria-label="${
    escapeHtml(label)
  }">${buttons}</div>
      <button type="button" class="copy" data-copy>Copy</button>
    </div>
  </div>
  ${panels}
</div>`;
}

/** Home page body. Install snippets use `version` from package.json. */
export function landing(version: string, base: string): string {
  const started = siteUrl(base, "docs/getting-started/");
  const originDoc = siteUrl(base, "docs/ios/#serving-the-page");
  const callDoc = siteUrl(base, "docs/web/#calls");
  const securityDoc = siteUrl(base, "docs/spec/#7-transports");
  const why = siteUrl(base, "docs/why/");
  const specPage = siteUrl(base, "docs/spec/");
  const tag = `v${version}`;
  const install = tabset("install", "Install", [
    {
      id: "npm",
      label: "npm",
      html: blocks([
        { lang: "sh", code: `npm install github:kt3k/gawa#${tag}\n` },
        { lang: "ts", code: `import { createBridge } from "gawa";\n` },
      ]),
    },
    {
      id: "deno",
      label: "Deno",
      html: blocks([{
        lang: "ts",
        code:
          `import { createBridge } from "https://raw.githubusercontent.com/kt3k/gawa/${tag}/web/mod.ts";\n`,
      }]),
    },
    {
      id: "ios",
      label: "iOS",
      html: blocks([{
        lang: "swift",
        code: `.package(url: "https://github.com/kt3k/gawa", from: "${version}")

// In the app target, depend on the Gawa product.
// The package identity is the repository name.
.product(name: "Gawa", package: "gawa")
`,
      }]),
    },
    {
      id: "android",
      label: "Android",
      html: blocks([{
        lang: "kotlin",
        code: `// settings.gradle.kts
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven("https://jitpack.io")
    }
}
// build.gradle.kts
plugins {
    id("org.jetbrains.kotlin.plugin.serialization")
}
dependencies {
    implementation("com.github.kt3k:gawa:${tag}")
}
`,
      }]),
    },
  ]);

  const example = tabset("example", "Quick example", [
    {
      id: "web",
      label: "Web",
      html: blocks([{
        lang: "ts",
        code: `import { createBridge } from "gawa";

// Describe what your app implements.
type Methods = {
  "kv.get": (p: { key: string }) => string | null;
  "kv.set": (p: { key: string; value: string }) => void;
  "app.version": () => string;
};
type Events = { back: null };

const bridge = createBridge<Methods, Events>();

if (bridge.available) {
  const lang = await bridge.call("kv.get", { key: "lang" }); // string | null
  bridge.on("back", () => {
    // Close this page's own UI.
  });
} else {
  // In a normal browser: fall back to web APIs.
}
`,
      }]),
    },
    {
      id: "ios",
      label: "iOS",
      html: blocks([{
        lang: "swift",
        code: `import Gawa
import WebKit

let config = WKWebViewConfiguration()
let root = Bundle.main.url(forResource: "www", withExtension: nil)!
config.setURLSchemeHandler(GawaSchemeHandler(root: root), forURLScheme: "app")
let webView = WKWebView(frame: .zero, configuration: config)

let bridge = GawaBridge(allowedOrigins: [URL(string: "app://localhost")!])
struct KVGet: Decodable { let key: String }
bridge.router.register("kv.get") { (p: KVGet) -> String? in
    UserDefaults.standard.string(forKey: p.key)
}
bridge.router.register("app.version") { () -> String in "1.0" }
bridge.attach(to: webView)

webView.load(URLRequest(url: URL(string: "app://localhost/index.html")!))

// Later:
try bridge.emit("back", nil as String?)
`,
      }]),
    },
    {
      id: "android",
      label: "Android",
      html: blocks([{
        lang: "kotlin",
        code: `import io.github.kt3k.gawa.*
import kotlinx.serialization.Serializable

@Serializable data class KVGet(val key: String)

val webView = WebView(context)
webView.webViewClient = GawaWebViewClient(GawaAssets.loader(context))

val bridge = GawaBridge(webView) // before loading the page
// prefs is the app's own SharedPreferences.
bridge.router.register<KVGet, String?>("kv.get") { prefs.getString(it.key, null) }
bridge.router.register<Unit, String>("app.version") { "1.0" }

webView.settings.javaScriptEnabled = true
webView.loadUrl(GawaAssets.url())

// Later:
bridge.emit("back", null as String?)
`,
      }]),
    },
  ]);

  return `<div class="wrap home">
  <section class="hero">
    <p class="hero-kana" lang="ja">側</p>
    <div class="hero-grid">
      <div>
        <p class="eyebrow"><span class="pill">v${
    escapeHtml(version)
  }</span> Web · iOS 15+ · Android 24+</p>
        <h1>gawa</h1>
        <p class="lede">the shell around something.</p>
        <p class="hero-copy">A thin, typed bridge between a web page and the native iOS / Android app that hosts it in a WebView. Nothing more: no runtime, no plugin system, no CLI, no opinion about your screens.</p>
        <div class="actions">
          <a class="button" href="${started}">Get started</a>
          <a class="button button-ghost" href="${GITHUB}">View on GitHub</a>
        </div>
      </div>
      <div>
        <ol class="stack" aria-label="Where gawa sits">
          <li><span class="stack-k">Page</span><span><code>call</code> / <code>on</code></span></li>
          <li class="stack-gawa"><span class="stack-k">gawa</span><span>typed RPC and events</span></li>
          <li><span class="stack-k">WebView</span><span>WKWebView or WebView</span></li>
        </ol>
        <p class="side-note">It works in an app you already have — add a WKWebView / WebView anywhere and attach gawa to it.</p>
      </div>
    </div>
  </section>

  <section id="features">
    <h2 class="section-title">What it does</h2>
    <div class="feature-grid">
      <article>
        <p class="num">01</p>
        <h3><a href="${originDoc}">Real-origin asset serving</a></h3>
        <p>Serve bundled files from a real origin instead of <code>file://</code>.</p>
        <ul class="spec">
          <li><span class="spec-k">iOS</span><span class="spec-v"><code>WKURLSchemeHandler</code><span aria-hidden="true">→</span><code>app://localhost/</code></span></li>
          <li><span class="spec-k">Android</span><span class="spec-v"><code>WebViewAssetLoader</code><span aria-hidden="true">→</span><code>https://appassets.androidplatform.net/</code></span></li>
        </ul>
      </article>
      <article>
        <p class="num">02</p>
        <h3><a href="${callDoc}">Typed RPC and events</a></h3>
        <p>Request / reply RPC and events, typed on both ends.</p>
        <ul class="spec">
          <li><span class="spec-k">iOS</span><span class="spec-v"><code>WKScriptMessageHandlerWithReply</code></span></li>
          <li><span class="spec-k">Android</span><span class="spec-v"><code>WebViewCompat.addWebMessageListener</code></span></li>
        </ul>
      </article>
      <article>
        <p class="num">03</p>
        <h3><a href="${securityDoc}">Origin checks</a></h3>
        <p>Only your bundled page can talk to the app.</p>
        <ul class="spec">
          <li><span class="spec-k">iOS</span><span class="spec-v">The message's security origin against an allowlist. Main frame only by default.</span></li>
          <li><span class="spec-k">Android</span><span class="spec-v"><code>allowedOriginRules</code> on the message listener. Main frame only.</span></li>
        </ul>
      </article>
    </div>
  </section>

  <section id="install">
    <h2 class="section-title">Install</h2>
    <p class="section-intro">Build a compatible gawa from the spec, or use the reference packages in this repository.</p>
    <p class="option-kicker">Option 1 · recommended</p>
    <h3 class="option-title">Make your own</h3>
    <p class="section-intro">Tell a coding agent to implement <a href="${SPEC_URL}">SPEC.md</a>. It can target the web page, iOS, Android, or another platform. <a href="${specPage}">The spec page</a> has the same prompt.</p>
    ${promptBlock()}
    <p class="option-kicker">Option 2</p>
    <h3 class="option-title">Use the reference implementation</h3>
    <p class="section-intro">These packages are the implementation in this repository. They install straight from a git tag — no registry needed.</p>
    ${install}
    <p class="caption">The npm package name is <code>gawa</code> (the committed <code>web/dist</code>). Swift Package Manager uses the <code>Gawa</code> product, iOS 15+ / macOS 12+. Android is minSdk 24, built by <a href="https://jitpack.io/#kt3k/gawa">JitPack</a> on first request.</p>
  </section>

  <section id="example">
    <h2 class="section-title">Quick example</h2>
    <p class="section-intro">Describe what the app implements. The same method names are registered on the native side.</p>
    ${example}
    <p class="caption">Calls reject with <code>GawaError</code> (<code>err.code</code>, <code>err.message</code>). In a normal browser, <code>available</code> is false. <a href="${why}">Why gawa, next to Capacitor and others</a>.</p>
  </section>

  <section class="close">
    <p class="pull">Add a WKWebView or WebView anywhere and attach gawa to it.</p>
    <a class="button" href="${started}">Read the docs</a>
  </section>
</div>`;
}
