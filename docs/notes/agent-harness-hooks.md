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

## 5b. The guards match a command shape, not a project — and a rule's two halves can come from two different commands

`guard-long-running.mjs`'s `NEVER_RETURNS` keys on the head of the command
(`/^dotnet\s+run\b/` → "the API host"), which is deliberate: matching by *project* would
mean resolving `--project`, `-p`, a bare path, a solution filter and the cwd, and getting any
of that wrong fails **open** on a real dev server. Two consequences, both measured:

**A console project is a false positive.** `backend/MapData` is an ETL tool that imports and
exits, but `dotnet run --project MapData` is denied as "the API host". Do not loosen the pattern.
Run the built binary, which is not a `dotnet run` at all:

```sh
cd backend && dotnet build MapData/MapData.csproj
./MapData/bin/Debug/net10.0/MapData --help
```

That is the better way to check a console tool's exit codes anyway, since `dotnet run`
returns its own exit status and can mask the tool's.

**A two-part matcher can be satisfied by two DIFFERENT commands on the same line.** This
section said something simpler and wrong for a while — that any Bash string *containing* a
guarded literal is denied, so a heredoc documenting one is blocked. Measured, it is not:

| command | |
| --- | --- |
| `echo "run dotnet test in backend/"` | allowed |
| `ls; echo "dotnet test"` | allowed |
| `cat > n.md <<EOF` / `run dotnet test here` / `EOF` | allowed |
| `git commit -m "document dotnet test"` | allowed |
| `ls; echo "docker compose up"` | allowed |

All of them pass, because `invokes()` and `NEVER_RETURNS` match on the **head** of a
`commandsIn()` position, and prose inside an `echo` or a heredoc body is never at a head.
Quoting a guarded command is fine.

What actually bites is narrower and order-dependent. `commandsIn()`'s position 0 is the
**whole string**, and the docker rule is two conditions against one segment —
`/^docker\s+compose\b/` at the head *and* `\bup\b` anywhere in it. So:

| command | |
| --- | --- |
| `docker compose ps` | allowed |
| `docker compose ps \|\| echo "not up yet"` | **DENIED** — `up` is English prose in an `echo` |
| `docker compose ps -a; echo up` | **DENIED** |
| `echo up; docker compose ps` | allowed — the same two commands, reversed |

The head comes from the real command and the trigger word from an unrelated one later in the
line. Reversing the order fixes it, which is the tell. This is live: it denied a
`docker compose ps … || echo "(compose not up — …)"` written while building
`guard-symbol-search.mjs`, and the first diagnosis — "the guard matched my prose" — was wrong
in a way that cost a wrong turn. It applies to every rule with a second condition beyond the
head: the docker `up` and `logs -f` rules, and the jest `--watch` rule.

Workarounds, both of which still hold: split the line so the guarded command is not at the
head of position 0, write file content with a non-Bash tool (the Write tool), or assemble the
literal from fragments in a script — `const DC = "docker" + " compose"`.

**A heredoc body line IS a command position, because `commandsIn()` splits on newlines.** So
the "prose is safe" rule above has one exception, and it is the one that catches people writing
notes about greps: a line *beginning* with a guarded command inside a heredoc is read as that
command.

| command | |
| --- | --- |
| `cat <<EOF` / `run grep -rn TrailRepository backend/` / `EOF` | allowed — the head is `run` |
| `cat <<EOF` / `grep -rn TrailRepository backend/` / `EOF` | **DENIED** by `guard-symbol-search` |
| `cat <<EOF` / ``run `grep -rn FromLonLat backend/` `` / `EOF` | allowed — see below |

The third row is allowed for a reason specific to that guard rather than to this one: the
backtick leaves ``backend/` `` as the path operand, and its gate 4 finds no declaration under
it. Do not rely on that — and in particular do not generalise it, because for
`guard-long-running.mjs` **the backticks are what causes the deny**.

**Backticks inside a heredoc are command substitution, so inline code in prose is a command
at head position.** This is the trap, because backticks are exactly how you write a command
name in Markdown, in a JSDoc block, or in a TS comment — so documenting a guarded command in
a file you write with a heredoc is denied, while the identical sentence without backticks
passes. Measured against `guard-long-running.mjs`:

| heredoc body line | |
| --- | --- |
| `` * vitest.config.ts sets the env`` | allowed — prose, no command position |
| ``` * `vitest.config.ts` sets the env ``` | **DENIED** — substitution, head is `vitest`, no `run` after it |
| ``` * `docker compose up` brings it up ``` | **DENIED** |
| ``` * `vitest run` is the form that exits ``` | allowed — the substitution is itself an allowed form |
| ``` * `npm test` for the runner ``` | allowed — same |
| `echo "see `` `vitest.config.ts` ``"` (no heredoc) | allowed |

Note the last row: outside a heredoc the same backticks are fine, so this is specifically the
heredoc path. And note the fourth and fifth: whether it denies depends on what is *inside* the
backticks, not on the prose around it — which is why it looks so arbitrary from the outside.

This is live. It denied a `cat > web/src/services/telemetry.test.ts <<'EOF' … EOF` whose body
was a test file with `` `vitest.config.ts` `` in one comment and no `vitest` command anywhere;
the whole call is rejected, so the file is not written and the first symptom is a missing file
rather than a message about prose. **Write file content with the Write tool** — that is the
workaround for both guards, and it is cheaper than finding out which of your comments is a
command.

## 5c. The hook modules cannot be imported

Every hook ends in `process.exit(main())` **at module scope**, so `await import()`-ing one to
reach its exported `decide()` runs `main()` — which reads stdin, gets nothing, and exits,
taking the importer with it. Silently: the probe just produces no output. That is why every
suite is in-file behind `--self-test` and why `scripts/check-hooks.mjs` spawns rather than
imports. To exercise a guard from outside, spawn it with the event on stdin
(`spawnSync(process.execPath, [hook], { input: JSON.stringify(ev) })`).

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
