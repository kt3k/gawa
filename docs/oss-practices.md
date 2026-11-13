# How this kind of project should be maintained

Notes gathered on 2026-11-13 for gawa. Each source below was fetched and
exists. This is not a ranking of projects, and it does not claim that the
sources agree on every point.

The practices are turned into working rules in
[harness/README.md](harness/README.md). Gaps that need a maintainer decision
are listed in [harness/backlog.md](harness/backlog.md).

## Sources

| Source | What it was used for |
| --- | --- |
| [Open Source Guides: Best Practices for Maintainers](https://opensource.guide/best-practices/) | Write the process down, keep a public record, say no to work outside the scope, require tests, automate the repetitive checks. |
| [Open Source Guides: Maintaining Balance](https://opensource.guide/maintaining-balance-for-open-source-maintainers/) | Maintainer time is limited. Boundaries, rest, and not saying yes to every request are part of keeping a project alive. |
| [Open Source Guides: Security Best Practices](https://opensource.guide/security-best-practices-for-your-project/) | A `SECURITY.md` should say how to report a vulnerability in private. Dependency updates and least privilege reduce risk. |
| [Open Source Guides: Your Code of Conduct](https://opensource.guide/code-of-conduct/) | A code of conduct only helps if someone will enforce it. |
| [OpenSSF Scorecard checks](https://github.com/ossf/scorecard/blob/main/docs/checks.md) and [beginner checks](https://github.com/ossf/scorecard/blob/main/docs/beginner-checks.md) | CI tests, a dependency-update tool, a security policy, token permissions, known vulnerabilities, and branch protection are the checks with the largest stated payoff. |
| [OpenSSF Best Practices Badge criteria](https://www.bestpractices.dev/en/criteria) | Passing level: a public license, unique versions, human release notes (not a raw `git log`), a documented bug tracker, a published vulnerability-report process, an automated test suite, and tests added with new functionality. |
| [CHAOSS Project Viability Starter](https://www.chaoss.community/kb/metrics-model-project-viability-starter/) and the [practitioner guide](https://www.chaoss.community/practitioner-guide-viability/) | Look at license, dependency freshness (libyears), whether change requests are closed, and whether the project depends on one person. Thresholds are not universal. |
| [Semantic Versioning 2.0.0](https://semver.org/) | Declare a public API. After 1.0.0, incompatible changes increment major, deprecations increment minor, and a deprecated API is removed only in a later major. `0.y.z` may change at any time. A released version is never edited. |
| [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) | `CHANGELOG.md` is for humans. Group Added, Changed, Deprecated, Removed, Fixed, and Security. Keep an Unreleased section. Do not dump `git log`. Dates are `YYYY-MM-DD`. |
| [GitHub community profiles](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/about-community-profiles-for-public-repositories) | The checklist looks for community health files such as README, CODE_OF_CONDUCT, LICENSE, and CONTRIBUTING, plus a security policy and issue templates under `.github/ISSUE_TEMPLATE` with `name` and `about`. |
| [GitHub default community health files](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/creating-a-default-community-health-file) | Supported files include CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, SUPPORT, and issue templates. |
| [OpenAI, Harness engineering](https://openai.com/index/harness-engineering/) (2026-02-11) | `AGENTS.md` should be a map, not a manual. Repository docs are the system of record. Encode rules so a later agent can check them. Pay down small bits of drift often. The post also describes merging with very few gates; that part is for a high-throughput internal product, and the post says it would be irresponsible in a low-throughput setting. |

## What the sources agree on

- Write the scope, the contribution process, and the release notes where a newcomer can find them. Out-of-date docs should be fixed or marked outdated.
- Keep decisions in the public record. A private chat that changes the protocol is invisible to the next contributor.
- Say no to work that does not fit the project, and close it instead of leaving it open out of politeness. Thank the person.
- Require an automated test for a behavior change, and make that test runnable by someone who is not the maintainer.
- Treat the public API as declared. gawa's declaration is [SPEC.md](../SPEC.md) plus the typed surfaces in `web/mod.ts`, the iOS `Gawa` module, and the Android `io.github.kt3k.gawa` package.
- Incompatible changes are expensive. SemVer's own FAQ says to deprecate in a minor release and remove only in a later major, once the project is at 1.0.0 or later.
- Release notes name the changes a user would notice. A vulnerability fix that already has a CVE is called out.
- Publish how to report a vulnerability, including a private path. Do not ask people to paste exploit details into a public issue.
- Keep dependencies from going stale, and do not leave a known medium-or-higher vulnerability unfixed for months. The Badge passing bar cited above is 60 days.
- A project that only one person can ship is fragile. CHAOSS calls this the contributor absence factor. The response is documentation and automation, not pretending there is a large team.
- Maintainer attention is the scarce resource. Automate the checks. Do not expand the scope to fill the queue.

## What gawa already does

- MIT license at `LICENSE`. README, docs site, and `SPEC.md` say what the software is and how to obtain the reference packages.
- Version `0.1.0` is shared by `package.json` and the Android default. Tags `vX.Y.Z` are what Deno, Swift Package Manager, and JitPack install. `scripts/check-versions.ts` refuses a tag that does not match.
- `CHANGELOG.md` exists. The release workflow turns one version section into the GitHub Release notes. It is not a `git log`.
- CI on every push to `main` and every pull request runs the web tests, the protocol fixtures, the generated-type diff, and the iOS and Android builds. The commands are in [harness/verify.md](harness/verify.md).
- `protocol/cases.json` is the shared behavior check for the page and the router.

## What this repository does not copy

The OpenAI article's repository merges with very few blocking gates because agent throughput there is high and a correction is cheap. gawa is a protocol library at `0.1.0` with one maintainer and three platforms. A wrong merge changes what shipped apps already call. The harness keeps the existing CI gates.

The article's useful part for gawa is the shape of the agent environment: a short `AGENTS.md`, docs that are the source of truth, checks a machine can run, and a log of small improvements. That is what `docs/harness/` is.
