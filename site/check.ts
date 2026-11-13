/**
 * Builds are checked by crawling a local server mounted at BASE_PATH.
 * Root-absolute links must stay under that prefix, and every docs page,
 * asset, and in-page anchor has to resolve.
 */
import { join, resolve } from "node:path";
import { basePath, canonicalUrl, normalizeBase, siteUrl } from "./base.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** Visible text, so highlighted code can be matched across spans. */
function visible(html: string): string {
  return html
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replace(/<[^>]+>/g, "");
}

assert(normalizeBase(undefined) === "/gawa/", "default base");
assert(normalizeBase("") === "/", "empty base");
assert(normalizeBase("/") === "/", "slash base");
assert(normalizeBase("/gawa") === "/gawa/", "base without slash");
assert(normalizeBase("/gawa/") === "/gawa/", "base with slash");
assert(normalizeBase("gawa") === "/gawa/", "bare base segment");

const root = import.meta.dirname;
if (!root) throw new Error("import.meta.dirname is missing");
const dist = resolve(root, "dist");
const base = basePath();
const pkg = JSON.parse(
  await Deno.readTextFile(join(root, "..", "package.json")),
) as {
  version: string;
};
const version = pkg.version;

function contentType(path: string): string {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".xml")) return "application/xml; charset=utf-8";
  if (path.endsWith(".txt")) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

/** Map a request path to a file under dist, or "outside" when it misses the base. */
async function resolveFile(
  pathname: string,
): Promise<string | null | "outside"> {
  const prefix = base === "/" ? "" : base.slice(0, -1);
  let rest: string;
  if (base === "/") rest = pathname;
  else if (pathname === prefix) rest = "/";
  else if (pathname.startsWith(prefix + "/")) {
    rest = pathname.slice(prefix.length);
  } else return "outside";

  let rel: string;
  try {
    rel = decodeURIComponent(rest);
  } catch {
    return null;
  }
  if (rel.includes("\0")) return null;
  if (rel === "" || rel === "/") rel = "/index.html";
  else if (rel.endsWith("/")) rel += "index.html";

  const full = resolve(dist, rel.slice(1));
  if (full !== dist && !full.startsWith(dist + "/")) return null;
  try {
    const stat = await Deno.stat(full);
    if (!stat.isFile) return null;
    return full;
  } catch {
    return null;
  }
}

const server = Deno.serve({
  port: 0,
  hostname: "127.0.0.1",
  onListen() {},
}, async (req) => {
  const url = new URL(req.url);
  const pathname = url.pathname;
  const prefix = base === "/" ? "" : base.slice(0, -1);
  const inSite = base === "/" || pathname === prefix ||
    pathname.startsWith(prefix + "/");
  const last = pathname.split("/").pop() ?? "";
  if (
    inSite && pathname !== prefix && !pathname.endsWith("/") &&
    !last.includes(".")
  ) {
    return Response.redirect(new URL(pathname + "/", url), 302);
  }
  if (prefix !== "" && pathname === prefix) {
    return Response.redirect(new URL(prefix + "/", url), 302);
  }
  const file = await resolveFile(pathname);
  if (file === "outside") {
    return new Response("outside site base\n", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  if (file === null) {
    const body = await Deno.readTextFile(join(dist, "404.html"));
    return new Response(body, {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  return new Response(await Deno.readFile(file), {
    headers: { "content-type": contentType(file) },
  });
});

const failures: string[] = [];
function fail(message: string) {
  failures.push(message);
}

try {
  const addr = server.addr;
  if (!("port" in addr)) throw new Error("expected a TCP listener");
  const origin = `http://127.0.0.1:${addr.port}`;
  const urlFor = (path: string) => origin + siteUrl(base, path);

  const required = [
    "",
    "docs/getting-started/",
    "docs/web/",
    "docs/ios/",
    "docs/android/",
    "docs/spec/",
    "docs/protocol/",
    "docs/why/",
    "docs/releasing/",
    "docs/maintaining/",
    "assets/site.css",
    "assets/site.js",
    "favicon.svg",
    "og.png",
    "sitemap.xml",
    "robots.txt",
    "404.html",
  ].map(urlFor);

  const queue = [...required];
  const seen = new Set<string>();
  const html = new Map<string, string>();
  const anchors: { from: string; page: string; id: string }[] = [];

  while (queue.length > 0) {
    const target = queue.shift()!;
    if (seen.has(target)) continue;
    seen.add(target);
    const response = await fetch(target);
    const type = response.headers.get("content-type") ?? "";
    const body = await response.text();
    if (!response.ok) {
      fail(`${response.status} ${target}`);
      continue;
    }
    if (!type.includes("html")) continue;
    const finalUrl = new URL(response.url);
    finalUrl.hash = "";
    html.set(finalUrl.toString(), body);
    const pageUrl = new URL(target);
    for (const match of body.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
      const href = match[1];
      if (
        href === "" || href.startsWith("mailto:") || href.startsWith("data:")
      ) continue;
      let resolved: URL;
      try {
        resolved = new URL(href, pageUrl);
      } catch {
        fail(`unparseable link ${href} on ${target}`);
        continue;
      }
      if (resolved.origin !== pageUrl.origin) continue;
      const id = decodeURIComponent(resolved.hash.replace(/^#/, ""));
      resolved.hash = "";
      if (id !== "") {
        anchors.push({ from: target, page: resolved.toString(), id });
      }
      if (!seen.has(resolved.toString())) queue.push(resolved.toString());
    }
  }

  for (const { from, page, id } of anchors) {
    const body = html.get(page);
    if (!body) fail(`anchor #${id} on ${page} (from ${from}) was not fetched`);
    else if (!body.includes(`id="${id}"`)) {
      fail(`missing id="${id}" on ${page} (from ${from})`);
    }
  }

  for (const [page, body] of html) {
    if (body.includes("{{version}}") || body.includes("{{tag}}")) {
      fail(`unfilled version token in ${page}`);
    }
    if (body.includes("@kt3k/gawa")) {
      fail(`package import @kt3k/gawa in ${page}`);
    }
    if (base !== "/") {
      const prefix = base.slice(0, -1);
      for (const match of body.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
        const path = match[1];
        if (path !== prefix && !path.startsWith(prefix + "/")) {
          fail(`link outside base path: ${path} on ${page}`);
        }
      }
    }
  }

  const home = visible(html.get(urlFor("")) ?? "");
  const expectHome = [
    "the shell around something",
    "WKURLSchemeHandler",
    "WebViewAssetLoader",
    "app://localhost/",
    "https://appassets.androidplatform.net/",
    "WKScriptMessageHandlerWithReply",
    "addWebMessageListener",
    `npm install github:kt3k/gawa#v${version}`,
    'from "gawa"',
    `https://raw.githubusercontent.com/kt3k/gawa/v${version}/web/mod.ts`,
    `.package(url: "https://github.com/kt3k/gawa", from: "${version}")`,
    `com.github.kt3k:gawa:v${version}`,
    'maven("https://jitpack.io")',
    '.product(name: "Gawa", package: "gawa")',
    "org.jetbrains.kotlin.plugin.serialization",
    "GawaError",
    "https://github.com/kt3k/gawa",
    "https://github.com/kt3k/gawa/blob/main/SPEC.md",
    "Implement gawa according to the following spec:",
    "Make your own",
    "Use the reference implementation",
  ];
  const homeHtml = html.get(urlFor("")) ?? "";
  for (
    const needle of [
      `href="${siteUrl(base, "assets/site.css")}"`,
      `src="${siteUrl(base, "assets/site.js")}"`,
      'id="install"',
      'id="example"',
      `property="og:image" content="${canonicalUrl(base, "og.png")}"`,
      "data-copy",
    ]
  ) {
    if (!homeHtml.includes(needle)) {
      fail(`home page missing ${JSON.stringify(needle)}`);
    }
  }
  for (const needle of expectHome) {
    if (!home.includes(needle)) {
      fail(`home page missing ${JSON.stringify(needle)}`);
    }
  }

  const protocol = html.get(urlFor("docs/protocol/")) ?? "";
  for (
    const needle of [
      "Messages are JSON strings.",
      "not a second spec",
      "https://github.com/kt3k/gawa/blob/main/SPEC.md",
      "unknown_method",
      "invalid_params",
      "unavailable",
      "timeout",
      "JavaScriptReplyProxy",
      "__gawa.receive",
      "allowedOriginRules",
      "docs/protocol.md",
    ]
  ) {
    if (!protocol.includes(needle)) {
      fail(`protocol page missing ${JSON.stringify(needle)}`);
    }
  }

  const spec = html.get(urlFor("docs/spec/")) ?? "";
  for (
    const needle of [
      "SPEC.md",
      "data-copy",
      "Implement gawa according to the following spec:",
      "unknown_method",
      "invalid_params",
      "unavailable",
      "timeout",
      "JavaScriptReplyProxy",
      "__gawa.receive",
      "allowedOriginRules",
      'id="7-transports"',
      'id="42-hello-android-transport-only"',
      'id="12-conformance-tests"',
      "protocol/cases.json",
    ]
  ) {
    if (!spec.includes(needle)) {
      fail(`spec page missing ${JSON.stringify(needle)}`);
    }
  }

  const pages: Record<string, string[]> = {
    "docs/web/": [
      'id="createbridge"',
      "BridgeOptions",
      "no native host is attached",
      "On this page",
      "data-copy",
    ],
    "docs/ios/": [
      'id="gawabridge"',
      "GawaSchemeHandler",
      "spaFallback",
      "allowSubframes",
    ],
    "docs/android/": [
      'id="gawabridge"',
      "WEB_MESSAGE_LISTENER",
      "@Serializable",
      "minSdk 24",
    ],
    "docs/getting-started/": [
      "examples/web/build.sh",
      "xcodegen",
      "connectedDebugAndroidTest",
      "Option 1. Make your own",
      "https://github.com/kt3k/gawa/blob/main/SPEC.md",
    ],
    "docs/why/": [
      "Make your own",
      "reference implementation",
      "SPEC.md",
      "protocol/cases.json",
    ],
    "docs/releasing/": [
      "web/build.sh",
      "package.json",
      "jitpack.yml",
      "pages.yml",
    ],
    "docs/maintaining/": [
      "docs/harness/README.md",
      "CONTRIBUTING.md",
      "scripts/health.ts",
      "private security contact",
    ],
  };
  for (const [path, needles] of Object.entries(pages)) {
    const body = html.get(urlFor(path)) ?? "";
    for (const needle of needles) {
      if (!body.includes(needle)) {
        fail(`${path} missing ${JSON.stringify(needle)}`);
      }
    }
  }

  const css = await (await fetch(urlFor("assets/site.css"))).text();
  if (!css.includes(".hero-kana")) fail("stylesheet is not site.css");

  const robots = await (await fetch(urlFor("robots.txt"))).text();
  const sitemapLoc = canonicalUrl(base, "sitemap.xml");
  if (!robots.includes(sitemapLoc)) fail("robots.txt missing sitemap url");
  const sitemap = await (await fetch(urlFor("sitemap.xml"))).text();
  for (
    const path of [
      "",
      "docs/getting-started/",
      "docs/spec/",
      "docs/protocol/",
      "docs/releasing/",
      "docs/maintaining/",
    ]
  ) {
    if (!sitemap.includes(canonicalUrl(base, path))) {
      fail(`sitemap missing ${canonicalUrl(base, path)}`);
    }
  }

  if (base !== "/") {
    const outside = await fetch(origin + "/");
    const outsideBody = await outside.text();
    if (outside.status !== 404 || !outsideBody.includes("outside site base")) {
      fail(
        `expected the server root to miss the ${base} mount, got ${outside.status}`,
      );
    }
  }

  const missing = await fetch(urlFor("docs/no-such/"));
  const missingBody = await missing.text();
  if (missing.status !== 404 || !missingBody.includes("Page not found")) {
    fail(`expected a site 404, got ${missing.status}`);
  }

  const redirected = await fetch(urlFor("docs/web").replace(/\/$/, ""), {
    redirect: "manual",
  });
  if (redirected.status !== 302) {
    fail(`expected a slash redirect, got ${redirected.status}`);
  }

  if (failures.length > 0) {
    throw new Error(`site check failed:\n${failures.join("\n")}`);
  }
  console.log(`checked ${seen.size} urls under ${base} (v${version})`);
} finally {
  await server.shutdown();
}
