# Human boundaries

Stop and ask the maintainer when the next step is one of these. Record the
question in [log.md](log.md). Do not fill the gap with a guess.

## Breaking changes

Anything an existing page, iOS caller, or Android caller would have to edit
is a breaking change, including a renamed method, a removed field, a tighter
origin check, or a new required message. SemVer would allow it at `0.y.z`.
This repository does not. Propose it. Do not ship it.

## Releases and publishing

Do not push a tag, create a GitHub Release, or publish to npm. The release
workflow uses the built-in `GITHUB_TOKEN` for the GitHub Release and the
`NPM_TOKEN` secret for npm. Do not read, print, or invent either value.

## Security

Do not open a public issue or pull request that contains a vulnerability
detail, a proof of concept, or a credential. Do not write a `SECURITY.md`
that names an email address, a Slack channel, or a person unless the
maintainer has given that contact. The absence of a contact is recorded in
[backlog.md](backlog.md).

If you find a leaked credential already in the repository, do not copy it
into the log. Say which file and that a person must rotate it.

## Conduct, support, and funding

Do not add `CODE_OF_CONDUCT.md`, `SUPPORT.md`, or `FUNDING.yml` until the
maintainer chooses the text and the contact. A code of conduct with no one
to enforce it is worse than none, which is the point of the
[Open Source Guide on codes of conduct](https://opensource.guide/code-of-conduct/).

## External posts

Do not post to X, Zenn, blogs, npm discussions, or other sites. Documentation
in this repository and the docs site is the public record.

## Scope

Do not add a plugin system, a CLI, a new platform, or a dependency that the
spec does not need. A new platform is a new implementation of `SPEC.md`, not
a feature of this repository, unless the maintainer asks for the reference
to grow one.

## Permissions and branch rules

Do not change GitHub branch protection, repository secrets, or who has
write access. Those are account settings, not files.
