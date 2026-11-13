/**
 * Local half of gawa's CI: web tests, generated-file drift, and the site.
 * iOS and Android are printed, not run. They need macOS or an Android SDK
 * and already run in .github/workflows/ci.yml.
 *
 *   deno run -A scripts/health.ts
 */
const root = new URL("..", import.meta.url).pathname;
Deno.chdir(root);
const deno = Deno.execPath();
const denoDir = deno.slice(0, deno.lastIndexOf("/"));
Deno.env.set("PATH", `${denoDir}:${Deno.env.get("PATH") ?? ""}`);

const required = [
  "SPEC.md",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "CHANGELOG.md",
  "protocol/cases.json",
  "docs/harness/README.md",
  "docs/harness/principles.md",
  "docs/harness/verify.md",
  "docs/oss-practices.md",
];

const failures: string[] = [];

function note(title: string) {
  console.log(`\n## ${title}`);
}

async function run(
  title: string,
  args: string[],
  cwd = Deno.cwd(),
): Promise<void> {
  note(title);
  console.log(`$ ${args.join(" ")}`);
  const proc = new Deno.Command(args[0], {
    args: args.slice(1),
    cwd,
    stdout: "inherit",
    stderr: "inherit",
  });
  const status = await proc.output();
  if (!status.success) failures.push(title);
}

note("files");
for (const rel of required) {
  try {
    await Deno.stat(rel);
    console.log(`ok ${rel}`);
  } catch {
    console.log(`missing ${rel}`);
    failures.push(`missing ${rel}`);
  }
}

try {
  const cases = JSON.parse(await Deno.readTextFile("protocol/cases.json"));
  for (const key of ["native", "events", "page"]) {
    if (!(key in cases)) failures.push(`protocol/cases.json missing ${key}`);
  }
  console.log("ok protocol/cases.json");
} catch (error) {
  console.log(error);
  failures.push("protocol/cases.json");
}

await run("web fmt", [deno, "fmt", "--check"], `${root}/web`);
await run("web lint", [deno, "lint"], `${root}/web`);
await run("web check", [deno, "check", "mod.ts"], `${root}/web`);
await run("web test", [deno, "test"], `${root}/web`);
await run("web/dist drift", ["bash", "web/build.sh"]);
await run("web/dist diff", ["git", "diff", "--exit-code", "--", "web/dist"]);
await run("versions", [deno, "run", "-A", "scripts/check-versions.ts"]);
await run("schema generate", [deno, "run", "-A", "schema/generate.ts"]);
await run("schema diff", [
  "git",
  "diff",
  "--exit-code",
  "--",
  "examples/web/src/methods.ts",
  "examples/ios/Sources/ExampleTypes.swift",
  "examples/android/src/main/kotlin/io/github/kt3k/gawa/example/ExampleTypes.kt",
]);
await run(
  "example page",
  ["bash", "-lc", `${JSON.stringify(deno)} check src/main.ts && ./build.sh`],
  `${root}/examples/web`,
);
await run("site fmt", [deno, "fmt", "--check"], `${root}/site`);
await run("site lint", [deno, "lint"], `${root}/site`);
await run("site check", [deno, "task", "check"], `${root}/site`);

note("not run here");
console.log("iOS: swift test, and the iOS builds in .github/workflows/ci.yml");
console.log("Android: ./gradlew test and emulator tasks in android/");
console.log("Those jobs run on GitHub Actions for main and for pull requests.");

if (failures.length > 0) {
  console.error(
    `\nhealth failed:\n${failures.map((item) => `- ${item}`).join("\n")}`,
  );
  Deno.exit(1);
}
console.log("\nhealth ok");
