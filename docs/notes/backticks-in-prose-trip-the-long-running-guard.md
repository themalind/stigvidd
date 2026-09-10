# A markdown backtick reads as shell command substitution, so *documenting* a dev server trips `guard-long-running`

Writing a `docs/notes/` entry through a heredoc was denied by
[`.claude/hooks/guard-long-running.mjs`](../../.claude/hooks/guard-long-running.mjs), with

```
`expo start` is` is the Expo dev server — in the foreground it does not return...
```

Nothing was being run. The file being written merely *described* the command, in ordinary
markdown inline code, in a sentence explaining that it has to be backgrounded.

## Why

[`commandsIn()`](../../.claude/hooks/lib.mjs) splits a Bash command into segments so a guard
can test each one, and it starts a new segment at every shell metacharacter that could
introduce a command:

```js
if (c === "`" || c === "(" || c === "{" || c === "\n") { starts.push(i + 1); continue; }
```

A **backtick is command substitution** in real shell, so this is correct and deliberately
conservative. But the splitter sees one flat string: it has no concept of a heredoc, so the
*body* of `cat > note.md <<'EOF' … EOF` is scanned exactly like code. Prose containing

    …rewrites the file on start — and `npx expo start` is a dev server, so background it.

yields a segment beginning right after the backtick, `npx expo start` is a dev server…`,
whose first three tokens are what the denial then quotes back — which is where the strange
doubled `` is` `` in the message above comes from.

The tell that it is this and not a real detection: the quoted "command" contains **prose**.

## Quoting does not save you the way the self-test suggests

`guard-long-running.mjs`'s own self-test asserts that
`echo 'do not docker compose up here'` is allowed, which reads like "mentions are fine".
It is allowed only because `commandsIn` consumes quoted spans *before* it looks for
metacharacters — a mention inside `'…'` or `"…"` is skipped. A heredoc body is not a quoted
span in that sense (`<<'EOF'` quotes it for **bash**, not for this splitter), so the
protection does not extend to it.

## What to do

Write the file with the **Write tool** instead of a heredoc. That is the fix, not a
workaround: the guard is right that the string it was handed contains something that parses
as a dev-server invocation, and the tool that writes files does not go through a shell at
all.

The same applies to any guarded command name in prose — `dotnet watch`, `npm run dev`,
`docker compose up`, `vitest` without `run` — and to `.claude/` docs, `docs/notes/` entries
and skill files most of all, since those are precisely the files that *have* to name the
commands they warn about. It is silent otherwise: the deny cannot be retried, so a session
that does not recognise the message tends to reword the documentation rather than change how
it is writing it.

Related: [[agent-harness-hooks]].
