# The rules that keep a hook working on Windows, Gentoo and Debian at once

`.claude/hooks/` is the only code here that runs against no test, produces no artifact, and
**fails closed to exit 0 by design** — a broken hook must never wedge a session. Every one
of its failure modes is therefore silent, and a hook that has quietly stopped guarding
anything looks exactly like one that is working. These are the rules, and each exists
because breaking it fails *open*.

## 1. Node, not Python

`python3` is the command name on Linux and is usually absent on Windows (`python`, or the
`py -3` launcher), and Python is not a prerequisite of this repo at all. `node` is one name
on all three platforms and Node 24 is already required by `web/` and `app/`. Hooks are
`.mjs`, zero-dependency.

## 2. Exec form in settings.json, never shell form

```json
{ "type": "command", "command": "node",
  "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/session-start.mjs"] }
```

Claude Code expands `${CLAUDE_PROJECT_DIR}` itself, into both `command` and `args`, before
any shell sees it. Shell form would need `$VAR` on bash and `$env:`/`%VAR%` on Windows —
and Claude Code falls back to **PowerShell when Git Bash is not installed** — so one
shell-form string cannot be right everywhere. Exec form has no shell and no quoting.
`scripts/check-hooks.mjs` fails the build on a shell-form entry.

## 3. Never spawn a `.cmd`/`.bat` shim, and never through a shell

On Windows, exec form needs a real executable. The `npm`, `npx` and `eslint` entries in
`node_modules/.bin` are **shims, not executables**, and cannot be spawned without a shell.
So `check-lint.mjs` runs `node node_modules/eslint/bin/eslint.js`. `run()` in `lib.mjs` is
deliberately `shell: false` for the same reason. `dotnet`, `git` and `node` are real
binaries and are fine.

## 4. Normalise paths before matching, and case-fold deliberately

The Edit tool on Windows sends `web\src\api\generated\x.ts`. A guard matching only
`web/src/api/generated/` lets it straight through. `relKey()` folds `\` to `/` *before*
resolving, which also lets the self-tests exercise the Windows shape from Linux CI.

Two distinct kinds of case-folding, and confusing them is a live fail-open:

- `fold()` is for **filesystem** semantics and is a no-op off win32.
- A comparison against a **fixed repo path** (`backend/Infrastructure/Migrations`) is a
  string question, not a filesystem one, and must lowercase unconditionally. Using `fold()`
  there left every mixed-case pattern in `guard-generated-files.mjs` dead on Linux. Its own
  self-test caught it, which is why every deny case asserts both separator shapes.

`path.resolve` is also not root-agnostic: on Linux it cannot parse `C:\w\repo` as a root,
so `check-dotnet-build.mjs` attributes compiler output to a file by **suffix** match
instead of resolving both sides.

## 5. Command matching has to know three shells

The Bash tool uses Git Bash on Windows, so bash forms are primary — but a guard that only
understands `X=1 cmd` sees `$env:X="1"; npx expo start` and `set X=1 && dotnet test` as one
opaque string with no recognisable command at its head. `commandsIn()` strips prefix runs
in all three vocabularies (inline assignments, `env`, `timeout`, `nice`, `stdbuf`, `npx`,
`set`, `$env:`) and steps into `$( )` and backticks. Spurious positions only make a guard
look harder; a missed one makes it fail open.

## 6. Everything gets a `--self-test`, and the gate runs them

```sh
node scripts/check-hooks.mjs
```

runs every hook's self-test, asserts that every registration resolves to a file **and**
that every file is registered somewhere, and checks `docs/notes/INDEX.md` against the
files. It is wired into GitHub CI (ubuntu and windows) and the Jenkinsfile Preflight.
A note cannot fail a build; a gate can.

A self-test that has never denied anything is not evidence, so each guard's cases include
the negatives — the ordinary paths and commands it must stay silent on. A guard that fires
on normal work gets switched off within the hour, which is a worse outcome than not having
written it.

## The exit-code contract

| | |
| --- | --- |
| exit 0, no output | silence, the normal case |
| exit 0 + `hookSpecificOutput.permissionDecision: "deny"` | PreToolUse blocks, with a reason |
| exit 2 | stderr goes in front of Claude in the same turn; PostToolUse does not block |
| SessionStart | cannot block; injects via `hookSpecificOutput.additionalContext` |
| Stop | can block; must respect `stop_hook_active` or it loops |

Related: [[git-worktree-repo-root]], [[line-endings-and-generated-files]].
