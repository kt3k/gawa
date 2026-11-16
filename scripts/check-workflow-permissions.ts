/**
 * Each GitHub Actions workflow grants read-only permissions above `jobs:`.
 * A write scope belongs on the job that needs it (OpenSSF Scorecard,
 * Token-Permissions).
 *
 *   deno run -A scripts/check-workflow-permissions.ts
 */
const root = new URL("..", import.meta.url);
const dir = new URL(".github/workflows/", root);

const names: string[] = [];
for await (const entry of Deno.readDir(dir)) {
  if (
    entry.isFile &&
    (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml"))
  ) {
    names.push(entry.name);
  }
}
names.sort();
if (names.length === 0) throw new Error("no workflows in .github/workflows");

// Fixtures for the parser. A top-level write fails; a job-level write does not.
for (
  const [text, includes] of [
    ["name: ci\n\npermissions:\n  contents: read\n\njobs:\n  web:\n", null],
    [
      "permissions:\n  contents: read\n  pages: read\n\njobs:\n  build:\n",
      null,
    ],
    [
      "# pages: write stays on the deploy job\npermissions:\n  contents: read\n  # contents: write would be wrong\n\njobs:\n  web:\n    permissions:\n      contents: write\n",
      null,
    ],
    ["permissions:\n  contents: write\n\njobs:\n  release:\n", "grant write"],
    [
      "permissions:\n  pages: write\n  id-token: write\n\njobs:\n  deploy:\n",
      "grant write",
    ],
    ["permissions: write-all\n\njobs:\n  web:\n", "one-line"],
    ["jobs:\n  web:\n", "missing top-level"],
  ] as const
) {
  const got = problemWith(text);
  const ok = includes === null
    ? got === null
    : got !== null && got.includes(includes);
  if (!ok) {
    throw new Error(`sample failed: expected ${includes}, got ${got}`);
  }
}

const failures: string[] = [];
for (const name of names) {
  const text = await Deno.readTextFile(new URL(name, dir));
  const problem = problemWith(text);
  if (problem) {
    console.log(`fail ${name}: ${problem}`);
    failures.push(`${name}: ${problem}`);
  } else {
    console.log(`ok ${name}`);
  }
}

if (failures.length > 0) {
  throw new Error(
    `workflow tokens\n${failures.map((item) => `- ${item}`).join("\n")}`,
  );
}
console.log("workflow tokens are read-only at the top level");

/** A problem description, or null when the top-level token is read-only. */
function problemWith(text: string): string | null {
  const jobs = /^jobs:\s*$/m.exec(text);
  if (!jobs) return "missing a top-level jobs: block";
  const lines = text.slice(0, jobs.index).split("\n");
  const start = lines.findIndex((line) =>
    line === "permissions:" || line.startsWith("permissions:")
  );
  if (start < 0) return "missing top-level permissions";
  if (lines[start] !== "permissions:") {
    return "top-level permissions must be a block, not a one-line grant";
  }

  const declared: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    if (line.startsWith(" ") || line.startsWith("\t")) {
      declared.push(trimmed);
      continue;
    }
    break;
  }

  const write = declared.find((line) =>
    /:\s*write\b/.test(line) || line.includes("write-all")
  );
  if (write) return `top-level permissions grant write (${write})`;
  if (!declared.includes("contents: read")) {
    return "top-level permissions omit contents: read";
  }
  return null;
}
