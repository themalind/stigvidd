---
name: add-a-hook
description: Add or change a Claude Code hook in .claude/hooks/ — a PreToolUse guard, a PostToolUse check, a SessionStart or Stop round. Use BEFORE writing the script, and whenever a hook you added seems not to fire, fires on the wrong events, or passes its own self-test while guarding nothing. Covers the registration points that fail silently, the cross-platform rules, and the exit-code contract.
---

# Adding a hook to this repo

A hook is the only code here that runs against no test, produces no artifact, and **fails
closed to exit 0 by design** — a broken one must never wedge a session. Every failure mode
is therefore silent, and "it looks like it is working" is worth nothing.

Read [agent-harness-hooks](../../../docs/notes/agent-harness-hooks.md) first. This skill is
the procedure; that note is the reasoning, including the specific fail-open bugs that were
found in this harness while building it.

## Step 0 — should it be a hook at all?

A hook earns its place when the knowledge has to arrive **whether or not anyone thought to
look**. If a skill step would do, write the skill step — a hook that fires on ordinary work
gets switched off within the hour, which is worse than not writing it.

Good reasons: the trap is invisible until minutes later (a stale generated client); the
failure names something other than its cause (a missing connection string); the correct
command is not guessable (`dotnet ef --project Infrastructure`).

## Step 1 — the four things that must line up

Getting any one wrong is silent:

1. **The event.** `PreToolUse` to block, `PostToolUse` to report after the fact,
   `SessionStart` to inject orientation, `Stop` to ask something at the end.
2. **The matcher.** A tool-name regex — `Bash`, `Write|Edit|MultiEdit|NotebookEdit`,
   `ExitPlanMode`. A matcher that never matches produces exactly the same output as a hook
   that decides everything is fine: nothing.
3. **The registration**, in [.claude/settings.json](../../settings.json). It must be
   **exec form**:
   ```json
   { "type": "command", "command": "node",
     "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/your-hook.mjs"] }
   ```
   Claude Code expands `${CLAUDE_PROJECT_DIR}` itself, into both fields, before any shell
   sees it. Shell form needs `$VAR` on bash and `$env:`/`%VAR%` on Windows — where Claude
   Code falls back to PowerShell if Git Bash is absent — so it cannot be written once and be
   right on all three platforms. `scripts/check-hooks.mjs` fails the build on shell form.
4. **The input field.** `Write`/`Edit`/`MultiEdit` carry `tool_input.file_path`;
   `NotebookEdit` carries `notebook_path`; `Bash` carries `command`; `ExitPlanMode` carries
   `plan`. Reading the wrong one yields `undefined` and a hook that silently never fires.

## Step 2 — the exit-code contract

| | |
| --- | --- |
| exit 0, no output | silence — the normal case |
| exit 0 + `hookSpecificOutput.permissionDecision: "deny"` + a reason | `PreToolUse` blocks |
| exit 2 | stderr goes in front of Claude in the same turn; `PostToolUse` does not block |
| `SessionStart` | cannot block; injects via `hookSpecificOutput.additionalContext` |
| `Stop` | can block, and **must respect `stop_hook_active`** or it loops |

`lib.mjs` has `deny()`, `speak()` and `inject()` so a hook does not hand-roll these.

**A deny must carry the command that works.** A block with no alternative just costs a turn.

## Step 3 — the cross-platform rules, each of which fails OPEN

- **Node, not Python.** `python3` does not exist on Windows.
- **Never spawn a `.cmd`/`.bat` shim, never through a shell.** `npm`, `npx` and `eslint` in
  `node_modules/.bin` are shims. Run `node node_modules/<pkg>/bin/<x>.js`. `run()` in
  `lib.mjs` is deliberately `shell: false`.
- **Normalise paths before matching.** Use `relKey()`, which folds `\` to `/` before
  resolving. A guard matching only `web/src/api/generated/` lets
  `web\src\api\generated\x.ts` straight through.
- **Case-fold deliberately.** `fold()` is for filesystem semantics and is a **no-op off
  win32**. A comparison against a fixed repo path is a string question and must lowercase
  unconditionally. Using `fold()` for that left half of `guard-generated-files.mjs` dead on
  Linux; its own self-test is what caught it.
- **Command guards must know three shells.** Use `commandsIn()` / `invokes()`, which strip
  bash, cmd and PowerShell prefix runs. `CI=1 npx expo start` has no recognisable command at
  its head to a naive matcher.
- **Fail silent.** Wrap anything that can throw; return 0. Use `os.tmpdir()` for state, and
  `lines()` for newline-agnostic comparison.

## Step 4 — the self-test, and both directions

Every hook takes `--self-test`, and it must assert:

- the **positive** cases — the things it catches;
- the **negative** cases — the ordinary paths and commands it must stay silent on. This half
  is what stops the hook from being switched off;
- the **Windows-shaped** inputs: backslash paths, `$env:` and `set` prefixes. Asserting these
  on Linux is what gives CI any Windows coverage at all.

Use `checker()` from `lib.mjs`. Informational hooks also take `--print`.

Where the hook drives a real tool, keep the parser's fixture **verbatim real output** (see
`check-dotnet-build.mjs`) and put the end-to-end version behind an opt-in flag
(`--with-compiler`, `--with-eslint`) so the gate stays fast and offline.

## Step 5 — the gate

```sh
node scripts/check-hooks.mjs
```

It runs every self-test, asserts every registration resolves to a file **and** every hook
file is registered somewhere, requires exec form, and checks the notes index. Then prove the
gate itself bites — break your hook's self-test on purpose and confirm the gate goes red.

## Step 6 — measure the cost

A hook runs on every matching tool call. Budget: `SessionStart` < 400 ms, `PreToolUse` < 50
ms, `PostToolUse` < 8 s. `check-dotnet-build.mjs` sits at ~1-2 s warm because a C# project
is the smallest compilable unit; that is the ceiling, not a target. If a hook exceeds its
budget, **narrow or downgrade it** rather than keeping something that taxes every edit.

## Step 7 — document it

Add the hook to the table in [CLAUDE.md](../../../CLAUDE.md), and if you learned something
non-obvious making it work, write it down ([write-a-note](../write-a-note/SKILL.md)).
