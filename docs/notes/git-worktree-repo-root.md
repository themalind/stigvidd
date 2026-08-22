# In a linked worktree `.git` is a FILE, and code that tests for a directory walks past it

Work in this repo is normally done in a `git worktree`. In the main checkout `.git` is a
directory; in a **linked worktree it is a regular file** containing a `gitdir:` pointer.
Any repo-root discovery written as "walk up until a directory named `.git` exists" does not
stop at the worktree root. It keeps walking to the filesystem root and then either throws
or, worse, finds an unrelated repository above.

## Where this actually bit

[`OpenApiContractTests.FindRepositoryRoot`](../../backend/Tests/IntegrationTests/OpenApiContract/OpenApiContractTests.cs)
used `Directory.Exists(Path.Combine(directory.FullName, ".git"))`. In a linked worktree
that is false at the real root, the walk ran off the top, and the test threw
`InvalidOperationException: Could not locate the repository root from ...` — so the whole
integration suite was unrunnable in exactly the checkout the work happens in. Fixed by
accepting a file as well as a directory.

The same predicate is the right one everywhere else, including in hooks:
`.claude/hooks/lib.mjs` `repoRoot()` uses `existsSync`, deliberately, for this reason.

## The other worktree surprise: `.codegraph/` is per-checkout

The CodeGraph index lives in `.codegraph/` at the root of a checkout and is not committed.
A freshly created worktree therefore has **no index**, and `codegraph explore` / the
codegraph MCP tool have nothing to read — they do not fail loudly, they simply know
nothing about the tree. `session-start.mjs` reports this on arrival. Either index the
worktree or use grep/Read there.

## Detecting it

```sh
git rev-parse --git-dir          # .git in the main checkout, an absolute path in a worktree
git rev-parse --git-common-dir   # differs from --git-dir exactly when this is linked
```

Related: [[agent-harness-hooks]].
