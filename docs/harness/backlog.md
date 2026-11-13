# Backlog

Maintenance the sources recommend and this repository does not have yet.
An item moves to [log.md](log.md) when it is done. Items marked **ask**
need a fact only the maintainer knows. Do not invent it.

## Ask the maintainer

- **Security contact.** [OpenSSF Best Practices](https://www.bestpractices.dev/en/criteria)
  (vulnerability report process) and the
  [Open Source Guide on security](https://opensource.guide/security-best-practices-for-your-project/)
  both want a published private way to report a vulnerability. `SECURITY.md`
  should name that path. No email or other contact is recorded in this
  repository for that purpose. The license names the copyright holder and
  does not make that person a security inbox.
- **Code of conduct contact.** GitHub's community profile looks for
  `CODE_OF_CONDUCT.md`. Adopting one requires an enforcement contact. See
  [boundaries.md](boundaries.md).
- **Whether to enable private vulnerability reporting** on the GitHub
  repository (a setting, not a file). It still needs a person who reads the
  reports.
- **Response expectations.** The maintainer guides suggest writing down how
  much time the project gets. Do not invent a number of hours or a reply
  deadline.
- **Labels** such as `good first issue`. Creating labels is a repository
  setting. The issue templates do not set labels, so they do not depend on
  labels that are not there.
- **Branch protection** that requires the CI checks before a merge to
  `main`. [Scorecard's beginner guide](https://github.com/ossf/scorecard/blob/main/docs/beginner-checks.md)
  recommends this. It is a GitHub setting.
- **Signed releases.** Scorecard checks for them. Not required for a useful
  gawa release. Decide only if a consumer asks.
- **Dependency bots beyond GitHub Actions.** Dependabot is enabled for
  Actions only. npm, Gradle, and Swift Package Manager updates are left off
  until the maintainer wants the noise. The reference packages themselves
  are installed from git tags, not from a floating registry range.

## Safe to do later, without a new fact

- Declare least-privilege `permissions` on the CI workflow tokens.
  `release.yml` already sets `contents: write`. The other workflows should
  be read against Scorecard's Token-Permissions check before they are
  tightened, so a job that uploads Pages is not broken.
- Add a `## Unreleased` note whenever a user-visible change lands. The
  heading exists. The `0.1.0` section has no date; leave it.
- Keep `protocol/cases.json` covering every new error code or envelope rule.
- Watch dependency age (CHAOSS libyears) once a dependency bot exists for
  more than Actions. There is no scanner in CI today.
- Static analysis beyond `deno lint` is a Badge suggestion, not a current
  gap that blocks use. Swift and Kotlin already build with warnings visible
  in CI.
