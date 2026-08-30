# `git diff --exit-code -- <path>` exits 0 when the path matches NOTHING, so the staleness gate fails open

The generated-client gate is

```sh
cd web && npm run generate:api && git diff --exit-code -- src/api/generated
```

The pathspec is **relative to the current directory**, and `git diff` does not complain about
a pathspec that matches nothing — it simply has no changes to report and exits 0. So running
the repo-root spelling from inside `web/` passes unconditionally:

```
$ cd web
$ git diff --exit-code -- web/src/api/generated ; echo $?   # no such path from here
0                                                           # <- PASS, and meaningless
$ git diff --exit-code -- src/api/generated ; echo $?        # the real check
1                                                           # <- 88 files actually differ
$ git diff --exit-code -- totally/made/up/path ; echo $?
0
```

Measured in this repo. The failure mode is the bad one: it **fails open**. A typo, a wrong
`cd`, or copying the path form out of CLAUDE.md's table (which writes it repo-relative in
prose elsewhere) turns the gate into a no-op that reports success. Nothing warns you, because
from git's point of view nothing is wrong.

This bit for real: a session regenerated the client, ran the gate from the wrong directory,
saw exit 0 and reported "no change to the generated client". All 88 files had changed.

## How to not be fooled

Either match the cwd to the pathspec, or make the check independent of both. The strongest
form is to assert the generator is **idempotent** rather than to diff against HEAD — that
also works in a dirty tree, where a HEAD diff cannot tell "regenerated" from "not yet
committed":

```sh
cd web
cp -r src/api/generated /tmp/gen-snap
npm run generate:api
diff -rq /tmp/gen-snap src/api/generated   # silence = the client is in step
```

Note the HEAD-diff form is the right one for **CI**, where the tree is clean and the question
really is "was the regenerated client committed". It is the wrong one locally mid-change.

The same trap applies to any `--exit-code`/`--quiet` git check pinned to a path:
`git diff --exit-code -- backend/Infrastructure/Migrations` and friends.

Related: [[openapi-contract-snapshot]], [[git-worktree-repo-root]].
