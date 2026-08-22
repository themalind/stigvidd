---
name: attribute-failure
description: Decide whether a failure — a red test, a build error, a broken web build, a service that will not start — was caused by the current change, was already there, or is an artifact of this machine. Use BEFORE debugging any red signal in this repo, and whenever tempted to call something "pre-existing" or "a platform thing".
---

# Is this mine, pre-existing, or just this box?

Answer this **first**. The two expensive mistakes are debugging a pre-existing failure as if
you caused it, and waving away a real regression as environmental. Both are avoidable
mechanically, and in this repo there is a third category — the failure that is real on one
OS and absent on another — which makes the usual two-way question a three-way one.

## Step 0 — the tree was probably already dirty

A session here commonly starts with uncommitted work from a previous one. `session-start.mjs`
reports the count on arrival for exactly this reason. Before anything else:

```sh
git status --porcelain
git diff                # is the change under suspicion even yours?
git log -1 --stat
```

## Step 1 — the failures that are BY DESIGN

Two red signals in this repo are expected and are not bugs:

- **`OpenApiContractTests` failed and `web/openapi.json` is now modified.** That is the
  contract test rewriting the snapshot after an API change. Regenerate the client and
  re-run — see [openapi-contract-snapshot](../../../docs/notes/openapi-contract-snapshot.md).
- **Jenkins: "the generated API client is stale".** Someone changed the API surface without
  running `npm run generate:api`. Nothing about the pipeline is broken.

## Step 2 — the failures that are CONFIGURATION, not code

Check these before reading any application code, because each produces a wall of output that
looks like a code failure:

| symptom | cause |
| --- | --- |
| every integration test fails at host startup, `InvalidOperationException` about configuration | `ConnectionStrings__StigVidd` not set — [note](../../../docs/notes/dotnet-test-connection-string.md) |
| geometry tests fail on SQLite extension load | the distro's spatialite module is not installed — [note](../../../docs/notes/spatialite-per-os.md) |
| `MSB1003` / "no project or solution" | run from `backend/`, not the repo root |
| `dotnet ef`: "No project was found" | missing `--project Infrastructure` |
| `NETSDK1004`, assets file not found | a fresh worktree; `dotnet restore` |
| `codegraph` knows nothing about the tree | a fresh worktree has no `.codegraph/` — [note](../../../docs/notes/git-worktree-repo-root.md) |
| `Could not locate the repository root` | the `.git`-is-a-file worktree case — same note |
| the whole generated client shows a diff after `generate:api` | line endings, on a Windows checkout — [note](../../../docs/notes/line-endings-and-generated-files.md) |
| npm resolution oddities in `web/` | Node below 22; npm only prints `EBADENGINE` and continues |

## Step 3 — is it pre-existing? Ask git, not your memory

```sh
git stash push --include-untracked
# re-run the same command
git stash pop
```

If it still fails with your work stashed, it is not yours. Where a stash is awkward
(a migration mid-scaffold, node_modules state), compare against the merge base instead:

```sh
git worktree add ../stigvidd-baseline $(git merge-base HEAD origin/develop)
# run the same command there, then: git worktree remove ../stigvidd-baseline
```

A second worktree is cheap and it answers the question without disturbing the tree you are
working in. Remember it needs its own `dotnet restore` / `npm ci`, and that its
`.codegraph/` will be absent.

## Step 4 — is it this OS?

This repo is developed on Windows, Gentoo and Debian 13, and it has real per-platform code:
`IntegrationTests.csproj` splits its SQLite packages on `$(OS)`, and `SqliteProvider.cs` and
`WebApplicationFactory.cs` have `#if !WINDOWS` blocks. So "it passes on my machine" is a
weaker claim here than usual.

Before concluding "platform issue", say **which** platform difference:

- a native library (spatialite) present on one box and not another;
- line endings, which change file content on a Windows checkout;
- path separators or case sensitivity — `Web/` and `web/` are the same directory on Windows
  and NTFS, and different on Linux;
- a `.cmd` shim that cannot be spawned without a shell.

If you cannot name the mechanism, it is not yet a platform issue — it is an unexplained
failure. And if it *is* one, that is a note worth writing
([write-a-note](../write-a-note/SKILL.md)), because the next session on the other OS will
hit it from the opposite direction.

## Step 5 — say which it was

When reporting, state the attribution explicitly: "pre-existing on develop", "introduced by
this change", "Debian-only, caused by X". "Some tests were already failing" is not an
attribution, and it is how a real regression gets shipped.
