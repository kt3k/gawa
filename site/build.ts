/**
 * Static site for https://kt3k.github.io/gawa/
 *
 *   cd site
 *   deno task build    # writes site/dist. BASE_PATH defaults to /gawa/
 *   deno task check    # build, then crawl every internal link
 *
 * BASE_PATH comes from actions/configure-pages (`/gawa` or empty). See base.ts.
 */
import { dirname, join } from "node:path";
import { basePath, canonicalUrl, GITHUB, siteUrl } from "./base.ts";
import { docsBody, layout, markCurrent, NAV } from "./html.ts";
import { landing } from "./landing.ts";
import { renderMarkdown } from "./markdown.ts";

const root = import.meta.dirname;
if (!root) throw new Error("import.meta.dirname is missing");
const dist = join(root, "dist");
const repo = join(root, "..");

interface DocPage {
  path: string;
  nav: string;
  title: string;
  description: string;
  /** Path relative to the repo root. */
  file: string;
  /** Substitute {{version}} and {{tag}}. The protocol page stays verbatim. */
  fill: boolean;
  note?: string;
}

const docs: DocPage[] = [
  {
    path: "docs/getting-started/",
    nav: "Getting started",
    title: "Getting started",
    description:
      "Install gawa for the web, iOS, and Android, and run the example apps.",
    file: "site/content/getting-started.md",
    fill: true,
  },
  {
    path: "docs/why/",
    nav: "Why gawa",
    title: "Why gawa",
    description:
      "How gawa differs from Capacitor, Hotwire Native, Tauri, and smaller WebView bridges.",
    file: "site/content/why.md",
    fill: false,
  },
  {
    path: "docs/web/",
    nav: "Web",
    title: "Web",
    description: "createBridge, calls, events, and errors on the page.",
    file: "site/content/web.md",
    fill: true,
  },
  {
    path: "docs/ios/",
    nav: "iOS",
    title: "iOS",
    description: "GawaSchemeHandler, GawaBridge, and GawaRouter for WKWebView.",
    file: "site/content/ios.md",
    fill: true,
  },
  {
    path: "docs/android/",
    nav: "Android",
    title: "Android",
    description: "GawaAssets, GawaBridge, and GawaRouter for Android WebView.",
    file: "site/content/android.md",
    fill: true,
  },
  {
    path: "docs/protocol/",
    nav: "Protocol",
    title: "Protocol",
    description: "JSON envelopes for gawa protocol version 1.",
    file: "docs/protocol.md",
    fill: false,
    note:
      `<p class="source-note">Rendered from <a href="${GITHUB}/blob/main/docs/protocol.md">docs/protocol.md</a>.</p>`,
  },
  {
    path: "docs/releasing/",
    nav: "Releasing",
    title: "Releasing",
    description:
      "Version bump, web/dist, and the git tag npm, Deno, Swift Package Manager, and JitPack consume.",
    file: "site/content/releasing.md",
    fill: true,
  },
];

const navPaths = new Set(NAV.map((item) => item.path));
for (const page of docs) {
  if (!navPaths.has(page.path)) {
    throw new Error(`nav is missing ${page.path}`);
  }
}

function fillVersion(markdown: string, version: string): string {
  return markdown.replaceAll("{{version}}", version).replaceAll(
    "{{tag}}",
    `v${version}`,
  );
}

/** Links to h2 and h3, using the ids the markdown renderer already emitted. */
function tableOfContents(article: string): string {
  const heads = [
    ...article.matchAll(
      /<h([23]) id="([^"]+)"><a class="heading-link" href="[^"]*">([\s\S]*?)<\/a><\/h\1>/g,
    ),
  ];
  if (heads.length < 2) return "";
  const items = heads.map((match) => {
    const text = match[3].replace(/<[^>]+>/g, "");
    return `<li class="toc-l${match[1]}"><a href="#${
      match[2]
    }">${text}</a></li>`;
  }).join("\n");
  return `<nav class="toc" aria-label="On this page"><p class="toc-label">On this page</p><ol>\n${items}\n</ol></nav>`;
}

async function writeFile(path: string, contents: string): Promise<void> {
  await Deno.mkdir(dirname(path), { recursive: true });
  await Deno.writeTextFile(path, contents);
}

const base = basePath();
const pkg = JSON.parse(await Deno.readTextFile(join(repo, "package.json"))) as {
  version?: string;
};
const version = pkg.version ?? "";
if (version === "" || /[\s<>"'{}]/.test(version)) {
  throw new Error(
    `unexpected package.json version: ${JSON.stringify(version)}`,
  );
}

await Deno.remove(dist, { recursive: true }).catch(() => {});
await Deno.mkdir(join(dist, "assets"), { recursive: true });

const homeDescription =
  "A thin, typed bridge between a web page and the native iOS / Android app hosting it in a WebView.";

await writeFile(
  join(dist, "index.html"),
  layout({
    title: "gawa — the shell around a WebView",
    description: homeDescription,
    path: "",
    body: landing(version, base),
    base,
    version,
  }),
);

const locs = [canonicalUrl(base, "")];

for (const page of docs) {
  let markdown = await Deno.readTextFile(join(repo, page.file));
  if (page.fill) markdown = fillVersion(markdown, version);
  if (markdown.includes("{{version}}") || markdown.includes("{{tag}}")) {
    throw new Error(`${page.file} still contains a version token`);
  }
  let article = await renderMarkdown(markdown, base);
  const contents = tableOfContents(article);
  if (page.note) article = article.replace("</h1>", `</h1>\n${page.note}`);
  if (contents) {
    article = page.note
      ? article.replace(page.note, `${page.note}\n${contents}`)
      : article.replace("</h1>", `</h1>\n${contents}`);
  }
  const html = layout({
    title: `${page.title} — gawa`,
    description: page.description,
    path: page.path,
    body: markCurrent(docsBody(base, article), page.path),
    base,
    version,
  });
  await writeFile(join(dist, page.path, "index.html"), html);
  locs.push(canonicalUrl(base, page.path));
}

const notFound = layout({
  title: "Not found — gawa",
  description: "This path is not on the gawa site.",
  path: "404.html",
  body: `<div class="wrap prose not-found">
  <h1>Page not found</h1>
  <p>This path is not on the site.</p>
  <p><a href="${siteUrl(base, "")}">Back to gawa</a></p>
</div>`,
  base,
  version,
});

await writeFile(join(dist, "404.html"), notFound);

await Deno.copyFile(
  join(root, "static/site.css"),
  join(dist, "assets/site.css"),
);
await Deno.copyFile(join(root, "static/site.js"), join(dist, "assets/site.js"));
await Deno.copyFile(
  join(root, "static/favicon.svg"),
  join(dist, "favicon.svg"),
);
await Deno.copyFile(join(root, "static/og.png"), join(dist, "og.png"));

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${locs.map((loc) => `  <url><loc>${loc}</loc></url>`).join("\n")}
</urlset>
`;
await writeFile(join(dist, "sitemap.xml"), sitemap);
await writeFile(
  join(dist, "robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: ${canonicalUrl(base, "sitemap.xml")}\n`,
);

console.log(
  `built ${locs.length} pages at ${dist} (base ${base}, v${version})`,
);
