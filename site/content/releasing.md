# Releasing

Deno, Swift Package Manager, and JitPack install from a git tag. npm can install from that tag too. The release publishes `jsr:@kt3k/gawa`, and publishes to the npm registry when the `NPM_TOKEN` secret is set.

1. Bump the version in `package.json` and the default in `android/gawa/build.gradle.kts` (`findProperty("publishVersion") ?: "…"`). CI checks that those two strings match.
2. Add a `## X.Y.Z` section to `CHANGELOG.md`. Do not put a date on that heading. `scripts/check-versions.ts` matches `## X.Y.Z` exactly.
3. Run `web/build.sh` and commit `web/dist`. CI fails if that directory is stale: the web job runs `web/build.sh && git diff --exit-code -- web/dist`.
4. Merge to `main` and wait until the checks `web`, `ios`, `android`, and `android-e2e` succeed on that commit.
5. On GitHub, open Actions, choose the `release` workflow, and run it on `main`. Leave the version input empty to use `package.json`, or type `X.Y.Z` without a leading `v`. [`.github/workflows/release.yml`](https://github.com/kt3k/gawa/blob/main/.github/workflows/release.yml) refuses any other ref, checks the version against `package.json`, `jsr.json`, and `CHANGELOG.md`, refuses a tag that already exists, then tags `vX.Y.Z`, creates the GitHub Release from that changelog section, and publishes to JSR. Pushing the tag by hand still runs the same publish steps. A tag created by the workflow does not start a second run, so JSR publishes in that same run.

To publish a tag that already exists (for example `v0.1.0`) to JSR without cutting another release, open Actions, choose the `jsr` workflow, and run it on `main`. Leave the version empty to use `package.json`. It refuses to run unless the tag is already there.

`web/build.sh` compiles `web/mod.ts` to `web/dist/mod.js` and `web/dist/mod.d.ts` with `tsc` (`--target es2020`), run via Deno. `package.json` lists those files in `files` and points `exports` at them, which is why `npm install github:kt3k/gawa#vX.Y.Z` works from the tag.

What each consumer reads:

| consumer              | what it uses                                                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm / pnpm / yarn     | the tag, and the committed `web/dist`                                                                                                                                                             |
| Deno                  | `jsr:@kt3k/gawa`, or `https://raw.githubusercontent.com/kt3k/gawa/vX.Y.Z/web/mod.ts`                                                                                                              |
| Swift Package Manager | the tag on `https://github.com/kt3k/gawa`, product `Gawa`                                                                                                                                         |
| JitPack               | the tag. `jitpack.yml` builds with JDK 17 and runs `:gawa:publishReleasePublicationToMavenLocal`, passing `-PpublishGroup` and `-PpublishVersion`. The artifact is `com.github.kt3k:gawa:vX.Y.Z`. |

Install snippets on this site are filled from `package.json`'s `version` when the site is built. [`.github/workflows/pages.yml`](https://github.com/kt3k/gawa/blob/main/.github/workflows/pages.yml) builds `site/` on every push to `main` (and on `workflow_dispatch`) and deploys it to GitHub Pages at <https://kt3k.github.io/gawa/>.
