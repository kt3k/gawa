# Contributing

gawa is a small bridge. [SPEC.md](SPEC.md) is the behavior. The packages in
this repository are a reference implementation of that spec.

Issues and pull requests are welcome when they fix the reference, clarify the
spec, or add a test the spec already requires. A new product surface (a UI
toolkit, a plugin system, a CLI) is out of scope.

## Before you start

Read [docs/harness/principles.md](docs/harness/principles.md). A change that
breaks an existing caller is not accepted at the current `0.y.z` version
unless the maintainer has agreed to it in the open.

Open an issue before a large pull request. A small doc or test fix can be a
pull request directly.

## Checks

The commands are listed in [docs/harness/verify.md](docs/harness/verify.md).
Locally:

```sh
deno run -A scripts/health.ts
```

That runs the web tests, the protocol fixtures, the generated-file diffs, and
the docs site check. iOS (`swift test`) and Android (`./gradlew` in
`android/`) run in GitHub Actions. Say which of those you could not run.

If you change the wire protocol, update `SPEC.md` and `protocol/cases.json`
in the same pull request.

## Security

This repository does not yet publish a private security contact. Do not put
vulnerability details, exploit steps, or credentials in a public issue or
pull request. Ask the maintainer, in a public issue that does not include
those details, where to send the report. A `SECURITY.md` will replace this
paragraph once a contact exists.
