import { canonicalUrl, GITHUB, siteUrl } from "./base.ts";

export interface NavItem {
  /** "" for the home page, or `"docs/web/"`. */
  path: string;
  label: string;
}

export const NAV: NavItem[] = [
  { path: "", label: "Overview" },
  { path: "docs/getting-started/", label: "Getting started" },
  { path: "docs/why/", label: "Why gawa" },
  { path: "docs/web/", label: "Web" },
  { path: "docs/ios/", label: "iOS" },
  { path: "docs/android/", label: "Android" },
  { path: "docs/spec/", label: "Spec" },
  { path: "docs/protocol/", label: "Protocol" },
  { path: "docs/releasing/", label: "Releasing" },
];

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const FONTS =
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;1,400&family=Newsreader:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Outfit:wght@400;500;600&display=swap";
const KANA_FONT =
  "https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@500&text=%E5%81%B4&display=swap";

export function layout(opts: {
  title: string;
  description: string;
  path: string;
  body: string;
  base: string;
  version: string;
}): string {
  const home = siteUrl(opts.base, "");
  const docs = siteUrl(opts.base, "docs/getting-started/");
  const docsCurrent = opts.path.startsWith("docs/");
  const image = canonicalUrl(opts.base, "og.png");
  const script = `\n<script src="${
    siteUrl(opts.base, "assets/site.js")
  }" defer></script>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(opts.title)}</title>
<meta name="description" content="${escapeHtml(opts.description)}">
<link rel="canonical" href="${canonicalUrl(opts.base, opts.path)}">
<meta property="og:title" content="${escapeHtml(opts.title)}">
<meta property="og:description" content="${escapeHtml(opts.description)}">
<meta property="og:url" content="${canonicalUrl(opts.base, opts.path)}">
<meta property="og:type" content="website">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="gawa, the shell around a WebView">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(opts.title)}">
<meta name="twitter:description" content="${escapeHtml(opts.description)}">
<meta name="twitter:image" content="${image}">
<meta name="theme-color" content="#f3efe6" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#171411" media="(prefers-color-scheme: dark)">
<link rel="icon" href="${
    siteUrl(opts.base, "favicon.svg")
  }" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="${KANA_FONT}">
<link rel="stylesheet" href="${siteUrl(opts.base, "assets/site.css")}">
</head>
<body>
<a class="skip" href="#content">Skip to content</a>
<header class="top">
  <div class="wrap top-inner">
    <a class="brand" href="${home}">
      <span class="brand-mark" lang="ja" aria-hidden="true">側</span>
      <span class="brand-name">gawa</span>
    </a>
    <nav class="top-nav" aria-label="Site">
      <a href="${docs}"${docsCurrent ? ' aria-current="page"' : ""}>Docs</a>
      <a href="${GITHUB}">GitHub</a>
    </nav>
  </div>
</header>
<main id="content" tabindex="-1">
${opts.body}
</main>
<footer class="site-footer">
  <div class="wrap footer-inner">
    <p><span class="brand-name">gawa</span> <span class="pill">v${
    escapeHtml(opts.version)
  }</span></p>
    <p>MIT License · <a href="${GITHUB}/blob/main/LICENSE">Yoshiya Hinosawa</a></p>
  </div>
</footer>${script}
</body>
</html>
`;
}

export function docsBody(base: string, article: string): string {
  const nav = NAV.map((item) => {
    return { item, href: siteUrl(base, item.path) };
  });
  // The current page is marked by the caller via a placeholder, replaced below.
  const links = nav.map(({ item, href }) => {
    return `<a data-nav="${item.path}" href="${href}">${item.label}</a>`;
  }).join("\n");
  return `<div class="wrap docs-shell">
<nav class="docs-nav" aria-label="Documentation">
  <p class="nav-label">Documentation</p>
  ${links}
</nav>
<article class="prose">
${article}
</article>
</div>`;
}

/** Mark the sidebar link for `path` as the current page. */
export function markCurrent(html: string, path: string): string {
  return html.replace(
    `data-nav="${path}"`,
    `data-nav="${path}" aria-current="page"`,
  );
}
