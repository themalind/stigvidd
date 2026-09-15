# `reuse lint` says "not compliant" on an indexed checkout, and licensing is not the reason

[CLAUDE.md](../../CLAUDE.md) points at the container form of `reuse lint` precisely because it
runs "over the whole working tree including uncommitted files". On a checkout that CodeGraph
has indexed, that is exactly what makes it fail — for a reason that has nothing to do with
licences:

```
reuse.report - ERROR - Could not read '.codegraph/daemon.sock'
OSError: .codegraph/daemon.sock is not a file

# SUMMARY
* Bad licenses: 0
* Missing licenses: 0
* Files with copyright information: 1314 / 1314
* Files with license information: 1314 / 1314

Unfortunately, your project is not compliant with version 3.3 of the REUSE Specification :-(
```

Every licensing counter is perfect and the verdict is still a failure, because `reuse` treats a
**read error** as non-compliance. `.codegraph/daemon.sock` is a unix socket, not a file, so it
cannot be read by anything — and it exists whenever the CodeGraph daemon is running for this
checkout.

## Why this is a false red specifically here

`.codegraph/` is gitignored (`.gitignore:54`) and per-checkout, so **CI never sees it**: the
GitHub `licensing` job checks out fresh, the socket does not exist there, and the job is green
while the local run says the project is not compliant. The failure is a property of the
developer's machine, not of the tree.

That inverts the usual reason to prefer the container form. It is still the right command —
it is the same image CI runs, and it does cover uncommitted files, which is the whole point
when you have just added one. It simply cannot be read by its exit code or its final line on
an indexed checkout.

**Read the counters, not the verdict.** CLAUDE.md already says the check is
`Missing licenses: 0` rather than a count; the sharper version is that
`Read errors: 0` is the only other line that matters, and a non-zero one naming a path under
`.codegraph/` is noise.

## Getting a trustworthy answer anyway

Lint a copy containing exactly what a fresh CI checkout would contain — tracked files plus
untracked-but-not-ignored ones, which is precisely the set that needs an SPDX header or a
`REUSE.toml` entry:

```sh
DEST=$(mktemp -d)
{ git ls-files; git ls-files --others --exclude-standard; } | sort -u \
  | tar -cf - -T - | tar -xf - -C "$DEST"
docker run --rm --volume "$DEST:/data" \
  -e GIT_CONFIG_COUNT=1 -e GIT_CONFIG_KEY_0=safe.directory -e GIT_CONFIG_VALUE_0=/data \
  fsfe/reuse:5 lint
```

Measured: the same tree that reported *not compliant* in place reported
`Read errors: 0`, `1315 / 1315`, *compliant* through this copy. `--exclude-standard` is what
does the work — it applies `.gitignore`, so `.codegraph/` and every other local artefact drop
out while a genuinely new, uncommitted source file stays in and is still checked.

Do not reach for `reuse lint --skip-existing` or an exclusion flag instead: those change what
is being checked, and the thing you want is the unmodified CI check on a clean set of inputs.

Related: [[licence-is-per-area-not-repo-wide]] for what the lint is actually asserting, and the
CodeGraph section of [CLAUDE.md](../../CLAUDE.md) for why `.codegraph/` is per-checkout in the
first place.
