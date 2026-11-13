# Releasing

Deno, Swift Package Manager, and JitPack install from a git tag. npm can install from that tag too. Pushing the tag also publishes to the npm registry when the `NPM_TOKEN` secret is set.

1. Bump the version in `package.json` and the default in `android/gawa/build.gradle.kts` (`findProperty("publishVersion") ?: "…"`). CI checks that those two strings match.
2. Add a `## X.Y.Z` section to `CHANGELOG.md`.
3. Run `web/build.sh` and commit `web/dist`. CI fails if that directory is stale: the web job runs `web/build.sh && git diff --exit-code -- web/dist`.
4. Tag `vX.Y.Z` and push the tag. [`.github/workflows/release.yml`](https://github.com/kt3k/gawa/blob/main/.github/workflows/release.yml) checks the tag against `package.json` and `CHANGELOG.md`, then creates the GitHub Release from that changelog section.

`web/build.sh` compiles `web/mod.ts` to `web/dist/mod.js` and `web/dist/mod.d.ts` with `tsc` (`--target es2020`), run via Deno. `package.json` lists those files in `files` and points `exports` at them, which is why `npm install github:kt3k/gawa#vX.Y.Z` works from the tag.

What each consumer reads:

| consumer              | what it uses                                                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm / pnpm / yarn     | the tag, and the committed `web/dist`                                                                                                                                                             |
| Deno                  | `https://raw.githubusercontent.com/kt3k/gawa/vX.Y.Z/web/mod.ts`                                                                                                                                   |
| Swift Package Manager | the tag on `https://github.com/kt3k/gawa`, product `Gawa`                                                                                                                                         |
| JitPack               | the tag. `jitpack.yml` builds with JDK 17 and runs `:gawa:publishReleasePublicationToMavenLocal`, passing `-PpublishGroup` and `-PpublishVersion`. The artifact is `com.github.kt3k:gawa:vX.Y.Z`. |

Install snippets on this site are filled from `package.json`'s `version` when the site is built. [`.github/workflows/pages.yml`](https://github.com/kt3k/gawa/blob/main/.github/workflows/pages.yml) builds `site/` on every push to `main` (and on `workflow_dispatch`) and deploys it to GitHub Pages at <https://kt3k.github.io/gawa/>.
