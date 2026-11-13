/** Published project site. configure-pages reports the path as `/gawa`. */
export const ORIGIN = "https://kt3k.github.io";
export const GITHUB = "https://github.com/kt3k/gawa";

/**
 * Prefix for every root-relative URL.
 * `undefined` (env unset) defaults to `/gawa/`. `""` and `/` mean the domain root.
 * `"/gawa"` and `"/gawa/"` both become `"/gawa/"`.
 */
export function normalizeBase(raw: string | undefined): string {
  const value = (raw ?? "/gawa/").trim();
  if (value === "" || value === "/" || value === ".") return "/";
  let path = value;
  if (!path.startsWith("/")) path = `/${path}`;
  if (!path.endsWith("/")) path = `${path}/`;
  return path;
}

export function basePath(): string {
  return normalizeBase(Deno.env.get("BASE_PATH"));
}

/** `path` is "" for the home page, or `"docs/web/"` (no leading slash). */
export function siteUrl(base: string, path: string): string {
  const rel = path.replace(/^\/+/, "");
  if (base === "/") return rel === "" ? "/" : `/${rel}`;
  return rel === "" ? base : `${base}${rel}`;
}

export function canonicalUrl(base: string, path: string): string {
  return ORIGIN + siteUrl(base, path);
}

/** Prefix root-relative href/src in an HTML fragment. Absolute URLs stay put. */
export function prefixRoot(html: string, base: string): string {
  if (base === "/") return html;
  const root = base.slice(0, -1);
  return html.replace(/(href|src)="\//g, `$1="${root}/`);
}
