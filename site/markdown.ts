import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import kotlin from "highlight.js/lib/languages/kotlin";
import swift from "highlight.js/lib/languages/swift";
import typescript from "highlight.js/lib/languages/typescript";
import { Marked, type Renderer, type Tokens } from "marked";
import { prefixRoot } from "./base.ts";

hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("swift", swift);
hljs.registerLanguage("kotlin", kotlin);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("json", json);

const ALIAS: Record<string, string> = {
  ts: "typescript",
  js: "javascript",
  sh: "bash",
  shell: "bash",
  kt: "kotlin",
};

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** Highlight a code sample. `lang` is a fence language (`ts`, `swift`, `kotlin`, `sh`, `json`). */
export function highlight(code: string, lang: string | undefined): string {
  const requested = (lang ?? "").trim().toLowerCase();
  const mapped = ALIAS[requested] ?? requested;
  const source = code.replace(/\n$/, "");
  const safeLang = /^[a-z0-9-]+$/.test(requested) ? requested : "plaintext";
  if (mapped !== "" && hljs.getLanguage(mapped)) {
    const inner = hljs.highlight(source, { language: mapped }).value;
    return `<pre><code class="hljs language-${safeLang}">${inner}</code></pre>\n`;
  }
  return `<pre><code class="hljs language-plaintext">${
    escapeHtml(source)
  }</code></pre>\n`;
}

function uniqueSlug(text: string, used: Map<string, number>): string {
  const base = text
    .replace(/`([^`]*)`/g, "$1")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "section";
  const seen = used.get(base) ?? 0;
  used.set(base, seen + 1);
  return seen === 0 ? base : `${base}-${seen}`;
}

/** Render Markdown to HTML and prefix root-relative links with `base`. */
export async function renderMarkdown(
  md: string,
  base: string,
): Promise<string> {
  // A class instance's methods are non-enumerable, and marked only copies
  // enumerable renderer fields, so these are plain functions.
  const used = new Map<string, number>();
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      heading(this: Renderer, { tokens, depth, text }: Tokens.Heading): string {
        const inner = this.parser.parseInline(tokens);
        const id = uniqueSlug(text, used);
        return `<h${depth} id="${id}"><a class="heading-link" href="#${id}">${inner}</a></h${depth}>\n`;
      },
      code({ text, lang }: Tokens.Code): string {
        return highlight(text, lang);
      },
    },
  });
  let html = await marked.parse(md);
  if (typeof html !== "string") html = String(html);
  html = html.replaceAll("<table>", '<div class="table-wrap"><table>');
  html = html.replaceAll("</table>", "</table></div>");
  return prefixRoot(html, base);
}
