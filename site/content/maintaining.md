# Maintaining

gawa stays small on purpose.
[SPEC.md](https://github.com/kt3k/gawa/blob/main/SPEC.md) is the behavior. The
packages are a reference implementation. Changes should keep existing callers
working.

The maintenance manual for people and for coding agents is in the repository,
not copied onto this site:

- [CONTRIBUTING.md](https://github.com/kt3k/gawa/blob/main/CONTRIBUTING.md) —
  how to send a fix
- [docs/harness/](https://github.com/kt3k/gawa/blob/main/docs/harness/README.md)
  — the improvement loop, the checks, and the limits
- [docs/oss-practices.md](https://github.com/kt3k/gawa/blob/main/docs/oss-practices.md)
  — the sources those rules come from

Local check:

```sh
deno run -A scripts/health.ts
```

iOS and Android still run in GitHub Actions. Releasing is a separate, human
step. See [Releasing](/docs/releasing/).

## Security

This repository does not yet publish a private security contact. Do not put
vulnerability details in a public issue.
[CONTRIBUTING.md](https://github.com/kt3k/gawa/blob/main/CONTRIBUTING.md#security)
says how to ask where to send a report.
