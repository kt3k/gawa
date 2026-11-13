/**
 * Print the CHANGELOG.md section for a version.
 *
 *   deno run -A scripts/release-notes.ts 0.1.0
 */
const version = (Deno.args[0] ?? "").replace(/^v/, "");
if (!version) throw new Error("usage: release-notes.ts <version>");
const changelog = await Deno.readTextFile(
  new URL("../CHANGELOG.md", import.meta.url),
);
const header = `## ${version}\n`;
const start = changelog.indexOf(header);
if (start < 0) throw new Error(`CHANGELOG.md has no "## ${version}" section`);
const rest = changelog.slice(start + header.length);
const next = rest.search(/\n## /);
const body = (next < 0 ? rest : rest.slice(0, next)).trim();
console.log(body);
