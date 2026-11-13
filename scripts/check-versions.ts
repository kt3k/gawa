/**
 * package.json, the Android default version, and (when a tag is given)
 * CHANGELOG.md all name the same version.
 *
 *   deno run -A scripts/check-versions.ts
 *   deno run -A scripts/check-versions.ts v0.1.0
 */
const root = new URL("..", import.meta.url);
const pkg = JSON.parse(
  await Deno.readTextFile(new URL("package.json", root)),
) as {
  version: string;
};
const gradle = await Deno.readTextFile(
  new URL("android/gawa/build.gradle.kts", root),
);
const match = gradle.match(/publishVersion"\)\?\.toString\(\) \?: "([^"]+)"/);
if (!match) throw new Error("android default version not found");
const android = match[1];
if (pkg.version !== android) {
  throw new Error(`package.json ${pkg.version} != android ${android}`);
}

const tag = Deno.args[0] ?? Deno.env.get("GITHUB_REF_NAME") ?? "";
if (tag.startsWith("v")) {
  const version = tag.slice(1);
  if (version !== pkg.version) {
    throw new Error(`tag ${tag} != package.json ${pkg.version}`);
  }
  const changelog = await Deno.readTextFile(new URL("CHANGELOG.md", root));
  if (!changelog.includes(`## ${version}\n`)) {
    throw new Error(`CHANGELOG.md has no "## ${version}" section`);
  }
}
console.log(`versions match: ${pkg.version}${tag ? ` (${tag})` : ""}`);
